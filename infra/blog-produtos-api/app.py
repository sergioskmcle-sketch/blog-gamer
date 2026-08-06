"""blog-produtos-api — fonte de produtos com link de afiliado (Shopee + ML).

Serve o pipeline do blog-gamer (GitHub Actions). Roda como servico separado na
VM monitor-telegram: NUNCA edita nem reinicia monitor-bot-ml/searcher-ml.

Fase 2: busca real na Shopee (individual e em lote), com cache de 30 min. O
Mercado Livre e o pareamento cruzado chegam na Fase 3.
"""

import asyncio
import hmac
import logging
import os
import time

from aiohttp import web

import adapters
import busca

VERSION = "1.1.0-fase2"
PORT = int(os.environ.get("BLOG_API_PORT", "8086"))
API_KEY = os.environ.get("BLOG_API_KEY", "")

CACHE_TTL_S = 1800

# Limite de ENTRADA: existe so como anti-abuso da porta HTTP. Deve ser folgado —
# um job do blog dispara poucas chamadas, e resposta cacheada ou erro 400 nao
# custa nada a montante.
#
# O limite que realmente importa (1 req/s por marketplace, protegendo ML e
# Shopee) NAO mora aqui: vai em busca.py, em volta das chamadas de saida, na
# Fase 2/3. Trocar os dois de lugar faz o servico se estrangular sozinho sem
# proteger ninguem.
RATE_PER_S = 5.0
RATE_BURST = 20

MARKETPLACES = ("shopee", "mercadolivre")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("blog-produtos-api")

STARTED_AT = time.time()
_CACHE = {}
_BUCKET = {"tokens": float(RATE_BURST), "ts": time.time()}


def erro(status, code, message, **extra):
    payload = {"ok": False, "error": {"code": code, "message": message}}
    return web.json_response(payload, status=status, headers=extra.get("headers"))


def _take_token():
    """Token bucket global: RATE_PER_S sustentado, RATE_BURST de pico."""
    agora = time.time()
    _BUCKET["tokens"] = min(
        float(RATE_BURST), _BUCKET["tokens"] + (agora - _BUCKET["ts"]) * RATE_PER_S
    )
    _BUCKET["ts"] = agora
    if _BUCKET["tokens"] >= 1.0:
        _BUCKET["tokens"] -= 1.0
        return True, 0
    faltam = (1.0 - _BUCKET["tokens"]) / RATE_PER_S
    return False, max(1, int(faltam + 0.999))


def cache_get(chave):
    item = _CACHE.get(chave)
    if not item:
        return None
    if time.time() - item["ts"] > CACHE_TTL_S:
        _CACHE.pop(chave, None)
        return None
    return item["valor"]


def cache_put(chave, valor):
    _CACHE[chave] = {"ts": time.time(), "valor": valor}


@web.middleware
async def middleware_auth(request, handler):
    """API key + rate limit. /api/health fica de fora para diagnostico externo."""
    if request.path == "/api/health":
        return await handler(request)

    if not API_KEY:
        logger.error("BLOG_API_KEY nao configurada — recusando tudo")
        return erro(500, "internal_error", "servico sem chave configurada")

    enviado = request.headers.get("X-API-Key", "")
    if not hmac.compare_digest(enviado, API_KEY):
        logger.warning("401 de %s em %s", request.remote, request.path)
        return erro(401, "unauthorized", "X-API-Key ausente ou invalida")

    ok, retry_after = _take_token()
    if not ok:
        return web.json_response(
            {"ok": False, "error": {"code": "rate_limited",
                                    "message": "limite de requisicoes excedido"}},
            status=429,
            headers={"Retry-After": str(retry_after)},
        )

    try:
        return await handler(request)
    except web.HTTPException:
        raise
    except Exception as e:
        logger.exception("erro nao tratado em %s", request.path)
        return erro(500, "internal_error", str(e))


async def _body(request):
    try:
        return await request.json()
    except Exception:
        return None


def _valida_busca(body):
    """Valida o contrato de /api/produtos/buscar. Devolve (params, erro_msg)."""
    if not isinstance(body, dict):
        return None, "corpo deve ser um objeto JSON"

    query = body.get("query")
    if not isinstance(query, str) or not (3 <= len(query.strip()) <= 120):
        return None, "query obrigatoria, entre 3 e 120 caracteres"

    limit = body.get("limit", 5)
    if not isinstance(limit, int) or not (1 <= limit <= 10):
        return None, "limit deve ser inteiro entre 1 e 10"

    mkts = body.get("marketplaces", list(MARKETPLACES))
    if not isinstance(mkts, list) or not mkts:
        return None, "marketplaces deve ser lista nao vazia"
    desconhecidos = [m for m in mkts if m not in MARKETPLACES]
    if desconhecidos:
        return None, "marketplaces invalidos: %s" % ", ".join(map(str, desconhecidos))

    for campo in ("min_price", "max_price"):
        v = body.get(campo)
        if v is not None and (not isinstance(v, (int, float)) or v < 0):
            return None, "%s deve ser numero >= 0" % campo

    return {
        "query": query.strip(),
        "limit": limit,
        "marketplaces": mkts,
        "min_price": body.get("min_price"),
        "max_price": body.get("max_price"),
    }, None


