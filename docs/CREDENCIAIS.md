# Credenciais e URLs

## GitHub Secrets (CI)

| Secret | Serviço | Observação |
|--------|---------|------------|
| `GROQ_API_KEY` | Groq (llama-3.3-70b-versatile) | Não expira, pode ser recriada no console |
| `TAVILY_API_KEY` | Tavily (busca de fontes) | 1000 consultas/mês free |
| `ML_CLIENT_ID` | Mercado Livre OAuth | client_credentials |
| `ML_CLIENT_SECRET` | Mercado Livre OAuth | client_credentials |
| `ML_COOKIES_B64` | Cookies ML (link afiliado) | Base64 de `ml_cookies.json`, expira periodicamente |
| `RAWG_API_KEY` | RAWG.io (imagens de jogos) | Free tier |

## GitHub Actions

| Workflow | Arquivo | Gatilho |
|----------|---------|---------|
| Gerar artigo | `.github/workflows/gerar-conteudo.yml` | Schedule (cron: `30 9 */2 * *`) + manual |
| Deploy | `.github/workflows/deploy.yml` | Push + manual |

## URLs

| Recurso | URL |
|---------|-----|
| Repositório | `https://github.com/sergioskmcle-sketch/blog-gamer.git` |
| Blog (GitHub Pages) | `https://sergioskmcle-sketch.github.io/blog-gamer/` |
| Status / Saúde | `https://sergioskmcle-sketch.github.io/blog-gamer/status.json` |
| Groq API | `https://api.groq.com/openai/v1/chat/completions` |
| Tavily API | `https://api.tavily.com/search` |
| RAWG API | `https://api.rawg.io/api/` |
| ML listing | `https://lista.mercadolivre.com.br/{query}` |
| ML produto | `https://www.mercadolivre.com.br/p/{MLB_ID}` |

## APIs Gratuitas

| API | Chave | Limite |
|-----|-------|--------|
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile, free tier |
| Tavily | `TAVILY_API_KEY` | 1000 consultas/mês free |
| ML OAuth | `ML_CLIENT_ID` + `ML_CLIENT_SECRET` | client_credentials, free |
| RAWG | `RAWG_API_KEY` | Free tier |

## ML Cookies

| Item | Descrição |
|------|-----------|
| Arquivo | `ml_cookies.json` na raiz do projeto |
| Função | Contém cookies de sessão para gerar link de afiliado |
| Renovação | Acessar ML via navegador logado como `sergioskm`, exportar cookies (JSON), codificar em base64 e atualizar o secret `ML_COOKIES_B64` |
| Comando | `gh secret set ML_COOKIES_B64 --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes("ml_cookies.json"))) --repo sergioskmcle-sketch/blog-gamer` |

## VM (Google Cloud) — Legado

| Item | Valor |
|------|-------|
| IP | `35.237.81.192` |
| Usuário | `sergioskm_cle` |
| Chave SSH | `C:\Users\Sérgio PC\.ssh\id_nova_vm` |
| Acesso | `ssh -i "C:\Users\Sérgio PC\.ssh\id_nova_vm" sergioskm_cle@35.237.81.192` |
| Path automação | `/home/sergioskm_cle/blog-gamer-automation/` |
| Path blog | `/home/sergioskm_cle/blog-gamer/` |
| Service | `blog-gamer.service` |

> A pipeline Python na VM está separada e não integrada ao CI do GitHub Actions.

## Paths Locais (PC)

| Path | Descrição |
|------|-----------|
| `C:\Users\sismais\Documents\Projetos Pessoais\blog-gamer` | Projeto principal |

## Observações

- `GROQ_API_KEY` e `TAVILY_API_KEY` estão no `.env` local e como GitHub Secrets
- `RAWG_API_KEY` está apenas como GitHub Secret (não precisa localmente para build)
- `ML_AFFILIATE_TAG` = `sergioskm` (fixo no código)
- Cookies do ML (`ML_COOKIES_B64`) precisam ser renovados manualmente quando expirarem
- Se `status.json` mostrar `"saudavel": false`, verifique os secrets no GitHub primeiro
- Erro `401` nos `erros_recentes` do `status.json` indica `GROQ_API_KEY` inválida (recriada e não atualizada)
- `GITHUB_TOKEN` da VM está expirado — a automação Python não está funcional
