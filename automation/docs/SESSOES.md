# Sessões Anteriores

> Histórico das últimas 5 sessões. Conforme novas sessões forem adicionadas, a mais antiga é removida.

---

## Sessão 5 — 2026-07-02 (atual)

**Design System + Watchdog + Upload Completo**

### Frontend (Astro)
- `global.css` reescrito com tema escuro profissional: `--bg-primary: #0F1115`, `--bg-card: #171A21`, `--accent: #2563EB` (azul), `--success: #A3E635` (verde), `--text-secondary: #BFC6D4`, `--border: #2D3748`
- Espaçamento grid 8px, tipografia Inter, sombras refinadas, tabelas estilizadas
- Componentes atualizados: Header glassmorphism, Footer, ArticleCard (hover azul), HeroSection (gradiente blue/green), Sidebar
- `Layout.astro`: `theme-color` → `#0F1115`
- `docs/DESIGN_SYSTEM.md` criado com especificação completa
- `docs/PROGRESSO.md` criado com status geral do projeto
- `docs/CREDENCIAIS.md` atualizado com TODAS as chaves e valores

### Infraestrutura (VM)
- Upload automacão + frontend completos pra VM (incluindo `.env`, `ml_cookies.json`, `.git/`)
- `BLOG_REPO_PATH` corrigido no `.env` da VM
- `npm install` + `venv` recriados na VM
- Heartbeat: `scheduler.py` escreve `heartbeat.txt` a cada 60s
- Watchdog: `heartbeat_watchdog.py` + systemd timer a cada 5 min — reinicia service se heartbeat parar >300s
- SSH keepalive: `ClientAliveInterval 60` no servidor, `ServerAliveInterval 60` no cliente (`~/.ssh/config` com alias `blog-gamer`)

---

## Sessão 4 — 2026-06-30

**Editorial + Scraping + Categorias + Deploy**

### Geração de Artigos
- Prompt editorial salvo em `docs/ORIENTACOES_EDITORIAIS.md`
- `scrape_ml_products` restaurado: listing + cookies + 8-digit IDs + multi-category
- `parse_product_html` extrai `original_price`, `free_shipping`, `installments`, `attributes` do JSON-LD
- Brand whitelist: ~35 marcas gamer (Logitech, Razer, HyperX, Corsair, etc.) com `filter_by_brand_gaming()`
- Filtro pula automaticamente para categorias de jogo (noticia, lista, etc.)
- 9 categorias (noticia, review, guia, lista, promocao, curiosidade, tutorial, comparativo, lancamento)
- Dois modos de artigo: "custo-beneficio" (preço crescente) e "melhores" (preço decrescente)
- `article_history.json` evita repetir mesma categoria nas últimas 3 execuções
- Groq prompt reescrito: estrutura editorial completa, 1500+ palavras, FAQ, tabela comparativa, perfil indicado
- `validate_article()`: auditoria com warnings (não aborta), checa produtos proibidos, IDs duplicados, word count

### Deploy
- Teste na VM: artigo "Conheça os Consoles Clássicos e Easter Eggs que Você Não Conhece" gerado e commitado (`d0528f1`)
- `article_history.json` criado na VM
- Google Stitch identificado: URL + API key registrados

---

## Sessão 3 — 2026-06-29

**Pipeline de Geração + Scraping ML + Afiliados**

### Scripts Python
- `generate_article.py`: pipeline completo (Tavily → ML scraping → Groq → validação → salvar .md → git push)
- `ml_affiliate.py`: geração de links curtos `meli.la` via API de afiliados do ML com cookies de sessão
- `scheduler.py`: loop 24/7 com schedule diário
- Scraping de listing pages do ML: extrai IDs de 8 dígitos com regex, visita páginas de produtos
- Fallback para `?tag=sergioskm` quando link curto falha

### Artigos Publicados
- "Os 10 Melhores Monitores Gamer Custo-Beneficio do Mercado Livre em 2026"
- "As 8 Melhores Placas de Video Custo-Beneficio do Mercado Livre em 2026"
- "Lançamento de Games e Anúncios de Consoles"
- "GTA 6: Data de Lançamento, Preço, Pré-venda"

---

## Sessão 2 — 2026-06-27

**VM + Systemd + Primeiro Deploy**

### Infraestrutura
- VM Google Cloud criada (IP `35.237.81.192`, Debian, usuário `sergioskm_cle`)
- Chave SSH `id_nova_vm` configurada
- `blog-gamer.service` criado: systemd com `Restart=always`, `RestartSec=30`
- Python venv + dependências instalados na VM
- Repositório do frontend clonado na VM
- Teste de geração de link de afiliado na VM
- `cookie_keepalive.py`: visita ML 1x/dia pra manter sessão ativa

### Documentação
- `docs/CREDENCIAIS.md` criado (versão inicial, sem valores das chaves)
- `docs/ESTRUTURA.md` criado
- `docs/FLUXO.md` criado
- `docs/REGRAS.md` criado
- `docs/TROUBLESHOOTING.md` criado

---

## Sessão 1 — 2026-06-25

**Setup Inicial do Projeto**

### Criação
- Projeto `blog-gamer` iniciado em `C:\Users\Sérgio PC\Documents\Expxagents\blog-gamer`
- Frontend Astro 5 criado em `C:\Users\Sérgio PC\Documents\blog-gamer-frontend`
- Repositório GitHub criado: `sergioskmcle-sketch/blog-gamer`
- `astro.config.mjs`: site `https://sergioskmcle-sketch.github.io`, base `/blog-gamer`, output static
- GitHub Actions configurado para deploy automático no GitHub Pages
- `docs/ORIENTACOES_EDITORIAIS.md` com diretrizes editoriais e regras de tom gamer

### APIs
- Groq API key obtida (modelo `llama-3.3-70b-versatile`)
- Tavily API key obtida (1000 consultas/mês free)
- Conta ML do usuário criada (`sergioskm` / `COMPROUBARATO2025`)
- App OAuth do ML registrado (Client ID + Secret)
- Cookies de sessão do ML exportados (`ml_cookies.json`)
