# Plano — Produtos com afiliado ML + Shopee via VM monitor-telegram

> 📌 **Documento histórico. Para executar, use [`FRENTE_4_RETOMADA.md`](FRENTE_4_RETOMADA.md).**
>
> Fases 0-2 concluídas conforme planejado. **A Fase 3 mudou de rumo em 06/08/2026**, por dois
> motivos descobertos na execução: (1) o ML não tem busca por palavra-chave utilizável nesta VM;
> (2) a sessão do ML não suporta um segundo consumidor — testá-la derrubou a operação do dono.
> O desenho final: o blog consome um **banco alimentado pelas Frentes 1/2/3**, com os links de
> afiliado já gerados. Custo em requisições ao ML: zero.

> **Fase 2 concluída em 2026-08-05** — busca real na Shopee no ar (individual + lote), cache de
> 30 min funcionando (2ª chamada `cached:true`, 0 ms), filtro de preço OK, query sem resultado
> devolve `ok:true` com lista vazia, ML pedido vira `warning` sem quebrar. Link de afiliado
> **verificado ponta a ponta**: `s.shopee.com.br/...` resolve para o produto com
> `utm_medium=affiliates`. Lote de 3 queries em 2,7s. Serviços pré-existentes intactos.
>
> **Decisão em aberto (atribuição):** o `offerLink` vem sem `subIds`, então a receita do blog e a
> do Telegram ficam misturadas no painel da Shopee. Separar exige `generate_short_link(...,
> sub_ids=['blog'])` — 1 chamada extra por produto, contra o rate limit. Não bloqueia a Fase 3.
>
> **Fase 1 concluída em 2026-08-05** — serviço `blog-produtos-api` ativo na VM (porta 8086),
> health reportando `ready:true` nos dois marketplaces, todos os gates verdes, os três serviços
> pré-existentes intactos. Código versionado em [`infra/blog-produtos-api/`](infra/blog-produtos-api/).
> Firewall liberado pelo dono (regra `allow-blog-api` + tag `blog-api`), validado da internet:
> `GET /api/health` → 200 em 0,76s; `POST` sem chave → 401; porta 8080 do bot intacta.
> **Sem pendências.** Correção aplicada durante o gate: o rate limit de entrada subiu para
> 5 req/s (burst 20); o limite de 1 req/s que protege ML/Shopee vai em `busca.py` na Fase 2.
>
> **Fase 0 concluída em 2026-08-05** — ver [`docs/MONITOR_API_AUDITORIA.md`](docs/MONITOR_API_AUDITORIA.md).
> Premissas confirmadas, com 3 revisões já aplicadas neste documento:
> 1. A Shopee usa a **API oficial de afiliados (GraphQL, autenticada por API key)** e o campo
>    `offerLink` da busca **já é o link de afiliado** → Shopee é o caminho **primário**; o ML
>    (dependente de cookies + circuit breaker) vira enriquecimento que pode falhar sem quebrar a
>    monetização.
> 2. O serviço reusa `/opt/afiliados-monitor-v2/venv` (já tem aiohttp 3.14.1) — **sem venv novo,
>    sem `pip install`**, para não arriscar drift no `curl_cffi` que sustenta a sessão do ML.
> 3. Os módulos do monitor são **stateful**: exigem `configure()` no startup (padrão em
>    `engine.py:312/389/613`). O `adapters.py` replica essa sequência.

## Contexto

Hoje o blog-gamer monetiza **zero**. O pipeline ativo (`.github/workflows/gerar-conteudo.yml` →
`node scripts/gerar-artigo.mjs`) descobre produtos via Serper.dev
(`scripts/google_shopping.mjs`) e, em `scripts/gerar-artigo.mjs:1941-1943`, faz literalmente
`p.affiliate_link = p.permalink` — ou seja, o botão do artigo aponta para um link direto de loja
(muitas vezes uma URL `google.com/search?ibp=oshop...`, como em
`src/content/artigos/top-5-mouse-gamer-wireless-*.md:31,41`, que exibe "VER NA SHOPEE" mas não é
link de afiliado).

