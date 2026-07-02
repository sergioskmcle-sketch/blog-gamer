# Blog Gamer Automation

Pipeline de geraÃ§Ã£o automÃ¡tica de artigos para o [Blog Gamer](https://sergioskmcle-sketch.github.io/blog-gamer/) com links de afiliado do Mercado Livre.

## Fluxo

```
1. Tavily                      â†’ pesquisa fontes sobre o tema
2. Scraping ML (com cookies)   â†’ extrai dados dos produtos (JSON-LD)
3. ml_affiliate.py (cookies)   â†’ gera link curto meli.la para cada produto
4. Groq (llama-3.3-70b)       â†’ gera artigo completo com frontmatter YAML
5. ValidaÃ§Ã£o                   â†’ word count, campos obrigatÃ³rios, slug Ãºnico
6. Salva .md                   â†’ src/content/artigos/{slug}.md
7. Git add + commit + push     â†’ GitHub Pages deploya automaticamente
```

## Estrutura do Projeto

```
blog-gamer-automation/
â”œâ”€â”€ .env                          # Credenciais (NUNCA commitar)
â”œâ”€â”€ .gitignore
â”œâ”€â”€ requirements.txt              # requests, python-dotenv, schedule, PyYAML
â”œâ”€â”€ ml_affiliate.py               # GeraÃ§Ã£o de links de afiliado ML
â”œâ”€â”€ ml_cookies.json               # Cookies de sessÃ£o ML (NUNCA commitar)
â”œâ”€â”€ cookie_keepalive.py           # MantÃ©m cookies ativos (1x/dia)
â”œâ”€â”€ generate_article.py           # Pipeline principal de geraÃ§Ã£o
â”œâ”€â”€ scheduler.py                  # Agendador 24/7 (executa 1x/dia)
â”œâ”€â”€ state.json                    # Estado da Ãºltima execuÃ§Ã£o (gerado automaticamente)
â””â”€â”€ logs/
    â””â”€â”€ geracao.log               # Log da Ãºltima execuÃ§Ã£o

blog-gamer/                       # RepositÃ³rio clonado do frontend (Astro 5)
â””â”€â”€ src/content/artigos/          # Artigos em markdown
```

## Credenciais

### APIs

| ServiÃ§o | VariÃ¡vel | Valor |
|---------|----------|-------|
| **Groq** (LLM) | `GROQ_API_KEY` | `gsk_SuaChaveGroqAqui1234567890abcdefghijklmnop` |
| **Tavily** (pesquisa web) | `TAVILY_API_KEY` | `tvly-SuaChaveTavilyAqui1234567890abcdefghij` |
| **ML Afiliado** | `ML_AFFILIATE_TAG` | `sergioskm` |
| **GitHub** | `GITHUB_TOKEN` | `[REDACTED]` |

### Mercado Livre Cookies

Arquivo: `ml_cookies.json`

Cookies de sessÃ£o do Mercado Livre extraÃ­dos via extensÃ£o Cookie-Editor (navegador logado como `sergioskm` / nick `COMPROUBARATO2025` / user ID `41181961`).

**Quando expirar:** Extrair novos cookies pelo navegador:
1. Instalar extensÃ£o [Cookie-Editor](https://cookie-editor.com/)
2. Logar em `mercadolivre.com.br` com a conta `sergioskm`
3. Clicar na extensÃ£o â†’ Exportar como JSON
4. Substituir o conteÃºdo de `ml_cookies.json`

### VM (Google Cloud)

| Item | Valor |
|------|-------|
| **Hostname** | `blog-gamer` |
| **IP** | `35.237.81.192` |
| **OS** | Debian 13 (trixie) |
| **UsuÃ¡rio** | `sergioskm_cle` |
| **Chave SSH** | `~/.ssh/id_nova_vm` |
| **Projeto** | `/home/sergioskm_cle/blog-gamer-automation/` |
| **Frontend** | `/home/sergioskm_cle/blog-gamer/` |
| **Python** | 3.13.5 (venv em `blog-gamer-automation/venv/`) |
| **Systemd** | `blog-gamer.service` |

### Conta Mercado Livre

- **UsuÃ¡rio:** `sergioskm`
- **Nick:** `COMPROUBARATO2025`
- **User ID:** `41181961`
- **App ID (OAuth, nÃ£o usado atualmente):** `2808627652282033`

### RepositÃ³rios GitHub

- **Blog (frontend):** `https://github.com/sergioskmcle-sketch/blog-gamer` (branch `main`)
- **Monitor Telegram:** `https://github.com/sergioskmcle-sketch/monitor-telegram` (projeto irmÃ£o, contÃ©m o scraper ML original)

## InstalaÃ§Ã£o (em mÃ¡quina nova)

```bash
# 1. Instalar dependÃªncias do sistema
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git

# 2. Clonar frontend do blog
git clone https://github.com/sergioskmcle-sketch/blog-gamer.git
cd blog-gamer
git config user.name "blog-bot"
git config user.email "bot@blog-gamer.com"

# 3. Criar diretÃ³rio de automaÃ§Ã£o
mkdir -p ~/blog-gamer-automation/logs
cd ~/blog-gamer-automation

# 4. Criar virtualenv e instalar dependÃªncias
python3 -m venv venv
source venv/bin/activate
pip install requests python-dotenv schedule PyYAML

# 5. Copiar arquivos do projeto para ~/blog-gamer-automation/
#    (ml_affiliate.py, generate_article.py, scheduler.py, cookie_keepalive.py,
#     ml_cookies.json, .gitignore, requirements.txt)

# 6. Criar .env com as credenciais acima

# 7. Testar link de afiliado
source venv/bin/activate
python3 -c "from ml_affiliate import generate_affiliate_link; print(generate_affiliate_link('https://www.mercadolivre.com.br/p/MLB51032833', 'ml_cookies.json', 'sergioskm'))"

# 8. Testar geraÃ§Ã£o de artigo
python3 generate_article.py

# 9. Instalar systemd service
sudo cp blog-gamer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable blog-gamer.service
sudo systemctl start blog-gamer.service
```

## Systemd Service

Arquivo: `/etc/systemd/system/blog-gamer.service`

```ini
[Unit]
Description=Blog Gamer Automation - Geracao automatica de artigos
After=network.target

[Service]
Type=simple
User=sergioskm_cle
WorkingDirectory=/home/sergioskm_cle/blog-gamer-automation
ExecStart=/home/sergioskm_cle/blog-gamer-automation/venv/bin/python3 scheduler.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

### Comandos Ãºteis

```bash
# Status
sudo systemctl status blog-gamer.service

# Logs
sudo journalctl -u blog-gamer.service -f

# Parar
sudo systemctl stop blog-gamer.service

# Iniciar
sudo systemctl start blog-gamer.service

# Reiniciar
sudo systemctl restart blog-gamer.service
```

## Agendamento

O `scheduler.py` roda 24/7 e executa:

| HorÃ¡rio (UTC) | Tarefa | DescriÃ§Ã£o |
|---------------|--------|-----------|
| 10:00 | `generate_article.py` | Gera 1 artigo |
| 06:00 | `cookie_keepalive.py` | Visita ML pra manter sessÃ£o ativa |

O scheduler roda `generate_article.py` imediatamente ao ser iniciado, depois segue o cronograma.

## Categorias de Artigos (rotaÃ§Ã£o)

A cada execuÃ§Ã£o, o tema alterna na ordem:

| # | Categoria | Exemplo de tema |
|---|-----------|-----------------|
| 1 | NotÃ­cia | LanÃ§amento de game, evento, anÃºncio de console |
| 2 | Review | Review de jogo popular, anÃ¡lise de gameplay |
| 3 | Guia de Compra | Melhores headsets, teclados, monitores gamers |
| 4 | Lista | Melhores jogos para PC, jogos multiplayer |
| 5 | PromoÃ§Ã£o | PromoÃ§Ãµes Steam, ofertas de perifÃ©ricos |

ApÃ³s a 5Âª, volta para a 1Âª (cÃ­clico).

## ManutenÃ§Ã£o

### Renovar ml_cookies.json

```bash
# Os cookies expiram periodicamente (geralmente semanas).
# Sintoma: link de afiliado volta erro 403/CSRF invÃ¡lido.
# SoluÃ§Ã£o: Exportar cookies frescos do navegador e scp pra VM:

scp -i ~/.ssh/id_nova_vm ml_cookies.json sergioskm_cle@35.237.81.192:~/blog-gamer-automation/

# Depois reiniciar o scheduler:
sudo systemctl restart blog-gamer.service
```

### Verificar logs

```bash
# Ãšltima execuÃ§Ã£o
cat ~/blog-gamer-automation/logs/geracao.log

# Service logs
sudo journalctl -u blog-gamer.service -n 50 --no-pager
```

### Testar manualmente

```bash
cd ~/blog-gamer-automation
source venv/bin/activate
python3 generate_article.py
```

## Modelo LLM

- **Provedor:** Groq
- **Modelo:** `llama-3.3-70b-versatile`
- **Max tokens:** 8192
- **Temperatura:** 0.7
- **Limite:** Free tier (30 req/min, 6000 req/dia) â€” com 1 artigo/dia, nunca bate o limite

## Anti-bloqueio ML

Para evitar bloqueio por scraping, o projeto utiliza as mesmas medidas do monitor-telegram:

- **User-Agent rotativo**: escolhe um de 4 User-Agents aleatoriamente a cada request
- **Delay aleatÃ³rio 3-6s** entre visitas a pÃ¡ginas de produtos
- **Fallback com cookies**: se a pÃ¡gina Ã© bloqueada (DataDome/account-verification), tenta novamente com cookies de sessÃ£o
- **Retry com backoff**: 3 tentativas com espera crescente em caso de 403
- **Volume baixo**: ~16 requests/dia (menos que um humano navegando)

## URLs

- **Blog:** https://sergioskmcle-sketch.github.io/blog-gamer/
- **RepositÃ³rio frontend:** https://github.com/sergioskmcle-sketch/blog-gamer
- **VM SSH:** `ssh -i ~/.ssh/id_nova_vm sergioskm_cle@35.237.81.192`

