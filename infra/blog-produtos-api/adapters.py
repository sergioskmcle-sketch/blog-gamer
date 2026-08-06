"""Ponte READ-ONLY com /opt/afiliados-monitor-v2.

Unico modulo acoplado ao codigo do monitor-telegram. Se a API interna daquele
projeto mudar, muda so aqui.

Regras invioláveis:
  - Nunca escreve em /opt/afiliados-monitor-v2 (config, cookies, state).
  - Nunca importa nada que dispare efeito colateral (post no Telegram, fila).
  - Falha de bootstrap NAO derruba o processo: vira ready=False no /api/health.

Fase 1: apenas bootstrap + status. As funcoes de busca chegam na Fase 2/3.
"""

import logging
import os
import sys
import threading
import time
from pathlib import Path

logger = logging.getLogger("blog-produtos-api.adapters")

MONITOR_ROOT = Path("/opt/afiliados-monitor-v2")
SEARCHER_ROOT = MONITOR_ROOT / "searcher"
SEARCHER_SVC = SEARCHER_ROOT / "services" / "searcher"
CONFIG_PATH = SEARCHER_SVC / "config.yaml"

# monitor_core vive em /opt/afiliados-monitor-v2/searcher/
if str(SEARCHER_ROOT) not in sys.path:
    sys.path.insert(0, str(SEARCHER_ROOT))

_LOCK = threading.Lock()
_STATE = {
    "config": None,
    "ready": {"shopee": False, "mercadolivre": False},
    "errors": {},
    "bootstrapped_at": None,
}


SEARCHER_ENV = SEARCHER_ROOT / ".env"

# Unicas chaves que este servico le do .env do searcher. O arquivo tambem contem
# TELEGRAM_BOT_TOKEN e PANEL_TOKEN — deliberadamente NAO carregados, para nao
# trazer segredo alheio ao escopo do blog para dentro deste processo.
_ENV_KEYS = ("SHOPEE_APP_ID", "SHOPEE_SECRET", "ML_COOKIES_PATH",
             "ML_CLIENT_ID", "ML_CLIENT_SECRET")


def _read_searcher_env():
    """Le seletivamente /opt/afiliados-monitor-v2/searcher/.env (read-only).

    E de la que o searcher-ml.service tira os segredos (via EnvironmentFile);
    no config.yaml esses campos estao vazios.
    """
    valores = {}
    try:
        with open(SEARCHER_ENV, "r", encoding="utf-8") as f:
            for linha in f:
                linha = linha.strip()
                if not linha or linha.startswith("#") or "=" not in linha:
                    continue
                k, v = linha.split("=", 1)
                k = k.strip()
                if k in _ENV_KEYS:
                    valores[k] = v.strip().strip('"').strip("'")
    except Exception as e:
        logger.warning("searcher/.env ilegivel (%s); seguindo so com config.yaml", e)
    return valores


def _load_config():
    """Monta o config em camadas, tudo em modo leitura.

    Precedencia (maior primeiro): variavel de ambiente do proprio servico >
    searcher/.env > config.yaml. Espelha engine.py:load_config(), mas sem tocar
    em vocabulary/blocklist/estado — o blog so precisa dos segredos e do
    caminho dos cookies.
    """
    import os

    import yaml

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}

    do_env = _read_searcher_env()

    for key, env in (
        ("ml_cookies_path", "ML_COOKIES_PATH"),
        ("shopee_app_id", "SHOPEE_APP_ID"),
        ("shopee_secret", "SHOPEE_SECRET"),
        ("ml_client_id", "ML_CLIENT_ID"),
        ("ml_client_secret", "ML_CLIENT_SECRET"),
    ):
        cfg[key] = os.environ.get(env) or do_env.get(env) or cfg.get(key, "")

    return cfg


def _bootstrap_shopee(cfg):
    """configure() do caminho Shopee (API oficial de afiliados, sem cookies)."""
    if not (cfg.get("shopee_app_id") and cfg.get("shopee_secret")):
        raise RuntimeError("shopee_app_id/shopee_secret ausentes no config")

    from monitor_core.scraping.shopee_offers import configure as shopee_configure

    shopee_configure(app_id=cfg["shopee_app_id"], secret=cfg["shopee_secret"])


