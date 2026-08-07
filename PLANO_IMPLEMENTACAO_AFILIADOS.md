# PLANO DE IMPLEMENTAÇÃO — Produtos com link de afiliado (Mercado Livre + Shopee) via VM monitor-telegram

> **Status do código:** branch atual `feat/afiliados-ml-shopee` (a branch já contém a Frente 4 do
> lado da VM versionada em `infra/blog-produtos-api/` + docs). Faltam os passos do **lado do blog**.
> Base de fatos levantada em **2026-08-06**. Este documento é o plano executável (pronto para o
> opencode implementar em etapas). Substitui como referência de implementação o
> `PLANO_AFILIADOS_API.md` (marcado como superado) e é consistente com `FRENTE_4_RETOMADA.md`.

---

## 0. Resumo executivo

O fluxo que a missão pede **já está ~80% construído e rodando na VM monitor-telegram**: o serviço
`blog-produtos-api` (porta **8086**, versão `2.0.0-frente4`) já responde busca de produto com
**links de afiliado de Mercado Livre E Shopee** prontos, com fallback cruzado, lote, health e cache.
Ele nasceu exatamente do princípio de **zero downtime** (serviço separado, nunca toca em
`monitor-bot-ml`/`searcher-ml`/`searcher-panel`).

**O que falta de fato** é o lado do blog:

1. Cliente HTTP Node `scripts/monitor_api.mjs` (não existe ainda).
2. Integração no `scripts/gerar-artigo.mjs` (modo `AFFILIATE_MODE=remote`, botão duplo ML+Shopee,
   aceitar id da Shopee no `sanitizeProducts`, não sobrescrever o link de afiliado).
3. CSS do botão duplo em `src/pages/blog/[...slug].astro`.
4. Testes de unidade em `scripts/test-injecao.mjs`.
5. Config: `.env.example`, `.github/workflows/gerar-conteudo.yml`, secret `MONITOR_API_KEY` +
   variáveis `MONITOR_API_URL` / `AFFILIATE_MODE` no GitHub.
6. Validação (modo `remote` local + teste do fallback com VM "fora") e **ativação reversível**
   (`AFFILIATE_MODE=remote`), com rollback por flag.

**Duas correções de premissa obrigatórias sobre o ML** (seção 1): a busca ao vivo do ML **não é
possível** nesta VM e a geração de link `meli.la` pelo blog **é proibida** (incidente de 06/08 derrubou
a sessão do ML por ~1h). O plano entrega o objetivo do dono — "fonte única de produtos com link de
afiliado ML + Shopee, com dois botões quando houver as duas lojas" — usando o **catálogo da Frente 4**
para o ML (links já afiliados pelas Frentes 1/2/3) e **busca ao vivo da Shopee** para o que faltar.

---

## 1. Correções de premissa (LEIA PRIMEIRO)

| Premissa do prompt | Realidade documentada no repo (06/08/2026) | Consequência para o plano |
|---|---|---|
| "A VM mantém sessão no ML e na Shopee e gera links de afiliado das duas" | A Shopee gera via API oficial (HMAC) **sem sessão**. O ML gera `meli.la` via cookies/sessão **compartilhada** com as Frentes 1/2. | Ok para a Shopee. Para o ML, só as frentes geram link; o blog consome pronto. |
| "A monitor-telegram pesquisa o produto na Shopee e no ML com fallback cruzado" | **Não existe busca por palavra-chave do ML nesta VM** (`/sites/MLB/search` → 403; `/ofertas?search=` ignora o termo; `lista.mercadolivre.com` → esqueleto). Frente 2 varre ofertas por categoria. | O "fallback cruzado" é: **catálogo-ML → catálogo-Shopee → Shopee ao vivo**, intercalados e deduplicados. ML nunca é consultado ao vivo. |
| "A capacidade de gerar link de afiliado da Shopee NÃO está documentada" | **Está documentada** em `infra/blog-produtos-api/adapters.py:226` (`shopee_search` via `monitor_core.shopee_api.search_products`; o `offerLink` da resposta JÁ é o link de afiliado) e em `FRENTE_4_RETOMADA.md` Parte 5 item 2. | O passo "validar/inspecionar" vira a **Fase 0** (auditoria de confirmação), não construção. |
| "Quando houver ML e Shopee para o mesmo produto, mostrar dois botões" | O modelo já suporta `offers` com 2 marketplaces, e o `FRENTE_4_RETOMADA.md` define `buildOfferButtonsHtml`. Porém `busca.py` hoje retorna **1 oferta por produto** (uma linha do catálogo por marketplace). | O botão duplo **por produto** exige o merge opcional da **Fase 6a** na VM. Sem ele, o artigo mostra produtos separados (1 botão cada), o que já permite o leitor escolher onde comprar. |

**Regras que nunca podem ser violadas** (fonte: `FRENTE_4_RETOMADA.md` Parte 0, `docs/CREDENCIAIS.md`,
`infra/blog-produtos-api/adapters.py:297`):

1. **Zero downtime**: nunca editar/reiniciar `monitor-bot-ml`, `searcher-ml`, `searcher-panel`.
   Só `blog-produtos-api` pode ser reiniciado (e é o único serviço que o blog toca).
2. **Blog não usa cookies de ML nem gera link do ML.** A trava `BLOG_ML_ENABLED` em `adapters.py`
   permanece **desligada**. Em 06/08/2026 religá-la derrubou a sessão do ML e parou a Frente 1 ~1h.
