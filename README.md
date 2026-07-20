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
  gerar-artigo.mjs        → Pipeline principal (Tavily → ML → Groq → RAWG → validação → state.json)
  ml_affiliate.mjs        → API ML (token OAuth, busca produtos, link afiliado)
  gerar-status.cjs        → Gera status.json a cada deploy
  download-images.mjs     → Baixa imagens dos produtos para o repo
  gerar-placas-video.mjs  → One-off: artigo de placas de vídeo
  gerar-lista-monitores.mjs → One-off: monitores
  gerar-gta6.mjs          → One-off: GTA 6

src/content/artigos/   → Artigos em markdown com frontmatter
state.json             → Estado da geração (cooldown, falhas consecutivas)
public/status.json     → Status público gerado a cada deploy
```

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

### Imagens automáticas de jogos
Integração com RAWG.io — nomes de jogos em **negrito** no artigo recebem imagens automaticamente dos servidores da RAWG. Capa do artigo também vem da RAWG quando não há produto do ML.

### Concorrência isolada
`gerar-conteudo.yml` e `deploy.yml` usam grupos de concorrência separados (`content-generation` vs `pages-deploy`), evitando filas e deploys redundantes.

---

## Fluxo de Geração

1. **Agendamento** — CI dispara a cada 2 dias (cron) ou manualmente
2. **Estado** — Verifica `state.json` para decidir se deve gerar
3. **Pesquisa** — Tavily busca fontes sobre o tema
4. **Produtos ML** — Busca via ML Products API (OAuth) com fallback para Tavily
5. **Geração** — Groq (llama-3.3-70b-versatile) escreve o artigo
6. **Imagens** — RAWG.io busca wallpapers dos jogos mencionados
7. **Validação** — frontmatter, word count mínimo (400 palavras)
8. **Commit + Push** — dispara o deploy automaticamente

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

| API | Limite |
|-----|--------|
| Groq | llama-3.3-70b-versatile, free tier |
| Tavily | 1000 consultas/mês free |
| ML OAuth | client_credentials, free |
| RAWG | Free tier, sem limite conhecido |

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
