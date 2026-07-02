# Credenciais e URLs

> Ãšltima atualizaÃ§Ã£o: 2026-07-02

---

## APIs

| Chave | ServiÃ§o | Valor |
|-------|---------|-------|
| `GROQ_API_KEY` | Groq (geraÃ§Ã£o de artigos) | `gsk_SuaChaveGroqAqui1234567890abcdefghijklmnop` |
| `TAVILY_API_KEY` | Tavily (busca fallback) | `tvly-SuaChaveTavilyAqui1234567890abcdefghij` |
| `GITHUB_TOKEN` | GitHub (push automÃ¡tico) | `[REDACTED]` |
| `ML_AFFILIATE_TAG` | Tag de afiliado ML | `sergioskm` |
| Stitch API Key | Google Stitch (UI design) | `AQ.SuaChaveStitchAqui1234567890abcdefghij` |

## URLs

| Recurso | URL |
|---------|-----|
| RepositÃ³rio GitHub | `https://github.com/sergioskmcle-sketch/blog-gamer.git` |
| Blog (GitHub Pages) | `https://sergioskmcle-sketch.github.io/blog-gamer/` |
| Groq API | `https://api.groq.com/openai/v1/chat/completions` |
| Tavily API | `https://api.tavily.com/search` |
| Google Stitch | `https://stitch.withgoogle.com` |
| ML listing | `https://lista.mercadolivre.com.br/{query}` |
| ML produto | `https://www.mercadolivre.com.br/p/{MLB_ID}` |

## VM (Google Cloud)

| Item | Valor |
|------|-------|
| IP | `35.237.81.192` |
| UsuÃ¡rio | `sergioskm_cle` |
| Chave SSH | `C:\Users\SÃ©rgio PC\.ssh\id_nova_vm` |
| Acesso | `ssh -i "C:\Users\SÃ©rgio PC\.ssh\id_nova_vm" sergioskm_cle@35.237.81.192` |
| Alias SSH (configurado) | `ssh blog-gamer` |
| Path automaÃ§Ã£o | `/home/sergioskm_cle/blog-gamer-automation/` |
| Path frontend | `/home/sergioskm_cle/blog-gamer/` |
| Service scheduler | `blog-gamer.service` |
| Service watchdog | `heartbeat-watchdog.timer` |
| Python | `venv/bin/python3` |
| OS | Debian 13 (trixie) |

## .env (conteÃºdo completo)

O arquivo `.env` estÃ¡ em `~/blog-gamer-automation/.env` na VM e localmente em `C:\Users\SÃ©rgio PC\Documents\Expxagents\blog-gamer\.env`:

```ini
GROQ_API_KEY=gsk_SuaChaveGroqAqui1234567890abcdefghijklmnop
TAVILY_API_KEY=tvly-SuaChaveTavilyAqui1234567890abcdefghij
ML_AFFILIATE_TAG=sergioskm
GITHUB_TOKEN=[REDACTED]
ML_COOKIES_PATH=ml_cookies.json
BLOG_REPO_PATH=/home/sergioskm_cle/blog-gamer
```

> **Nota:** `BLOG_REPO_PATH` estÃ¡ como `/home/sergioskm_cle/blog-gamer` na VM. Localmente no PC Ã© `C:\Users\SÃ©rgio PC\Documents\blog-gamer-frontend`.

## Conta Mercado Livre

| Item | Valor |
|------|-------|
| UsuÃ¡rio | `sergioskm` |
| Nick | `COMPROUBARATO2025` |
| User ID | `41181961` |
| App ID (OAuth) | `2808627652282033` |

## ML Cookies

| Item | DescriÃ§Ã£o |
|------|-----------|
| Arquivo | `ml_cookies.json` na raiz da automaÃ§Ã£o |
| FunÃ§Ã£o | ContÃ©m `_csrf` token para API de afiliados |
| RenovaÃ§Ã£o | Acessar ML no navegador â†’ extensÃ£o Cookie-Editor â†’ Exportar JSON â†’ SCP pra VM: `scp -i "C:\Users\SÃ©rgio PC\.ssh\id_nova_vm" ml_cookies.json sergioskm_cle@35.237.81.192:~/blog-gamer-automation/` |

## SSH Keepalive

**Servidor (VM):** `/etc/ssh/sshd_config.d/keepalive.conf`
```
ClientAliveInterval 60
ClientAliveCountMax 3
```

**Cliente (PC local):** `C:\Users\SÃ©rgio PC\.ssh\config`
```
Host 35.237.81.192
  ServerAliveInterval 60
  ServerAliveCountMax 3

Host blog-gamer
  HostName 35.237.81.192
  User sergioskm_cle
  IdentityFile "C:\Users\SÃ©rgio PC\.ssh\id_nova_vm"
  ServerAliveInterval 60
  ServerAliveCountMax 3
```

## Paths Locais (PC)

| Path | DescriÃ§Ã£o |
|------|-----------|
| `C:\Users\SÃ©rgio PC\Documents\Expxagents\blog-gamer` | AutomaÃ§Ã£o (scripts Python + docs) |
| `C:\Users\SÃ©rgio PC\Documents\blog-gamer-frontend` | Frontend Astro |
| `C:\Users\SÃ©rgio PC\.ssh\id_nova_vm` | Chave privada SSH da VM |
| `C:\Users\SÃ©rgio PC\Documents\afiliados-monitor` | Projeto referÃªncia (scraping) |