def _bootstrap_ml(cfg):
    """configure() do caminho ML: busca (offers) + afiliacao (affiliate).

    Os DOIS sao obrigatorios. Sem offers.configure a lista de user-agents fica
    vazia e todo fetch morre com "Cannot choose from an empty sequence" —
    parece bloqueio do ML, mas e bootstrap faltando.
    """
    cookies_path = cfg.get("ml_cookies_path") or ""
    if not cookies_path or not Path(cookies_path).exists():
        raise RuntimeError("ml_cookies_path inexistente: %s" % cookies_path)

    from monitor_core.affiliate import configure as aff_configure
    from monitor_core.scraping.offers import DEFAULT_USER_AGENTS
    from monitor_core.scraping.offers import configure as offers_configure

    offers_configure(
        base_dir=str(SEARCHER_SVC),  # de onde sai o ml_api_token.json
        ml_client_id=cfg.get("ml_client_id"),
        ml_client_secret=cfg.get("ml_client_secret"),
        token_url=cfg.get("ml_token_url"),
    )
    aff_configure(
        config=cfg,
        cookies_path=cookies_path,
        user_agents=DEFAULT_USER_AGENTS,
        ua_fixo=cfg.get("ml_ua_fixo", ""),
        proxy=cfg.get("ml_proxy", ""),
    )


def bootstrap():
    """Configura os modulos do monitor. Idempotente e tolerante a falha parcial.

    Um marketplace quebrado nao impede o outro: cada erro vira ready=False +
    entrada em _STATE['errors'], visivel no /api/health.
    """
    with _LOCK:
        try:
            cfg = _load_config()
            _STATE["config"] = cfg
        except Exception as e:
            logger.error("config ilegivel: %s", e)
            _STATE["errors"]["config"] = str(e)
            return _STATE

        for nome, fn in (("shopee", _bootstrap_shopee), ("mercadolivre", _bootstrap_ml)):
            try:
                fn(cfg)
                _STATE["ready"][nome] = True
                _STATE["errors"].pop(nome, None)
                logger.info("bootstrap %s: OK", nome)
            except Exception as e:
                _STATE["ready"][nome] = False
                _STATE["errors"][nome] = str(e)
                logger.warning("bootstrap %s falhou: %s", nome, e)

        _STATE["bootstrapped_at"] = time.time()
        return _STATE


def _session_age_h(path):
    try:
        return round((time.time() - Path(path).stat().st_mtime) / 3600.0, 1)
    except Exception:
        return None


def status():
    """Payload de marketplaces para o /api/health."""
    cfg = _STATE.get("config") or {}
    ml_cookies = cfg.get("ml_cookies_path") or ""
    return {
        "shopee": {
            "ready": _STATE["ready"]["shopee"],
            # A Shopee autentica por API key (HMAC), nao por sessao: nao expira sozinha.
            "session_age_h": None,
            "error": _STATE["errors"].get("shopee"),
        },
        "mercadolivre": {
            "ready": _STATE["ready"]["mercadolivre"],
            "session_age_h": _session_age_h(ml_cookies) if ml_cookies else None,
            "error": _STATE["errors"].get("mercadolivre"),
        },
    }


def is_ready(marketplace):
    return bool(_STATE["ready"].get(marketplace))


# ---------------------------------------------------------------- rate limit
# Este e o limite que importa: 1 req/s POR MARKETPLACE, protegendo ML e Shopee
# de excesso de chamadas. Nao confundir com o limite de entrada em app.py, que
# e so anti-abuso da porta HTTP.
#
# Roda em thread (as chamadas vem de asyncio.to_thread), por isso threading.Lock
# e time.sleep, e nao asyncio.
MIN_INTERVAL_S = 1.0
_THROTTLE = {}
_THROTTLE_LOCK = threading.Lock()


class RateLimitUpstream(Exception):
    """O marketplace recusou por excesso de chamadas (ex.: Shopee 10030)."""


def _throttle(nome):
    with _THROTTLE_LOCK:
        espera = MIN_INTERVAL_S - (time.time() - _THROTTLE.get(nome, 0.0))
        if espera > 0:
            time.sleep(espera)
        _THROTTLE[nome] = time.time()