A afiliação antiga do ML por cookies está **aposentada** (`docs/CREDENCIAIS.md`: fingerprint +
bloqueio global, OAuth `invalid_client`, `/sites/MLB/search` 403). `scripts/ml_affiliate.mjs` e
`automation/ml_affiliate.py` seguem no repo mas **fora do pipeline**. O `PLANO_AFILIADOS_API.md`
(marcado como superado) já propunha mover a geração de links para a VM monitor-telegram, mas
nunca foi implementado.

A VM **monitor-telegram** (`34.29.27.155`, `/opt/afiliados-monitor-v2/`) mantém sessão
autenticada em ML **e** Shopee e gera links de afiliado das duas. O objetivo é transformá-la na
**fonte única de produtos com comissão**: o blog manda uma query, a VM busca nos dois
marketplaces com fallback cruzado, e devolve produto + link de afiliado por marketplace. Quando
houver oferta nos dois, o artigo mostra **dois botões**.

**Decisões já tomadas (confirmadas pelo dono):**
- Escopo inclui **os dois lados** (serviço na VM + cliente no blog).
- Transporte: **HTTP público na VM + `X-API-Key`** (migração para HTTPS fica como fase futura).
- Descoberta: **a VM busca por query**; Serper permanece só como fallback de indisponibilidade.
- Marketplaces do fluxo novo: **apenas ML e Shopee**. Amazon/Kabum/etc. continuam aparecendo
  apenas pelo caminho de fallback Serper.

---

## Arquitetura alvo

```
┌──────────────────────── GitHub Actions (runner) ────────────────────────┐
│  npm test  →  node scripts/gerar-artigo.mjs                             │
│                                                                          │
│   fetchProdutos(queries)                                                 │
│      │                                                                   │
│      ├─ AFFILIATE_MODE=remote ──► scripts/monitor_api.mjs                │
│      │        POST /api/produtos/buscar   (X-API-Key, timeout 25s, 2 retry)
│      │                                                                   │
│      └─ falha/vazio/legacy ────► scripts/google_shopping.mjs (Serper)    │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ HTTP :8086 (firewall GCP, tag blog-api)
                                   ▼
┌──────────────── VM monitor-telegram 34.29.27.155 ───────────────────────┐
│  NOVO: blog-produtos-api.service   (aiohttp, /opt/blog-produtos-api/)    │
│    app.py  ── rotas + auth + rate limit + cache TTL                      │
│    busca.py ─ orquestra ML + Shopee + pareamento cruzado                 │
│         │                                                                │
│         ├─ import monitor_core.affiliate      (ML  — já existe)          │
│         └─ import monitor_core.<shopee>       (Shopee — CONFIRMAR fase 0)│
│                                                                          │
│  INTOCADOS: monitor-bot-ml.service (:8080), searcher-ml.service          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Por que serviço separado e porta nova (8086):** requisito de zero downtime. O serviço só
**importa** os módulos existentes (leitura de código e de `automation/ml_cookies.json`); nunca
edita nem reinicia `monitor-bot-ml.service` / `searcher-ml.service`. Uso 8086 e não a 8085 do
plano antigo para não colidir com nada que tenha sido reservado desde então.

**Por que o cliente vive no GitHub Actions (Node) e não na blog VM:** o pipeline ativo é o CI;
a blog VM (`35.237.81.192`) é legado com `GITHUB_TOKEN` expirado. Nada novo vai para lá.

---

## Contrato de API

Base: `http://34.29.27.155:8086`. Header obrigatório em todas as rotas exceto `/api/health`:
`X-API-Key: <MONITOR_API_KEY>`. `Content-Type: application/json`.

