# Blog Gamer

Blog estático sobre o mundo gamer com links de afiliado do Mercado Livre.

**URL:** https://sergioskmcle-sketch.github.io/blog-gamer

## Artigos Publicados

| Artigo | Data | Status |
|--------|------|--------|
| [Os 10 Melhores Monitores Gamer Custo-Beneficio do Mercado Livre em 2026](https://sergioskmcle-sketch.github.io/blog-gamer/blog/os-10-melhores-monitores-gamer-custo-beneficio-do-mercado-livre-em-2026) | 2026-06-29 | ✅ Live |
| [As 8 Melhores Placas de Video Custo-Beneficio do Mercado Livre em 2026](https://sergioskmcle-sketch.github.io/blog-gamer/blog/as-10-melhores-placas-de-video-custo-beneficio-do-mercado-livre-em-2026) | 2026-06-30 | ✅ Live |
| [Lançamento de Games e Anúncios de Consoles](https://sergioskmcle-sketch.github.io/blog-gamer/blog/lan%C3%A7amento-de-games-e-an%C3%BAncios-de-consoles-o-que-voc%C3%AA-precisa-saber) | 2026-06-30 | ✅ Live |
| [GTA 6: Data de Lançamento, Preço, Pré-venda](https://sergioskmcle-sketch.github.io/blog-gamer/blog/gta-6-data-de-lancamento-preco-pre-venda) | 2026-07-01 | ✅ Live |

## Arquitetura

```
.github/workflows/
  gerar-conteudo.yml   → Geração automática de artigos (scheduled + push)
  deploy.yml           → Deploy GitHub Pages

scripts/
  ml_affiliate.mjs        → API ML (token OAuth, busca produtos, link afiliado)
  gerar-artigo.mjs        → Geração automática (Tavily → ML → Groq → validação)
  gerar-placas-video.mjs  → One-off: artigo de placas de vídeo
  download-images.mjs     → Baixa imagens dos produtos para o repo (evita hotlink do ML)

src/content/artigos/   → Artigos em markdown com frontmatter
```

## Fluxo de Geração de Artigo

1. **Pesquisa** — Tavily busca fontes sobre o tema
2. **Produtos ML** — Busca via API de categoria do ML (highlights + items) ou Tavily + ML Products API
3. **Geração** — Groq (llama-3.3-70b) escreve o artigo com imagens e links de afiliado
4. **Validação** — frontmatter, word count mínimo
5. **Commit + Push** — GitHub Actions faz build e deploy

## APIs Gratuitas

| API | Chave | Limite |
|-----|-------|--------|
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile, free |
| Tavily | `TAVILY_API_KEY` | 1000 consultas/mês free |
| ML OAuth | `ML_CLIENT_ID` + `ML_CLIENT_SECRET` | client_credentials, free |
| ML Cookies | `ml_cookies.json` | Sessão do navegador para link afiliado |

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```bash
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
ML_CLIENT_ID=...
ML_CLIENT_SECRET=...
```

### GitHub Secrets (para CI)

| Secret | Descrição |
|--------|-----------|
| `GROQ_API_KEY` | API key do Groq |
| `TAVILY_API_KEY` | API key do Tavily |
| `ML_CLIENT_ID` | Client ID do app ML |
| `ML_CLIENT_SECRET` | Client Secret do app ML |
| `ML_COOKIES_B64` | Cookies ML em base64 (de `ml_cookies.json`) |

## Comandos

```bash
npm run dev          # Servidor local
npm run build        # Build de produção
npm run preview      # Preview do build
node scripts/gerar-artigo.mjs          # Geração automática
node scripts/gerar-placas-video.mjs    # One-off: placas de vídeo
node scripts/download-images.mjs       # Baixar imagens dos produtos para o repo
```

## Configurar GitHub Pages

1. Crie um repositório no GitHub chamado `blog-gamer`
2. Habilite GitHub Pages em Settings > Pages > source: GitHub Actions
3. Faça push do código

## Imagens dos Produtos

As imagens dos produtos são baixadas para `public/images/produtos/` e servidas localmente pelo GitHub Pages, eliminando dependência do CDN do ML.

Sempre que um novo artigo for gerado, rode:

```bash
node scripts/download-images.mjs
```

O script:
1. Varre todos os markdowns em `src/content/artigos/`
2. Baixa as imagens dos produtos para o repositório
3. Se o CDN do ML bloquear (retorna GIF placeholder para imagens `.webp`), segue o link de afiliado e extrai a imagem OG da página do produto
4. Atualiza os caminhos nos markdowns

## Problemas Conhecidos

### 🔴 Links de Afiliado não funcionam nos artigos publicados

**Sintoma:** Os links "VER NO MERCADO LIVRE" nos artigos apontam para URLs do ML sem o tracking de afiliado (`?tag=sergioskm`).

**Causa:** A API de links do ML retorna URLs curtas que funcionam localmente, mas o cookie de sessão usado para gerar o link expira no CI (GitHub Actions). O secret `ML_COOKIES_B64` contém cookies expirados.

**Solução pendente:**
1. Exportar cookies frescos do navegador logado no ML com conta `sergioskm`
2. Salvar em `ml_cookies.json` (já está no `.gitignore`)
3. Codificar em base64 e atualizar o secret `ML_COOKIES_B64` no GitHub
   ```bash
   $env:ML_COOKIES_B64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("ml_cookies.json"))
   ```
4. Opcional: o parâmetro `?tag=sergioskm` pode ser adicionado manualmente aos links como fallback

### 🔴 ML Search API bloqueada

A API de busca do ML (`/sites/MLB/search`) retorna 403. Solução: usar highlights da categoria + Products API + Items API para descobrir produtos.

### 🟡 ML_COOKIES_B64 expirado no GitHub

O secret precisa ser atualizado manualmente sempre que os cookies expirarem. Solução ideal: implementar login automatizado via API.