3. **Nunca chamar `getUpdates`** do Telegram (rouba as mensagens do bot da Frente 1).
4. **Nunca escrever em `/opt/afiliados-monitor-v2/`** (só leitura).
5. **Nunca rodar `pip` no venv do monitor** (`/opt/afiliados-monitor-v2/venv` compartilhado, depende
   de `curl_cffi 0.16.0`).
6. **Fallback sempre presente**: VM fora → blog segue com Google Shopping (Serper) + produtos fixos.

---

## 2. Arquitetura alvo

### 2.1 Decisões de arquitetura (recomendações)

| Pergunta | Recomendação | Justificativa |
|---|---|---|
| Forma do serviço na VM | **Reutilizar `blog-produtos-api` (já rodando, porta 8086)**. Não criar serviço novo nem reabrir o plano 8085 (`afiliados-api.service` nunca existiu). | O serviço já implementa busca+lote+health+catálogo+cache. Criar outro duplicaria código e rate limit. Zero downtime garantido por ser serviço separado. |
| Rota a usar | `POST /api/produtos/buscar` e `POST /api/produtos/buscar-lote`. | Contrato já definido e testado (8 consultas típicas → 5 produtos cada). |
| Cliente no blog | **Node puro no GitHub Actions** (`scripts/monitor_api.mjs`, `fetch` nativo). | O GitHub Actions é o único pipeline ativo. A VM do blog (`35.237.81.192`) é **legado/morta** (token expirado) — não reativar. |
| Botão duplo | `buildOfferButtonsHtml()` no blog (render) + opcionalmente merge na VM (Fase 6a). | O render já está desenhado; o merge é incremental e reversível por flag. |
| Fallback | Serper (`searchGoogleShopping`) **sempre** como reserva em `AFFILIATE_MODE=remote`; vira o único caminho em `legacy`. | Restrição 6 do dono: o blog nunca para de publicar por causa da VM. **Não existe fase que desligue o Serper** — só rebaixar a prioridade. |

### 2.2 Diagrama

```
github.com/sergioskmcle-sketch/blog-gamer  (GitHub Actions, pipeline ativo)
┌─────────────────────────────────────────────────────────────┐
│ gerar-conteudo.yml (cron 09:30 UTC + dispatch)              │
│  ├─ npm test (test-injecao.mjs)                             │
│  └─ node scripts/gerar-artigo.mjs                            │
│       │ AFFILIATE_MODE=remote?                               │
│       │  ├─ YES → scripts/monitor_api.mjs                    │
│       │  │        POST {MONITOR_API_URL}/api/produtos/buscar-lote
│       │  │        Header X-API-Key: {MONITOR_API_KEY}        │
│       │  │        (retry 3x, timeout 25s, nunca lança)      │
│       │  └─ NO  → (legacy) só Google Shopping (Serper)       │
│       │  produtos remotos < MAX_PRODUCTS (5)                 │
│       │      └─ preencher resto com Serper                   │
│       │  buildOfferButtonsHtml → 1 ou 2 <a class="product-btn">
│       │  salva src/content/artigos/<slug>.md                 │
│       │  gh workflow run deploy.yml                          │
└─────────────────────────────────────────────────────────────┘
                          │  HTTP (porta 8086, X-API-Key)
                          ▼
VM monitor-telegram  34.29.27.155  (/opt/blog-produtos-api/)
┌─────────────────────────────────────────────────────────────┐
│ blog-produtos-api.service  (aiohttp, separado — nunca parar  │
│  as 3 frentes: monitor-bot-ml / searcher-ml / searcher-panel)│
│  ├─ GET  /api/health         (sem auth)                      │
│  ├─ POST /api/produtos/buscar                                │
│  ├─ POST /api/produtos/buscar-lote  (≤5 queries, sequencial) │
│  ├─ GET  /api/catalogo                                       │
│  ├─ POST /api/afiliar        (Shopee só; ML travado)         │
│  └─ POST /api/faltantes      (aviso no Telegram do dono)     │
│  ├─ busca.py: catálogo-ML → catálogo-Shopee → Shopee-vivo,   │
│  │            intercala + dedup por (marketplace, id)        │
│  └─ catalogo.db (SQLite, 30 dias, alimentado a cada 10 min   │
│      pelas Frentes 1/2/3 a partir dos posted.json)           │
└─────────────────────────────────────────────────────────────┘
```

Fluxo de dados ponta a ponta de um artigo:

1. `discoverTrendingTopic()` escolhe o tema (já acontece hoje) → `topic.trending_keywords` +
   `topic.ml_query`.
2. Se `AFFILIATE_MODE === "remote"`: monta até 5 queries (2 trending + `ml_query`) e chama
   `buscarProdutosLoteRemoto(queries, { limitPorQuery: 3 })`.
3. O serviço devolve produtos no shape da seção 4, cada um com `offers` (1 marketplace hoje,
   2 se o merge 6a estiver ativo) e `affiliate_link` sempre preenchido (`meli.la` / `s.shopee.com.br`).
4. Se o total vier abaixo de `MAX_PRODUCTS` (5), o blog **completa com Serper** (links diretos, sem
   comissão) — nunca bloqueia a geração.
5. `sanitizeProducts()` + `isGamerProduct()` filtram; `ensureProductImages()` baixa thumbnails locais.
6. `buildOfferButtonsHtml()` renderiza **1 botão por loja** do produto (1 ou 2 botões; wrapper
   `div.product-btns` quando há 2). `injectSegmentedItems`/`injectProductCards` usam o mesmo caminho.
7. Frontmatter `affiliate: true` (já é automático quando há produtos).
8. Commit+push → `deploy.yml` → GitHub Pages.

---

## 3. Contrato de API (blog-produtos-api)