### `GET /api/health` (sem auth)
```json
{ "ok": true, "version": "1.0.0", "uptime_s": 3821,
  "marketplaces": { "mercadolivre": { "ready": true, "session_age_h": 12.4 },
                    "shopee":       { "ready": true, "session_age_h": 30.1 } } }
```
Sempre HTTP 200 quando o processo vive; `ready:false` sinaliza sessão morta sem derrubar o
endpoint. O blog usa isso só para log/diagnóstico, nunca como gate bloqueante.

### `POST /api/produtos/buscar`
```json
{ "query": "mouse gamer wireless", "limit": 5,
  "marketplaces": ["mercadolivre", "shopee"], "min_price": 50, "max_price": 20000 }
```
- `query` (obrigatório, 3–120 chars), `limit` (default 5, máx 10), `marketplaces` (default
  ambos), `min_price`/`max_price` opcionais.

Resposta 200:
```json
{ "ok": true, "query": "mouse gamer wireless", "cached": false, "took_ms": 4120,
  "produtos": [ /* ver Modelo de dados */ ],
  "warnings": ["shopee: sessao expirada, resultado apenas de mercadolivre"] }
```
`produtos: []` com `ok: true` é resultado válido (não achou nada) — o blog cai para o fallback.

### `POST /api/produtos/buscar-lote`
```json
{ "queries": ["mouse gamer wireless", "headset gamer ps5"], "limit_por_query": 3 }
```
Máx **5** queries. Resposta: `{ "ok": true, "resultados": [ { "query": "...", "produtos": [...],
"warnings": [...] } ] }`. Processa sequencialmente na VM (respeita o rate limit interno de
1 req/s por marketplace). É o caminho preferido do blog — 1 round-trip em vez de 5.

### Erros

| HTTP | `error.code` | Ação do blog |
|---|---|---|
| 400 | `bad_request` | Não repetir. Log WARN, fallback Serper. |
| 401 | `unauthorized` | Não repetir. Log ERROR (chave errada), fallback Serper. |
| 429 | `rate_limited` | 1 retry após `retry_after` (header, default 5s), depois fallback. |
| 503 | `session_expired` | Sem retry. Log ERROR, fallback Serper. |
| 502 | `upstream_error` | 1 retry com backoff 2s, depois fallback. |
| 500 | `internal_error` | 1 retry, depois fallback. |
| — | timeout / DNS / ECONNREFUSED | 2 tentativas (backoff 1s, 3s), depois fallback. |

Corpo de erro: `{ "ok": false, "error": { "code": "...", "message": "..." } }`.

**Regra de ouro do cliente:** nenhum caminho de erro pode lançar exceção não tratada — toda
falha vira `[]` + log, e o pipeline segue para o Serper.

---

## Modelo de dados do produto

Superset **compatível** com o shape atual (`{id,title,price,original_price,thumbnail,permalink,
images,source}`), para não quebrar `sanitizeProducts` / `ensureProductImages` /
`injectProductCards`:

```json
{
  "id": "MLB3921...",
  "title": "Mouse Gamer Logitech G Pro X Superlight 2 Wireless",
  "price": 549.9,
  "original_price": 699.9,
  "thumbnail": "https://http2.mlstatic.com/....jpg",
  "images": ["https://..."],
  "permalink": "https://www.mercadolivre.com.br/...",
  "source": "Mercado Livre",
  "sources": ["mercadolivre", "shopee"],
  "affiliate_link": "https://meli.la/xxxxx",
  "offers": {
    "mercadolivre": { "permalink": "https://www.mercadolivre.com.br/...",
                      "affiliate_link": "https://meli.la/xxxxx",
                      "price": 549.9, "item_id": "MLB3921..." },
    "shopee":       { "permalink": "https://shopee.com.br/product/123/456",
                      "affiliate_link": "https://s.shopee.com.br/yyyyy",
                      "price": 529.0, "item_id": "123_456" }
  },
  "match_confidence": 0.87
}
```

