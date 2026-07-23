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
  "ultimo_artigo": "2026-07-23",
  "ultimo_deploy": "2026-07-23T20:14:40Z",
  "total_artigos": 24,
  "erros_recentes": [],
  "apis": { "groq": "ok", "tavily": "ok", "rawg": "ok" }
}
```

Se `saudavel: false` ou `ultimo_artigo` está muito antigo, verifique os secrets no GitHub.

---

## Arquitetura

```
.github/workflows/
  gerar-conteudo.yml      → Geração automática diária (schedule + manual)
  gerar-artigo-pilar.yml  → Artigo pilar manual (3000+ palavras, 1x/mês)
  deploy.yml              → Deploy GitHub Pages (push + manual)

scripts/
  gerar-artigo.mjs          → Pipeline principal (trending → Tavily → Google ML → Groq → RAWG → injeção de produtos → validação)
  gerar-artigo-pilar.mjs    → Artigo pilar (3 passes: pesquisa → draft → refino + injeção mecânica de produtos)
  ml_affiliate.mjs          → API ML (token OAuth, searchMLviaGoogle, link afiliado)
  gerar-status.cjs          → Gera status.json a cada deploy
  download-images.mjs       → Baixa imagens dos produtos para o repo
  convert-banners.mjs       → Converter banners PNG → WebP

src/content/artigos/   → Artigos em markdown com frontmatter
state.json             → Estado da geração (cooldown, falhas, tópicos recentes)
public/status.json     → Status público gerado a cada deploy
public/images/         → Banners Telegram (WebP), logo SVG, imagens de produtos
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
│ 4. GROQ IA      openai/gpt-oss-120b (8K TPM)                       │
│                 Persona dual: Mano Gamer / Técnico                  │
│                 Retry exponencial 8x em falhas (429/503/413)        │
├─────────────────────────────────────────────────────────────────────┤
│ 5. VALIDAÇÃO    Frontmatter, word count (400+), links internos      │
│                 Links inválidos removidos automaticamente           │
├─────────────────────────────────────────────────────────────────────┤
│ 6. INJEÇÃO      Product cards → entre intro e 2º heading           │
│                 Imagens RAWG → final dos parágrafos                 │
│                 Capa → RAWG trending keyword ou produto ML          │
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

4. **Posição** (`injectGameImages`): a imagem é inserida **após o parágrafo** que contém o nome do jogo — nunca no meio da frase. Exemplo:
   ```markdown
   A Capcom confirmou **Resident Evil Requiem** para PS5 com gráficos no ultra.

   <img src="https://media.rawg.io/..." alt="Resident Evil Requiem" class="article-game-img">
   ```

5. **Lightbox**: no frontend (`[...slug].astro`), ao clicar em qualquer imagem, ela abre em tela cheia com overlay. Fecha com ESC ou clique no fundo.

### Imagem de Capa

A capa do artigo (hero image no topo da página e thumbnail nos cards) segue esta prioridade:

1. **RAWG da 1ª trending keyword** (tópico principal do artigo — ex: wallpaper de "Resident Evil")
2. **Thumbnail do 1º produto do Mercado Livre** (fallback)
3. **RAWG do 1º jogo mencionado no corpo do texto** (segundo fallback)
4. **Vazio** (artigo sem imagem de capa)

---

## Como os Produtos do Mercado Livre São Inseridos

### Injeção Mecânica de Product Cards

Os artigos **não dependem da IA** incluir produtos no texto. Após o Groq gerar o artigo, o sistema injeta product cards diretamente no markdown:

1. **Busca de produtos** (`searchMLviaGoogle`): até 4 queries usando trending keywords (ex: `"resident evil jogo ps5 xbox pc"`). Fallback para API interna do ML.
2. **Link de afiliado** (`generateAffiliateLink`): visita a página do produto para obter CSRF token, chama API de afiliados — resultado: `https://meli.la/XXXXXX`
3. **Filtro** (`isGamerProduct`): bloqueia itens não-gamer (whey, parafusadeira, roupas, cosméticos, utensílios de cozinha, etc.)
4. **Posição**: os cards são injetados **entre o conteúdo da introdução e o segundo heading** do artigo — o leitor vê a introdução primeiro, depois os produtos.

