# FRENTE 4 — INSTRUÇÕES DE EXECUÇÃO

> **LEIA ESTE ARQUIVO INTEIRO ANTES DE EXECUTAR QUALQUER COMANDO.**
>
> Este documento é auto-suficiente. Ele contém tudo: o contexto, as proibições, o código pronto
> para copiar, os comandos exatos e como verificar cada passo.
>
> **Você NÃO precisa tomar nenhuma decisão de arquitetura.** Todas já foram tomadas e estão
> escritas aqui. Se algo parecer ambíguo, siga literalmente o que está escrito.
>
> Estado medido em: **06/08/2026**.

---

# PARTE 0 — PROIBIÇÕES ABSOLUTAS

Estas cinco regras não têm exceção. Violar qualquer uma causa prejuízo real ao dono.

### ❌ PROIBIÇÃO 1 — Nunca gerar link de afiliado do Mercado Livre a partir do blog

**Não chame** `generate_affiliate_link`, `affiliate.py`, nem qualquer coisa que use os cookies do
Mercado Livre. **Não ative** `BLOG_ML_ENABLED=1`.

**Por que:** em 06/08/2026 isso foi feito e derrubou a sessão do ML (`401 auth_error`). A Frente 1
parou de postar por 1 hora e o dono precisou exportar cookies novos do navegador de madrugada. A
sessão do ML **não suporta um segundo programa usando ela**.

**O que fazer em vez disso:** o blog consome produtos do banco (Parte 2), onde os links de
afiliado **já vêm prontos**, gerados pelas Frentes 1/2/3.

### ❌ PROIBIÇÃO 2 — Nunca chamar `getUpdates` do Telegram

Use **apenas** `sendMessage`. O Telegram entrega cada mensagem **uma única vez por token**; se
você escutar com o token do bot, rouba as mensagens da Frente 1 e quebra a detecção nos grupos
**sem gerar erro nenhum no log**.

### ❌ PROIBIÇÃO 3 — Nunca parar, reiniciar ou editar os serviços do monitor

Proibido tocar em `monitor-bot-ml`, `searcher-ml` e `searcher-panel`. Você só pode reiniciar
`blog-produtos-api` (que é o serviço do blog).

Depois de **qualquer** alteração na VM, rode esta verificação e confirme que as 4 linhas dizem
`active`:
```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api'
```

### ❌ PROIBIÇÃO 4 — Nunca escrever dentro de `/opt/afiliados-monitor-v2/`

Esse diretório é do monitor. O serviço do blog **só lê** de lá. Escrever pode corromper o estado
das frentes. A única exceção já autorizada foram arquivos `.md` de documentação, sempre com
backup antes.

### ❌ PROIBIÇÃO 5 — Nunca rodar `pip install` no venv do monitor

O venv `/opt/afiliados-monitor-v2/venv` é compartilhado. Ele tem `curl_cffi 0.16.0`, que é o que
sustenta a sessão do ML. Atualizar qualquer coisa ali pode quebrar a operação do dono.
Tudo que você precisa (`aiohttp`) já está instalado.

---

# PARTE 1 — CONTEXTO

## 1.1 O problema

O blog gamer (Astro + GitHub Pages) publica artigos com botões de compra que **não geram
comissão nenhuma**. Em `scripts/gerar-artigo.mjs`, linha ~1941, existe literalmente:

```js
p.affiliate_link = p.permalink;   // copia o link normal, sem afiliação
```

Os produtos vêm do Google Shopping (Serper.dev), que devolve links diretos de loja.

## 1.2 A solução

O dono tem um segundo projeto, o **monitor-telegram**, que descobre produtos e **já gera links de
afiliado** do Mercado Livre e da Shopee o dia inteiro. Ele tem três "frentes":

| Frente | O que faz | Serviço systemd |
|---|---|---|
| 1 | Monitora grupos do Telegram e extrai produtos das mensagens | `monitor-bot-ml.service` |
| 2 | Buscador: varre ofertas do ML por categoria, busca na Shopee por palavra-chave | `searcher-ml.service` |
| 3 | Painel web onde o dono lança links manualmente | `searcher-panel.service` |
| **4** | **O blog** (o que estamos construindo) | `blog-produtos-api.service` |

