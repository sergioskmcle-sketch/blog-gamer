"""Orquestracao da busca e montagem do modelo de produto do blog.

Fase 2: Shopee. Fase 3 acrescenta ML + pareamento cruzado.

O shape devolvido e um SUPERSET do que o pipeline do blog ja consome
(`{id,title,price,original_price,thumbnail,permalink,images,source}`), para que
codigo antigo que ignore `offers` continue funcionando: os campos de topo sao
sempre um espelho da oferta mais barata.
"""

import logging
import re

import adapters

logger = logging.getLogger("blog-produtos-api.busca")

ROTULO = {"shopee": "Shopee", "mercadolivre": "Mercado Livre"}


def _num(v):
    try:
        f = float(v or 0)
        return f if f > 0 else 0.0
    except (TypeError, ValueError):
        return 0.0


def _dentro_da_faixa(preco, min_price, max_price):
    if preco <= 0:
        return False
    if min_price is not None and preco < min_price:
        return False
    if max_price is not None and preco > max_price:
        return False
    return True


def _oferta_shopee(item):
    """Converte um item do funil Shopee numa oferta do modelo do blog."""
    afiliado = item.get("offer_link") or ""
    permalink = item.get("permalink") or ""
    return {
        "permalink": permalink or afiliado,
        # offerLink JA e o link de afiliado (ver docstring de shopee_offers).
        "affiliate_link": afiliado,
        "price": _num(item.get("price")),
        "item_id": str(item.get("item_id") or ""),
    }


def _montar_produto(ofertas, base):
    """Aplica as invariantes do modelo: offers + espelho da oferta mais barata.

    `ofertas` = {marketplace: oferta}. `base` = item que fornece titulo/imagem.
    """
    validas = {k: o for k, o in ofertas.items()
               if o and (o.get("affiliate_link") or o.get("permalink"))}
    if not validas:
        return None

    # O espelho de topo aponta para a oferta mais barata; ofertas sem preco
    # ficam por ultimo em vez de ganharem por serem "zero".
    barata_key = min(validas, key=lambda k: validas[k]["price"] or float("inf"))
    barata = validas[barata_key]

    thumb = base.get("thumbnail") or ""
    imagens = [i for i in (base.get("images") or []) if i] or ([thumb] if thumb else [])

    produto = {
        "id": str(base.get("item_id") or base.get("id") or ""),
        "title": (base.get("title") or "").strip(),
        "price": barata["price"],
        "original_price": _num(base.get("original_price")),
        "thumbnail": thumb,
        "images": imagens,
        "permalink": barata["permalink"],
        "source": ROTULO.get(barata_key, barata_key),
        "sources": sorted(validas.keys()),
        "affiliate_link": barata["affiliate_link"] or barata["permalink"],
        "offers": validas,
    }
    if not produto["id"] or not produto["title"]:
        return None
    return produto


def _buscar_shopee(query, limit, min_price, max_price, warnings):
    try:
        itens = adapters.shopee_search(query, limit)
    except adapters.RateLimitUpstream:
        raise
    except Exception as e:
        logger.warning("shopee falhou para %r: %s", query, e)
        warnings.append("shopee: %s" % e)
        return []

    produtos = []
    for item in itens:
        oferta = _oferta_shopee(item)
        if not _dentro_da_faixa(oferta["price"], min_price, max_price):
            continue
        p = _montar_produto({"shopee": oferta}, item)
        if p:
            produtos.append(p)
    return produtos


def buscar(query, limit=5, marketplaces=("shopee", "mercadolivre"),
           min_price=None, max_price=None):
    """Busca nos marketplaces pedidos. Devolve (produtos, warnings).

    Falha de um marketplace nunca derruba o outro: vira warning e segue.
    Lista vazia com warnings e resultado valido — quem chama decide o fallback.
    """
    warnings = []
    produtos = []

    if "shopee" in marketplaces:
        produtos.extend(_buscar_shopee(query, limit, min_price, max_price, warnings))

    if "mercadolivre" in marketplaces:
        # Fase 3: busca no ML, geracao de link de afiliado e pareamento cruzado.
        warnings.append("mercadolivre: nao implementado nesta versao (Fase 3)")

    # Dedup por id dentro do mesmo marketplace.
    vistos = set()
    unicos = []
    for p in produtos:
        chave = (p["sources"][0], p["id"])
        if chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(p)

    return unicos[:limit], warnings
