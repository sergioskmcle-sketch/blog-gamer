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
import catalogo

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


def _do_catalogo(query, limit, plataforma, min_price, max_price, warnings):
    """Produtos vindos do banco alimentado pelas Frentes 1/2/3.

    O link de afiliado ja veio pronto de la — nao ha nenhuma chamada externa.
    """
    try:
        linhas = catalogo.buscar(query, limit=limit * 3, plataformas=(plataforma,))
    except Exception as e:
        logger.warning("catalogo falhou para %r: %s", query, e)
        warnings.append("%s: banco indisponivel (%s)" % (plataforma, e))
        return []

    produtos = []
    for l in linhas:
        preco = _num(l.get("preco"))
        if preco and not _dentro_da_faixa(preco, min_price, max_price):
            continue
        oferta = {"permalink": l.get("url") or l.get("affiliate_url"),
                  "affiliate_link": l.get("affiliate_url") or "",
                  "price": preco, "item_id": str(l.get("item_id") or "")}
        base = {"item_id": l.get("item_id") or l.get("fingerprint"),
                "title": l.get("titulo"), "thumbnail": l.get("thumbnail"),
                "images": [l["thumbnail"]] if l.get("thumbnail") else [],
                "original_price": 0}
        p = _montar_produto({plataforma: oferta}, base)
        if p:
            # O preco e do dia em que a frente encontrou a oferta, nao de agora.
            # O artigo deve tratar como referencia, nunca como preco garantido.
            p["preco_de"] = (l.get("postado_em") or "")[:10]
            p["origem"] = "catalogo"
            produtos.append(p)
    return produtos[:limit]


def buscar(query, limit=5, marketplaces=("shopee", "mercadolivre"),
           min_price=None, max_price=None):
    """Busca nos marketplaces pedidos. Devolve (produtos, warnings).

    Falha de um marketplace nunca derruba o outro: vira warning e segue.
    Lista vazia com warnings e resultado valido — quem chama decide o fallback.
    """
    warnings = []

    # Banco primeiro para AMBOS: custo zero em requisicoes, e o link de afiliado
    # ja vem pronto das Frentes 1/2/3. O blog nunca dispara busca no ML.
    cat_ml = (_do_catalogo(query, limit, "mercadolivre", min_price, max_price, warnings)
              if "mercadolivre" in marketplaces else [])
    cat_shopee = (_do_catalogo(query, limit, "shopee", min_price, max_price, warnings)
                  if "shopee" in marketplaces else [])

    # Intercala em vez de concatenar. Concatenando, a primeira lista consome o
    # limite inteiro e a segunda some — foi o que aconteceu no 1o teste, com a
    # Shopee ocupando as 5 vagas com acessorios de R$ 15 enquanto o ML tinha
    # monitor e headset de verdade esperando na fila.
    produtos = []
    for i in range(max(len(cat_ml), len(cat_shopee))):
        if i < len(cat_ml):
            produtos.append(cat_ml[i])
        if i < len(cat_shopee):
            produtos.append(cat_shopee[i])

    # So se o banco nao encheu a lista vale gastar uma chamada ao vivo na Shopee
    # (API oficial, sem sessao a arriscar). O ML nunca entra aqui.
    if len(produtos) < limit and "shopee" in marketplaces:
        produtos.extend(_buscar_shopee(query, limit, min_price, max_price, warnings))

    # Dedup por marketplace + id.
    vistos = set()
    unicos = []
    for p in produtos:
        chave = (p["sources"][0], p["id"])
        if chave in vistos:
            continue
        vistos.add(chave)
        unicos.append(p)

    return unicos[:limit], warnings
