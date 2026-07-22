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
  "ultimo_artigo": "2026-07-21",
  "ultimo_deploy": "2026-07-21T23:54:53Z",
  "total_artigos": 17,
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
  convert-banners.mjs       → Converte banners PNG para WebP

src/content/artigos/   → Artigos em markdown com frontmatter
state.json             → Estado da geração (cooldown, falhas, tópicos recentes)
public/status.json     → Status público gerado a cada deploy
public/images/         → Banners Telegram (WebP), logo SVG, imagens de produtos
```

---

## Modelo de IA

**openai/gpt-oss-120b** (Groq, plano Free). Substituiu o llama-3.3-70b em Jul/2026. Escreve melhor em português, segue instruções complexas (tabelas, FAQ, pros/cons), e tem o dobro do limite gratuito (200K tokens/dia vs 100K). Limitado a 8K TPM por requisição (payload otimizado para ~7K).

---

## Injeção Mecânica de Produtos

Os artigos **não dependem mais** da IA incluir produtos no texto. Após o Groq gerar o artigo, o sistema injeta os product cards diretamente no markdown — com imagens, preços e botões "VER NO MERCADO LIVRE". Isso garante que **100% dos produtos encontrados** aparecem no artigo, independente do modelo cooperar ou não.

---

## Busca de Produtos via Google

O sistema usa **Tavily/Google** para encontrar produtos no Mercado Livre (não a API interna do ML, que é limitada para hardware). O fluxo:

1. Tavily busca `"RTX 4060 placa de video preço Brasil"` + `"site:mercadolivre.com.br"`
2. Extrai URLs de produtos do ML dos resultados
3. Faz scraping da página do produto (título, preço, imagem)
4. Gera link de afiliado via `generateAffiliateLink()`
5. Injeta product cards no artigo

Fallback: se o Google não encontrar, tenta a API interna do ML.

---

## Escolha Inteligente de Tema (Trending Topics)

Antes de cada artigo, o sistema consulta **RSS feeds** de sites BR (MeuPlayStation, GameVicio, IGN Brasil) e **Reddit** (r/gaming, r/gamesEcultura) para descobrir o que está em alta:

1. Coleta headlines dos feeds RSS e posts do Reddit
2. Extrai palavras-chave e ranqueia por frequência
3. Tema vencedor vira o artigo do dia
4. Contexto trending injetado no prompt do Groq
5. Fallback estático se nenhum trending for encontrado (score < 2)
6. Últimos 10 tópicos salvos no `state.json` para evitar repetição

---

## Sistemas de Resiliência

### Retry exponencial
8 tentativas com backoff: 10s → 20s → 40s → 80s → 160s → 5min → 10min → 20min (~2h de cobertura). Trata quotas (429), servidor indisponível (503/502) e falhas temporárias de rede.

### Cooldown inteligente (20h)
Cooldown por horas reais, não por data UTC. Se o último artigo foi gerado há menos de 20h, o sistema pula. Workflow manual tem checkbox **Force** para ignorar o cooldown.

### Degradação elegante
- **ML sem produtos** → modo informativo (conteúdo puro, sem links de afiliado)
- **Tavily offline** → artigo sem fontes de pesquisa (ainda gera conteúdo)
- **RAWG offline** → artigo sem imagens de jogos (fallback: sem imagens)
- **Cookies ML expirados** → links diretos do ML (sem tracking de afiliado)
- **RSS/Reddit offline** → fallback para lista estática de temas
- **Google não acha produtos** → fallback para API interna do ML

### Imagens automáticas de jogos
Integração com RAWG.io — nomes de jogos em **negrito** recebem imagens automaticamente. Capa do artigo usa RAWG quando não há produto do ML.

### Concorrência isolada
`gerar-conteudo.yml`, `gerar-artigo-pilar.yml` e `deploy.yml` usam grupos de concorrência separados, evitando filas e deploys redundantes.

---

## Fluxo de Geração (Artigo Diário)

1. **Agendamento** — CI dispara a cada 2 dias (cron `30 9 */2 * *`) ou manualmente
2. **Trending** — RSS + Reddit para descobrir tema em alta
3. **Estado** — Verifica cooldown de 20h no `state.json`
4. **Pesquisa** — Tavily (`search_depth: advanced`, `max_results: 4`) busca fontes
5. **Produtos ML** — Google → scrape → affiliate link (fallback: API ML)
6. **Geração** — Groq (openai/gpt-oss-120b) escreve com tabelas, FAQ, pros/cons
7. **Injeção** — Product cards inseridos mecanicamente no markdown
8. **Imagens** — RAWG.io busca wallpapers dos jogos mencionados
9. **Capa** — Produto ML ou RAWG ou vazio
10. **Validação** — frontmatter, word count mínimo (400 palavras)
11. **Commit + Push** → dispara deploy automaticamente via `gh workflow run`

---

## Fluxo de Geração (Artigo Pilar)

1. **Manual** — `workflow_dispatch` (1x por mês)
2. **Pesquisa** — 6 queries Tavily + 6 queries Google ML (uma por seção)
3. **Produtos** — 2 produtos por seção (~12 no total), links de afiliado
4. **Draft** — Groq gera 9 seções (~3000 palavras)
5. **Injeção** — Product cards inseridos mecanicamente sob cada heading
6. **Refino** — Segundo passe do Groq para correções
7. **Commit + Push** → deploy automático

---

## Funcionalidades do Site

- **Search** — Clique na lupa ou `Ctrl+K` para busca overlay com filtro em títulos, categorias e tags
- **Categorias** — Páginas dedicadas em `/categoria/noticia/`, `/categoria/review/`, etc.
- **404** — Página customizada com estética gamer
- **Ofertas** — `/ofertas/` agrega artigos com links de afiliado
- **Progress Bar** — Barra de leitura neon green no topo dos artigos
- **Logo** — Ícone SVG + fonte Orbitron (display gamer)
- **Background** — Hex grid roxo sutil (opacidade 1.5%)
- **Ícones** — SVGs inline (sem dependência de fonte externa Material Symbols)
- **Banners** — WebP otimizados (4.5 MB → 470 KB)

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

Os cookies do Mercado Livre expiram periodicamente. Sem eles, os links de afiliado ainda funcionam, mas sem tracking.

1. Acesse mercadolivre.com.br logado com a conta `sergioskm`
2. Exporte os cookies como JSON (extensão Cookie-Editor)
3. Salve como `ml_cookies.json`
4. Codifique em base64 e atualize o secret `ML_COOKIES_B64`:

```powershell
gh secret set ML_COOKIES_B64 --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("ml_cookies.json"))) --repo sergioskmcle-sketch/blog-gamer
```

### Recriar chave do Groq

Se a chave do Groq for recriada no console, atualize o GitHub Secret e o `.env` local. O `status.json` mostrará `saudavel: false` com o erro `401 Invalid API Key` nos `erros_recentes`.

### Google Search Console

O blog está verificado no Google Search Console. Sitemap enviado em:
`https://sergioskmcle-sketch.github.io/blog-gamer/sitemap-index.xml`