**Base:** `http://34.29.27.155:8086` — todas as rotas exigem `X-API-Key: <BLOG_API_KEY>` **exceto**
`GET /api/health`. Erro de chave = `401 {"ok":false,"error":{"code":"unauthorized","message":...}}`.

### 3.1 `GET /api/health` — diagnóstico (sem auth)

```jsonc
{
  "ok": true,
  "version": "2.0.0-frente4",
  "uptime_s": 123456,
  "marketplaces": {
    "shopee": { "ready": true, "session_age_h": null, "error": null },
    "mercadolivre": { "ready": true, "session_age_h": 12.3, "error": null }
  },
  "catalogo": { "total": 792, "por_plataforma": { "mercadolivre": 646, "shopee": 146 },
                "mais_recente": "2026-08-06T...", "db_mb": 0.57, "disco_livre_gb": 18.4,
                "retencao_dias": 30 }
}
```

> `mercadolivre.ready: true` apenas significa que o processo leu os cookies do ML (bootstrap) — o
> serviço **não usa** a sessão (trava). `catalogo` diz o acervo disponível: é o que alimenta o ML.

### 3.2 `POST /api/produtos/buscar` — busca individual

Request:
```jsonc
{
  "query": "mouse gamer wireless",        // string, 3 a 120 chars (obrigatório)
  "limit": 5,                             // int 1..10 (default 5)
  "marketplaces": ["shopee", "mercadolivre"], // default ambos; ordem não importa
  "min_price": null,                      // opcional, número >= 0
  "max_price": null                       // opcional, número >= 0
}
```

Resposta `200`:
```jsonc
{
  "ok": true,
  "query": "mouse gamer wireless",
  "cached": false,        // true se veio do cache de 30 min
  "took_ms": 340,
  "warnings": [],          // ex.: "shopee: <erro>" quando um marketplace falhou (não derruba o outro)
  "produtos": [ /* seção 4 */ ]
}
```

### 3.3 `POST /api/produtos/buscar-lote` — lote (≤5 consultas)

Request: `{ "queries": ["mouse gamer wireless", "teclado mecanico", ...], "limit_por_query": 3,
"marketplaces": [...] }`.

Resposta `200`:
```jsonc
{ "ok": true, "resultados": [
    { "query": "mouse gamer wireless", "produtos": [/*seção 4*/], "cached": false, "warnings": [] },
    ...
] }
```
O lote é **sequencial** de propósito (o throttle de 1 req/s por marketplace vive no `adapters.py`);
se um marketplace rate-limitar a montante, o lote todo responde `429`.

### 3.4 `GET /api/catalogo` — estatísticas do banco

`{"ok":true,"catalogo":{...}}` (mesmo objeto da seção 3.1).

### 3.5 `POST /api/afiliar` — converter URLs em links de afiliado (Shopee; ML travado)

Request: `{ "urls": ["https://shopee.com.br/product/...", "https://produto.mercadolivre.com.br/..."] }`
(1 a 10 URLs).

Resposta `200`:
```jsonc
{ "ok": true, "total": 2, "afiliados": 1, "resultados": [
  { "url": "...", "url_final": "...", "marketplace": "shopee",
    "affiliate_link": "https://s.shopee.com.br/...", "ok": true, "error": null },
  { "url": "...", "url_final": "...", "marketplace": "mercadolivre",
    "affiliate_link": "", "ok": false,
    "error": "mercadolivre desativado por seguranca (BLOG_ML_ENABLED != 1)" }
]}
```
> ⚠️ **Não usar esta rota para o ML.** O blog não deve depender dela para ML. No fluxo novo, o ML
> chega **sempre via catálogo** (link já pronto). A rota existe para a Shopee e para casos manuais.

### 3.6 `POST /api/faltantes` — aviso ao dono no Telegram

Request: `{ "faltantes": [ {"query":"...","encontrados":0,"precisa":3} ], "forcar": true }`.
Resposta: `{"ok":true,"avisado":true,"motivo":null}`. **Gate:** o dono precisa ter enviado `/start`
ao `@MonitorDeGruposBot` (senão `avisado:false`, motivo `chat not found`).

### 3.7 Códigos de erro e ação do blog

| HTTP | `error.code` | Significado | Ação do blog (cliente `monitor_api.mjs`) |
|---|---|---|---|
| 400 | `bad_request` | query inválida (tam/limit/marketplaces) | Sem retry → fallback Serper; log WARN. Não é bug da VM. |
| 401 | `unauthorized` | `X-API-Key` ausente/inválida | Sem retry → fallback; log WARN **alto** ("MONITOR_API_KEY errada?"). Alerta o dono. |
| 429 | `rate_limited` | limite de entrada (5/s) ou upstream (Shopee/ML) | Respeitar `Retry-After` (máx 20s) 1 vez; depois fallback. |
| 500 | `internal_error` | exceção não tratada no serviço | Retry 3x com backoff; depois fallback. |
| timeout / DNS | — | VM fora / rede | Retry 3x (2s/4s/8s); depois fallback. Timeout total ~75s. |
| 200 com `warnings` | — | um marketplace falhou, o outro respondeu | Usar produtos normalmente (warning é informativo). |
| 200 com lista vazia | — | não achou nada (resultado válido) | Completar com Serper / produtos fixos. |

**Regra de ouro do cliente:** *nunca lança exceção*. Toda falha vira `[]` + log. O artigo sempre sai.

---

## 4. Modelo de dados do produto

É um **superset** do shape atual do pipeline (`{ id, title, price, original_price, thumbnail,
permalink, images, source }`): os campos de topo **espelham a oferta mais barata**, e `offers`
carrega 1..2 marketplaces com seus links. Código antigo que ignore `offers` continua funcionando.

