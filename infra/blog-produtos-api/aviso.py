"""Aviso ao dono, por mensagem direta no Telegram.

>>> REGRA CRITICA: SO ENVIA. NUNCA CHAMA getUpdates. <<<

O Telegram entrega cada atualizacao UMA UNICA VEZ por token. Se este servico
chamar getUpdates com o mesmo token do bot da Frente 1, ele ROUBA as mensagens
que o bot deveria receber e quebra a deteccao de produto no grupo — em silencio,
sem erro nenhum no log.

sendMessage nao tem esse problema: varios processos podem enviar com o mesmo
token sem interferir entre si.

Se um dia for preciso RECEBER algo, crie um bot separado no BotFather. Nunca
escute com este token.
"""

import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger("blog-produtos-api.aviso")

API = "https://api.telegram.org/bot%s/sendMessage"

# Intervalo minimo entre avisos, para o blog nunca virar spam no seu privado.
INTERVALO_MIN_S = 3600
_ultimo = {"ts": 0.0}


def _post(token, chat_id, texto):
    dados = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": texto,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(API % token, data=dados)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        # O corpo do erro traz a causa real ("chat not found", "bot was blocked"...).
        # Sem ler o corpo, sobra so "HTTP Error 400", que nao diz nada.
        try:
            return json.loads(e.read().decode())
        except Exception:
            return {"ok": False, "description": "HTTP %s" % e.code}


def avisar_faltantes(token, chat_id, faltantes, forcar=False):
    """Manda a lista do que a Frente 4 nao achou no banco.

    `faltantes`: lista de dicts {query, encontrados, precisa}.
    Devolve (enviado: bool, motivo: str).
    """
    if not token or not chat_id:
        return False, "telegram nao configurado"
    if not faltantes:
        return False, "nada a avisar"

    agora = time.time()
    if not forcar and (agora - _ultimo["ts"]) < INTERVALO_MIN_S:
        return False, "silenciado (aviso recente)"

    linhas = ["<b>Blog — produtos faltando</b>",
              "A Frente 4 nao achou no banco do monitor:", ""]
    for f in faltantes[:15]:
        linhas.append("• <b>%s</b> — tem %d, precisa %d" % (
            f.get("query", "?"), f.get("encontrados", 0), f.get("precisa", 0)))
    linhas += ["", "Se quiser cobrir, mande os links pela Frente 3: "
                   "eles vao para o grupo e entram no banco automaticamente."]

    try:
        r = _post(token, chat_id, "\n".join(linhas))
    except Exception as e:
        logger.warning("aviso falhou: %s", e)
        return False, str(e)

    if not r.get("ok"):
        logger.warning("telegram recusou: %s", r)
        return False, str(r.get("description"))

    _ultimo["ts"] = agora
    logger.info("aviso enviado: %d faltantes", len(faltantes))
    return True, "enviado"
