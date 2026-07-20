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
  "ultimo_artigo": "2026-07-20",
  "ultimo_deploy": "2026-07-20T22:30:25Z",
  "total_artigos": 21,
  "erros_recentes": [],
  "apis": { "groq": "ok", "tavily": "ok", "rawg": "ok" }
}
```

Se `saudavel: false` ou `ultimo_artigo` está muito antigo, verifique os secrets no GitHub.

---

## Arquitetura

```
.github/workflows/
  gerar-conteudo.yml   → Geração automática (schedule + manual)
  deploy.yml           → Deploy GitHub Pages (push + manual)

scripts/
  gerar-artigo.mjs        → Pipeline principal (trending → Tavily → ML → Groq → RAWG → validação → state.json)
  ml_affiliate.mjs        → API ML (token OAuth, busca produtos, link afiliado)
  gerar-status.cjs        → Gera status.json a cada deploy
  download-images.mjs     → Baixa imagens dos produtos para o repo

src/content/artigos/   → Artigos em markdown com frontmatter
state.json             → Estado da geração (cooldown, falhas, tópicos recentes)
public/status.json     → Status público gerado a cada deploy
public/images/         → Banners do Telegram (banner-grupo.png, banner-grupo-9x16-2.png)
```

---

## Escolha Inteligente de Tema (Trending Topics)

O sistema não usa mais uma lista fixa de temas. Antes de cada artigo, ele consulta **RSS feeds** de sites BR (MeuPlayStation, GameVicio, IGN Brasil, TecMundo) e **Reddit** (r/gaming, r/gamesEcultura) para descobrir o que está em alta:

1. Coleta headlines dos feeds RSS e posts do Reddit
2. Extrai palavras-chave (jogos, consoles, hardware, eventos) e ranqueia por frequência
3. Tema vencedor vira o artigo do dia, com categoria e hint montados automaticamente
4. O contexto trending é injetado no prompt do Groq (ex: "PS5, Call of Duty e GTA estão em alta agora")
5. Se nenhum trending for encontrado (score < 2), cai pro fallback estático
6. Últimos 10 tópicos são salvos no `state.json` para evitar repetição

---

## Sistemas de Resiliência

### Retry exponencial
8 tentativas com backoff: 10s → 20s → 40s → 80s → 160s → 5min → 10min → 20min (~2h de cobertura). Trata quotas (429), servidor indisponível (503/502) e falhas temporárias de rede.

### Cooldown por estado real
Se a geração falhar (erro no Groq, frontmatter inválido, etc.), o sistema tenta de novo no próximo ciclo agendado. Só respeita cooldown de 24h quando a geração anterior foi bem-sucedida.

### Degradação elegante
- **ML sem produtos** → modo informativo (conteúdo puro, sem links de afiliado)
- **Tavily offline** → artigo sem fontes de pesquisa (ainda gera conteúdo)
- **RAWG offline** → artigo sem imagens de jogos (fallback: sem imagens)
- **Cookies ML expirados** → links diretos do ML (sem tracking de afiliado)
- **RSS/Reddit offline** → fallback para lista estática de temas

### Imagens automáticas de jogos
Integração com RAWG.io — nomes de jogos em **negrito** no artigo recebem imagens automaticamente dos servidores da RAWG. Capa do artigo também vem da RAWG quando não há produto do ML.

### Concorrência isolada
`gerar-conteudo.yml` e `deploy.yml` usam grupos de concorrência separados (`content-generation` vs `pages-deploy`), evitando filas e deploys redundantes.

---

## Fluxo de Geração

1. **Agendamento** — CI dispara a cada 2 dias (cron) ou manualmente
2. **Trending** — Consulta RSS + Reddit para descobrir tema em alta
3. **Estado** — Verifica `state.json` para decidir se deve gerar
4. **Pesquisa** — Tavily (`search_depth: advanced`, `time_range: month`) busca fontes
5. **Produtos ML** — Busca via ML Products API (OAuth) com fallback para Tavily
6. **Geração** — Groq (llama-3.3-70b-versatile) escreve o artigo com contexto trending
7. **Imagens** — RAWG.io busca wallpapers dos jogos mencionados
8. **Validação** — frontmatter, word count mínimo (400 palavras)
9. **Commit + Push** — dispara o deploy automaticamente

---

## Banners do Telegram

Dois banners promovendo o grupo VIP de ofertas no Telegram (`https://t.me/+TRWZ67WHuk85Y2Nh`):

| Banner | Formato | Posição |
|--------|---------|---------|
| `banner-grupo-9x16-2.png` | 9:16 vertical | Topo da sidebar em **todas** as páginas |
| `banner-grupo.png` | 16:9 horizontal | Final da home (full-width) + final de cada artigo |

Arquivos em `public/images/`.

---

## GitHub Secrets

| Secret | Descrição |
|--------|-----------|
| `GROQ_API_KEY` | API key do Groq (não expira, mas pode ser recriada no console) |
| `TAVILY_API_KEY` | API key do Tavily (1000 consultas/mês free) |
| `ML_CLIENT_ID` | Client ID do app ML (OAuth client_credentials) |
| `ML_CLIENT_SECRET` | Client Secret do app ML |
| `ML_COOKIES_B64` | Cookies ML em base64 (de `ml_cookies.json`) |
| `RAWG_API_KEY` | API key do RAWG.io (imagens de jogos) |

---

## APIs Gratuitas

| API | Função | Limite |
|-----|--------|--------|
| Groq | Geração de texto (llama-3.3-70b) | Free tier |
| Tavily | Busca de fontes | 1000 consultas/mês free |
| ML OAuth | Busca de produtos + links afiliados | client_credentials, free |
| RAWG | Imagens de jogos | Free tier |
| Reddit | Trending topics (r/gaming, r/gamesEcultura) | Grátis, sem API key |
| RSS Feeds | Trending topics (MeuPlayStation, GameVicio, etc.) | Grátis, sem API key |

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
node scripts/gerar-artigo.mjs          # Geração automática (manual)
node scripts/gerar-status.cjs          # Gerar status.json manualmente
node scripts/download-images.mjs       # Baixar imagens dos produtos
```

---

## Manutenção

### Renovar cookies do ML

Os cookies do Mercado Livre expiram periodicamente. Quando isso acontecer, os artigos serão gerados com links diretos (sem tracking de afiliado).

1. Acesse mercadolivre.com.br logado com a conta `sergioskm`
2. Exporte os cookies como JSON (extensão Cookie-Editor)
3. Salve como `ml_cookies.json`
4. Codifique em base64 e atualize o secret `ML_COOKIES_B64`:

```powershell
gh secret set ML_COOKIES_B64 --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("ml_cookies.json"))) --repo sergioskmcle-sketch/blog-gamer
```

### Recriar chave do Groq

Se a chave do Groq for recriada no console, atualize o GitHub Secret e o `.env` local. O `status.json` mostrará `saudavel: false` com o erro `401 Invalid API Key` nos `erros_recentes`.