**Invariantes que a VM garante:**
- `offers` tem 1 ou 2 chaves, nunca 0.
- Campos de topo (`price`, `permalink`, `thumbnail`, `source`, `affiliate_link`) são espelhos da
  **oferta mais barata**, garantindo que qualquer código legado que ignore `offers` continue
  funcionando.
- `sources` deriva de `Object.keys(offers)`.
- `match_confidence` só existe quando há 2 ofertas: similaridade de título (token-set ratio) +
  proximidade de preço. **Pareamento só é aceito com `match_confidence >= 0.75`**; abaixo disso a
  VM devolve dois produtos separados em vez de um pareado errado.

### Render dos dois botões

`buildProductButtonHtml` (`scripts/gerar-artigo.mjs:904`) passa a delegar:

```js
const OFFER_META = {
  mercadolivre: { label: "VER NO MERCADO LIVRE", cls: "product-btn product-btn--ml" },
  shopee:       { label: "VER NA SHOPEE",        cls: "product-btn product-btn--shopee" },
};

function buildOfferButtonsHtml(p) {
  const keys = Object.keys(p?.offers || {}).filter((k) => OFFER_META[k] && (p.offers[k].affiliate_link || p.offers[k].permalink));
  if (keys.length === 0) return "";                       // sem offers → caminho legado
  const btns = keys.map((k) => {
    const o = p.offers[k], m = OFFER_META[k];
    const href = o.affiliate_link || o.permalink;
    return `<a href="${href}" class="${m.cls}" target="_blank" rel="nofollow sponsored">${m.label}</a>`;
  });
  return btns.length === 1 ? btns[0] : `<div class="product-btns">\n${btns.join("\n")}\n</div>`;
}

function buildProductButtonHtml(p) {
  const dual = buildOfferButtonsHtml(p);
  if (dual) return dual;
  // ...corpo atual intacto (link = p.affiliate_link || p.permalink, productButtonLabel, class="product-btn")
}
```

Nada mais muda: `injectProductCards:1086` e `buildItemSection:2649` continuam chamando
`buildProductButtonHtml(p)` e recebem uma string HTML — só que agora pode ser um bloco com dois
`<a>`. `rel="nofollow sponsored"` é adicionado no caminho novo (correto para link de afiliado) e
mantido como `nofollow` no legado, para não quebrar as asserts existentes.

CSS em `src/pages/blog/[...slug].astro` (bloco `/* === Product Cards === */`, ~L354):
```css
#articleBody .product-btns { display:flex; flex-wrap:wrap; gap:.75rem; justify-content:center;
  max-width:420px; margin:1.5rem auto 0; }
#articleBody .product-btns .product-btn { margin:0; flex:1 1 180px; width:auto; }
#articleBody .product-btn--ml { background:#ffe600; color:#000; }
#articleBody .product-btn--shopee { background:#ee4d2d; color:#fff; }
```
(Não tocar em `.product-btn` base — os artigos antigos dependem dele.)

---

## Mudanças por arquivo