# ------------------------------------------------------------------- buscas
def shopee_search(query, limit=5):
    """Busca na Open API de afiliados da Shopee.

    Devolve itens ja no schema do funil (via _map_node), onde 'offer_link' e o
    link de afiliado — a API so lista produtos que ja estao no programa, entao
    NAO existe passo de geracao de link aqui. Chamar generate_short_link de
    novo seria uma requisicao a toa contra o rate limit.
    """
    if not is_ready("shopee"):
        raise RuntimeError("shopee nao configurada: %s" % _STATE["errors"].get("shopee"))

    from monitor_core.scraping.shopee_offers import _map_node
    from monitor_core.shopee_api import ShopeeRateLimitError, search_products

    _throttle("shopee")
    try:
        # Pede folga sobre o limit: parte dos nodes cai no filtro de preco ou
        # no _map_node (item sem preco/id volta None).
        nodes, _ = search_products(keyword=query, page=1,
                                   limit=max(20, min(50, limit * 5)))
    except ShopeeRateLimitError as e:
        raise RateLimitUpstream("shopee: %s" % e)

    itens = []
    for node in nodes or []:
        mapeado = _map_node(node)
        if mapeado:
            itens.append(mapeado)
    logger.info("shopee_search(%r) -> %d itens", query, len(itens))
    return itens


# ------------------------------------------------------- afiliacao por URL
# O ML nao tem busca por keyword utilizavel nesta VM (medido em 05/Ago/2026):
#   - /sites/MLB/search       -> 403, app nao aprovada
#   - /ofertas?search=        -> ignora o termo e devolve o feed generico
#   - lista.mercadolivre.com  -> devolve so o esqueleto da pagina, sem produtos
# Gerar link de afiliado a partir de uma URL, porem, funciona. Dai o desenho
# hibrido: quem descobre o produto do ML e o Google Shopping (no blog), e a VM
# so converte a URL em meli.la.


def _resolver_se_preciso(url):
    """Resolve redirecionador (google.com/shopping, short link) ate a loja."""
    from monitor_core.linkparse import classify, resolve_redirect

    if classify(url) != "unknown":
        return url, False
    final = resolve_redirect(url)
    return final, final != url


def afiliar_url(url):
    """Converte uma URL de produto em link de afiliado.

    Devolve dict sempre — nunca levanta — no formato:
      {url, url_final, marketplace, affiliate_link, ok, error}

    ok=False significa "nao consegui afiliar": quem chama deve usar a URL
    original, nunca fingir que o link e afiliado.
    """
    saida = {"url": url, "url_final": url, "marketplace": "unknown",
             "affiliate_link": "", "ok": False, "error": None}
    try:
        from monitor_core.linkparse import classify

        final, resolveu = _resolver_se_preciso(url)
        saida["url_final"] = final
        mkt = classify(final)
        saida["marketplace"] = {"ml": "mercadolivre"}.get(mkt, mkt)

        if mkt == "ml":
            # TRAVA DE SEGURANCA (06/Ago/2026). A sessao do ML e compartilhada
            # com monitor-bot-ml e searcher-ml, que dependem dela para postar no
            # Telegram. Em 06/Ago a sessao caiu para 401 durante testes deste
            # servico — o modo de falha que docs/CREDENCIAIS.md ja previa ao
            # usar os cookies de um segundo consumidor.
            #
            # Enquanto a causa nao for confirmada, este servico NAO toca no ML.
            # Religar: BLOG_ML_ENABLED=1 no /opt/blog-produtos-api/.env, depois
            # de renovar os cookies com instalar_cookies_ml.sh.
            if os.environ.get("BLOG_ML_ENABLED", "") != "1":
                saida["error"] = ("mercadolivre desativado por seguranca "
                                  "(BLOG_ML_ENABLED != 1)")
                return saida
            if not is_ready("mercadolivre"):
                saida["error"] = "mercadolivre nao configurado"
                return saida
            from monitor_core.affiliate import generate_affiliate_link

            _throttle("mercadolivre")
            r = generate_affiliate_link(final)
            # Contrato do modulo: em caso de falha devolve a PROPRIA url.
            # Sucesso e, e so e, conter 'meli.la'.
            if r and "meli.la" in r:
                saida["affiliate_link"] = r
                saida["ok"] = True
            else:
                saida["error"] = "ml recusou gerar o link (sessao/breaker)"

        elif mkt == "shopee":
            if not is_ready("shopee"):
                saida["error"] = "shopee nao configurada"
                return saida
            from monitor_core.shopee_api import (ShopeeRateLimitError,
                                                 generate_short_link)

            _throttle("shopee")
            try:
                curto = generate_short_link(final, sub_ids=["blog"])
            except ShopeeRateLimitError as e:
                raise RateLimitUpstream("shopee: %s" % e)
            if curto:
                saida["affiliate_link"] = curto
                saida["ok"] = True
            else:
                saida["error"] = "shopee nao devolveu short link"
        else:
            saida["error"] = "url nao e de mercadolivre nem shopee"

    except RateLimitUpstream:
        raise
    except Exception as e:
        saida["error"] = str(e)
    return saida
