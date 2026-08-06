> ⚠️ **DOCUMENTO LEGADO — NÃO USE COMO REFERÊNCIA (marcado em 06/08/2026)**
>
> Este arquivo descreve o pipeline **Python na VM** (`scheduler.py`, `generate_article.py`,
> `ml_affiliate.py`), que **não é mais o sistema ativo** e não funciona (o `GITHUB_TOKEN` da VM
> está expirado). Quem gera os artigos hoje é o **GitHub Actions**
> (`.github/workflows/gerar-conteudo.yml` → `scripts/gerar-artigo.mjs`).
>
> **A versão correta e atualizada está em [`docs/ESTRUTURA.md`](../../docs/ESTRUTURA.md).**
> Para o trabalho em andamento (monetização), veja
> [`FRENTE_4_RETOMADA.md`](../../FRENTE_4_RETOMADA.md).
>
> Mantido apenas como histórico.

# Estrutura do Projeto

```
blog-gamer/
├── docs/                              # Documentação do projeto
│   ├── CREDENCIAIS.md                 # IP, chaves, API keys
│   ├── DESIGN_SYSTEM.md               # Cores, tipografia, componentes
│   ├── ESTRUTURA.md                   # Este arquivo
│   ├── FLUXO.md                       # Pipeline de geração
│   ├── PROGRESSO.md                   # Status geral do projeto
│   ├── REGRAS.md                      # Regras editoriais
│   └── TROUBLESHOOTING.md             # Problemas e soluções
│
├── scripts/
│   └── download-images.mjs            # Download de imagens locais
│
├── heartbeat.txt                      # Timestamp do scheduler (prova de vida)
├── heartbeat_watchdog.py              # Watchdog: reinicia service se travado
├── heartbeat-watchdog.service         # Systemd service do watchdog
├── heartbeat-watchdog.timer           # Systemd timer (a cada 5 min)
│
├── generate_article.py                # Script principal de geração
├── ml_affiliate.py                    # Geração de links de afiliado
├── scheduler.py                       # Agendador (roda na VM, escreve heartbeat)
├── ml_cookies.json                    # Cookies do ML (NÃO versionado)
├── .env                               # Chaves de API (NÃO versionado)
├── .gitignore
├── requirements.txt
├── state.json                         # Estado da última geração
├── README.md
└── logs/
    ├── geracao.log                    # Log da geração de artigos
    └── watchdog.log                   # Log do watchdog
```

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `generate_article.py` | Pipeline completo: scraping ML → Groq → git push |
| `ml_affiliate.py` | Gera links de afiliado meli.la usando API do ML |
| `scheduler.py` | Roda na VM, escreve heartbeat a cada 60s, executa geração diária |
| `heartbeat_watchdog.py` | Verifica heartbeat, reinicia service se >300s sem batida |
| `heartbeat-watchdog.service` | Systemd oneshot para o watchdog |
| `heartbeat-watchdog.timer` | Timer systemd que aciona watchdog a cada 5 min |
| `download-images.mjs` | Baixa imagens dos artigos localmente, substitui CDN |
| `state.json` | Controla qual categoria será gerada na próxima execução |
| `ml_cookies.json` | Cookies de sessão do ML (obrigatório para scraping) |
| `heartbeat.txt` | Timestamp Unix escrito pelo scheduler (prova de vida) |

## Categorias de Artigos

O sistema roda em ciclo pelas categorias:

1. `noticia` — Lançamentos de games, consoles
2. `review` — Análises de jogos
3. `guia` — Guias de compra (periféricos, equipamentos)
4. `lista` — Listas (jogos, promoções)
5. `promocao` — Ofertas e descontos

## VM vs Local

| Ambiente | O que roda | Frequência |
|----------|-----------|------------|
| VM | `scheduler.py` (via `blog-gamer.service`) | 24/7, gera artigo 10:00 UTC |
| VM | `heartbeat_watchdog.py` (via `heartbeat-watchdog.timer`) | A cada 5 min |
| VM | `/etc/ssh/sshd_config.d/keepalive.conf` | `ClientAliveInterval 60` |
| Local (PC) | `~/.ssh/config` — alias `blog-gamer` + `ServerAliveInterval 60` | Toda conexão SSH |
| Local (PC) | Manual (`node scripts/download-images.mjs`) | Sob demanda |

## GitHub Pages

- Branch: `main`
- Build automático via GitHub Actions
- URL: `https://sergioskmcle-sketch.github.io/blog-gamer/`
- Imagens servidas de `/blog-gamer/images/produtos/`