### VM monitor-telegram — `/opt/blog-produtos-api/` (tudo novo)
| Arquivo | Conteúdo |
|---|---|
| `app.py` | aiohttp app; rotas `/api/health`, `/api/produtos/buscar`, `/api/produtos/buscar-lote`; middleware `require_api_key` (compara `X-API-Key` com `hmac.compare_digest`); rate limit token-bucket 1 req/s + burst 3; cache em memória `dict[(query,limit)] → (ts, produtos)` TTL **1800s**; toda chamada bloqueante via `asyncio.to_thread`. |
| `busca.py` | `buscar(query, limit, marketplaces)` → **Shopee primeiro**, ML como enriquecimento; `_buscar_ml()`, `_buscar_shopee()`, `_parear(ml, shopee)` (normaliza título, token-set ratio + delta de preço ≤ 25% → `match_confidence`), `_montar_produto()` (aplica invariantes do modelo). |
| `adapters.py` | Isola o acoplamento com o código existente. **Único arquivo que importa de `/opt/afiliados-monitor-v2/`.** Faz o bootstrap `configure()` no import (padrão de `engine.py:312/389/613`) e expõe: `shopee_search(kw, limit)` → `shopee_api.search_products` + `shopee_offers._map_node` (**`offerLink` já é o afiliado — não chamar `generate_short_link` de novo**; usar `sub_ids=['blog']` só quando precisar gerar link avulso, para separar a receita do blog); `ml_search(q, limit)` → `offers.search_ml`; `ml_affiliate(url)` → `affiliate.generate_affiliate_link` (**retorna string; sucesso ⇔ `'meli.la' in resultado`**). |
| venv | **Reusar `/opt/afiliados-monitor-v2/venv`** (aiohttp 3.14.1 já instalado). Nenhum `pip install` — nunca escrever nesse venv. Sem `requirements.txt`. |
| `/etc/systemd/system/blog-produtos-api.service` | `User=sergioskm_cle`, `Restart=always`, `MemoryMax=512M`, `EnvironmentFile=/opt/blog-produtos-api/.env` (contém `BLOG_API_KEY`, `chmod 600`), `ExecStart=/opt/afiliados-monitor-v2/venv/bin/python /opt/blog-produtos-api/app.py`. |
| `smoke.sh` | curl das 3 rotas + caso 401 + caso 400. Usado como gate de cada fase. |

### blog-gamer
| Arquivo | Mudança |
|---|---|
| `scripts/monitor_api.mjs` **(novo)** | `buscarProdutosRemoto(query, opts)`, `buscarProdutosLoteRemoto(queries, opts)`, `checarSaudeRemota()`, `normalizarProdutoRemoto(raw)` (defensivo: valida tipos, força `offers` coerente, descarta item sem `title`/link). Usa `fetch` global + `AbortSignal.timeout(25_000)`, retry conforme tabela de erros. Nunca lança: retorna `[]`. |
| `scripts/gerar-artigo.mjs` | (a) consts novas perto da L455-460: `AFFILIATE_MODE`, `MONITOR_API_URL`, `MONITOR_API_KEY`. (b) nova `fetchProdutos(searchQueries, topic)` que encapsula o bloco L1893-1921: se `remote` → `buscarProdutosLoteRemoto`; se vazio/erro → Serper; fallback hardcoded L1923 permanece por último. (c) L1941-1943 vira `if (!p.affiliate_link) p.affiliate_link = p.permalink;` (não sobrescrever o link remoto). (d) `buildOfferButtonsHtml` + `OFFER_META` + delegação em `buildProductButtonHtml` (L904). (e) `sanitizeProducts` (L832): aceitar `id` de Shopee — trocar a extração `MLB\d{8,}` por `p.id || match(MLB) || match(shopee \d+/\d+) || hash(permalink)`. (f) exportar as funções novas para os testes. |
| `scripts/google_shopping.mjs` | Sem mudança de comportamento. Continua sendo o fallback. |
| `scripts/test-injecao.mjs` | Novos asserts (ver Testes). |
| `.github/workflows/gerar-conteudo.yml` | Adicionar ao `env` do step de geração: `AFFILIATE_MODE`, `MONITOR_API_URL`, `MONITOR_API_KEY` (todos via `secrets`/`vars`). |
| `.env.example` | `AFFILIATE_MODE=legacy`, `MONITOR_API_URL=http://IP:8086`, `MONITOR_API_KEY=`. Remover `ML_CLIENT_ID`/`ML_CLIENT_SECRET` (mortos) na fase de limpeza. |
| `docs/CREDENCIAIS.md`, `docs/PROGRESSO.md` | Documentar o serviço novo, secrets e o estado real. `PROGRESSO.md` está desatualizado (ainda descreve cookies ML como "pronto") — corrigir na fase 7. |
| `PLANO_AFILIADOS_API.md` | Adicionar nota apontando para este plano como sucessor. |