### Formato do Card

```html
<div class="product-card">
  <img src="[thumbnail]" class="product-card-img">
  <div class="product-card-body">
    <h3>[nome do produto]</h3>
    <div class="product-price">R$ [preço]</div>
    <p>Garante o teu no Mercado Livre antes que o estoque acabe.</p>
    <div class="product-pros"><strong>Destaque:</strong> [frase rotativa]</div>
    <a href="https://meli.la/XXXXX" class="product-btn">VER NO MERCADO LIVRE</a>
  </div>
</div>
```

Os destaques são frases rotativas no tom do blog:
- *"Setup gamer raiz sem vender o rim"*
- *"Desempenho de elite sem preço de scalper"*
- *"Custo-benefício que não pesa no bolso"*

### A IA e os Produtos

A IA recebe a lista de produtos no prompt, mas é instruída a **apenas mencioná-los naturalmente** no texto — sem imagens, preços ou links. O sistema cuida de toda a parte visual. Isso evita:
- Produtos duplicados (card do sistema + texto da IA)
- Links quebrados ou preços errados
- Imagens de baixa qualidade

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

## Modelo de IA

**openai/gpt-oss-120b** (Groq, plano Free). Substituiu o llama-3.3-70b em Jul/2026. Escreve melhor em português, segue instruções complexas (tabelas, FAQ, pros/cons), e tem o dobro do limite gratuito (200K tokens/dia vs 100K). Limitado a 8K TPM por requisição (payload otimizado para ~7K).

---

## Sistemas de Resiliência

### Retry exponencial
8 tentativas com backoff: 10s → 20s → 40s → 80s → 160s → 5min → 10min → 20min (~2h de cobertura). Trata quotas (429), servidor indisponível (503/502), payload muito grande (413) e falhas temporárias de rede.

### Cooldown inteligente (20h)
Cooldown por horas reais, não por data UTC. Se o último artigo foi gerado há menos de 20h, o sistema pula. Workflow manual tem checkbox **Force** para ignorar o cooldown.

### Degradação elegante
- **ML sem produtos** → modo informativo (conteúdo puro, sem links de afiliado)
- **Tavily offline** → artigo sem fontes de pesquisa (ainda gera conteúdo)
- **RAWG offline** → artigo sem imagens de jogos (fallback: sem imagens)
- **Cookies ML expirados** → links diretos do ML (sem tracking de afiliado)
- **RSS/Reddit offline** → fallback para lista estática de temas
- **Google não acha produtos** → fallback para API interna do ML

### Concorrência isolada
`gerar-conteudo.yml`, `gerar-artigo-pilar.yml` e `deploy.yml` usam grupos de concorrência separados, evitando filas e deploys redundantes.

---

## Busca de Produtos via Google

O sistema usa **Tavily/Google** para encontrar produtos no Mercado Livre (não a API interna do ML, que é limitada para hardware). O fluxo:

1. Tavily busca `"resident evil jogo ps5"` + `"site:mercadolivre.com.br"`
2. Extrai URLs de produtos do ML dos resultados
3. Faz scraping da página do produto (título, preço, imagem)
4. Gera link de afiliado via `generateAffiliateLink()`
5. Injeta product cards no artigo

Fallback: se o Google não encontrar, tenta a API interna do ML.

---

## Funcionalidades do Site

