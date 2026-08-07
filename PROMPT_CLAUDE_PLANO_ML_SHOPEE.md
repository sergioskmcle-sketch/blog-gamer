# ORDEM DE EXECUÇÃO — Frente 4: afiliados ML + Shopee no blog-gamer

> **Este documento NÃO pede um plano. O plano já está decidido.**
>
> Não projete arquitetura, não proponha alternativas, não pergunte nada, não peça confirmação.
> Execute os **Passos 1 a 8** da seção 7, na ordem, e valide cada gate antes de seguir.
> Se algo parecer ambíguo, **siga literalmente o que está escrito aqui**.
>
> Todo o código que você precisa escrever está colado neste arquivo. Os números de linha foram
> reverificados no repositório em **06/08/2026** e estão corretos.
>
> Responda e comente sempre em **português do Brasil**.

**Critério de pronto (todos obrigatórios):**

- [ ] `scripts/monitor_api.mjs` criado
- [ ] `scripts/gerar-artigo.mjs` alterado nos 6 pontos do Passo 3
- [ ] CSS do botão duplo em `src/pages/blog/[...slug].astro`
- [ ] Testes novos em `scripts/test-injecao.mjs` e `npm test` verde
- [ ] `npm run build` sem erro
- [ ] Gate de fallback passa (VM fora do ar → artigo sai mesmo assim)
- [ ] `.env.example` e `.github/workflows/gerar-conteudo.yml` atualizados
- [ ] Commits feitos na branch `feat/afiliados-ml-shopee`, com `AFFILIATE_MODE=legacy`

**Fora do seu escopo (não faça):** ativar `AFFILIATE_MODE=remote` no GitHub (o dono faz),
manutenção na VM, deploy do serviço Python, limpeza de `/var/log`, mexer no `/api/faltantes`.

---

## 1. Contexto em 10 linhas

O blog **blog-gamer** (Astro 5 + GitHub Pages) publica artigos com botões de compra que **não geram
comissão nenhuma**: em `scripts/gerar-artigo.mjs`, linha 1942, existe literalmente
`p.affiliate_link = p.permalink;`. Os produtos vêm do Google Shopping (Serper.dev), que devolve
links diretos de loja.

O dono tem uma segunda VM (projeto **monitor-telegram**) que descobre produtos e **já gera links de
afiliado** do Mercado Livre e da Shopee o dia inteiro, em três "frentes". A **Frente 4** — o serviço
`blog-produtos-api`, porta 8086 — **já está no ar** e serve esses produtos por HTTP, com o link de
afiliado pronto, a partir de um banco SQLite com ~792 produtos.

**A Frente 4 não busca nada e não gasta requisição de marketplace.** Ela só lê o que as Frentes
1/2/3 já descobriram e já afiliaram.

**Seu trabalho é só um:** ensinar o blog a consultar esse serviço, com fallback para o Google
Shopping quando ele não responder.

---

## 2. Proibições absolutas

Cinco regras sem exceção. Violar qualquer uma causa prejuízo real ao dono.

### ❌ 1 — Nunca gerar link de afiliado do Mercado Livre a partir do blog

Não chame `generate_affiliate_link`, `affiliate.py`, nem nada que use os cookies do ML.
**Não ative `BLOG_ML_ENABLED=1`.**

*Por quê:* em 06/08/2026 isso foi feito e derrubou a sessão do ML (`401 auth_error`). A Frente 1
parou de postar por 1 hora e o dono precisou exportar cookies novos de madrugada. A sessão do ML
**não suporta um segundo programa usando ela**.

*Em vez disso:* consuma os produtos da API — os links de afiliado **já vêm prontos**.

### ❌ 2 — Nunca chamar `getUpdates` do Telegram

Apenas `sendMessage`. O Telegram entrega cada mensagem **uma única vez por token**; escutar com o
token do bot rouba as mensagens da Frente 1 e quebra a detecção nos grupos **sem gerar erro nenhum
no log**.

### ❌ 3 — Nunca parar, reiniciar ou editar os serviços do monitor

Proibido tocar em `monitor-bot-ml`, `searcher-ml` e `searcher-panel`.

### ❌ 4 — Nunca escrever dentro de `/opt/afiliados-monitor-v2/`

Esse diretório é do monitor. O serviço do blog **só lê** de lá.

### ❌ 5 — Nunca rodar `pip install` no venv do monitor

`/opt/afiliados-monitor-v2/venv` é compartilhado e tem `curl_cffi 0.16.0`, que sustenta a sessão do
ML. Tudo que o serviço precisa (`aiohttp`) já está instalado.

> Nesta ordem de execução você **não precisa alterar nada na VM**. O único acesso SSH autorizado é
> de leitura: pegar a chave da API (Passo 1) e conferir o `/api/health`.

---

## 3. Fichário de infraestrutura