**A Frente 4 não busca nada.** Ela consome o que as Frentes 1/2/3 já descobriram e já afiliaram.
Custo em requisições ao Mercado Livre: **zero**.

## 1.3 Onde fica cada coisa

| Servidor | O que roda lá |
|---|---|
| **VM do monitor** — `34.29.27.155` | Frentes 1, 2, 3, o serviço da Frente 4 e o banco de dados |
| **GitHub Actions** | O pipeline que gera os artigos do blog (`gerar-conteudo.yml`) |
| VM do blog — `35.237.81.192` | **Nada.** Legado, fora de uso, token expirado. Ignore. |

Acesso à VM do monitor:
```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155
```
Tem `sudo` sem senha. A VM roda em **UTC**; o código do monitor usa horário de Brasília (UTC−3).

---

# PARTE 2 — O QUE JÁ ESTÁ PRONTO (não refazer)

## 2.1 O serviço

`blog-produtos-api.service` está **rodando** na VM do monitor, porta **8086**, versão
`2.0.0-frente4`. Arquivos em `/opt/blog-produtos-api/`:

| Arquivo | Papel |
|---|---|
| `app.py` | Rotas HTTP, autenticação, cache, tarefa do coletor |
| `busca.py` | Monta o resultado combinando ML e Shopee |
| `catalogo.py` | Banco SQLite: coleta, busca, retenção, travas de disco |
| `adapters.py` | Único arquivo que fala com o monitor. **Contém a trava do ML** |
| `aviso.py` | Envia mensagem no Telegram (só envia, nunca escuta) |
| `catalogo.db` | O banco (SQLite) |
| `.env` | Chaves (permissão 600) |

Existe uma cópia versionada no repositório do blog em `infra/blog-produtos-api/`.

## 2.2 O banco de dados

**Onde:** `/opt/blog-produtos-api/catalogo.db`, na VM do monitor.

**Como enche:** as Frentes 1/2/3 gravam tudo que publicam em dois arquivos JSON, mas **cortam nos
últimos 1000 registros** (`posted[-1000:]`) — a Frente 1 joga fora ~150 produtos por dia. Um
coletor roda a cada 10 minutos, lê esses arquivos e copia o que é novo antes do descarte.

Arquivos de origem (**somente leitura**):
- `/opt/afiliados-monitor-v2/automation/state/posted.json` — Frentes 1 e 3
- `/opt/afiliados-monitor-v2/searcher/services/searcher/state/posted.json` — Frente 2

**Estado atual:** 792 produtos (646 do ML, 146 da Shopee), 0,57 MB.

**Travas de disco** (se o disco encher, perde-se o acesso SSH à VM):
- Retenção de 30 dias, com limpeza automática
- Teto de 200 MB
- Para de gravar se o disco livre cair abaixo de 3 GB
- Guarda só texto e endereço de imagem, **nunca a imagem em si**

## 2.3 A API

Base: `http://34.29.27.155:8086`
Header obrigatório em todas as rotas (menos `/api/health`): `X-API-Key: <chave>`

| Rota | Método | Estado |
|---|---|---|
| `/api/health` | GET | ✅ pronta |
| `/api/produtos/buscar` | POST | ✅ pronta |
| `/api/produtos/buscar-lote` | POST | ✅ pronta (até 5 consultas) |
| `/api/catalogo` | GET | ✅ pronta (estatísticas) |
| `/api/afiliar` | POST | ⚠️ funciona só para Shopee; ML travado de propósito |
| `/api/faltantes` | POST | ⚠️ pronta, mas o Telegram recusa (ver Parte 4) |

### Exemplo de chamada

```bash
curl -s -X POST http://34.29.27.155:8086/api/produtos/buscar \
  -H "X-API-Key: SUA_CHAVE" \
  -H 'Content-Type: application/json' \
  -d '{"query":"headset gamer","limit":5}'
```

### Exemplo de resposta

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

