# Skill: Imagens de Jogos e Produtos

## Descrição
Busca e gerencia imagens para artigos do blog. Jogos via RAWG, produtos via Google Shopping, capas via IA.

## Hierarquia de Imagens

### 1. Imagens de Jogos (RAWG API)
- **API:** RAWG Video Games Database
- **Uso:** Imagens de jogos mencionados no artigo
- **Formato:** `<img src="URL_RAWG" alt="Nome do Jogo" class="article-game-img" loading="lazy" decoding="async">`
- **Parâmetros de crop:** `?auto=format&fit=crop&w=800&h=450`

### 2. Imagens de Produtos (Google Shopping)
- **API:** Serper (Google Shopping thumbnails)
- **Uso:** Imagens dos produtos listados no artigo
- **Formato:** URL direta do thumbnail do Google Shopping
- **Regra:** Imagem deve ser EXATAMENTE do produto mencionado

### 3. Capas de Artigo (IA)
- **APIs:** OpenAI DALL-E → Stability AI → fallback RAWG
- **Script:** `scripts/openai-cover.mjs`
- **Formato:** WebP/PNG em `/images/capas/`

## Regras

### Proibido
- NUNCA: imagens base64 (data:URI) no markdown
- NUNCA: imagens locais (/public/images/) — servidor não fica ligado
- NUNCA: imagens de Instagram/Facebook/TikTok (frágeis, dependem de auth)
- NUNCA: imagens de CDNs de terceiros que podem bloquear hotlinking

### Permitido
- RAWG API (jogos) — estável, alta qualidade
- Google Shopping thumbnails (produtos) — CDN do Google, sempre atualizado
- URLs de fabricantes oficiais (wooting.io, keychron.com, etc.) — para capas/artigos destacados

### Validação de Imagem
- Imagem do produto deve corresponder ao produto mencionado no texto
- Verificar se a URL retorna 200
- Alt text deve descrever a imagem com keyword quando relevante
- `loading="lazy"` e `decoding="async"` OBRIGATÓRIOS

## Scripts Relacionados
- `scripts/openai-cover.mjs` — geração de capa via OpenAI
- `scripts/gerar-artigo.mjs` — injecão de imagens RAWG via `injectGameImages()`
- `scripts/gerar-artigo.mjs` — fallback de imagens