```jsonc
{
  "id": "MLB123456789",                 // "MLB..." p/ ML; "shopid_itemid" p/ Shopee
  "title": "Mouse Gamer Wireless Logitech G PRO X Superlight",
  "price": 899.0,                        // espelho: oferta mais barata
  "original_price": 0,
  "thumbnail": "https://http2.mlstatic.com/....jpg",
  "images": ["https://http2.mlstatic.com/....jpg"],
  "permalink": "https://www.mercadolivre.com.br/...",   // espelho: permalink da mais barata
  "source": "Mercado Livre",             // "Mercado Livre" | "Shopee" (rótulo da mais barata)
  "sources": ["mercadolivre", "shopee"], // marketplaces disponíveis (o que gera o botão duplo)
  "affiliate_link": "https://meli.la/2NMK1Tf",  // SEMPRE presente; topo = mais barata
  "offers": {                            // 1 ou 2 entradas
    "mercadolivre": {
      "permalink": "https://www.mercadolivre.com.br/...",
      "affiliate_link": "https://meli.la/2NMK1Tf",
      "price": 899.0,
      "item_id": "MLB123456789"
    },
    "shopee": {
      "permalink": "https://shopee.com.br/product/123/456",
      "affiliate_link": "https://s.shopee.com.br/xxxx",   // offerLink já é afiliado
      "price": 879.0,
      "item_id": "456"
    }
  },
  "preco_de": "2026-08-05",              // só produtos do catálogo: data da captura (não é hoje)
  "origem": "catalogo"                    // "catalogo" | ausente (busca viva)
}
```

| Campo | Origem | Observação |
|---|---|---|
| `affiliate_link` | catálogo (`affiliate_url` das Frentes 1/2/3) ou `offerLink` da Shopee viva | **É o que vai no botão.** Para ML sempre `meli.la`; Shopee `s.shopee.com.br/...`. |
| `sources` | chaves de `offers` | `["mercadolivre"]`, `["shopee"]` ou `["mercadolivre","shopee"]`. |
| `offers` | 1 oferta por marketplace | É daqui que o `buildOfferButtonsHtml` monta os botões. |
| `preco_de` | data do `posted.json` | O artigo já trata preço como referência (não escreve R$ no texto). |
| topo (`price`/`permalink`/`source`) | espelho da oferta mais barata | Garante compatibilidade com `sanitizeProducts`, tabela comparativa e qualquer código antigo. |

### Como o artigo renderiza os botões

- Produto com **1 oferta** → 1 `<a class="product-btn" ...>VER NO MERCADO LIVRE</a>` (ou SHOPEE).
- Produto com **2 ofertas** → wrapper `div.product-btns` com 2 âncoras:
  ```html
  <div class="product-btns">
  <a href="https://meli.la/..." class="product-btn product-btn--ml" target="_blank" rel="nofollow sponsored">VER NO MERCADO LIVRE</a>
  <a href="https://s.shopee.com.br/..." class="product-btn product-btn--shopee" target="_blank" rel="nofollow sponsored">VER NA SHOPEE</a>
  </div>
  ```
- Sem `offers` (produto do Serper) → caminho antigo intacto (label via `productButtonLabel`).

---

## 5. Mudanças por arquivo no blog-gamer

Trabalhar na branch atual `feat/afiliados-ml-shopee`. Nenhuma mudança abaixo toca a VM.

### 5.1 NOVO — `scripts/monitor_api.mjs`

Cliente HTTP do serviço. **Usar exatamente o código do `FRENTE_4_RETOMADA.md`, Passo 2**
(arquivo completo, linhas 245-376). Funções exportadas:

- `normalizarProdutoRemoto(raw)` → produto sanitizado (shape da seção 4) ou `null`. Valida:
  `title` não vazio; pelo menos 1 oferta com `affiliate_link` **ou** `permalink`; monta `sources`
  a partir das chaves de `offers`. NUNCA lança.
- `buscarProdutosRemoto(query, { limit = 5 })` → `POST /api/produtos/buscar`.
- `buscarProdutosLoteRemoto(queries, { limitPorQuery = 3 })` → `POST /api/produtos/buscar-lote`,
  dedup por `(sources[0], id)`.
- `avisarFaltantes(faltantes)` → `POST /api/faltantes`.

Comportamento (já no código de referência): `BASE = MONITOR_API_URL`, `KEY = MONITOR_API_KEY`,
`TIMEOUT_MS = 25000`, sem retry em `{400, 401, 503}`, retry ≤3 com backoff em 5xx/timeout,
`AbortSignal.timeout`. Se `BASE`/`KEY` ausentes → `[]` + WARN.

**Refinamento opcional recomendado (implementar junto):** em resposta `429`, ler o header
`Retry-After` e aguardar `min(Retry-After, 20)`s antes de uma única repetição; caso contrário fallback.

### 5.2 MODIFICAR — `scripts/gerar-artigo.mjs`

Cinco pontos (todos já mapeados no `FRENTE_4_RETOMADA.md`, Passo 3):

1. **Import** (junto dos outros imports, topo):
   ```js
   import { buscarProdutosLoteRemoto, normalizarProdutoRemoto } from "./monitor_api.mjs";
   ```
   (o import de `normalizarProdutoRemoto` é para os testes; se o teste importar direto de
   `monitor_api.mjs` não precisa aqui).

2. **Constante de modo** (logo abaixo de `const MAX_PRODUCTS = 5;`, linha ~460):
   ```js
   // remote = Frente 4 (produtos com comissao). legacy = so Google Shopping.
   const AFFILIATE_MODE = process.env.AFFILIATE_MODE || "legacy";
   ```