| Item | Valor |
|---|---|
| **Repositório** | `c:\Users\sismais\Documents\Projetos Pessoais\blog-gamer` |
| **Branch de trabalho** | `feat/afiliados-ml-shopee` (já existe — `git checkout feat/afiliados-ml-shopee`) |
| **Branch principal** | `main` |
| **Remote** | `https://github.com/sergioskmcle-sketch/blog-gamer.git` |
| **Site publicado** | `https://sergioskmcle-sketch.github.io/blog-gamer/` |
| **API da Frente 4** | `http://34.29.27.155:8086` |
| **API pelo loopback (na VM)** | `http://127.0.0.1:8086` |
| **Autenticação da API** | header `X-API-Key: <BLOG_API_KEY>` em todas as rotas, menos `/api/health` |
| **VM do monitor** | `34.29.27.155` (`ml-monitor-telegram`), user `sergioskm_cle`, zona `us-central1-a` |
| **Acesso SSH** | `ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155` (sudo sem senha; VM em UTC) |
| **Serviços na VM — NUNCA TOCAR** | `monitor-bot-ml`, `searcher-ml`, `searcher-panel` |
| **Serviço da Frente 4** | `blog-produtos-api` (o único que pode ser reiniciado — mas não nesta tarefa) |
| **Código do serviço na VM** | `/opt/blog-produtos-api/` (cópia versionada em `infra/blog-produtos-api/`) |
| **Banco de produtos** | `/opt/blog-produtos-api/catalogo.db` (SQLite, ~792 produtos: 646 ML + 146 Shopee, 0,57 MB) |
| **Chaves do serviço** | `/opt/blog-produtos-api/.env` (chmod 600, não versionado) |
| **VM do blog (legado)** | `35.237.81.192` — **morta, token expirado. IGNORE.** |
| **3ª VM (Shopee)** | `34.27.101.162` — **fora de escopo nesta tarefa.** |
| **Porta 8085** | do `PLANO_AFILIADOS_API.md` — **superada, nunca existiu. NÃO USAR.** |
| **URL de falha proposital** | `http://127.0.0.1:9999` (usada no gate de fallback) |
| **Preview local do Astro** | `http://127.0.0.1:4321/blog-gamer` (`npm run dev`) |
| **Node no CI** | 22 |

Comando de segurança — depois de **qualquer** operação na VM, as 4 linhas têm que dizer `active`:

```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api'
```

---

## 4. Mapa de diretórios

```
blog-gamer/
├─ scripts/                       ← TODO O SEU TRABALHO EM JS ESTÁ AQUI
│  ├─ gerar-artigo.mjs            ← gerador principal (~2.750 linhas). EDITAR (Passo 3)
│  ├─ monitor_api.mjs             ← NÃO EXISTE. VOCÊ VAI CRIAR (Passo 2)
│  ├─ google_shopping.mjs         ← searchGoogleShopping(query, apiKey, limit). NÃO EDITAR
│  └─ test-injecao.mjs            ← testes (node:assert, sem framework). EDITAR (Passo 5)
├─ src/
│  ├─ pages/blog/[...slug].astro  ← CSS dos artigos. EDITAR (Passo 4)
│  ├─ content/artigos/*.md        ← 21 artigos publicados
│  └─ content.config.ts           ← frontmatter (title, description, pubDate, tags, image,
│                                    category, affiliate: boolean = false)
├─ infra/blog-produtos-api/       ← cópia versionada do serviço Python (aiohttp). NÃO EDITAR
│  ├─ app.py busca.py catalogo.py adapters.py aviso.py
│  ├─ blog-produtos-api.service
│  └─ README.md
├─ .github/workflows/
│  └─ gerar-conteudo.yml          ← pipeline ativo (cron 30 9 * * *). EDITAR (Passo 6)
├─ docs/                          ← CREDENCIAIS.md, PROGRESSO.md, MONITOR_API_AUDITORIA.md,
│                                    TROUBLESHOOTING.md, REGRAS.md, ESTRUTURA.md, FLUXO.md
├─ FRENTE_4_RETOMADA.md           ← doc canônico. Este arquivo é o resumo executável dele
├─ .env                           ← gitignorado, valores reais
├─ .env.example                   ← versionado, só placeholders. EDITAR (Passo 6)
└─ package.json                   ← "test": "node scripts/test-injecao.mjs"
```

**Legados — NÃO usar, NÃO editar, NÃO se inspirar:**

| Caminho | Por quê |
|---|---|
| `scripts/ml_affiliate.mjs` | lógica antiga de `meli.la` com cookies/CSRF. Fora do pipeline |
| `scripts/fix-article-links.mjs` | substituía `?tag=sergioskm`. Obsoleto |
| `automation/**` (Python) | pipeline legado morto (`generate_article.py`, `ml_affiliate.py`, `scheduler.py`, `admin_api.py`) |
| `blog/` (HTML) | site antigo |
| `PLANO_AFILIADOS_API.md` | **superado** — propunha porta 8085, nunca implementado |
| `automation/docs/CREDENCIAIS.md` | duplicata legada de `docs/CREDENCIAIS.md` |

