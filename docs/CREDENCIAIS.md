# Credenciais e URLs

## APIs

| Chave | Serviço | Onde está |
|-------|---------|-----------|
| `GROQ_API_KEY` | Groq (geração de artigos) | `.env` na VM + local |
| `TAVILY_API_KEY` | Tavily (busca fallback) | `.env` na VM + local |
| `GITHUB_TOKEN` | GitHub (push automático) | `.env` na VM |
| `ML_AFFILIATE_TAG` | Tag de afiliado ML | `.env` (`sergioskm`) |

## URLs

| Recurso | URL |
|---------|-----|
| Repositório GitHub | `https://github.com/sergioskmcle-sketch/blog-gamer.git` |
| Blog (GitHub Pages) | `https://sergioskmcle-sketch.github.io/blog-gamer/` |
| Groq API | `https://api.groq.com/openai/v1/chat/completions` |
| Tavily API | `https://api.tavily.com/search` |
| ML listing | `https://lista.mercadolivre.com.br/{query}` |
| ML produto | `https://www.mercadolivre.com.br/p/{MLB_ID}` |

## VM (Google Cloud)

| Item | Valor |
|------|-------|
| IP | `35.237.81.192` |
| Usuário | `sergioskm_cle` |
| Chave SSH | `C:\Users\Sérgio PC\.ssh\id_nova_vm` |
| Acesso | `ssh -i "C:\Users\Sérgio PC\.ssh\id_nova_vm" sergioskm_cle@35.237.81.192` |
| Path automação | `/home/sergioskm_cle/blog-gamer-automation/` |
| Path blog | `/home/sergioskm_cle/blog-gamer/` |
| Service | `blog-gamer.service` |
| Python | `venv/bin/python3` |

## ML Cookies

| Item | Descrição |
|------|-----------|
| Arquivo | `ml_cookies.json` na raiz da automação |
| Função | Contém `_csrf` token para API de afiliados |
| Renovação | Acessar ML no navegador → exportar cookies (JSON) → copiar para VM via SCP |

## Paths Locais (PC)

| Path | Descrição |
|------|-----------|
| `C:\Users\Sérgio PC\Documents\Expxagents\blog-gamer` | Projeto principal |
| `C:\Users\Sérgio PC\Documents\afiliados-monitor` | Projeto referência (scraping) |

## Observações

- `GROQ_API_KEY` e `TAVILY_API_KEY` estão no `.env` (local + VM)
- `GITHUB_TOKEN` só está no `.env` da VM (não versionado)
- `ML_AFFILIATE_TAG` = `sergioskm` (fixo)
- Cookies do ML precisam ser renovados manualmente se expirarem