3. **Busca com Frente 4 primeiro** — no bloco de produtos (linha ~1893, antes de
   `if (SERPER_API_KEY) {`):
   ```js
   let mlProducts = [];

   if (AFFILIATE_MODE === "remote") {
     try {
       const trendingKws = topic.trending_keywords || [];
       const queriesRemotas = [
         ...trendingKws.slice(0, 2).flatMap((kw) =>
           effectiveDomain === "hardware" ? [`${kw} gamer`, `${kw}`] : [`${kw} ps5`, `${kw} xbox`]
         ),
         topic.ml_query,
       ].filter(Boolean).slice(0, 5);
       const remotos = await buscarProdutosLoteRemoto(queriesRemotas, { limitPorQuery: 3 });
       for (const p of remotos) {
         if (mlProducts.length >= MAX_PRODUCTS) break;
         mlProducts.push(p);
       }
       log("INFO", `Frente 4: ${mlProducts.length} produtos com afiliado`);
     } catch (e) {
       log("WARN", `Frente 4 falhou: ${e.message} — seguindo com Google Shopping`);
     }
   }
   ```
   E alterar a linha seguinte `if (SERPER_API_KEY) {` para:
   ```js
   if (SERPER_API_KEY && mlProducts.length < MAX_PRODUCTS) {
   ```
   Dentro do loop do Serper, **pré-semear o dedup** com os permalinks remotos:
   ```js
   const seen = new Set(mlProducts.map((p) => p.permalink).filter(Boolean));
   ```

4. **Não sobrescrever link de afiliado** (linha ~1941):
   ```js
   for (const p of mlProducts) {
     // Produto da Frente 4 ja tem link de afiliado — nao sobrescrever.
     if (!p.affiliate_link) p.affiliate_link = p.permalink;
   }
   ```

5. **Aceitar produto da Shopee no `sanitizeProducts`** (linha ~842) — adicionar fallback de id:
   ```js
   const id = p.id
     || (url.match(/MLB\d{8,}/) || [])[0]
     || (url.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/) || []).slice(1, 3).join("_")
     || "";
   ```

6. **Botão duplo** — **antes** de `buildProductButtonHtml` (linha ~904):
   ```js
   const OFFER_META = {
     mercadolivre: { label: "VER NO MERCADO LIVRE", cls: "product-btn product-btn--ml" },
     shopee:       { label: "VER NA SHOPEE",        cls: "product-btn product-btn--shopee" },
   };

   export function buildOfferButtonsHtml(p) {
     const lojas = Object.keys(p?.offers || {}).filter(
       (k) => OFFER_META[k] && (p.offers[k].affiliate_link || p.offers[k].permalink)
     );
     if (lojas.length === 0) return "";
     const botoes = lojas.map((k) => {
       const o = p.offers[k];
       const m = OFFER_META[k];
       const href = o.affiliate_link || o.permalink;
       return `<a href="${href}" class="${m.cls}" target="_blank" rel="nofollow sponsored">${m.label}</a>`;
     });
     if (botoes.length === 1) return botoes[0];
     return `<div class="product-btns">\n${botoes.join("\n")}\n</div>`;
   }
   ```
   E delegar no início de `buildProductButtonHtml` (o caminho antigo fica intacto abaixo):
   ```js
   function buildProductButtonHtml(p) {
     const duplo = buildOfferButtonsHtml(p);
     if (duplo) return duplo;
     // caminho antigo (Google Shopping) — NAO ALTERAR, os testes dependem dele.
     const link = p.affiliate_link || p.permalink || "";
     if (!link) return "";
     const label = productButtonLabel(p);
     return `<a href="${link}" class="product-btn" target="_blank" rel="nofollow">${label}</a>`;
   }
   ```

> Os fluxos segmentado (`buildItemSection`/`injectSegmentedItems`) e clássico
> (`injectProductCards`) usam `buildProductButtonHtml`, então o botão duplo vale para os dois sem
> mudança adicional. A tabela comparativa usa `p.price` (espelho da mais barata) — ok.

### 5.3 MODIFICAR — `scripts/test-injecao.mjs`

