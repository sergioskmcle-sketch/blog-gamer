"""Banco de produtos da Frente 4 — alimentado pelas Frentes 1, 2 e 3.

O monitor ja descobre ~215 produtos/dia e GERA o link de afiliado de cada um,
mas descarta o historico: as duas frentes cortam em `posted[-1000:]`. Este
modulo apenas COPIA o que elas ja escreveram, antes que seja descartado.

Regras invioláveis:
  - Leitura pura dos arquivos do monitor. Nunca escreve neles.
  - Zero requisicao a ML ou Shopee. Os links de afiliado ja vem prontos.
  - Crescimento limitado: retencao por dias + teto de tamanho + guarda de disco.

Sobre disco: guardamos so texto e URLs — nunca a imagem. ~215 produtos/dia a
~500 bytes = ~3 MB por mes de retencao. Ainda assim as travas existem, porque
disco cheio nesta VM significa perder o acesso SSH a ela.
"""

import json
import logging
import os
import re
import shutil
import sqlite3
import time
import unicodedata
from pathlib import Path

logger = logging.getLogger("blog-produtos-api.catalogo")

DB_PATH = Path("/opt/blog-produtos-api/catalogo.db")

FONTES = {
    "frente1": Path("/opt/afiliados-monitor-v2/automation/state/posted.json"),
    "frente23": Path("/opt/afiliados-monitor-v2/searcher/services/searcher/state/posted.json"),
}

RETENCAO_DIAS = 30
MAX_DB_MB = 200          # teto duro; a projecao real e ~3 MB/mes
MIN_DISCO_LIVRE_GB = 3   # abaixo disso o coletor para de escrever

