# Blog Gamer — Status do Projeto

> Última atualização: 2026-07-02

---

## 1. O que está pronto

### Automação (gera artigos todo dia 10:00 UTC)

| Componente | Arquivo | Status |
|------------|---------|--------|
| Scheduler 24/7 | `scheduler.py` | ✅ Rodando via `blog-gamer.service` |
| Geração de artigo | `generate_article.py` | ✅ Scraping ML, Groq, validação |
| Link de afiliado | `ml_affiliate.py` | ✅ Gera links `meli.la` com cookies |
| Rotação de categorias | `generate_article.py` | ✅ 9 categorias, evita repetir últimas 3 |
| Filtro de marcas | `generate_article.py` (`filter_by_brand_gaming`) | ✅ ~35 marcas gamer, auto-pula em categorias de jogo |
| Heartbeat | `scheduler.py` | ✅ Escreve `heartbeat.txt` a cada 60s |
| Watchdog | `heartbeat_watchdog.py` | ✅ Reinicia service se heartbeat parar >300s |
| SSH Keepalive (servidor) | `/etc/ssh/sshd_config.d/keepalive.conf` | ✅ `ClientAliveInterval 60`, `ClientAliveCountMax 3` |

### Frontend (Astro 5, static site)

| Componente | Status |
|------------|--------|
| Tema escuro profissional | ✅ `#0F1115` fundo, `#171A21` cards, `#2563EB` azul |
| Design system no CSS | ✅ `global.css` com todas as variáveis |
| Header glassmorphism | ✅ Sticky, blur, dropdown com animação |
| Cards com hover azul | ✅ `--shadow-glow`, `translateY(-3px)` |
| Gradiente hero blue/green | ✅ Substituído o neon roxo/verde |
| Tabelas, FAQ, affiliate-box | ✅ Estilizados no CSS global |

### Infraestrutura

| Item | Status |
|------|--------|
| VM Google Cloud (`35.237.81.192`) | ✅ Rodando Debian 13, systemd |
| `blog-gamer.service` | ✅ Auto-restart (`Restart=always`, `RestartSec=30`) |
| `heartbeat-watchdog.timer` | ✅ A cada 5 min, verifica heartbeat |
| SSH keepalive (cliente) | ✅ `~/.ssh/config` no PC local |
| Docs de credenciais | ✅ `docs/CREDENCIAIS.md` com IP, chave, paths |

---

## 2. O que falta fazer

### 🔴 Alta prioridade

| Tarefa | Motivo |
|--------|--------|
| **Deploy do frontend no GitHub Pages** | O `dist/` com o design system novo está na VM, mas o blog ao vivo (`sergioskmcle-sketch.github.io/blog-gamer`) ainda exibe o tema neon roxo/verde antigo. Precisa comitar e dar push. |
| **Corrigir YAML parsing do Groq** | O Groq retorna frontmatter YAML sem o `---` de fechamento. O `generate_article.py` tenta parsear e falha. Artigo gerado mas não salvo. Ajustar prompt ou parser. |

### 🟡 Média prioridade

| Tarefa | Motivo |
|--------|--------|
| **`docs/DESIGN_SYSTEM.md`** | Documentar o design system (cores, tipografia, componentes, etc.) como referência para manutenção |
| **Testar geração manual na VM** | Rodar `generate_article.py` manualmente após corrigir YAML pra confirmar que o fluxo completo funciona (scraping → links → groq → salvar .md → commit → push) |

### 🟢 Baixa prioridade

| Tarefa | Motivo |
|--------|--------|
| **Google Stitch** | Usar chave `AQ.Ab...` pra gerar mockups de novos componentes. O Stitch é `stitch.withgoogle.com` (Google Labs AI UI). |
| **Renovar cookies ML** | `ml_cookies.json` pode expirar. Se links de afiliado pararem de funcionar, exportar cookies frescos do navegador logado como `sergioskm`. |

---

## 3. Arquitetura

```
PC local (dev)
├── C:\Users\Sérgio PC\Documents\Expxagents\blog-gamer\   ← automação
│   ├── generate_article.py     ← pipeline principal
│   ├── scheduler.py            ← loop 24/7 + heartbeat
│   ├── ml_affiliate.py         ← link de afiliado ML
│   ├── heartbeat_watchdog.py   ← watchdog do scheduler
│   └── docs/                   ← documentação + credenciais
│
├── C:\Users\Sérgio PC\Documents\blog-gamer-frontend\     ← frontend Astro
│   ├── src/                    ← componentes, layouts, páginas
│   ├── public/                 ← imagens dos produtos
│   └── dist/                   ← build estático
│
└── ~/.ssh/config               ← keepalive + alias blog-gamer

VM (35.237.81.192)
├── ~/blog-gamer-automation/    ← scripts Python
│   ├── venv/                   ← virtualenv
│   ├── heartbeat.txt           ← prova de vida
│   └── logs/                   ← watchdog.log + geracao.log
│
├── ~/blog-gamer/               ← frontend (clone do GitHub)
│   └── src/content/artigos/    ← artigos em .md
│
└── /etc/systemd/system/
    ├── blog-gamer.service           ← scheduler 24/7
    └── heartbeat-watchdog.timer     ← watchdog a cada 5 min
```

---

## 4. Comandos úteis

```bash
# Acessar VM (com keepalive automático)
ssh blog-gamer

# Ver status do scheduler
sudo systemctl status blog-gamer.service

# Ver logs do scheduler
cat ~/blog-gamer-automation/logs/geracao.log

# Ver logs do watchdog
cat ~/blog-gamer-automation/logs/watchdog.log

# Ver heartbeat
cat ~/blog-gamer-automation/heartbeat.txt

# Testar geração manual
cd ~/blog-gamer-automation
source venv/bin/activate
python3 generate_article.py

# Build do frontend
cd ~/blog-gamer
npm run build

# Commit e push dos artigos
cd ~/blog-gamer
git add .
git commit -m "novo artigo"
git push
```

---

## 5. Credenciais

Ver `docs/CREDENCIAIS.md` para:
- IP, usuário, chave SSH da VM
- API keys (Groq, Tavily, GitHub)
- Tag de afiliado ML (`sergioskm`)
- Cookies ML (`ml_cookies.json`)
