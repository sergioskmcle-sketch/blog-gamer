# Skill: Imagens de Jogos e Produtos

## Descrição
Busca e gerencia imagens para artigos do blog. Jogos via RAWG, produtos via Google Shopping, capas via IA.

## Hierarquia de Imagens

### 1. Imagens de Jogos (RAWG API)
- **API:** RAWG Video Games Database
- **Uso:** Imagens de jogos mencionados no artigo
- **Formato:** `<img src="URL_RAWG" alt="Nome do Jogo" class="article-game-img" loading="lazy" decoding="async">`
- **Parâmetros de crop:** `?auto=format&fit=crop&w=800&h=450`

#### Queda progressiva de busca (RAWG e Tavily)
O título de uma seção costuma ter subtítulo de marketing que o RAWG não conhece
(ex.: `The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição`).
Em vez de desistir na primeira busca, o pipeline cai progressivamente o nome
(`progressiveGameQueries` em `scripts/gerar-artigo.mjs`) até achar a imagem:

1. Nome completo (com subtítulo)
2. Sem subtítulo após a travessão (` — `)
3. Sem sufixo de versão genérico (`remake`, `remaster`, `edition`, `deluxe`...)
4. Partes separadas por `:` (prefixo e sufixo — ex.: `The Legend of Zelda` e `Ocarina of Time`)
5. Palavras removidas do final (até 3)
6. Sem artigo inicial (`The `)

Ordem de fontes: **RAWG → Tavily** (o Tavily recebe as mesmas variantes, uma a uma).

#### Filtros de qualidade no fallback web
- **URLs frágeis nunca usadas** (`isFragileImageUrl`): wikimedia, Instagram,
  Facebook, TikTok, Reddit (`redd.it`/`redditmedia.com`), `data:` URIs.
- **Preferência de hosts estáveis** antes de validar: `media.rawg.io`,
  `i.ytimg.com`, `nintendo.com`, `shared.akamai.steamstatic.com`,
  `store.steampowered.com`.
- **Validação HTTP** (`HEAD` retornando 2xx) antes de aceitar a imagem.
- Se nada passar em todas as variantes, o marcador é removido e a seção fica sem imagem.

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