**O que NÃO desligar:** Serper permanece indefinidamente como fallback (requisito 3). O fallback
hardcoded de 6 produtos (L1923) também fica — é a última linha de defesa.

---

## Etapas com gates

Cada fase é reversível. Nenhuma altera o comportamento de produção até a **Fase 6**.

### Fase 0 — Auditoria da VM (read-only, ~30 min)
**Escopo:** confirmar as premissas antes de escrever código.
`ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155`, e mapear:
1. Módulo/função de **busca** e de **link de afiliado da Shopee** (`grep -ril shopee /opt/afiliados-monitor-v2/`).
2. Assinatura e retorno reais de `monitor_core/affiliate.py` e de `monitor_bot.py:~900`.
3. Como as sessões são persistidas (`ml_cookies.json` e o equivalente Shopee) e se são
   thread-safe para leitura concorrente.
4. Versão do Python, se aiohttp está disponível, portas em uso (`ss -tlnp`).

**Gate:** documento `docs/MONITOR_API_AUDITORIA.md` com as 4 respostas + assinaturas exatas.
**Se a capacidade Shopee não existir:** parar e reportar ao dono; ML-only ainda vale a pena
(fases seguem, `marketplaces` só com `mercadolivre`).
**Impacto em serviço:** nenhum.

### Fase 1 — Serviço no ar com health (só esqueleto)
**Escopo:** `/opt/blog-produtos-api/` com `app.py` respondendo `/api/health` e as duas rotas de
busca retornando `501 not_implemented`. Systemd + firewall GCP (regra `allow-blog-api`, tcp:8086,
target tag da VM).
**Gate:**
```bash
systemctl is-active blog-produtos-api           # active
systemctl is-active monitor-bot-ml searcher-ml  # active  ← prova de zero downtime
curl -s http://34.29.27.155:8086/api/health
curl -s -o /dev/null -w '%{http_code}' -X POST http://34.29.27.155:8086/api/produtos/buscar  # 401
```
**Rollback:** `systemctl stop blog-produtos-api` + remover a regra de firewall.

### Fase 2 — Busca Shopee real *(era ML; invertido após a Fase 0)*
**Escopo:** `adapters.py` (bootstrap + Shopee) + `busca.py` sem pareamento;
`/api/produtos/buscar` com `marketplaces:["shopee"]` funcional, com cache e rate limit.
Vem primeiro por ser o caminho sem sessão/cookie — valida a API inteira sem depender do ML.
**Gate:** `curl` retorna ≥1 produto com `offers.shopee.affiliate_link` não vazio; 2ª chamada
idêntica devolve `cached:true` e `took_ms < 50`; `ShopeeRateLimitError` (código 10030) vira
HTTP 429 e não 500; serviços antigos continuam `active`.

### Fase 3 — ML + pareamento cruzado
**Escopo:** `adapters.py` (ML), `_parear`, fallback cruzado, `warnings`, rota de lote.
Tratar o contrato peculiar de `generate_affiliate_link`: **string, e falha devolve a própria
URL** — se `'meli.la' not in resultado`, marcar a oferta como não-afiliada e emitir `warning`,
nunca publicar como se fosse afiliada.
**Gate:** query com resultado nos dois marketplaces devolve produto com `sources` de tamanho 2 e
`match_confidence >= 0.75`; query só-Shopee devolve `sources:["shopee"]` + warning; com o ML
falhando de propósito (cookies renomeados temporariamente **não** — usar query inexistente), a
resposta ainda sai monetizada via Shopee; rota de lote com 3 queries responde em < 60s. Rodar
`smoke.sh` inteiro.