Scripts do `package.json`: `dev` (astro dev), `build` (astro build), `preview` (astro preview),
`test` (node scripts/test-injecao.mjs).

---

## 5. Credenciais e variáveis de ambiente

**Regra de ouro: nenhum valor de segredo pode ser escrito em arquivo versionado, em mensagem de
commit, ou impresso em log.** O `.env` da raiz já está no `.gitignore`.

### Variáveis que esta tarefa introduz

| Variável | Onde vive | Valor |
|---|---|---|
| `MONITOR_API_URL` | `.env` local + GitHub **variable** | `http://34.29.27.155:8086` |
| `MONITOR_API_KEY` | `.env` local + GitHub **secret** | = `BLOG_API_KEY` da VM (Passo 1) |
| `AFFILIATE_MODE` | `.env` local + GitHub **variable** | `legacy` agora; `remote` quando o dono ativar |

### Variáveis que já existem (não mexer)

`.env` da raiz, todas preenchidas: `ADMIN_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`,
`GROQ_API_KEY`, `ML_AFFILIATE_TAG`, `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_COOKIES_B64`,
`OPENAI_API_KEY`, `RAWG_API_KEY`, `STABILITY_API_KEY`, `TAVILY_API_KEY`.

Secrets já cadastrados no GitHub Actions: `GEMINI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`,
`SERPER_API_KEY`, `RAWG_API_KEY`, `OPENAI_API_KEY`, `STABILITY_API_KEY`.

### Variáveis que vivem só na VM (você não configura)

| Variável | Arquivo na VM | Observação |
|---|---|---|
| `BLOG_API_KEY` | `/opt/blog-produtos-api/.env` | é a chave que você lê no Passo 1 |
| `BLOG_API_PORT` | idem | default `8086` |
| `BLOG_ML_ENABLED` | idem | **ausente de propósito. NUNCA ativar** (Proibição 1) |
| `SHOPEE_APP_ID`, `SHOPEE_SECRET`, `ML_COOKIES_PATH`, `ML_CLIENT_ID`, `ML_CLIENT_SECRET` | `/opt/afiliados-monitor-v2/searcher/.env` | do monitor. Não são do blog |
| `TELEGRAM_BOT_TOKEN`, `PANEL_TOKEN` | idem | deliberadamente ignorados pelo serviço |

---

## 6. Contrato da API (já implementado — não precisa inspecionar a VM)

**Base:** `http://34.29.27.155:8086` · **Header:** `X-API-Key: <chave>` (exceto `/api/health`)

| Rota | Método | Uso nesta tarefa |
|---|---|---|
| `/api/health` | GET | diagnóstico. Sem auth |
| `/api/produtos/buscar` | POST | busca 1 consulta |
| `/api/produtos/buscar-lote` | POST | **o que o blog usa** — até 5 consultas |
| `/api/catalogo` | GET | estatísticas do banco |
| `/api/afiliar` | POST | afilia URLs avulsas. Shopee só; ML travado. **Não usar** |
| `/api/faltantes` | POST | aviso no Telegram. **Fora de escopo** |

**Request de `/api/produtos/buscar`:**
`{"query": "headset gamer", "limit": 5}` — `query` 3–120 chars, `limit` 1–10 (default 5).
Opcionais: `marketplaces` (`["shopee","mercadolivre"]`), `min_price`, `max_price`.

**Request de `/api/produtos/buscar-lote`:**
`{"queries": ["mouse gamer","teclado mecanico"], "limit_por_query": 3}` — máx. 5 queries.
Resposta: `{"ok":true,"resultados":[{"query","produtos","cached","warnings"}]}`.

**Resposta de `/api/produtos/buscar`:**

```json
{
  "ok": true,
  "query": "headset gamer",
  "cached": false,
  "took_ms": 12,
  "warnings": [],
  "produtos": [
    {
      "id": "MLB123456789",
      "title": "Headset Gamer Redragon Pandora 2 RGB P2 H350RGB-1",
      "price": 181.0,
      "original_price": 0,
      "thumbnail": "https://http2.mlstatic.com/....jpg",
      "images": ["https://http2.mlstatic.com/....jpg"],
      "permalink": "https://www.mercadolivre.com.br/...",
      "source": "Mercado Livre",
      "sources": ["mercadolivre"],
      "affiliate_link": "https://meli.la/2NMK1Tf",
      "offers": {
        "mercadolivre": {
          "permalink": "https://www.mercadolivre.com.br/...",
          "affiliate_link": "https://meli.la/2NMK1Tf",
          "price": 181.0,
          "item_id": "MLB123456789"
        }
      },
      "preco_de": "2026-08-05",
      "origem": "catalogo"
    }
  ]
}
```