async def handle_health(request):
    return web.json_response({
        "ok": True,
        "version": VERSION,
        "uptime_s": int(time.time() - STARTED_AT),
        "marketplaces": adapters.status(),
    })


def _chave_cache(p):
    return (p["query"].lower(), p["limit"], tuple(sorted(p["marketplaces"])),
            p["min_price"], p["max_price"])


async def _executar(params):
    """Roda a busca com cache. Devolve (payload, status)."""
    chave = _chave_cache(params)
    em_cache = cache_get(chave)
    if em_cache is not None:
        return {"ok": True, "query": params["query"], "cached": True, "took_ms": 0,
                "produtos": em_cache["produtos"],
                "warnings": em_cache["warnings"]}, 200

    inicio = time.monotonic()
    try:
        produtos, warnings = await asyncio.to_thread(
            busca.buscar,
            params["query"], params["limit"], tuple(params["marketplaces"]),
            params["min_price"], params["max_price"],
        )
    except adapters.RateLimitUpstream as e:
        logger.warning("upstream rate limited: %s", e)
        return {"ok": False, "error": {"code": "rate_limited", "message": str(e)}}, 429

    took = int((time.monotonic() - inicio) * 1000)
    cache_put(chave, {"produtos": produtos, "warnings": warnings})
    logger.info("buscar(%r) -> %d produtos em %dms %s",
                params["query"], len(produtos), took, warnings or "")
    return {"ok": True, "query": params["query"], "cached": False, "took_ms": took,
            "produtos": produtos, "warnings": warnings}, 200


async def handle_buscar(request):
    body = await _body(request)
    params, msg = _valida_busca(body)
    if msg:
        return erro(400, "bad_request", msg)

    payload, status = await _executar(params)
    if status == 429:
        return web.json_response(payload, status=429, headers={"Retry-After": "30"})
    return web.json_response(payload, status=status)


async def handle_buscar_lote(request):
    body = await _body(request)
    if not isinstance(body, dict):
        return erro(400, "bad_request", "corpo deve ser um objeto JSON")

    queries = body.get("queries")
    if not isinstance(queries, list) or not (1 <= len(queries) <= 5):
        return erro(400, "bad_request", "queries deve ser lista de 1 a 5 itens")

    limit = body.get("limit_por_query", 3)
    if not isinstance(limit, int) or not (1 <= limit <= 10):
        return erro(400, "bad_request", "limit_por_query deve ser inteiro entre 1 e 10")

    mkts = body.get("marketplaces", list(MARKETPLACES))
    validadas = []
    for q in queries:
        params, msg = _valida_busca({"query": q, "limit": limit, "marketplaces": mkts})
        if msg:
            return erro(400, "bad_request", "query invalida (%r): %s" % (q, msg))
        validadas.append(params)

    # Sequencial de proposito: o throttle de 1 req/s por marketplace vive em
    # adapters, e disparar as queries em paralelo so as faria enfileirar la —
    # com o custo extra de segurar varias threads.
    resultados = []
    for params in validadas:
        payload, status = await _executar(params)
        if status == 429:
            # Rate limit a montante interrompe o lote: devolver o que ja veio
            # seria pior, porque o blog nao saberia que a lista veio truncada.
            return web.json_response(payload, status=429, headers={"Retry-After": "30"})
        resultados.append({"query": params["query"],
                           "produtos": payload["produtos"],
                           "cached": payload["cached"],
                           "warnings": payload["warnings"]})

    return web.json_response({"ok": True, "resultados": resultados})


def criar_app():
    adapters.bootstrap()
    app = web.Application(middlewares=[middleware_auth])
    app.router.add_get("/api/health", handle_health)
    app.router.add_post("/api/produtos/buscar", handle_buscar)
    app.router.add_post("/api/produtos/buscar-lote", handle_buscar_lote)
    return app


if __name__ == "__main__":
    logger.info("blog-produtos-api %s subindo na porta %s", VERSION, PORT)
    web.run_app(criar_app(), host="0.0.0.0", port=PORT, access_log=None)