**Campos importantes:**
- `affiliate_link` — **é este que vai no botão do artigo.** Sempre existe.
- `sources` — lista de lojas. Pode ser `["mercadolivre"]`, `["shopee"]` ou as duas.
- `offers` — os dados por loja. É daqui que sai o botão duplo.
- `preco_de` — a data em que o preço foi capturado. **Não é o preço de hoje.**
- Os campos de topo (`price`, `permalink`, `source`) espelham sempre a **oferta mais barata**.

### Cobertura já testada

As 8 consultas típicas de artigo devolvem 5 produtos cada, com mistura de **3 do ML + 2 da
Shopee**: `mouse gamer`, `teclado mecanico`, `headset gamer`, `cadeira gamer`, `monitor gamer`,
`placa de video`, `notebook gamer`, `ssd nvme`.

---

# PARTE 3 — O QUE FAZER NO BLOG (tarefa principal)

**Esta é a parte principal do trabalho. Ela é toda dentro do repositório do blog. Não tem risco
nenhum para a VM.**

Trabalhe na branch `feat/afiliados-ml-shopee` (já existe):
```bash
cd "caminho/do/blog-gamer"
git checkout feat/afiliados-ml-shopee
```

## PASSO 1 — Pegar a chave da API

```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env'
```

Guarde essa chave. **NUNCA escreva o valor dela em nenhum arquivo do repositório nem em mensagem
de commit.** Ela vai para dois lugares:
1. Seu `.env` local (que já está no `.gitignore`)
2. Um secret do GitHub chamado `MONITOR_API_KEY`

## PASSO 2 — Criar `scripts/monitor_api.mjs`

Crie o arquivo com exatamente este conteúdo:

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

## PASSO 3 — Alterar `scripts/gerar-artigo.mjs`

### 3.1 — Importar o cliente

No topo do arquivo, junto dos outros `import`, adicione:

```js
import { buscarProdutosLoteRemoto } from "./monitor_api.mjs";
```

### 3.2 — Adicionar as constantes

Procure a linha `const MAX_PRODUCTS = 5;` (perto da linha 460) e adicione **logo abaixo**:

```js
// remote = usa a Frente 4 (produtos com comissao). legacy = so Google Shopping.
const AFFILIATE_MODE = process.env.AFFILIATE_MODE || "legacy";
```

### 3.3 — Fazer a busca usar a Frente 4

Procure o bloco que começa em torno da linha 1893 com `let mlProducts = [];`.

**Antes** da linha `if (SERPER_API_KEY) {`, insira:

