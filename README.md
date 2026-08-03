# Blog Gamer

Blog estático sobre o mundo gamer com links de afiliado do Mercado Livre. Geração automática de artigos via GitHub Actions.

**URL:** https://sergioskmcle-sketch.github.io/blog-gamer

**Status:** https://sergioskmcle-sketch.github.io/blog-gamer/status.json

---

## Monitoramento (Zero-Touch)

O blog se auto-gerencia. Para verificar a saúde do sistema, abra o [`status.json`](https://sergioskmcle-sketch.github.io/blog-gamer/status.json) — 10 segundos, 1x por semana:

```json
{
  "saudavel": true,
  "ultimo_artigo": "2026-07-30",
  "ultimo_deploy": "2026-07-31T00:00:00Z",
  "total_artigos": 13,
  "erros_recentes": [],
  "apis": { "groq": "ok", "tavily": "ok", "rawg": "ok" }
}
```

Se `saudavel: false` ou `ultimo_artigo` está muito antigo, verifique os secrets no GitHub.

---

## Arquitetura

```
.github/workflows/
  gerar-conteudo.yml      → Geração automática (schedule diário + manual)
  gerar-artigo-pilar.yml  → Artigo pilar manual (3000+ palavras, 1x/mês)
  regenerar-capa.yml      → Regenera a capa IA de um artigo (manual)
  deploy.yml              → Deploy GitHub Pages (push + manual)

scripts/
  gerar-artigo.mjs          → Pipeline principal (trending → Tavily → Google ML → Gemini/Groq → RAWG → injeção de produtos → validação)
  gerar-artigo-pilar.mjs    → Artigo pilar (3 passes: pesquisa → draft → refino + injeção mecânica de produtos)
  gerar-cadeiras.mjs        → Script dedicado: artigo de cadeiras gamer + capa OpenAI
  gerar-placas-video.mjs    → Pipeline dedicada para artigos sobre placas de vídeo
  gerar-lista-monitores.mjs → Pipeline dedicada para artigos sobre monitores gamer
  ml_affiliate.mjs          → API ML (busca produtos via Tavily/Google; scraping e API OAuth estão bloqueados/restritos)
  openai-cover.mjs          → Capa IA (gpt-image-2) usando imagens dos produtos como referência
  stability-cover.mjs       → Refinamento/fallback de capas via Stability AI (sd3)
  fix-article-links.mjs     → Script manual: substitui links diretos ML por meli.la em artigo existente
  regenerate-*-cover.mjs    → Regenera a capa de artigos específicos (cadeiras, fones, monitores, psplus, xbox)
  gerar-status.cjs          → Gera status.json a cada deploy
  test-injecao.mjs          → Testes de validação (124 asserts): itens, TOC, fontes, portão de produtos e montagem segmentada
  download-images.mjs       → Baixa imagens dos produtos para o repo
  convert-banners.mjs       → Converter banners PNG → WebP

automation/                 → Suíte Python (pipelines locais/servidor)
  generate_article.py       → Gera artigos (modos: informativo/melhor/custo-beneficio/misto + capa IA + ml_query seed)
  scheduler.py              → Agenda 1 artigo/dia (roda generate_article.py com seeds circulares)
  heartbeat_watchdog.py     → Watchdog do serviço systemd `blog-gamer.service` (reinicia se o heartbeat parar)
  cookie_keepalive.py       → Desativado (não visitar o ML com cookies: entrega fingerprint e causa bloqueio global)
  admin_api.py              → Painel de controle do blog (FastAPI)
  force_article.py          → Força a geração manual de um tópico
  fix_article_links.py      → Versão Python do fix-article-links
  ml_affiliate.py           → API ML (versão Python)
  docs/TIPOS_ARTIGO.md      → Tipos/modos de artigo e regras de imagens

admin/ + public/admin/      → Painel admin: layout editor (sliders de CSS/cores/logo) + CRUD de artigos, com deploy automático

src/content/artigos/   → Artigos em markdown com frontmatter
docs/                  → Estrutura de artigo (ARTICLE_STRUCTURE_DRAFT.md)
state.json             → Estado da geração (cooldown, falhas, tópicos recentes)
public/status.json     → Status público gerado a cada deploy
public/images/         → Banners Telegram (WebP), logo (logo-blog.webp), capas IA (capas/) e imagens de produtos
```

---

## Pipeline Completo de Geração

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. TRENDING     RSS (MeuPlayStation, GameVicio, IGN) + Reddit      │
│                 → Extrai keywords, ranqueia por frequência          │
│                 → Escolhe tema NÃO usado recentemente (dedup)       │
├─────────────────────────────────────────────────────────────────────┤
│ 2. PESQUISA     Tavily: 6 resultados (search_depth: advanced)       │
│                 → Contexto de ~600 words por fonte injetado         │
├─────────────────────────────────────────────────────────────────────┤
│ 3. PRODUTOS ML  Google (Tavily) → scraping → affiliate link         │
│                 Até 4 queries usando trending keywords              │
│                 Filtro isGamerProduct + dedup por permalink         │
├─────────────────────────────────────────────────────────────────────┤
│ 4. GEMINI IA    gemini-flash-latest (primário, 64K budget)          │
│                 Fallback: Groq (openai/gpt-oss-120b) → OpenAI       │
│                 Persona dual: Mano Gamer / Técnico                  │
│                 Retry exponencial 3x em falhas (429/503/413)        │
├─────────────────────────────────────────────────────────────────────┤
│ 5. VALIDAÇÃO    Frontmatter, word count (400+), links internos      │
│                 Links inválidos removidos automaticamente           │
├─────────────────────────────────────────────────────────────────────┤
│ 6. INJEÇÃO      Imagens RAWG → início dos parágrafos (antes do texto)  │
│                 Botão afiliado → final de cada tópico                  │
│                 Capa → foto real do produto do artigo                   │
├─────────────────────────────────────────────────────────────────────┤
│ 7. SAVE + PUSH  Markdown salvo em src/content/artigos/              │
│                 Commit automático → git push → deploy GitHub Pages  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tipos de Artigo e Personas

O blog publica **5 categorias** de artigos. Cada categoria tem uma **persona de IA** específica que define o tom e o estilo de escrita.

### Persona "Mano Gamer" (Irreverente — `noticia`, `lista`, `promocao`)

Usada para 3 das 5 categorias. O prompt define uma voz forte:

```
PERSONA: Você é o "Mano Gamer", narrador raiz do Blog Gamer — um gamer brasileiro
que escreve como se estivesse trocando ideia com os amigos no Discord.
```

**Características do estilo:**
- **Abertura:** gancho direto — *"Fala, gamer!"*, *"Segura essa, galera!"*
- **Opinião forte:** critica empresas, elogia quando merece
- **Humor/sarcasmo:** metáforas do mundo gamer — *"mais difícil que matar Malenia no level 1"*
- **Gírias BR:** *"brabo"*, *"tankar"*, *"farmar"*, *"rushar"*, *"o bagulho"*, *"mermão"*
- **Leitor direto:** *"teu setup"*, *"bora ver?"*, *"vai encarar?"*
- **Proibido:** voz passiva, emojis, mencionar que é IA, termos corporativos

### Persona "Técnico" (Factual — `guia`, `review`)

Usada para guias de compra e reviews. O prompt define precisão:

```
PERSONA: Você é um redator técnico especializado em games e hardware.
Escreve reviews e guias com precisão e profundidade.
```

**Características do estilo:**
- **Abertura:** direto ao ponto, contextualiza em 1-2 frases
- **Objetividade:** compara especificações, mostra dados, explica decisões
- **Profundidade:** explica o "porquê" de cada recomendação
- **Estrutura:** tabelas comparativas, pros/contras, listas numeradas
- **Tom:** profissional acessível — *"A RTX 4060 entrega 60 fps estáveis em 1080p"*
- **Proibido:** gírias de boteco, humor forçado, sarcasmo

### Categorias

| Categoria | Slug | Persona | Conteúdo típico |
|-----------|------|---------|-----------------|
| **Notícia** | `noticia` | Mano Gamer | Lançamentos, eventos (E3, Game Awards), anúncios, trailers |
| **Review** | `review` | Técnico | Análise de jogos: gameplay, gráficos, desempenho, nota |
| **Guia de Compra** | `guia` | Técnico | Hardware: headsets, teclados, mouses, monitores, cadeiras, GPUs |
| **Lista** | `lista` | Mano Gamer | Rankings, melhores jogos do ano, melhores gratuitos, por estilo |
| **Promoção** | `promocao` | Mano Gamer | Ofertas: Steam Sale, descontos em periféricos, bundles |

### Estrutura obrigatória (todas as categorias)

Todo artigo, independente da persona, deve conter:
- **Headings** (`##`) para cada seção principal — rejeitado sem headings
- **Estrutura por tópico:** `## Nome → Imagem → Texto → Botão` (imagem antes do texto)
- **`**nome do jogo**` em negrito** na primeira menção (sistema injeta imagem RAWG)
- **Tabela comparativa** com colunas: Produto | Preço | Destaque | Nota (1-10)
- **FAQ** com 3-4 perguntas e respostas
- **Pros e Contras** em bullets para cada produto
- **2-3 links internos** para outros artigos do blog
- **Seção "Quer mais ofertas?"** com link do Telegram
- **Seção "Fontes"** com links de pesquisa
- **Mínimo 800 palavras** (sistema rejeita artigos menores)

---

## Como as Imagens São Inseridas

### Imagens de Jogos (RAWG.io)

O sistema **nunca pede para a IA gerar imagens**. Em vez disso:

1. **Detecção** (`extractGameNames`): varre o artigo por `**texto em negrito**` (padrão da IA para marcar jogos). Filtra automaticamente termos não-jogos:
   - "Instalação rápida", "Ajuste de dificuldade", "Prós", "Contras"
   - "O que é?", "Por que vale a pena?", perguntas de seção
   - Nomes de produtos (>60 caracteres, contendo "recondicionado", "mídia física")

2. **Busca no RAWG.io** (`fetchRAWGImage`): consulta `api.rawg.io/api/games?search=[nome]` e valida se o nome retornado corresponde ao termo buscado (mínimo 1 palavra >3 letras coincidindo). Rejeita matches falsos.

3. **URL de alta qualidade**: transforma o link RAWG em crop 800×450:
   ```
   /media/games/xxx.jpg → /media/crop/600/400/games/xxx.jpg?auto=format&fit=crop&w=800&h=450
   ```

4. **Posição** (`injectGameImages`): a imagem é inserida **antes do parágrafo** que contém o nome do jogo — nunca no meio da frase. Exemplo:
   ```markdown
   <img src="https://media.rawg.io/..." alt="Resident Evil Requiem" class="article-game-img">

   A Capcom confirmou **Resident Evil Requiem** para PS5 com gráficos no ultra.
   ```

5. **CSS**: `object-fit: contain` (formato natural da imagem, sem corte forçado)

6. **Lightbox**: no frontend (`[...slug].astro`), ao clicar em qualquer imagem, ela abre em tela cheia com overlay. Fecha com ESC ou clique no fundo.

### Imagem de Capa

A capa do artigo (hero image e thumbnail) é gerada via **OpenAI** com as imagens dos produtos como referência. O pipeline está em `scripts/openai-cover.mjs`:

- **Endpoint:** `POST /v1/images/edits` com modelo `gpt-image-2` (fallback: `gpt-image-1`)
- **Refinamento alternativo:** `scripts/stability-cover.mjs` refina/gera capas via Stability AI (`stable-image/generate/sd3`, secret `STABILITY_API_KEY`) quando o resultado da OpenAI precisa de retoque
- **Referências:** todas as imagens dos produtos são enviadas no campo `image[]` (multipart FormData)
- **Fallback de imagem:** se URL direta falha (404/timeout), busca automaticamente via Tavily (`include_images: true`)
- **Contraste automático:** `analyzeProductBrightness()` mede a luminância média via sharp (resize 10×10, skip pixels >200) — produtos escuros ganham fundo claro, produtos claros ganham fundo escuro
- **Artigos de jogos:** `contentType: "game"` orienta a IA a extrair personagens das referências e compô-los em um cenário de mundo de jogo (usa `GAME_TONE` em vez de `TONE`)
- **Capa gerada:** salva como PNG local em `public/images/capas/{slug}.png`, frontmatter `image:` atualizado automaticamente
- **Fallback final:** `POST /v1/images/generations` com prompt textual (apenas se nenhuma imagem foi obtida)
- **Script de exemplo:** `scripts/regenerate-psplus-cover.mjs` — cria array de produtos com `name`/`image`/`link`, chama `gerarCapaOpenAI({ mlProducts, category, slug, contentType })`

Para artigos automáticos (pipeline diário), a capa é gerada durante o `gerar-artigo.mjs`. Para regenerar manualmente, crie um script dedicado seguindo o padrão dos existentes em `scripts/regenerate-*-cover.mjs`.

---

## Como os Produtos do Mercado Livre São Inseridos

### Injeção de Botão de Produto

Os artigos **não dependem da IA** incluir produtos no texto. Após a IA gerar o artigo, o sistema injeta um botão de compra no final de cada tópico de produto:

1. **Busca de produtos** (`searchGoogleShopping`): até 5 queries usando trending keywords (ex: `"resident evil jogo ps5 xbox pc"`). A fonte é a **API de Google Shopping da Serper.dev** (`gl=br`, retorna produto + preço + imagem + link da loja: Mercado Livre, Kabum, Amazon, etc.).
2. **Link direto**: o botão aponta para a URL do produto na loja (`p.permalink`). Sem comissão até você cadastrar um programa de afiliado (Amazon Associates, AliExpress).
3. **Texto do botão**: usa o nome da loja (ex.: `VER NA KABUM`, `VER NO MERCADO LIVRE`). Editável depois no painel `/admin/`.
4. **Filtro** (`isGamerProduct`): bloqueia itens não-gamer (whey, parafusadeira, roupas, cosméticos, utensílios de cozinha, etc.)
5. **Posição**: o botão é injetado **no final de cada tópico de produto**, após o texto que descreve o produto.

### Produtos — Status Atual (ago/2026)

| Fonte | Status | Detalhe |
|-------|--------|---------|
| **Google Shopping (Serper.dev)** | ✅ Ativo | Produto + preço + imagem + link de lojas brasileiras (ML, Kabum, Amazon, Magalu). 2.500 buscas grátis; depois $50/50k (~anos de blog). |
| **Cookie de sessão ML** | ❌ Aposentado | Não usar: entrega fingerprint e causa bloqueio global (cookies deletados do projeto). |
| **OAuth ML** (`client_credentials`) | ❌ Bloqueado | `ML_CLIENT_ID` + `ML_CLIENT_SECRET` retornam `invalid_client` (local) e `/sites/MLB/search` está restrito para apps não aprovadas (403). |
| **Scraping de página ML** | ❌ Bloqueado | Todo conteúdo profundo do ML (produto, listagem, busca) cai em `account-verification`. |

Os artigos com produtos saem com `affiliate: true` e botões apontando para as lojas reais. Links com comissão (Amazon Associates, AliExpress) podem ser adicionados depois via painel ou API dedicada.

### Regenerar Links de um Artigo Existente

Use o script `fix-article-links.mjs`:

```bash
# 1. Editar SLUG e productUrls no script
# 2. Executar:
node --env-file .env scripts/fix-article-links.mjs
```

O script lê o `.md`, chama `generateAffiliateLink()` para cada URL e substitui por `meli.la/XXXXXX`. **Atenção:** esse fluxo depende de cookies de sessão, que foram aposentados — inativo até existirem credenciais de app válidas.

### Formato do Botão

```html
<a href="https://meli.la/XXXXX" class="product-btn" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>
```

### A IA e os Produtos

A IA recebe a lista de produtos no prompt, mas é instruída a **apenas mencioná-los naturalmente** no texto — sem imagens, preços ou links. O sistema cuida de toda a parte visual. Isso evita:
- Produtos duplicados (botão do sistema + texto da IA)
- Links quebrados ou preços errados

### Tabela + Pros/Contras

A IA gera dentro do corpo do artigo:
- **Tabela comparativa:** `| Produto | Preço | Destaque | Nota (1-10) |`
- **Seção Pros e Contras:** bullets para cada produto

---

## Escolha Inteligente de Tema (Trending Topics)

Antes de cada artigo, o sistema consulta **RSS feeds** de sites BR (MeuPlayStation, GameVicio, IGN Brasil) e **Reddit** (r/gaming, r/gamesEcultura) para descobrir o que está em alta:

1. Coleta headlines dos feeds RSS e posts do Reddit
2. Extrai palavras-chave de 4 categorias: **GAMES** (gta, persona, resident evil...), **CONSOLES** (ps5, xbox, nintendo switch...), **HARDWARE** (monitor, rtx, headset...), **EVENTOS** (lançamento, game awards, e3...) e **PROMOÇÕES** (oferta, desconto, steam sale...)
3. Ranqueia por frequência
4. **Dedup:** pula keywords já usadas nos últimos artigos (2+ palavras coincidindo = bloqueio)
5. Tema vencedor vira o artigo do dia, com a categoria determinada pelo tipo de keyword
6. Contexto trending injetado no prompt do Groq
7. Fallback estático se nenhum trending for encontrado (score < 2)
8. Últimos 10 tópicos salvos no `state.json`

### Como o `ml_query` é construído

A query de busca de produtos usa as **trending keywords reais**, não queries genéricas:

| Tipo de keyword | Query de exemplo |
|----------------|-----------------|
| Game (ex: resident evil) | `"resident evil persona jogo ps5 xbox pc"` |
| Console (ex: ps5) | `"ps5 resident evil persona jogo"` |
| Hardware (ex: monitor) | `"monitor gamer resident evil 2026"` |
| Evento (ex: lançamento) | `"resident evil persona jogo ps5 pc"` |
| Promoção (ex: oferta) | `"resident evil persona promocao oferta"` |

Isso garante que os produtos encontrados sejam **relacionados ao conteúdo real** do artigo, não acessórios genéricos.

---

## Modelos de IA

**Primário:** `gemini-flash-latest` (Google Gemini, plano Free). 1M tokens de entrada, 8192 de saída. Usado como primeira tentativa em toda geração.

**Fallback:** `openai/gpt-oss-120b` (Groq, plano Free) → `gpt-4o-mini` (OpenAI). Se o Gemini falha (quota, 503, truncamento), o sistema tenta Groq automaticamente. Se Groq falha, tenta OpenAI.

---

## Sistemas de Resiliência

### Retry exponencial
8 tentativas com backoff: 10s → 20s → 40s → 80s → 160s → 5min → 10min → 20min (~2h de cobertura). Trata quotas (429), servidor indisponível (503/502), payload muito grande (413) e falhas temporárias de rede.

### Cooldown inteligente (20h)
Cooldown por horas reais, não por data UTC. Se o último artigo foi gerado há menos de 20h, o sistema pula. Workflow manual tem checkbox **Force** para ignorar o cooldown.

### Degradação elegante
- **ML sem produtos / fonte bloqueada** → artigo sem produtos (`affiliate: false`), modo informativo
- **OpenAI indisponível** → capa via RAWG (fallback: sem capa AI)
- **Tavily offline** → artigo sem fontes de pesquisa + sem imagens Tavily (ainda gera conteúdo)
- **RAWG offline** → artigo sem imagens de jogos (fallback: sem imagens)
- **RSS/Reddit offline** → fallback para lista estática de temas
- **Google não acha produtos** → fallback para API interna do ML

### Concorrência isolada
`gerar-conteudo.yml`, `gerar-artigo-pilar.yml` e `deploy.yml` usam grupos de concorrência separados, evitando filas e deploys redundantes.

---

## Busca de Produtos (Google Shopping / Serper)

O sistema usa a **API de Google Shopping da Serper.dev** (geo Brasil) para encontrar produtos reais em várias lojas. O fluxo:

1. `searchGoogleShopping(query)` → `POST google.serper.dev/shopping` com `{q, gl:"br", hl:"pt-br"}`
2. Retorna por item: título, preço, imagem, link e nome da loja (`source`: Mercado Livre, Kabum, Amazon, Magalu…)
3. `isGamerProduct()` + `sanitizeProducts()` descartam não-gamer, blog/listagem/artigo, deduplicam, exigem preço e ordenam por relevância ao tópico
4. Gera o botão com o nome da loja (`VER NA KABUM`, `VER NO MERCADO LIVRE`) apontando para a URL real
5. Monta o artigo de forma **segmentada**: 1 chamada LLM por item (blurb) + 1 chamada para o corpo; itens, tabela comparativa e botões são montados em código

Fallback para tópicos de games: lista fixa de consoles/periféricos (com link real do ML).

> **⚠️ Status atual (ago/2026):** scraping e API do Mercado Livre continuam bloqueados (cookies aposentados, `account-verification`, `/search` 403). A fonte de produtos ativa é o **Google Shopping via Serper** — configure `SERPER_API_KEY` para os artigos saírem com produtos (`affiliate: true`).

---

## Funcionalidades do Site

- **Search** — Clique na lupa ou `Ctrl+K` para busca overlay com filtro em títulos, categorias e tags
- **Categorias** — Páginas dedicadas em `/categoria/noticia/`, `/categoria/review/`, etc.
- **404** — Página customizada com estética gamer
- **Ofertas** — `/ofertas/` agrega artigos com links de afiliado
- **Progress Bar** — Barra de leitura neon green no topo dos artigos
- **Lightbox** — Clique em qualquer imagem para expandir em tela cheia (ESC para fechar)
- **Texto justificado** — Parágrafos e listas com alinhamento justificado para melhor legibilidade
- **Logo** — Imagem WebP (`logo-blog.webp`) com altura e posição lateral configuráveis (itens do nav permanecem centralizados)
- **Background** — Hex grid roxo sutil (opacidade 1.5%)
- **Ícones** — SVGs inline (sem dependência de fonte externa Material Symbols)
- **Banners** — WebP otimizados (4.5 MB → 470 KB)
- **Layout** — Container 1280px, conteúdo 780px, fonte 1.05rem com line-height 1.85
- **Painel Admin** — `/admin/`: editor de layout visual (sliders de altura do nav, altura/posição lateral da logo, colunas do conteúdo/sidebar, altura do conteúdo, fontes e cores; upload de logo; salvamento em `global.css` + deploy automático), CRUD de artigos e gerenciamento de imagens

---

## Banners do Telegram

Dois banners promovendo o grupo VIP de ofertas no Telegram (`https://t.me/+TRWZ67WHuk85Y2Nh`):

| Banner | Formato | Posição |
|--------|---------|---------|
| `banner-grupo-9x16-2.webp` | 9:16 vertical | Topo da sidebar em **todas** as páginas |
| `banner-grupo.webp` | 16:9 horizontal | Final da home (full-width) + final de cada artigo |

Arquivos em `public/images/`.

---

## GitHub Secrets

| Secret | Descrição |
|--------|-----------|
| `GEMINI_API_KEY` | API key do Google Gemini (primário, modelo `gemini-flash-latest`) |
| `GROQ_API_KEY` | API key do Groq (fallback, não expira) |
| `TAVILY_API_KEY` | API key do Tavily (1000 consultas/mês free, busca fontes de pesquisa + imagens de produtos) |
| `SERPER_API_KEY` | API key da Serper.dev (Google Shopping BR — produto, preço, imagem, link da loja; 2.500 buscas grátis) |
| `RAWG_API_KEY` | API key do RAWG.io (imagens de jogos) |
| `OPENAI_API_KEY` | API key da OpenAI (fallback de texto `gpt-4o-mini` + capas IA `gpt-image-2`) |
| `STABILITY_API_KEY` | API key da Stability AI (refinamento/fallback de capas, modelo sd3) |

---

## APIs Gratuitas

| API | Função | Limite |
|-----|--------|--------|
| Gemini | Geração de texto (primário, gemini-flash-latest) | Free tier (30 RPM, 1M input, 8K output) |
| Groq | Geração de texto (fallback, openai/gpt-oss-120b) | Free tier (200K tokens/dia) |
| OpenAI | Geração de texto (fallback, gpt-4o-mini) + Capas IA (gpt-image-2) | Pago (~$0.005/imagem) |
| Stability AI | Capas IA (fallback/refino, stable-image sd3) | Pago |
| Tavily | Busca de fontes + busca Google de produtos ML + imagens não-jogos | 1000 consultas/mês free |
| ML OAuth | Links de afiliado (client_credentials) | Restrito (403 p/ apps não aprovadas) |
| ML (scraping) | Extração de título, preço e imagem de produtos | Bloqueado (account-verification) |
| RAWG | Imagens de jogos | Free tier |
| Reddit | Trending topics (r/gaming, r/gamesEcultura) | Grátis, sem API key |
| RSS Feeds | Trending topics (MeuPlayStation, GameVicio, etc.) | Grátis, sem API key |
| Google Fonts | Inter, Public Sans, Orbitron (subset latin) | Grátis |

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```bash
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
SERPER_API_KEY=...
RAWG_API_KEY=...
OPENAI_API_KEY=sk-proj-...
STABILITY_API_KEY=sk-...
```

---

## Comandos

```bash
npm run dev          # Servidor local
npm run build        # Build de produção
npm run preview      # Preview do build

node scripts/gerar-artigo.mjs          # Gerar artigo diário (manual)
node scripts/gerar-artigo-pilar.mjs    # Gerar artigo pilar (manual)
node scripts/gerar-cadeiras.mjs        # Gerar o artigo de cadeiras gamer (+ capa OpenAI)
node scripts/gerar-status.cjs          # Gerar status.json
node scripts/download-images.mjs       # Baixar imagens dos produtos
node scripts/convert-banners.mjs       # Converter banners PNG → WebP

# — Capas IA —
node scripts/regenerate-cadeiras-cover.mjs   # Regenerar capa de um artigo (ex: cadeiras)
# (regenerar-capa.yml também dispara isso via Actions)

# — Afiliados ML —
node scripts/fix-article-links.mjs     # Regenerar links meli.la em artigo existente (editar SLUG antes)

# — Suíte Python (automation/) —
python automation/generate_article.py  # Gerar artigo (modo definido pelo seed)
python automation/scheduler.py         # Agendador diário (1 artigo/dia)
python automation/force_article.py     # Forçar geração manual de um tópico
python automation/fix_article_links.py # Regenerar links meli.la (versão Python)
python automation/admin_api.py         # Painel de controle (FastAPI)
```

---

## Funcionalidades v1.1 (Melhorias de Artigo)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Blocos de produto** | `buildProductButtonHtml()` + `buildProductImageTag()` geram foto do item + botão de afiliado (sem card/preço; preço só na tabela comparativa) |
| **Índice automático** | `injectTableOfContents()` gera `## Índice` com links âncora para cada seção |
| **Validação de fontes** | `validateSourceCoverage()` verifica se cada tópico tem fonte citada |
| **Gemini primário** | `gemini-flash-latest` como IA principal, Groq como fallback |
| **Budget 64K tokens** | Aumentado de 8K para 64K para evitar truncamento de artigos |

## Workflows

| Workflow | Gatilho | Função |
|----------|---------|--------|
| **Gerar Conteudo Automatico** | Cron (diário 09:30 UTC) + manual | Artigo com trending, produtos e deploy |
| **Gerar Artigo Pilar** | Manual | Guia completo 3000+ palavras com 12+ produtos |
| **Regenerar Capa** | Manual | Regenera a capa IA de um artigo |
| **Deploy Blog Gamer** | Push na main + manual | Build e deploy GitHub Pages |

---

## Troubleshooting

### O blog parou de publicar artigos

1. Verifique o [`status.json`](https://sergioskmcle-sketch.github.io/blog-gamer/status.json)
2. Veja os logs do workflow `Gerar Conteudo Automatico` em **Actions**
3. Erro comum já corrigido (jul/2026): `Cannot read properties of undefined (reading 'slice')` — ocorria quando o script tentava logar um erro da API sem validar se a mensagem existia. O tratamento de erros agora converte valores `undefined` para string antes de usar `.slice()`.
4. **Gemini 404/400:** se o Gemini retorna `"not found"` ou `"API key not valid"`, verifique se a chave `GEMINI_API_KEY` está atualizada no GitHub Secrets e se o modelo `gemini-flash-latest` está disponível na sua conta.
5. **Workflow travando 15min+:** reduzimos as tentativas do Gemini de 5 para 3 (falha rápido e cai para Groq). Também aumentamos o budget de tokens de 8K para 64K para evitar truncamento.
6. **Push falhando com conflito:** o workflow agora faz rebase na branch atual em vez de forçar `origin main`.
7. Verifique se as chaves dos secrets ainda são válidas (`GEMINI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`, etc.)

### Artigos sem produtos

Artigos de tópicos que não encontram produto (ou sem `SERPER_API_KEY` configurada) saem com `affiliate: false`:

1. **Fonte de produtos sem resultados:** o Google Shopping (Serper) pode não retornar produto para o tópico, ou a `SERPER_API_KEY` não está configurada. Confirmar o secret e tentar de novo.
2. **Link quebrado:** se a loja removeu o produto, a URL retorna 404. Corrigir no painel `/admin/` (aba Produtos) ou gerar de novo.
3. **Produto errado (permalloc reciclado):** se um marketplace reutilizou o ID/URL de outro produto, atualize o link manualmente no painel.

### Consumo do GROQ

O blog faz poucas chamadas ao GROQ (geralmente 2–3 por artigo, diariamente). Se você usa a mesma conta do GROQ em outros projetos, o consumo compartilhado pode chegar ao limite gratuito:

| Projeto | Chamadas/24h |
|---------|-------------|
| blog-gamer | ~44 |
| monitor-telegram | ~270 |
| **Limite gratuito** | **6.000** |

Se o total se aproximar do limite, considere uma conta GROQ separada para o blog.

---

## Manutenção

### Reativar produtos no pipeline (Serper)

Os produtos vêm do **Google Shopping via Serper.dev** (sem cookies, sem OAuth). Para ativar:

1. **Crie uma conta grátis em [serper.dev](https://serper.dev)** (2.500 buscas, sem cartão).
2. **Copie a API key** do dashboard e configure:
   - Local: `SERPER_API_KEY=...` no `.env`
   - GitHub: `gh secret set SERPER_API_KEY`
3. O pipeline busca até 5 produtos por artigo (`searchGoogleShopping`) e gera botões com o nome da loja (`VER NA KABUM`, `VER NO MERCADO LIVRE`). Links são diretos (sem comissão).
4. **Editar botões depois**: no painel `/admin/`, aba **Produtos** — altere o texto e o link de cada botão (ex.: troque o link ML pelo seu link de afiliado) e salve.
5. **Monetização futura**: cadastre-se no Amazon Associates ou no AliExpress Affiliate e troque os links no painel, ou integre a API dedicada.

> **Regra de ouro:** não reativar cookies de sessão do ML — o uso deles causou bloqueio global.

### Recriar chave do Groq

Se a chave do Groq for recriada no console, atualize o GitHub Secret e o `.env` local. O `status.json` mostrará `saudavel: false` com o erro `401 Invalid API Key` nos `erros_recentes`.

### Google Search Console

O blog está verificado no Google Search Console. Sitemap enviado em:
`https://sergioskmcle-sketch.github.io/blog-gamer/sitemap-index.xml`
