# Credenciais e URLs

## GitHub Secrets (CI)

| Secret | Serviço | Observação |
|--------|---------|------------|
| `GROQ_API_KEY` | Groq (llama-3.3-70b-versatile) | Não expira, pode ser recriada no console |
| `TAVILY_API_KEY` | Tavily (busca de fontes + imagens) | 1000 consultas/mês free |
| `SERPER_API_KEY` | Serper.dev (Google Shopping BR) | 2500 buscas grátis na criação |
| `RAWG_API_KEY` | RAWG.io (imagens de jogos) | Free tier |

## GitHub Actions

| Workflow | Arquivo | Gatilho |
|----------|---------|---------|
| Gerar artigo | `.github/workflows/gerar-conteudo.yml` | Schedule (cron: `30 9 * * *` e `30 21 * * *`, 2x/dia) + manual |
| Deploy | `.github/workflows/deploy.yml` | Push + manual |

## URLs

| Recurso | URL |
|---------|-----|
| Repositório | `https://github.com/sergioskmcle-sketch/blog-gamer` |
| Blog (GitHub Pages) | `https://promogamer.com.br/` |
| Status / Saúde | `https://promogamer.com.br/status.json` |
| Groq API | `https://api.groq.com/openai/v1/chat/completions` |
| Tavily API | `https://api.tavily.com/search` |
| Serper (Shopping) | `https://google.serper.dev/shopping` |
| RAWG API | `https://api.rawg.io/api/` |

## APIs Gratuitas

| API | Chave | Limite |
|-----|-------|--------|
| Groq | `GROQ_API_KEY` | llama-3.3-70b-versatile, free tier |
| Tavily | `TAVILY_API_KEY` | 1000 consultas/mês free |
| Serper | `SERPER_API_KEY` | Google Shopping BR, 2500 buscas grátis |
| RAWG | `RAWG_API_KEY` | Free tier |

## Frente 4 — API de produtos afiliados (monitor-telegram)

Serviço `blog-produtos-api` que serve produtos **com link de afiliado** para o pipeline do blog.
Detalhes de operação: [`FRENTE_4_RETOMADA.md`](../FRENTE_4_RETOMADA.md).

| Item | Valor |
|------|-------|
| Host | `34.29.27.155` (VM monitor-telegram, `ml-monitor-telegram`) |
| Porta | `8086` (firewall GCP: regra `allow-blog-api` + tag `blog-api`) |
| Acesso SSH | `ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155` |
| Path | `/opt/blog-produtos-api/` |
| Banco | `/opt/blog-produtos-api/catalogo.db` (SQLite, retenção 30 dias) |
| Zona / Projeto GCP | `us-central1-a` / `project-475deb3a-7038-45fd-948` |

| Config | Onde fica | Valor |
|--------|-----------|-------|
| `MONITOR_API_URL` | GitHub **variable** + `.env` local | `http://34.29.27.155:8086` |
| `MONITOR_API_KEY` | GitHub **secret** + `.env` local | = `BLOG_API_KEY` do `.env` da VM |
| `AFFILIATE_MODE` | GitHub **variable** | **`remote`** (ativo em produção) / `legacy` (fallback) |
| `BLOG_API_KEY` | `/opt/blog-produtos-api/.env` na VM (chmod 600) | gerado com `openssl rand -hex 32` |

Recuperar a chave (nunca colar o valor em arquivo ou commit):
```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env'
```

Os segredos dos marketplaces **não são duplicados** no blog: o serviço lê seletivamente
`SHOPEE_APP_ID`, `SHOPEE_SECRET`, `ML_COOKIES_PATH`, `ML_CLIENT_ID` e `ML_CLIENT_SECRET` de
`/opt/afiliados-monitor-v2/searcher/.env`, que é onde o `searcher-ml.service` os carrega.

## ML (Aposentado para uso direto do blog)

- **Cookies de sessão** e **OAuth do ML** estão aposentados/bloqueados (fingerprint + bloqueio global; `invalid_client` local; `/sites/MLB/search` 403 para apps não aprovadas). Não reativar cookies.
- ⛔ **O blog NUNCA deve gerar link de afiliado do ML.** A sessão é compartilhada com as Frentes 1
  e 2 do monitor e **não suporta um segundo consumidor**. Em 06/08/2026 isso foi feito em testes,
  a sessão caiu com `401` e a Frente 1 parou de postar por ~1h (ver `TROUBLESHOOTING.md`).
  Existe a trava `BLOG_ML_ENABLED` em `adapters.py`, **desligada**, e deve continuar assim.
- Produtos do ML chegam ao blog **apenas** pelo banco da Frente 4, com o link de afiliado já
  gerado pelas frentes do monitor. Custo em requisições ao ML: zero.
- Renovação de sessão (só o dono, exportando do navegador logado):
  `sudo /opt/afiliados-monitor-v2/instalar_cookies_ml.sh <arquivo.json>`

## Telegram

| Item | Valor |
|------|-------|
| Bot | `@MonitorDeGruposBot` |
| Token | `TELEGRAM_BOT_TOKEN` em `/opt/afiliados-monitor-v2/searcher/.env` |
| Chat do dono | `admin_chat_id` em `/opt/afiliados-monitor-v2/automation/config.yaml` |

⛔ **Nunca chamar `getUpdates`** com esse token: o Telegram entrega cada atualização uma única vez
e o serviço do blog roubaria as mensagens da Frente 1, quebrando a detecção nos grupos em
silêncio. Só `sendMessage`.

## VM (Google Cloud) — Legado

| Item | Valor |
|------|-------|
| IP | `35.237.81.192` |
| Usuário | `sergioskm_cle` |
| Chave SSH | `C:\Users\Sérgio PC\.ssh\id_nova_vm` |
| Acesso | `ssh -i "C:\Users\Sérgio PC\.ssh\id_nova_vm" sergioskm_cle@35.237.81.192` |
| Path automação | `/home/sergioskm_cle-automation/` |
| Path blog | `/home/sergioskm_cle/` |
| Service | `blog-gamer.service` |

> A pipeline Python na VM está separada e não integrada ao CI do GitHub Actions.

## Paths Locais (PC)

| Path | Descrição |
|------|-----------|
| `C:\Users\sismais\Documents\Projetos Pessoais\blog-gamer` | Projeto principal |

## Observações

- `GROQ_API_KEY`, `TAVILY_API_KEY` e `SERPER_API_KEY` estão no `.env` local e como GitHub Secrets
- `RAWG_API_KEY` está apenas como GitHub Secret (não precisa localmente para build)
- `ML_AFFILIATE_TAG` = `sergioskm` (fixo no código, sem uso — ML aposentado)
- Se `status.json` mostrar `"saudavel": false`, verifique os secrets no GitHub primeiro
- Erro `401` nos `erros_recentes` do `status.json` indica `GROQ_API_KEY` inválida (recriada e não atualizada)
- `GITHUB_TOKEN` da VM está expirado — a automação Python não está funcional