**Campos que importam:**

- `affiliate_link` — **é este que vai no botão do artigo.** Sempre existe.
- `sources` — lojas do produto: `["mercadolivre"]`, `["shopee"]` ou as duas.
- `offers` — dados por loja. **É daqui que sai o botão duplo.**
- `preco_de` — data de captura do preço. **Não é o preço de hoje.**
- Campos de topo (`price`, `permalink`, `source`) espelham sempre a **oferta mais barata**.

**Erros:** `{"ok":false,"error":{"code","message"}}` com `bad_request` (400), `unauthorized` (401),
`rate_limited` (429 + `Retry-After`), `internal_error` (500).

**Rate limit HTTP:** 5 req/s, burst 20. **Cache:** 30 min. **Cobertura já testada:** as 8 consultas
típicas de artigo (`mouse gamer`, `teclado mecanico`, `headset gamer`, `cadeira gamer`,
`monitor gamer`, `placa de video`, `notebook gamer`, `ssd nvme`) devolvem 5 produtos cada, com
mistura de ~3 ML + 2 Shopee.

---

## 7. PASSOS DE EXECUÇÃO

```bash
cd "c:/Users/sismais/Documents/Projetos Pessoais/blog-gamer"
git checkout feat/afiliados-ml-shopee
```

### PASSO 1 — Pegar a chave da API

```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env'
```

Grave o valor **apenas** no `.env` da raiz (gitignorado), como `MONITOR_API_KEY=...`, junto de
`MONITOR_API_URL=http://34.29.27.155:8086` e `AFFILIATE_MODE=legacy`.
**Nunca escreva esse valor em arquivo versionado, em commit ou em log.**

**Gate:**
```bash
curl -s http://34.29.27.155:8086/api/health
```
Esperado: JSON com `"ok": true` e `"version": "2.0.0-frente4"`.

---

### PASSO 2 — Criar `scripts/monitor_api.mjs`

Crie o arquivo com **exatamente** este conteúdo:

```js
// Cliente HTTP da Frente 4 (blog-produtos-api, na VM do monitor).
//
// REGRA DE OURO: este modulo NUNCA lanca excecao. Toda falha vira lista vazia
// + log. Se a VM estiver fora do ar, o artigo tem que sair mesmo assim, usando
// o Google Shopping como antes.

const BASE = (process.env.MONITOR_API_URL || "").replace(/\/+$/, "");
const KEY = process.env.MONITOR_API_KEY || "";
const TIMEOUT_MS = 25000;

function log(nivel, msg) {
  console.log(`[${nivel}] monitor_api: ${msg}`);
}

// Erros que nao adianta repetir: a resposta seria a mesma.
const SEM_RETRY = new Set([400, 401, 503]);

async function chamar(rota, corpo, tentativa = 1) {
  if (!BASE || !KEY) {
    log("WARN", "MONITOR_API_URL/MONITOR_API_KEY ausentes — usando fallback");
    return null;
  }
  try {
    const r = await fetch(`${BASE}${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": KEY },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (r.ok) return await r.json();

    if (SEM_RETRY.has(r.status)) {
      log("WARN", `HTTP ${r.status} em ${rota} — sem retry, indo para fallback`);
      return null;
    }
    if (tentativa < 3) {
      const espera = tentativa * 2000;
      log("WARN", `HTTP ${r.status} em ${rota} — tentativa ${tentativa}, aguardando ${espera}ms`);
      await new Promise((s) => setTimeout(s, espera));
      return chamar(rota, corpo, tentativa + 1);
    }
    log("WARN", `HTTP ${r.status} em ${rota} — desistindo`);
    return null;
  } catch (e) {
    if (tentativa < 3) {
      await new Promise((s) => setTimeout(s, tentativa * 1000));
      return chamar(rota, corpo, tentativa + 1);
    }
    log("WARN", `${e.message} — desistindo, indo para fallback`);
    return null;
  }
}

// Valida e limpa um produto vindo da API. Devolve null se for inutilizavel.
export function normalizarProdutoRemoto(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim();
  if (!title) return null;

  const offers = {};
  for (const [loja, o] of Object.entries(raw.offers || {})) {
    if (!o || typeof o !== "object") continue;
    const link = String(o.affiliate_link || o.permalink || "").trim();
    if (!link) continue;
    offers[loja] = {
      permalink: String(o.permalink || link),
      affiliate_link: String(o.affiliate_link || ""),
      price: Number(o.price) || 0,
      item_id: String(o.item_id || ""),
    };
  }
  if (Object.keys(offers).length === 0) return null;

  const thumb = String(raw.thumbnail || "");
  return {
    id: String(raw.id || ""),
    title,
    price: Number(raw.price) || 0,
    original_price: Number(raw.original_price) || 0,
    thumbnail: thumb,
    images: Array.isArray(raw.images) && raw.images.length ? raw.images : (thumb ? [thumb] : []),
    permalink: String(raw.permalink || ""),
    source: String(raw.source || ""),
    sources: Object.keys(offers),
    affiliate_link: String(raw.affiliate_link || ""),
    offers,
    preco_de: String(raw.preco_de || ""),
    origem: String(raw.origem || "remoto"),
  };
}