```js
  // Frente 4 primeiro: produtos que ja vem com link de afiliado.
  if (AFFILIATE_MODE === "remote") {
    try {
      const trendingKws = topic.trending_keywords || [];
      const queriesRemotas = [
        ...trendingKws.slice(0, 2),
        topic.ml_query,
      ].filter(Boolean).slice(0, 5);

      const remotos = await buscarProdutosLoteRemoto(queriesRemotas,
                                                     { limitPorQuery: 3 });
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

Depois, altere a linha `if (SERPER_API_KEY) {` para:

```js
  // Google Shopping so completa o que faltou (ou assume tudo, no modo legacy).
  if (SERPER_API_KEY && mlProducts.length < MAX_PRODUCTS) {
```

### 3.4 — Não sobrescrever o link de afiliado

Procure (linha ~1941):

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

### 3.5 — Aceitar produtos da Shopee em `sanitizeProducts`

Procure em `sanitizeProducts` (linha ~842):

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

### 3.6 — Criar o botão duplo

Procure a função `buildProductButtonHtml` (linha ~904). **Antes** dela, adicione:

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

Agora altere `buildProductButtonHtml` para delegar. O corpo atual **continua existindo**, ele só
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

⚠️ **Atenção:** não mexa no caminho antigo. Os testes em `test-injecao.mjs:102-112` verificam
exatamente aquele formato de botão.

## PASSO 4 — Adicionar o CSS

Abra `src/pages/blog/[...slug].astro`, procure o bloco de comentário
`/* === Product Cards === */` (perto da linha 284) e adicione ao final desse bloco:

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

⚠️ **Não altere a regra `.product-btn` que já existe.** Os artigos antigos dependem dela.

## PASSO 5 — Adicionar os testes

Abra `scripts/test-injecao.mjs`. Os testes não usam framework: são `assert` com dois auxiliares,
`ok(condicao, nome)` e `igual(a, b, nome)`. Rode com `npm test`.

Adicione o import (junto dos outros, no topo):
```js
import { buildOfferButtonsHtml } from "./gerar-artigo.mjs";
import { normalizarProdutoRemoto } from "./monitor_api.mjs";
```

Adicione no final do arquivo:

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

**Não adicione testes que façam chamadas de rede.** O `npm test` roda no CI antes de gerar o
artigo, e ele não pode depender da VM estar no ar.

## PASSO 6 — Configurar o GitHub

### 6.1 — No `.env.example`, adicione:
```
AFFILIATE_MODE=legacy
MONITOR_API_URL=http://34.29.27.155:8086
MONITOR_API_KEY=
```

### 6.2 — No `.github/workflows/gerar-conteudo.yml`

Procure o step que roda `node scripts/gerar-artigo.mjs` e adicione ao bloco `env:`:

```yaml
          AFFILIATE_MODE: ${{ vars.AFFILIATE_MODE }}
          MONITOR_API_URL: ${{ vars.MONITOR_API_URL }}
          MONITOR_API_KEY: ${{ secrets.MONITOR_API_KEY }}
```

### 6.3 — Cadastrar no GitHub (o dono faz, ou você orienta)
- **Secret** `MONITOR_API_KEY` = a chave do Passo 1
- **Variable** `MONITOR_API_URL` = `http://34.29.27.155:8086`
- **Variable** `AFFILIATE_MODE` = `legacy` (por enquanto)

## PASSO 7 — Verificar

Execute na ordem e confirme cada resultado:

```bash
# 1. Testes passam
npm test
# esperado: "N asserts OK", sem erro

# 2. O site compila
npm run build
# esperado: build concluido sem erro

# 3. Com a Frente 4 ligada, gera artigo com link de afiliado
AFFILIATE_MODE=remote MONITOR_API_URL=http://34.29.27.155:8086 \
MONITOR_API_KEY=<a chave> node scripts/gerar-artigo.mjs
# esperado no log: "Frente 4: N produtos com afiliado"
# esperado no artigo gerado: hrefs com meli.la ou s.shopee.com.br

# 4. TESTE MAIS IMPORTANTE — com a VM inacessivel, o artigo ainda sai
AFFILIATE_MODE=remote MONITOR_API_URL=http://127.0.0.1:9999 \
MONITOR_API_KEY=qualquer node scripts/gerar-artigo.mjs
# esperado: warning no log e artigo gerado normalmente via Google Shopping
```

O teste 4 é o que garante que o blog nunca para de publicar por causa da VM.

## PASSO 8 — Ativar

Só depois de tudo acima passar: mude a variable `AFFILIATE_MODE` no GitHub para `remote`.

**Para desligar em caso de problema:** mude de volta para `legacy`. Não precisa alterar código
nem fazer deploy.

---

# PARTE 4 — O QUE FAZER NO MONITOR

## 4.1 — Destravar o aviso no Telegram

**Estado:** a rota `/api/faltantes` está pronta, mas o Telegram responde
`400 Bad Request: chat not found`.

**Causa:** o Telegram **não permite que um bot inicie conversa**. O dono nunca abriu chat privado
com o `@MonitorDeGruposBot`.

**Ação do DONO (você não consegue fazer isso):** abrir o Telegram, procurar
**@MonitorDeGruposBot**, e enviar `/start`.

**Depois disso, teste:**
```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'KEY=$(sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env); curl -s -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" -d "{\"forcar\":true,\"faltantes\":[{\"query\":\"teste\",\"encontrados\":0,\"precisa\":3}]}" http://127.0.0.1:8086/api/faltantes'
```
Esperado: `"avisado": true`.

**Para que serve:** quando a Frente 4 não achar produtos suficientes, ela avisa o dono no privado.
Ele pesquisa manualmente e lança pela **Frente 3**, o produto vai para o grupo, e entra no banco
automaticamente. O ciclo se fecha.

## 4.2 — NÃO fazer sem ordem expressa do dono

**`mode: both` na Frente 1.** O arquivo `/opt/afiliados-monitor-v2/automation/config.yaml`, linha
7, tem `mode: ml`. Isso faz a Frente 1 ignorar links da Shopee vindos dos grupos (por isso só 4
produtos Shopee em 1000).

Mudar para `both` capturaria Shopee dos grupos, **mas também faria a Frente 1 publicar produtos
Shopee no grupo do Telegram do dono** — mudando o conteúdo do canal dele. E exigiria reiniciar a
Frente 1.

**Não é necessário:** a Frente 2 já traz ~46 produtos Shopee por dia, o que dá ~1.400 em 30 dias.
O banco se equilibra sozinho.

## 4.3 — Oportunidade não explorada: a terceira VM

Existe uma **terceira VM**, `shopee-monitor-telegram` (`34.27.101.162`), que roda uma Frente 01
dedicada à **Shopee** e tem o próprio `posted.json`
(`/opt/afiliados-monitor-shopee/automation/`). O coletor atual **não lê essa VM** — ele só lê
arquivos locais da VM do monitor.

**Não é urgente:** a Shopee no banco já entra a ~46 produtos/dia pela Frente 02, o que dá ~1.400
em 30 dias. Mas se um dia faltar produto Shopee, incluir essa VM é a forma mais barata de dobrar
o acervo. Exigiria expor o arquivo por HTTP ou sincronizar por `rsync`/`scp`.

## 4.4 — Limpeza pendente (pedir autorização antes)

- **`/var/log` com 6 GB**, sendo 2,8 GB de journald sem teto. Sugerido:
  `sudo journalctl --vacuum-size=500M` e depois `SystemMaxUse=500M` em
  `/etc/systemd/journald.conf`. Liberaria ~2,3 GB. **Este é o real risco de disco da VM**, não o
  banco (que tem 0,57 MB).
- Backup morto `automation/ml_cookies.json.bak-20260806-022714` (sessão já inválida).
- ~128 arquivos `.bak-*` de código antigo espalhados.

## 4.5 — Decisões que o dono já tomou (não reabrir)

| Assunto | Decisão |
|---|---|
| Credenciais em texto puro (`auth_ml.py`, `ml_proxy`) | **Não rotacionar agora** |
| Contas `opencode-access` e `monitor-bot` com sudo | **Manter as duas** |
| Separar comissão do blog x Telegram (`subIds`) | **Adiar** |
| Validade dos produtos no banco | **30 dias**, e o artigo avisa que o preço pode ter mudado |
| Canal de aviso | **Telegram, mensagem direta**, não no grupo |

---

# PARTE 5 — FATOS TÉCNICOS QUE CUSTARAM CARO

Não redescubra estes. Cada um custou horas ou causou incidente.

**1. O Mercado Livre não tem busca por palavra-chave utilizável nesta VM.**
`/sites/MLB/search` → 403 (app não aprovada). `/ofertas?search=` → **ignora o termo** e devolve o
feed genérico (duas consultas diferentes retornam a mesma lista de espelho, creatina e potes de
vidro). `lista.mercadolivre.com.br` → devolve só o esqueleto da página, sem produtos. A Frente 2
não "pesquisa" no ML: ela **varre ofertas por categoria** (Informática, Games) e filtra por um
vocabulário de 13 famílias.

**2. A Shopee usa a API oficial de afiliados** (GraphQL, `open-api.affiliate.shopee.com.br`,
autenticada por chave). O campo **`offerLink` que já vem na busca é o link de afiliado** — chamar
`generate_short_link` depois é requisição desperdiçada. Sem cookies, sem sessão que caia.

**3. Os módulos do monitor exigem `configure()` antes de usar.** Sem `offers.configure`, a lista
de user-agents fica vazia e todo download morre com `Cannot choose from an empty sequence` — o
que parece bloqueio do ML, mas é só bootstrap faltando.

**4. Os segredos não estão no `config.yaml`** (lá estão vazios). Eles vêm de
`/opt/afiliados-monitor-v2/searcher/.env`, carregado via `EnvironmentFile` pelo serviço.

**5. `generate_affiliate_link` do ML devolve string, e quando falha devolve a própria URL do
produto.** Sucesso é, e só é, o resultado conter `meli.la`. Não checar isso publica link sem
comissão sem ninguém perceber.

**6. Limite de velocidade tem lugar certo.** 1 requisição/segundo **por marketplace** fica em
`adapters.py`, em volta das chamadas de saída. O limite de `app.py` (5/s, pico 20) é só
anti-abuso da porta HTTP. Inverter os dois estrangula o serviço sem proteger ninguém.

**7. A Frente 2 tem janela de horário** (07:00 às 23:59, Brasília). Ficar silenciosa fora disso é
o comportamento correto. A Frente 1 não tem janela: é reativa aos grupos, e de madrugada eles
esfriam — silêncio de uma hora é normal.

**8. Ao combinar produtos de duas lojas, intercale, não concatene.** Concatenando, a primeira
lista consome o limite inteiro e a segunda desaparece. Isso aconteceu: a Shopee ocupava as 5
vagas com acessórios de R$ 15 enquanto o ML tinha monitor e headset esperando na fila.

**9. Para distinguir Frente 1 de Frente 3** no arquivo `automation/state/posted.json`: registros
da Frente 1 têm `source_group_name` preenchido (o grupo de origem); os da Frente 3 vêm com `None`.

---

# PARTE 6 — COMANDOS DE REFERÊNCIA

```bash
# Estado dos 4 servicos (os 3 primeiros NUNCA podem sair de "active")
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api'

# Saude da API + estado do banco
curl -s http://34.29.27.155:8086/api/health | python -m json.tool

# Log do servico do blog
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'sudo journalctl -u blog-produtos-api -n 40 --no-pager'

# Deploy de alteracao no servico (do diretorio infra/blog-produtos-api/)
scp -i ~/.ssh/id_opencode app.py busca.py catalogo.py adapters.py aviso.py \
    sergioskm_cle@34.29.27.155:/opt/blog-produtos-api/
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
    'sudo systemctl restart blog-produtos-api'
# e conferir que as outras 3 frentes seguem active

# Espaco em disco (nunca deixar encher)
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'df -h /'
```

---

# PARTE 7 — DOCUMENTOS RELACIONADOS

| Arquivo | Conteúdo |
|---|---|
| `docs/MONITOR_API_AUDITORIA.md` | Auditoria da VM, assinaturas dos módulos, decisões do dono |
| `PLANO_ML_SHOPEE_MONITOR.md` | Plano original (histórico; a Fase 3 mudou de rumo) |
| `infra/blog-produtos-api/README.md` | Código do serviço + como fazer deploy |
| `docs/CREDENCIAIS.md` | Onde fica cada chave |
| `docs/TROUBLESHOOTING.md` | Problemas conhecidos, incluindo o incidente da sessão do ML |

---

# RESUMO EM UMA PÁGINA

**O que já funciona:** o serviço na VM do monitor (porta 8086) com um banco de 792 produtos que
já têm link de afiliado, alimentado automaticamente pelas Frentes 1/2/3 a cada 10 minutos.

**O que falta:** ensinar o blog a consultar esse serviço (Parte 3, passos 1 a 8) e o dono mandar
`/start` para o bot no Telegram (Parte 4.1).

**O que nunca fazer:** usar os cookies do Mercado Livre a partir do blog, chamar `getUpdates`,
reiniciar as frentes do monitor, escrever em `/opt/afiliados-monitor-v2/`, ou rodar `pip` no venv
do monitor.

**Como saber que deu certo:** um artigo publicado com botões apontando para `meli.la` e
`s.shopee.com.br`, e o teste com a VM inacessível ainda gerando artigo normalmente.