- **Search** — Clique na lupa ou `Ctrl+K` para busca overlay com filtro em títulos, categorias e tags
- **Categorias** — Páginas dedicadas em `/categoria/noticia/`, `/categoria/review/`, etc.
- **404** — Página customizada com estética gamer
- **Ofertas** — `/ofertas/` agrega artigos com links de afiliado
- **Progress Bar** — Barra de leitura neon green no topo dos artigos
- **Lightbox** — Clique em qualquer imagem para expandir em tela cheia (ESC para fechar)
- **Texto justificado** — Parágrafos e listas com alinhamento justificado para melhor legibilidade
- **Logo** — Ícone SVG + fonte Orbitron (display gamer)
- **Background** — Hex grid roxo sutil (opacidade 1.5%)
- **Ícones** — SVGs inline (sem dependência de fonte externa Material Symbols)
- **Banners** — WebP otimizados (4.5 MB → 470 KB)
- **Layout** — Container 1280px, conteúdo 780px, fonte 1.05rem com line-height 1.85

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
| `GROQ_API_KEY` | API key do Groq (não expira, mas pode ser recriada no console) |
| `TAVILY_API_KEY` | API key do Tavily (1000 consultas/mês free, busca fontes + produtos Google) |
| `ML_CLIENT_ID` | Client ID do app ML (OAuth client_credentials) |
| `ML_CLIENT_SECRET` | Client Secret do app ML |
| `ML_COOKIES_B64` | Cookies ML em base64 (de `ml_cookies.json`, para links de afiliado) |
| `RAWG_API_KEY` | API key do RAWG.io (imagens de jogos) |

---

## APIs Gratuitas

| API | Função | Limite |
|-----|--------|--------|
| Groq | Geração de texto (openai/gpt-oss-120b) | Free tier (200K tokens/dia) |
| Tavily | Busca de fontes + busca Google de produtos ML | 1000 consultas/mês free |
| ML OAuth | Links de afiliado (client_credentials) | Free |
| ML (scraping) | Extração de título, preço e imagem de produtos | Sem limite |
| RAWG | Imagens de jogos | Free tier |
| Reddit | Trending topics (r/gaming, r/gamesEcultura) | Grátis, sem API key |
| RSS Feeds | Trending topics (MeuPlayStation, GameVicio, etc.) | Grátis, sem API key |
| Google Fonts | Inter, Public Sans, Orbitron (subset latin) | Grátis |

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```bash
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
ML_CLIENT_ID=...
ML_CLIENT_SECRET=...
RAWG_API_KEY=...
```

---

## Comandos

```bash
npm run dev          # Servidor local
npm run build        # Build de produção
npm run preview      # Preview do build

node scripts/gerar-artigo.mjs          # Gerar artigo diário (manual)
node scripts/gerar-artigo-pilar.mjs    # Gerar artigo pilar (manual)
node scripts/gerar-status.cjs          # Gerar status.json
node scripts/download-images.mjs       # Baixar imagens dos produtos
node scripts/convert-banners.mjs       # Converter banners PNG → WebP
```

---

## Workflows

| Workflow | Gatilho | Função |
|----------|---------|--------|
| **Gerar Conteudo Automatico** | Cron (2 dias) + manual | Artigo diário com trending, produtos e deploy |
| **Gerar Artigo Pilar** | Manual | Guia completo 3000+ palavras com 12+ produtos |
| **Deploy Blog Gamer** | Push + manual | Build e deploy GitHub Pages |

---

## Manutenção

### Renovar cookies do ML

Os cookies do Mercado Livre expiram periodicamente. Sem eles, os links saem sem tracking de afiliado (ainda funcionam como links diretos).

1. Acesse mercadolivre.com.br logado com a conta `sergioskm`
2. Exporte os cookies como JSON (extensão Cookie-Editor)
3. Salve como `ml_cookies.json`
4. Codifique em base64 e atualize o secret `ML_COOKIES_B64`:

```powershell
gh secret set ML_COOKIES_B64 --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("ml_cookies.json"))) --repo sergioskmcle-sketch/blog-gamer
```

**Importante:** o arquivo JSON deve ser salvo **sem BOM** (UTF-8 without BOM). PowerShell adiciona BOM com `Set-Content -Encoding UTF8`. Use `[System.IO.File]::WriteAllText` ou export do Cookie-Editor diretamente.

### Recriar chave do Groq

Se a chave do Groq for recriada no console, atualize o GitHub Secret e o `.env` local. O `status.json` mostrará `saudavel: false` com o erro `401 Invalid API Key` nos `erros_recentes`.

### Google Search Console

O blog está verificado no Google Search Console. Sitemap enviado em:
`https://sergioskmcle-sketch.github.io/blog-gamer/sitemap-index.xml`