Adicionar import:
```js
import { buildOfferButtonsHtml } from "./gerar-artigo.mjs";
import { normalizarProdutoRemoto } from "./monitor_api.mjs";
```
E os testes do `FRENTE_4_RETOMADA.md`, Passo 5 (bloco "Frente 4: botao duplo" + "Frente 4: cliente
remoto", linhas 556-591). **Nenhum teste com rede** (o `npm test` roda no CI antes de gerar).

### 5.4 MODIFICAR — `src/pages/blog/[...slug].astro`

No bloco `/* === Product Cards === */` (após a regra `.product-btn-roxo`, ~linha 394), **adicionar**
(sem alterar regras existentes):
```css
    #articleBody .product-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      max-width: 420px;
      margin: 1.5rem auto 0;
    }
    #articleBody .product-btns .product-btn { margin: 0; flex: 1 1 180px; width: auto; }
    #articleBody .product-btn--ml { background: #ffe600; color: #000; }
    #articleBody .product-btn--ml:hover { box-shadow: 0 0 20px rgba(255, 230, 0, 0.4); color: #000; }
    #articleBody .product-btn--shopee { background: #ee4d2d; color: #fff; }
    #articleBody .product-btn--shopee:hover { box-shadow: 0 0 20px rgba(238, 77, 45, 0.4); color: #fff; }
```

### 5.5 MODIFICAR — `.github/workflows/gerar-conteudo.yml`

No step `Gerar artigo`, no bloco `env:` adicionar:
```yaml
          AFFILIATE_MODE: ${{ vars.AFFILIATE_MODE }}
          MONITOR_API_URL: ${{ vars.MONITOR_API_URL }}
          MONITOR_API_KEY: ${{ secrets.MONITOR_API_KEY }}
```

### 5.6 MODIFICAR — `.env.example`

Adicionar:
```
AFFILIATE_MODE=legacy
MONITOR_API_URL=http://34.29.27.155:8086
MONITOR_API_KEY=
```

### 5.7 MODIFICAR — `docs/CREDENCIAIS.md`

Atualizar a seção "Frente 4" para refletir a implementação concluída no blog (modo `remote` ativo)
e apontar para `PLANO_IMPLEMENTACAO_AFILIADOS.md`. Sem valores de chave.

### 5.8 NÃO alterar (fora de escopo)

- `scripts/google_shopping.mjs` — **mantido** como fallback permanente.
- `scripts/ml_affiliate.mjs`, `automation/ml_affiliate.py`, `scripts/fix-article-links.mjs` — legado
  não usado; **limpeza só em fase posterior e com autorização** (nunca remover o código ainda
  usado como referência histórica).
- `PLANO_AFILIADOS_API.md` — histórico; não tocar.
- `infra/blog-produtos-api/*` — só na Fase 6a (merge opcional) e 6c.
- `admin/index.html` / `admin/editor.js` — **verificar no gate da Fase 4** (o regex de edição já
  casa cada `a.product-btn` individualmente, então o botão duplo aparece como 2 botões editáveis —
  comportamento aceitável, sem mudança obrigatória).

---

## 6. Etapas de implementação (com gates e rollback)

> Padrão herdado de `PLANO_AFILIADOS_API.md` (fases + flag `AFFILIATE_MODE`), corrigido: sem
> serviço novo na VM (reusa 8086), sem `?tag=sergioskm` (obsoleto), foco no blog.

| # | Fase | Escopo | Gate de validação | Impacto |
|---|---|---|---|---|
| 0 | Auditoria da VM | Confirmar estado do `blog-produtos-api` e da Shopee | Seção 6.0 | nenhum |
| 1 | Cliente + testes | `scripts/monitor_api.mjs` + testes `normalizarProdutoRemoto` | `npm test` | nenhum (código novo) |
| 2 | Integração no gerador + botão duplo + CSS | `gerar-artigo.mjs`, `[...slug].astro` | `npm test` + `npm run build` | nenhum (default `legacy`) |
| 3 | Config CI | `gerar-conteudo.yml`, `.env.example`, secrets/vars GitHub | `workflow_dispatch` em `legacy` | nenhum (default `legacy`) |
| 4 | Validação `remote` local | Rodar gerador com `remote` + teste do fallback | Seção 6.4 (2 comandos) | nenhum (local) |
| 5 | **Ativação** | Var GitHub `AFFILIATE_MODE=remote` | 2–3 gerações reais | **rollback = voltar p/ `legacy`** |
| 6 | Melhorias opcionais (VM) | Merge 2 botões (6a), faltantes Telegram (6b), 3ª VM Shopee (6c) | Seção 6.5 | reversível por flag |

**Rollback global:** em qualquer fase, reverter a variável `AFFILIATE_MODE` do GitHub para `legacy`
restaura o comportamento atual instantaneamente (o código `remote` fica inativo, não é removido).

### 6.0 Fase 0 — Auditoria da VM (confirmação)

Nada é criado; apenas confirmar fatos. Comandos (SSH):

```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api'
# esperado: active active active active

ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'curl -s http://127.0.0.1:8086/api/health'
# esperado: ok:true, version 2.0.0-frente4, marketplaces.shopee.ready true, catalogo.total>0

ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'df -h /'
# esperado: disco com folga (>=3GB livres)
```

Confirmar também (1) o shape real da resposta de `buscar` para as 8 consultas típicas
(`mouse gamer`, `teclado mecanico`, `headset gamer`, `cadeira gamer`, `monitor gamer`,
`placa de video`, `notebook gamer`, `ssd nvme`), (2) que produtos Shopee trazem
`offers.shopee.affiliate_link` começando com `s.shopee` e ML com `meli.la`, e (3) que `busca.py`
na VM bate com a cópia versionada (`diff` entre `/opt/blog-produtos-api/` e `infra/blog-produtos-api/`).

**Gate:** os 4 serviços `active`; health ok; shape confirmado. **Saída:** `BLOG_API_KEY` lida e
guardada **fora do repo** (no `.env` local do agente, nunca commitada).

### 6.1 Fase 1 — Cliente HTTP + testes (blog)

Arquivos: **criar** `scripts/monitor_api.mjs`; **editar** `scripts/test-injecao.mjs`.

Gate:
```bash
npm test
# esperado: "N asserts OK" (sem rede, sem erro)
node -e "import('./scripts/monitor_api.mjs').then(m => { console.log(typeof m.buscarProdutosLoteRemoto, typeof m.normalizarProdutoRemoto); })"
```

### 6.2 Fase 2 — Integração no gerador + botão duplo + CSS

Arquivos: `scripts/gerar-artigo.mjs`, `src/pages/blog/[...slug].astro`, `scripts/test-injecao.mjs`
(testes do botão duplo).

Gate:
```bash
npm test      # testes novos de buildOfferButtonsHtml/normalizarProdutoRemoto
npm run build # CSS novo não quebra o build
```

### 6.3 Fase 3 — Configuração CI

Arquivos: `.github/workflows/gerar-conteudo.yml`, `.env.example`, `docs/CREDENCIAIS.md`.
Passos manuais do dono: criar GitHub **secret** `MONITOR_API_KEY` (= `BLOG_API_KEY` da VM) e
**variáveis** `MONITOR_API_URL` (`http://34.29.27.155:8086`) e `AFFILIATE_MODE` (`legacy`).

Gate: `workflow_dispatch` do workflow **em `legacy`** — gera artigo normalmente (o código `remote`
existe mas está desligado). `npm test` no CI passa.

### 6.4 Fase 4 — Validação `remote` (local, reversível)

> Requer `MONITOR_API_KEY` no `.env` local (o agente lê da VM via
> `ssh ... 'sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env'` — **nunca** commitar).

```bash
# 1. Modo remote de verdade:
AFFILIATE_MODE=remote node scripts/gerar-artigo.mjs
# esperado no log: "Frente 4: N produtos com afiliado"
# artigo gerado: hrefs com meli.la OU s.shopee.com.br

# 2. TESTE MAIS IMPORTANTE — VM "fora":
AFFILIATE_MODE=remote MONITOR_API_URL=http://127.0.0.1:9999 MONITOR_API_KEY=qualquer \
  node scripts/gerar-artigo.mjs
# esperado: warning de fallback no log e artigo gerado normalmente (Google Shopping)
```

Gate: os 2 comandos geram artigo; `public/status.json` com `saudavel:true`. Conferir no artigo:
produtos remotos com `affiliate_link` e botões rotulados; verificar no admin que os botões duplos
aparecem como 2 âncoras editáveis (comportamento aceitável).

### 6.5 Fase 5 — Ativação

Dono muda a variável GitHub `AFFILIATE_MODE` para `remote`. Acompanhar **2–3 gerações reais**
(agenda diária + `workflow_dispatch`). Critérios de sucesso: artigos com `meli.la`/`s.shopee`
públicos; `status.json` saudável; VM não reporta erros no `journalctl -u blog-produtos-api`.

**Rollback (a qualquer sinal de problema):** `AFFILIATE_MODE=legacy` no GitHub. Não há mudança de
código nem deploy.

### 6.6 Fase 6 — Melhorias opcionais (VM, apenas depois da Fase 5 estável ~2 semanas)

- **6a. Botão duplo por produto (merge ML+Shopee no `busca.py`).** Quando o mesmo modelo existe nos
  dois marketplaces, retornar UM produto com `offers` de 2 lojas. Implementar em `busca.py` um passo
  de pareamento por similaridade de título normalizado (`catalogo.normalizar`), ligado por uma flag
  nova `MERGIR_OFERTAS=1` em `/opt/blog-produtos-api/.env` (default 0). Critério: só parear quando o
  título normalizado coincidir em ≥ 80% dos termos e preços a ≤ 20% de diferença; nunca parear ML com
  Shopee se já houver oferta do mesmo marketplace. Deploy: editar cópia versionada, `scp`, restart
  **só** de `blog-produtos-api`, conferir as outras 3 frentes `active`. **Rollback:** `MERGIR_OFERTAS=0`
  + restart. **Gate:** `curl buscar` para "mouse gamer wireless" retorna ao menos 1 produto com
  `sources == ["mercadolivre","shopee"]` e `buildOfferButtonsHtml` gera 2 botões (teste unitário).
- **6b. `/api/faltantes` no ar.** Dono envia `/start` ao `@MonitorDeGruposBot`; testar com o curl do
  `FRENTE_4_RETOMADA.md` Parte 4.1 (`avisado:true`). Sem mudança de código no blog: só chamar
  `avisarFaltantes` quando `buscarProdutosLoteRemoto` retornar menos que o esperado (opcional).
- **6c. Mais acervo Shopee.** Incluir a 3ª VM (`34.27.101.162`, `shopee-monitor-telegram`) no
  coletor — duplica o acervo Shopee (~46/dia → ~92/dia). Exige expor `posted.json` por HTTP ou
  `rsync`; **só com autorização**, sem tocar nas frentes.

---

## 7. Configuração e secrets

| Config | Onde fica | Valor | Comentário |
|---|---|---|---|
| `MONITOR_API_KEY` | GitHub **secret** + `.env` local + `.env.example` (vazio) | = `BLOG_API_KEY` de `/opt/blog-produtos-api/.env` (VM) | **Nunca** commitada. Gerada com `openssl rand -hex 32`. |
| `MONITOR_API_URL` | GitHub **variable** + `.env` + `.env.example` | `http://34.29.27.155:8086` | Porta 8086 (Frente 4), firewall já aberto (`allow-blog-api`). |
| `AFFILIATE_MODE` | GitHub **variable** + `.env` + `.env.example` | `legacy` → `remote` (Fase 5) | Flag de rollback. |
| `BLOG_API_KEY` | `/opt/blog-produtos-api/.env` na VM (chmod 600) | segredo | Não duplicar nos marketplaces (o serviço lê `searcher/.env` seletivamente). |
| `BLOG_ML_ENABLED` | `/opt/blog-produtos-api/.env` na VM | **ausente/≠1** (trava) | NUNCA ativar. |

Como recuperar a chave (sem expor em commit):
```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env'
```

Workflow `gerar-conteudo.yml` usa `vars.AFFILIATE_MODE`, `vars.MONITOR_API_URL`,
`secrets.MONITOR_API_KEY` (adicionados na Fase 3). Nenhum secret de marketplace é adicionado ao blog.

---

## 8. Testes

### 8.1 Unidade (repo, sem rede — rodam no CI)

`npm test` → `scripts/test-injecao.mjs` deve cobrir, além do que já existe:

- `buildOfferButtonsHtml`:
  - 2 ofertas → 2 `<a>`, wrapper `product-btns`, classes `--ml`/`--shopee`, `rel="nofollow sponsored"`;
  - 1 oferta → 1 `<a>`, sem wrapper;
  - sem `offers` → `""` (cai no caminho antigo);
  - loja desconhecida (`amazon`) → `""`.
- `normalizarProdutoRemoto`:
  - produto válido → aceito, `sources` de `offers`;
  - sem `title` → `null`; sem oferta → `null`.
- Caminho antigo intacto: os testes existentes de `buildProductButtonHtml`/`productButtonLabel`
  (linhas 94-112) continuam passando.

### 8.2 Smoke na VM (Fases 0 e 6)

Curls do `infra/blog-produtos-api/README.md` (seção Smoke) + health + `systemctl is-active` das
4 frentes. Nunca derrubar `monitor-bot-ml`/`searcher-ml`/`searcher-panel`.

### 8.3 Integração (Fase 4)

Os 2 comandos da seção 6.4 (remote real + fallback forçado). Este segundo é o que prova que o blog
**nunca para de publicar** por causa da VM.

---

## 9. Riscos e perguntas em aberto

### Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| **ML "ao vivo" inexistente/proibido** → cobertura do ML limitada ao catálogo (30 dias, ~646 produtos ML) | certa | É o desenho documentado (Frentes 1/2/3). Mitigação: Fase 6c (3ª VM Shopee), `/api/faltantes`, e o blog sempre completa com Serper. |
| Incidente de sessão do ML (06/08): usar a sessão do ML a partir do blog derruba Frente 1 | média (se alguém violar a trava) | Trava `BLOG_ML_ENABLED` off + este plano **nunca** chama `afiliar`/`generate_affiliate_link` para ML. |
| Rate limit da Shopee (1 req/s) no lote | baixa | Lote é sequencial; cache 30 min no serviço; consultas típicas já estão cobertas. |
| Drift entre `infra/blog-produtos-api/` (versionado) e `/opt/blog-produtos-api/` (VM) | média | Fase 0 faz `diff`; toda mudança na VM usa `scp` da cópia versionada + restart só do serviço do blog. |
| `MONITOR_API_KEY` vazada em commit | baixa (procedimento) | Chave nunca entra em arquivo; `.env` no `.gitignore`; `.env.example` só com placeholder. |
| HTTP puro (sem TLS) na porta 8086 | média | Tráfego interno GCP + chave por header. **Pergunta em aberto:** futuro `nginx`/túnel HTTPS — opcional, fora do escopo atual. |
| Botão duplo só aparece com merge (6a) | certa (hoje 1 oferta/produto) | Sem 6a, o artigo lista produtos separados (1 botão cada) — requisito "escolher onde comprar" atendido a nível de lista. |
| `npm test` quebra se o cliente remoto chamar rede | baixa | Testes do cliente são **puros** (sem `fetch`); testes de botão são **puros**. |
| `Retry-After` em 429 pode passar de 30s | baixa | Cliente respeita `min(Retry-After, 20)`s, 1 tentativa, depois fallback. |

### Perguntas em aberto (confirmar antes de cada fase)

1. **Fase 5 (go/no-go de ativação):** dono concorda que ML só vem do catálogo e que "busca ao vivo
   do ML" está descartada por decisão técnica e de segurança? (Recomendação: sim — é o único caminho
   seguro e já documentado.)