### Fase 4 — Cliente Node no blog (inativo)
**Escopo:** `scripts/monitor_api.mjs` + `fetchProdutos()` + consts, com **`AFFILIATE_MODE`
default `legacy`**. Secrets no GitHub. Comportamento de produção inalterado.
**Gate:** `npm test` verde; local com `AFFILIATE_MODE=remote node scripts/gerar-artigo.mjs`
gera artigo com `meli.la`/`s.shopee.com.br` nos hrefs; com a VM desligada, o mesmo comando gera
artigo normalmente via Serper (log `WARN monitor_api: ... → fallback Serper`).

### Fase 5 — Botão duplo
**Escopo:** `buildOfferButtonsHtml`, delegação em `buildProductButtonHtml`, `sanitizeProducts`
com id genérico, CSS em `[...slug].astro`, asserts novos.
**Gate:** `npm test` verde (incluindo os asserts legados de label); `npm run build` sem erro;
inspeção visual de um artigo gerado com produto pareado (dois botões lado a lado, empilhando no
mobile).

### Fase 6 — Ativação
**Escopo:** trocar o default para `AFFILIATE_MODE=remote` (variável do workflow).
**Gate:** 3 execuções diárias consecutivas do cron gerando artigo com ≥3 produtos afiliados e
zero falha de pipeline. Conferir cliques/links manualmente no 1º artigo.
**Rollback:** mudar a variável para `legacy` no GitHub — sem deploy, sem código.

### Fase 7 — Limpeza e endurecimento
**Escopo:** deletar `scripts/fix-article-links.mjs`, `scripts/ml_affiliate.mjs`,
`automation/ml_affiliate.py` (mortos); atualizar `docs/PROGRESSO.md` e `docs/CREDENCIAIS.md`;
remover `ML_CLIENT_ID`/`ML_CLIENT_SECRET` do `.env.example`; **verificar se o `.env` real (22 KB
na raiz) está no `.gitignore`** — se estiver versionado, rotacionar todas as chaves.
Opcional: migrar 8086 para HTTPS via Cloudflare Tunnel e restringir o firewall.

---

## Configuração e secrets

| Nome | Onde | Valor |
|---|---|---|
| `MONITOR_API_URL` | GitHub **variable** + `.env` local | `http://34.29.27.155:8086` |
| `MONITOR_API_KEY` | GitHub **secret** + `.env` local | token aleatório ≥32 bytes (`openssl rand -hex 32`) |
| `AFFILIATE_MODE` | GitHub **variable** | `legacy` até a Fase 6, depois `remote` |
| `BLOG_API_KEY` | `/opt/blog-produtos-api/.env` na VM (`chmod 600`) | **mesmo valor** de `MONITOR_API_KEY` |

Nenhum valor real entra no repositório, em log ou em mensagem de commit. O cliente Node nunca
loga a chave nem a URL completa com query.

---

## Testes

**API (na VM):** `smoke.sh` cobrindo — health; busca ML; busca Shopee; busca pareada; query sem
resultado (`ok:true, produtos:[]`); sem `X-API-Key` (401); chave errada (401); `query` vazia
(400); lote com 6 queries (400); 5 chamadas em 1s (429 + `retry_after`).

**`scripts/test-injecao.mjs`** (asserts manuais via `ok`/`igual`, sem framework — seguir o padrão
existente). Adicionar:
1. `buildOfferButtonsHtml` com 2 offers → contém exatamente 2 `<a`, ambas as classes
   `--ml`/`--shopee`, wrapper `product-btns`, `rel="nofollow sponsored"`.
2. Com 1 offer → um `<a` só, **sem** wrapper.
3. Com `offers` ausente → cai no caminho legado e continua produzindo
   `class="product-btn"` + label correto (protege os asserts de loja em L102-112).
4. `offers` com marketplace desconhecido ou sem link → ignorado, sem HTML quebrado.
5. `normalizarProdutoRemoto` (de `monitor_api.mjs`) contra um fixture da resposta real:
   preenche `sources`, espelha a oferta mais barata no topo, descarta item sem título.