PLATAFORMA = {"ML": "mercadolivre", "Shopee": "shopee"}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS produtos (
    fingerprint   TEXT PRIMARY KEY,
    item_id       TEXT,
    plataforma    TEXT NOT NULL,
    titulo        TEXT NOT NULL,
    titulo_norm   TEXT NOT NULL,
    preco         REAL,
    url           TEXT,
    affiliate_url TEXT,
    thumbnail     TEXT,
    postado_em    TEXT,
    fonte         TEXT,
    visto_em      REAL
);
CREATE INDEX IF NOT EXISTS ix_titulo  ON produtos(titulo_norm);
CREATE INDEX IF NOT EXISTS ix_data    ON produtos(postado_em);
CREATE INDEX IF NOT EXISTS ix_plat    ON produtos(plataforma);
"""


def _conn():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        c.executescript(_SCHEMA)
    logger.info("catalogo pronto em %s", DB_PATH)


def normalizar(s):
    """Minusculas, sem acento, so letras/numeros/espaco — para casar titulo."""
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9]+", " ", s)).strip().lower()


def _disco_livre_gb():
    try:
        return shutil.disk_usage(str(DB_PATH.parent)).free / (1024 ** 3)
    except Exception:
        return 999.0


def _db_mb():
    try:
        return DB_PATH.stat().st_size / (1024 ** 2)
    except Exception:
        return 0.0


def _pode_escrever():
    """Guardas de disco. Se qualquer uma bater, o coletor NAO escreve."""
    livre = _disco_livre_gb()
    if livre < MIN_DISCO_LIVRE_GB:
        logger.error("disco baixo (%.1f GB livres) — coletor pausado", livre)
        return False
    tam = _db_mb()
    if tam > MAX_DB_MB:
        logger.error("catalogo em %.1f MB (teto %d) — coletor pausado", tam, MAX_DB_MB)
        return False
    return True


def _linhas(caminho):
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:
        logger.warning("fonte ilegivel %s: %s", caminho, e)
        return []
    return d if isinstance(d, list) else list(d.values())


def _mapear(item, fonte):
    if not isinstance(item, dict):
        return None
    titulo = (item.get("title") or "").strip()
    plat = PLATAFORMA.get(item.get("platform") or "", "")
    if not titulo or not plat:
        return None
    # Sem link de afiliado o registro nao serve ao blog: seria mais um produto
    # sem comissao, que o Google Shopping ja fornece.
    afiliado = (item.get("affiliate_url") or "").strip()
    if not afiliado:
        return None
    fp = item.get("fingerprint") or "%s:%s" % (plat, item.get("item_id") or item.get("url") or titulo)
    try:
        preco = float(item.get("price") or 0) or None
    except (TypeError, ValueError):
        preco = None
    return (str(fp), str(item.get("item_id") or ""), plat, titulo, normalizar(titulo),
            preco, item.get("url") or "", afiliado, item.get("thumbnail") or "",
            str(item.get("posted_at") or ""), fonte, time.time())


def sincronizar():
    """Copia das fontes o que ainda nao esta no banco. Devolve resumo."""
    if not _pode_escrever():
        return {"ok": False, "motivo": "guarda de disco", "novos": 0}

    novos = 0
    lidos = 0
    with _conn() as c:
        for fonte, caminho in FONTES.items():
            for item in _linhas(caminho):
                lidos += 1
                linha = _mapear(item, fonte)
                if not linha:
                    continue
                cur = c.execute(
                    "INSERT OR IGNORE INTO produtos (fingerprint,item_id,plataforma,"
                    "titulo,titulo_norm,preco,url,affiliate_url,thumbnail,postado_em,"
                    "fonte,visto_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", linha)
                novos += cur.rowcount

    removidos = purgar()
    if novos or removidos:
        logger.info("sync: %d novos, %d expirados, %d lidos, db %.1f MB",
                    novos, removidos, lidos, _db_mb())
    return {"ok": True, "novos": novos, "expirados": removidos, "lidos": lidos,
            "db_mb": round(_db_mb(), 2)}


def purgar():
    """Apaga o que passou da retencao. E o que mantem o banco pequeno."""
    limite = time.strftime("%Y-%m-%d", time.localtime(time.time() - RETENCAO_DIAS * 86400))
    with _conn() as c:
        cur = c.execute("DELETE FROM produtos WHERE substr(postado_em,1,10) < ?", (limite,))
        return cur.rowcount


def compactar():
    """VACUUM — devolve ao disco o espaco dos registros apagados."""
    with _conn() as c:
        c.execute("VACUUM")


def buscar(termo, limit=5, plataformas=("mercadolivre", "shopee"), dias=RETENCAO_DIAS):
    """Procura produtos no banco pelos termos da consulta.

    Ranqueia por quantos termos aparecem no titulo e, em empate, pelo mais
    recente. Termos com 2 caracteres ou menos sao ignorados (ruido).
    """
    termos = [t for t in normalizar(termo).split() if len(t) > 2]
    if not termos:
        return []

    corte = time.strftime("%Y-%m-%d", time.localtime(time.time() - dias * 86400))
    marcadores = ",".join("?" * len(plataformas))
    sql = ("SELECT * FROM produtos WHERE plataforma IN (%s) "
           "AND substr(postado_em,1,10) >= ? AND (%s)" %
           (marcadores, " OR ".join(["titulo_norm LIKE ?"] * len(termos))))
    args = list(plataformas) + [corte] + ["%%%s%%" % t for t in termos]

    with _conn() as c:
        linhas = [dict(r) for r in c.execute(sql, args).fetchall()]

    for l in linhas:
        l["_score"] = sum(1 for t in termos if t in l["titulo_norm"])
    # Exige pelo menos metade dos termos: evita devolver "cadeira de escritorio"
    # para "cadeira gamer" so porque casou uma palavra.
    minimo = max(1, (len(termos) + 1) // 2)
    linhas = [l for l in linhas if l["_score"] >= minimo]
    linhas.sort(key=lambda l: (-l["_score"], l.get("postado_em") or ""), reverse=False)
    linhas.sort(key=lambda l: (l["_score"], l.get("postado_em") or ""), reverse=True)
    return linhas[:limit]


def estatisticas():
    try:
        with _conn() as c:
            total = c.execute("SELECT COUNT(*) FROM produtos").fetchone()[0]
            por_plat = {r[0]: r[1] for r in c.execute(
                "SELECT plataforma, COUNT(*) FROM produtos GROUP BY plataforma")}
            recente = c.execute("SELECT MAX(postado_em) FROM produtos").fetchone()[0]
    except Exception as e:
        return {"erro": str(e)}
    return {"total": total, "por_plataforma": por_plat, "mais_recente": recente,
            "db_mb": round(_db_mb(), 2), "disco_livre_gb": round(_disco_livre_gb(), 1),
            "retencao_dias": RETENCAO_DIAS}