export async function buscarProdutosRemoto(query, { limit = 5 } = {}) {
  const d = await chamar("/api/produtos/buscar", { query, limit });
  if (!d || !d.ok) return [];
  const produtos = (d.produtos || []).map(normalizarProdutoRemoto).filter(Boolean);
  log("INFO", `"${query}" -> ${produtos.length} produtos`);
  return produtos;
}

export async function buscarProdutosLoteRemoto(queries, { limitPorQuery = 3 } = {}) {
  const lote = (queries || []).filter(Boolean).slice(0, 5);
  if (lote.length === 0) return [];
  const d = await chamar("/api/produtos/buscar-lote",
                         { queries: lote, limit_por_query: limitPorQuery });
  if (!d || !d.ok) return [];

  const todos = [];
  const vistos = new Set();
  for (const r of d.resultados || []) {
    for (const bruto of r.produtos || []) {
      const p = normalizarProdutoRemoto(bruto);
      if (!p) continue;
      const chave = `${p.sources[0]}:${p.id}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      todos.push(p);
    }
  }
  log("INFO", `lote de ${lote.length} consultas -> ${todos.length} produtos`);
  return todos;
}

export async function avisarFaltantes(faltantes) {
  if (!faltantes || faltantes.length === 0) return false;
  const d = await chamar("/api/faltantes", { faltantes });
  return Boolean(d && d.avisado);
}
```

**Gate:** `node -e "import('./scripts/monitor_api.mjs').then(m => console.log(Object.keys(m)))"`
Esperado: `[ 'normalizarProdutoRemoto', 'buscarProdutosRemoto', 'buscarProdutosLoteRemoto', 'avisarFaltantes' ]`

---

### PASSO 3 — Alterar `scripts/gerar-artigo.mjs` (6 pontos)

#### 3.1 — Importar o cliente

No topo do arquivo, junto dos outros `import` (perto da linha 6, onde está
`import { searchGoogleShopping } from "./google_shopping.mjs";`), adicione:

```js
import { buscarProdutosLoteRemoto } from "./monitor_api.mjs";
```

#### 3.2 — Adicionar a constante do modo

**Linha 460** é `const MAX_PRODUCTS = 5;`. Adicione **logo abaixo**:

```js
// remote = usa a Frente 4 (produtos com comissao). legacy = so Google Shopping.
const AFFILIATE_MODE = process.env.AFFILIATE_MODE || "legacy";
```

#### 3.3 — Fazer a busca usar a Frente 4

O trecho atual, nas **linhas 1893–1894**, é:

```js
  let mlProducts = [];
  if (SERPER_API_KEY) {
```

Substitua essas duas linhas por:

```js
  let mlProducts = [];
  // Dedup compartilhado entre Frente 4 e Google Shopping: sem isto, o Serper
  // reinsere produto que a Frente 4 ja trouxe.
  const seen = new Set();

  // Frente 4 primeiro: produtos que ja vem com link de afiliado.
  if (AFFILIATE_MODE === "remote") {
    try {
      const trendingKws = topic.trending_keywords || [];
      const queriesRemotas = [
        ...trendingKws.slice(0, 2),
        topic.ml_query,
      ].filter(Boolean).slice(0, 5);

      const remotos = await buscarProdutosLoteRemoto(queriesRemotas, { limitPorQuery: 3 });
      for (const p of remotos) {
        if (mlProducts.length >= MAX_PRODUCTS) break;
        if (p.permalink && seen.has(p.permalink)) continue;
        if (p.permalink) seen.add(p.permalink);
        mlProducts.push(p);
      }
      log("INFO", `Frente 4: ${mlProducts.length} produtos com afiliado`);
    } catch (e) {
      log("WARN", `Frente 4 falhou: ${e.message} — seguindo com Google Shopping`);
    }
  }

  // Google Shopping so completa o que faltou (ou assume tudo, no modo legacy).
  if (SERPER_API_KEY && mlProducts.length < MAX_PRODUCTS) {
```

⚠️ **Importante:** dentro do bloco `if (SERPER_API_KEY)` existe hoje uma linha
`const seen = new Set();` (logo depois do array `searchQueries`). **Remova essa linha** — o `Set`
agora é o que você declarou acima. Sem isso o `const` duplicado quebra o arquivo.

#### 3.4 — Não sobrescrever o link de afiliado

O trecho na **linha ~1941** é:

```js
      for (const p of mlProducts) {
        p.affiliate_link = p.permalink;
      }
```

Substitua por:

```js
      for (const p of mlProducts) {
        // Produto vindo da Frente 4 ja tem link de afiliado — nao sobrescrever.
        if (!p.affiliate_link) p.affiliate_link = p.permalink;
      }
```

> Esta é **a linha que zera a comissão hoje**. Sem esta correção nada do resto adianta.

#### 3.5 — Aceitar produtos da Shopee em `sanitizeProducts`

A função começa na **linha 832**. Na **linha 842** está:

```js
    const id = p.id || (url.match(/MLB\d{8,}/) || [])[0] || "";
```

Substitua por:

```js
    // Produto da Shopee nao tem id no formato MLB — sem isto ele seria descartado.
    const id = p.id
      || (url.match(/MLB\d{8,}/) || [])[0]
      || (url.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/) || []).slice(1, 3).join("_")
      || "";
```

#### 3.6 — Criar o botão duplo

`function buildProductButtonHtml(p)` está na **linha 904**. **Antes** dela, adicione:

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

Agora altere `buildProductButtonHtml` para delegar. **O corpo atual continua existindo** — ele só
passa a ser o caminho de quando não há `offers`:

```js
function buildProductButtonHtml(p) {
  // Produto da Frente 4: um botao por loja.
  const duplo = buildOfferButtonsHtml(p);
  if (duplo) return duplo;

  // Caminho antigo (Google Shopping) — NAO ALTERAR, os testes dependem dele.
  const link = p.affiliate_link || p.permalink || "";
  if (!link) return "";
  const label = productButtonLabel(p);
  return `<a href="${link}" class="product-btn" target="_blank" rel="nofollow">${label}</a>`;
}
```

⚠️ Não mexa no caminho antigo. Os testes em `test-injecao.mjs` verificam exatamente aquele formato.

#### 3.7 — Exportar a função nova

O bloco `export {` começa na **linha 2726**. Adicione `buildOfferButtonsHtml` à lista, logo depois
de `buildProductButtonHtml`:

```js
  buildProductButtonHtml,
  buildOfferButtonsHtml,
  productButtonLabel,
```

> Sem isto o import do Passo 5 quebra com `SyntaxError: does not provide an export named`.
> A função também tem `export` na declaração (3.6) — em ESM isso é redundante e causa erro de
> duplicidade. **Escolha um dos dois:** ou remova o `export` da declaração em 3.6, ou não a
> adicione ao bloco `export {}`. Recomendado: **manter `export function` em 3.6 e NÃO adicionar ao
> bloco**, que é o caminho com menos edição.

**Gate do Passo 3:**
```bash
node --check scripts/gerar-artigo.mjs
node -e "import('./scripts/gerar-artigo.mjs').then(m => console.log(typeof m.buildOfferButtonsHtml))"
```
Esperado: sem erro de sintaxe, e `function`.

---

### PASSO 4 — Adicionar o CSS

Abra `src/pages/blog/[...slug].astro`. O bloco de comentário `/* === Product Cards === */` está
perto da **linha 284**; a regra `.product-btn` está perto da **linha 354**. Adicione ao final desse
bloco:

```css
    #articleBody .product-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      max-width: 420px;
      margin: 1.5rem auto 0;
    }
    #articleBody .product-btns .product-btn {
      margin: 0;
      flex: 1 1 180px;
      width: auto;
    }
    #articleBody .product-btn--ml { background: #ffe600; color: #000; }
    #articleBody .product-btn--shopee { background: #ee4d2d; color: #fff; }
```

⚠️ **Não altere a regra `.product-btn` existente.** Os 21 artigos publicados dependem dela.

**Gate:** `npm run build` conclui sem erro.

---

### PASSO 5 — Adicionar os testes

Abra `scripts/test-injecao.mjs`. Não há framework: são `assert` com dois auxiliares,
`ok(condicao, nome)` e `igual(a, b, nome)`. Os imports ficam num bloco único no topo (linhas 6–14).

Adicione `buildOfferButtonsHtml` à lista de nomes importados de `./gerar-artigo.mjs` e crie um
import novo, separado, logo abaixo do de `./google_shopping.mjs`:

```js
import { normalizarProdutoRemoto } from "./monitor_api.mjs";
```

Adicione no **final** do arquivo:

```js
// ---- Frente 4: botao duplo ----
const produtoDuasLojas = {
  offers: {
    mercadolivre: { affiliate_link: "https://meli.la/abc", permalink: "https://ml.com/x", price: 100 },
    shopee: { affiliate_link: "https://s.shopee.com.br/xyz", permalink: "https://shopee.com.br/y", price: 90 },
  },
};
const htmlDuplo = buildOfferButtonsHtml(produtoDuasLojas);
igual((htmlDuplo.match(/<a /g) || []).length, 2, "duas lojas geram dois botoes");
ok(htmlDuplo.includes("product-btns"), "duas lojas usam o wrapper");
ok(htmlDuplo.includes("product-btn--ml"), "botao do ML tem a classe certa");
ok(htmlDuplo.includes("product-btn--shopee"), "botao da Shopee tem a classe certa");
ok(htmlDuplo.includes('rel="nofollow sponsored"'), "link de afiliado marcado como sponsored");

const htmlUma = buildOfferButtonsHtml({
  offers: { shopee: { affiliate_link: "https://s.shopee.com.br/z", price: 50 } },
});
igual((htmlUma.match(/<a /g) || []).length, 1, "uma loja gera um botao");
ok(!htmlUma.includes("product-btns"), "uma loja nao usa wrapper");

igual(buildOfferButtonsHtml({}), "", "sem offers cai no caminho antigo");
igual(buildOfferButtonsHtml({ offers: { amazon: { affiliate_link: "x" } } }), "",
      "loja desconhecida e ignorada");

// ---- Frente 4: cliente remoto ----
const bruto = {
  id: "MLB1", title: "Headset Gamer", price: 181, thumbnail: "http://img/x.jpg",
  offers: { mercadolivre: { affiliate_link: "https://meli.la/a", permalink: "http://ml/x", price: 181 } },
};
const norm = normalizarProdutoRemoto(bruto);
ok(norm !== null, "produto valido e aceito");
igual(norm.sources.length, 1, "sources vem de offers");
igual(normalizarProdutoRemoto({ title: "" }), null, "produto sem titulo e descartado");
igual(normalizarProdutoRemoto({ title: "X", offers: {} }), null, "produto sem oferta e descartado");
```

⚠️ **Nenhum teste pode fazer chamada de rede.** O `npm test` roda no CI antes de gerar o artigo e
não pode depender da VM estar no ar.

**Gate:** `npm test` → `N asserts OK` com **N maior que 145** (o valor anterior).

---

### PASSO 6 — Configuração

#### 6.1 — `.env.example`

O arquivo hoje tem 7 chaves. Adicione ao final (**sem valor na chave secreta**):

```
AFFILIATE_MODE=legacy
MONITOR_API_URL=http://34.29.27.155:8086
MONITOR_API_KEY=
```

#### 6.2 — `.github/workflows/gerar-conteudo.yml`

No step `- name: Gerar artigo`, o bloco `env:` tem hoje 8 entradas, terminando em
`FORCE_GENERATE`. Adicione as três linhas:

```yaml
          AFFILIATE_MODE: ${{ vars.AFFILIATE_MODE }}
          MONITOR_API_URL: ${{ vars.MONITOR_API_URL }}
          MONITOR_API_KEY: ${{ secrets.MONITOR_API_KEY }}
```

> `vars.` para variables, `secrets.` para o secret. Não troque um pelo outro.

#### 6.3 — Cadastro no GitHub — **o DONO faz, você só documenta no relatório final**

- **Secret** `MONITOR_API_KEY` = a chave do Passo 1
- **Variable** `MONITOR_API_URL` = `http://34.29.27.155:8086`
- **Variable** `AFFILIATE_MODE` = `legacy`

**Gate:** `.env.example` não contém nenhum valor real; `git diff` do workflow mostra só 3 linhas
adicionadas.

---

### PASSO 7 — Verificação completa

Execute na ordem e confirme cada resultado:

```bash
# 1. Testes passam
npm test
# esperado: "N asserts OK" com N > 145, sem erro

# 2. O site compila
npm run build
# esperado: build concluido sem erro

# 3. Caminho feliz — Frente 4 ligada gera artigo com link de afiliado
AFFILIATE_MODE=remote MONITOR_API_URL=http://34.29.27.155:8086 \
MONITOR_API_KEY=<a chave do Passo 1> node scripts/gerar-artigo.mjs
# esperado no log: "Frente 4: N produtos com afiliado"
# esperado no artigo gerado: hrefs com meli.la ou s.shopee.com.br

# 4. TESTE MAIS IMPORTANTE — com a VM inacessivel, o artigo ainda sai
AFFILIATE_MODE=remote MONITOR_API_URL=http://127.0.0.1:9999 \
MONITOR_API_KEY=qualquer node scripts/gerar-artigo.mjs
# esperado: warning no log e artigo gerado normalmente via Google Shopping
```

**O teste 4 é o que garante que o blog nunca para de publicar por causa da VM.** Se ele falhar,
o trabalho não está pronto — corrija antes de commitar.

> Os testes 3 e 4 geram artigo de verdade em `src/content/artigos/`. **Não commite os artigos de
> teste** — remova-os do working tree antes dos commits do Passo 8.

---

### PASSO 8 — Commits

Na branch `feat/afiliados-ml-shopee`. Conventional Commits, em português, sem acento:

```
feat(frente4): cliente HTTP da API de produtos afiliados
feat(frente4): botao duplo ML + Shopee nos artigos
test(frente4): cobertura do botao duplo e do cliente remoto
chore(frente4): variaveis de ambiente do workflow e do .env.example
```

**Não faça push para `main`. Não altere `AFFILIATE_MODE` para `remote`** — a ativação é do dono,
pelo painel do GitHub, e o rollback é mudar a variable de volta para `legacy` (sem deploy, sem
alterar código).

Confira antes de commitar: `git diff --stat` não deve tocar em `automation/`, `infra/`, `blog/`,
nem em `.env`.

---

## 8. Convenções obrigatórias

| Assunto | Regra |
|---|---|
| Idioma | **PT-BR** em código, comentários, logs e docs |
| Acentuação | **Comentários e logs sem acento** (padrão do repo) |
| Módulos | ESM puro, `.mjs`, `"type":"module"`. **Sem TypeScript em `scripts/`** |
| TypeScript | só no front Astro (`src/lib/*.ts`, `src/content.config.ts`) |
| Lint | não há ESLint/Prettier configurados — siga o estilo do arquivo vizinho |
| Testes | `node:assert` + helpers `ok()`/`igual()`. Sem framework. **Zero rede** |
| Log | `log("INFO"\|"WARN", msg)`, formato `[ts] [LEVEL] [TAG] msg` |
| Commits | Conventional Commits em português |

---

## 9. Fatos técnicos que custaram caro (não redescubra)

1. **O Mercado Livre não tem busca por palavra-chave utilizável nesta VM.** `/sites/MLB/search` →
   403. `/ofertas?search=` → **ignora o termo** e devolve feed genérico. A Frente 2 não "pesquisa"
   no ML: ela varre ofertas por categoria e filtra por vocabulário.
2. **A Shopee usa a API oficial de afiliados** (GraphQL, autenticada por chave). O campo
   `offerLink` que já vem na busca **é** o link de afiliado. Sem cookies, sem sessão que caia.
3. **Os módulos do monitor exigem `configure()` antes de usar.** Sem isso, a lista de user-agents
   fica vazia e todo download morre com `Cannot choose from an empty sequence` — parece bloqueio do
   ML, mas é bootstrap faltando.
4. **Os segredos não estão no `config.yaml`** (lá estão vazios). Vêm de
   `/opt/afiliados-monitor-v2/searcher/.env`, via `EnvironmentFile`.
5. **`generate_affiliate_link` do ML devolve a própria URL do produto quando falha.** Sucesso é, e
   só é, o resultado conter `meli.la`.
6. **Limite de velocidade tem lugar certo:** 1 req/s **por marketplace** em `adapters.py`; o limite
   de `app.py` (5/s) é só anti-abuso da porta HTTP.
7. **A Frente 2 tem janela de horário** (07:00–23:59, Brasília). Silêncio fora disso é correto.
8. **Ao combinar produtos de duas lojas, intercale, não concatene.** Já aconteceu: a Shopee ocupava
   as 5 vagas com acessórios de R$ 15 enquanto o ML tinha monitor e headset na fila. A API já
   devolve intercalado — **não reordene por preço**.
9. **Frente 1 vs Frente 3** no `posted.json`: registros da Frente 1 têm `source_group_name`
   preenchido; os da Frente 3 vêm com `None`.

---

## 10. Se algo der errado

| Sintoma | Causa provável |
|---|---|
| `SyntaxError: Identifier 'seen' has already been declared` | não removeu o `const seen` antigo de dentro do bloco `if (SERPER_API_KEY)` (Passo 3.3) |
| `does not provide an export named 'buildOfferButtonsHtml'` | Passo 3.7 — resolva a duplicidade de `export` |
| `npm test` com menos asserts que antes | quebrou o caminho antigo de `buildProductButtonHtml` |
| API responde 401 | `MONITOR_API_KEY` errada ou ausente. Refaça o Passo 1 |
| API responde 429 | rate limit 5 req/s. Respeite o `Retry-After` |
| Artigo sai sem produto no modo `remote` | esperado se o banco não tiver a categoria; o Google Shopping completa |
| VM fora do ar | **comportamento correto é o artigo sair mesmo assim.** Se não sair, o Passo 2 está errado |

**Documentos de referência (leitura, não edição):**

| Arquivo | Conteúdo |
|---|---|
| `FRENTE_4_RETOMADA.md` | doc canônico completo — este arquivo é o extrato executável dele |
| `infra/blog-produtos-api/README.md` | como o serviço funciona e como se faz deploy |
| `docs/CREDENCIAIS.md` | onde fica cada chave |
| `docs/MONITOR_API_AUDITORIA.md` | auditoria da VM, assinaturas dos módulos |
| `docs/TROUBLESHOOTING.md` | problemas conhecidos, incluindo o incidente da sessão do ML |
| `docs/PROGRESSO.md` | status atual do projeto |