6. `sanitizeProducts` aceita produto Shopee (id não-MLB) e não o descarta.
7. `injectProductCards` com um produto de 2 offers substitui `[PRODUTO: 1]` pelo bloco duplo.

Testes de rede ficam **fora** do `npm test` (o CI não deve depender da VM); o smoke remoto é
manual/gate de fase.

---

## Riscos e premissas

| # | Premissa / risco | Mitigação | Confirmar em |
|---|---|---|---|
| 1 | ~~A VM realmente gera link de afiliado da **Shopee**~~ | **RESOLVIDO na Fase 0** — API oficial GraphQL, `offerLink` já é afiliado. | ✅ |
| 1b | Rate limit da API de afiliados Shopee (código 10030) sob carga de lote. | `ShopeeRateLimitError` já é uma exceção tipada → mapear para HTTP 429 + `retry_after`; cache TTL 30 min; lote sequencial. | Fase 2 |
| 1c | `ml_cookies.json` tinha 3 dias na auditoria e o ML tem breaker de 300s. | Shopee-first garante monetização mesmo com ML fora; `warnings` expõe o estado. Renovação via `instalar_cookies_ml.sh`. | Fase 3 |
| 2 | Pareamento ML↔Shopee do "mesmo produto" é heurístico e pode errar (variante, bundle, seller diferente). | Threshold `match_confidence >= 0.75`; abaixo disso, produtos separados. Revisar amostra na Fase 3. | Fase 3 |
| 3 | Latência: 5 queries × 2 marketplaces pode estourar o job. | Rota de **lote**, cache TTL 30 min, timeout 25s no cliente, `limit` baixo. Se a busca demorar, o artigo sai com Serper. | Fase 3/4 |
| 4 | Ler `ml_cookies.json` concorrentemente com o bot pode disparar refresh/fingerprint. | `adapters.py` abre **read-only**, nunca reescreve sessão. Monitorar o bot após a Fase 2. | Fase 2 |
| 5 | HTTP sem TLS expõe a API key em trânsito. | Chave longa e rotacionável, rate limit, sem dado sensível no payload. Fase 7 migra p/ HTTPS. | aceito |
| 6 | Novo serviço competindo por CPU/RAM com o monitor. | Venv e processo separados; `MemoryMax=512M` no unit; cache reduz carga. | Fase 1 |
| 7 | Sessões (ML/Shopee) expiram silenciosamente → artigos voltam a sair sem comissão sem ninguém notar. | `warnings` na resposta + log ERROR distinto no blog + `ready:false` no health. Sugestão: alerta no bot do Telegram se `ready:false` por > 6h. | Fase 3 |
| 8 | Firewall GCP aberto para `0.0.0.0/0` (IPs do runner do Actions são amplos demais para allowlist). | Aceito conscientemente; auth por chave + rate limit. | Fase 1 |
| 9 | Compliance de afiliado (ML/Shopee exigem disclosure de link patrocinado). | `rel="nofollow sponsored"` + o frontmatter já marca `affiliate: true`. Verificar se o layout exibe aviso ao leitor. | Fase 5 |

## Verificação end-to-end (após a Fase 6)

1. `curl -s http://34.29.27.155:8086/api/health` → `ready:true` nos dois marketplaces.
2. `gh workflow run gerar-conteudo.yml -f force=true` e acompanhar o log: deve aparecer
   `monitor_api: N produtos (ml=X, shopee=Y)` e **não** `fallback Serper`.
3. Abrir o artigo publicado: produtos pareados mostram dois botões; os hrefs começam com
   `https://meli.la/` e `https://s.shopee.com.br/`.
4. Clicar em ambos e confirmar no painel de afiliado de cada plataforma que o clique foi rastreado.
5. Parar o serviço na VM (`systemctl stop blog-produtos-api`), rodar o workflow de novo:
   o artigo ainda é gerado, via Serper, sem falha — prova do requisito de fallback.