2. **Fase 6a (merge do botão duplo):** quer o pareamento por similaridade de título/preço? O critério
   conservador (≥80% dos termos, preço ≤20% de diferença) minimiza falsos pares. Alternativa simples:
   aceitar 1 botão por produto (o serviço já entrega ML **e** Shopee na mesma lista).
3. **Fase 3 (manual):** dono cria o secret `MONITOR_API_KEY` e as variáveis `MONITOR_API_URL` /
   `AFFILIATE_MODE` no GitHub (agente não consegue criar secrets).
4. **Fase 6b (faltantes):** dono envia `/start` ao `@MonitorDeGruposBot` (Telegram não deixa o bot
   iniciar conversa).
5. **Attribuição Shopee (blog × Telegram):** a busca viva usa `offerLink` sem `sub_ids` → receita de
   blog e Telegram aparecem juntas no painel da Shopee. Separar custa 1 chamada extra por produto
   (`generate_short_link(sub_ids=['blog'])`, como em `/api/afiliar`). Decisão: aceitar junto por ora
   (recomendado) ou separar na Fase 6.
6. **HTTPS/roteamento:** manter `http://34.29.27.155:8086` direto (recomendado agora) ou expor por
   túnel HTTPS no futuro?
7. **Cobertura de games:** consultas de jogos/consoles tendem a não casar com o catálogo (poucos
   produtos de game) → cairão na Shopee viva ou no Serper. Confirmar que é aceitável (a prioridade de
   afiliação é hardware/periféricos, que o catálogo cobre bem).

---

## 10. Referências

- `FRENTE_4_RETOMADA.md` — instruções de execução (passos exatos do blog nos Passos 1-8; proibições
  na Parte 0; fatos técnicos na Parte 5).
- `infra/blog-produtos-api/README.md` — serviço da VM, contrato, deploy e smoke.
- `infra/blog-produtos-api/app.py` / `busca.py` / `catalogo.py` / `adapters.py` — contrato e modelo.
- `docs/CREDENCIAIS.md` — onde fica cada chave; incidente do ML.
- `docs/MONITOR_API_AUDITORIA.md` — auditoria da VM e decisões do dono.
- `PLANO_AFILIADOS_API.md` — histórico (superado; ideia central mantida pela Frente 4).
- `PROMPT_CLAUDE_PLANO_ML_SHOPEE.md` — a missão original (este plano a implementa com as correções
  da seção 1).
