# Sessões Anteriores

> Histórico das últimas 5 sessões. Conforme novas sessões forem adicionadas, a mais antiga é removida.

---

## Sessão 8 — 2026-08-13 (atual)

**Imagens nas seções + Queda progressiva de busca de imagem (RAWG → Tavily)**

### Imagens do artigo da Gamescom
- As seções de jogo do artigo **"Gamescom 2026"** ficaram sem imagem na geração: o marcador `[IMG:Nome]` usava o título completo da seção com subtítulo de marketing (ex.: `The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição`), o matcher do RAWG rejeitava (score < 0.55) e o fallback Tavily buscava uma vez só o nome longo e desistia — marcador sem imagem é removido silenciosamente.
- Inseridas as artes de **Grounded 2**, **Zelda Ocarina** (arte oficial da Nintendo), **The Witcher 3: Songs of the Past**, **Final Fantasy 7: Revelation** e **Gears of War: E-Day** (seção Xbox), na ordem renderizada **título → imagem → texto**.
- Removida a imagem de destaque (Samsung) que aparecia antes da primeira subseção.

### Pipeline (`scripts/gerar-artigo.mjs`)
- **Queda progressiva do nome** (`progressiveGameQueries`): nome completo → sem subtítulo após ` — ` → sem sufixo genérico (`remake`/`edition`/`deluxe`...) → partes após `:` → palavras removidas do final → sem artigo inicial. Aplicada no **RAWG** (`fetchRAWGImage`) e no **fallback Tavily** (`fetchTavilyImage`).
- **Filtro de URLs frágeis** (`isFragileImageUrl`): wikimedia, Instagram, Facebook, TikTok, Reddit, `data:` — nunca usadas no corpo.
- **Preferência de hosts estáveis** antes da validação: `media.rawg.io`, `i.ytimg.com`, `nintendo.com`, `steamstatic`, `store.steampowered.com`.
- **Validação HTTP** (`HEAD` 2xx) antes de aceitar a imagem; `timeout` trocado por `AbortSignal.timeout` (a opção `timeout` era ignorada pelo `fetch` do Node e travava o pipeline).
- Observação: durante esta sessão o **RAWG esteve fora do ar (HTTP 522/timeout)** — as imagens do artigo vieram do fallback Tavily com a queda progressiva.

### Verificação
- `npm test` → **403 asserts OK**; `npm run build` → **165 páginas**; portão `validar-artigo.mjs` → 0 falhas; deploy via GitHub Actions concluído.

---

## Sessão 7 — 2026-08-12

**Rodízio de categorias + Fallback de tema (P2) + Gate corretor + Reserva Tavily + 900 palavras**

### Pipeline (`scripts/`)
- **Rodízio `N→G→N→L→N→R`** por posição (`rotation_pos` no `state.json`, migração por `indexOf` de `last_category`): notícia ocupa posições pares e vira a maioria dos dias (notícia nunca aborta no sourcing). `gerar-status.cjs` sincronizado (removeu `promocao`, categoria morta).
- **Fallback de tema (fecha P2):** `main()` monta pool de candidatos (tema principal → keywords alternativas do trending → seeds estáticos da categoria do dia → notícia por último). O sourcing aborta com `throw` em vez de `exit(1)`, e o próximo candidato é tentado.
- **Gate com correção (Tarefa E):** antes de rollback, `corrigirPeloGate` corrige P0/P1 determinísticos (seções `##` vazias, imagens base64, imagens frágeis de redes sociais, abertura proibida, marcadores `[IMG:]/[PRODUTO:]` restantes, `description` < 120, `tags` < 3), reaplica os passos deterministas (`stripPricesFromBody` → `stripLeftoverMarkers` → `injectHeadingAnchors`) e revalida as 5 etapas determinísticas. Só remove/restaura se a correção não zerar as reprovações.
- **Reserva da Tavily via Serper** (`buscarComReserva` em `pesquisar-fundo.mjs`): se a Tavily cair/estourar cota, usa o Serper já presente no projeto — cobre as 3 profundidades.
- **Regra das 900 palavras:** `MIN_WORDS.noticia` 800→900 e faixa-alvo única `900-1100` (a antiga `700-900` era contraditória com o mínimo 900).
- **Workflow:** 2ª execução diária (21:30 UTC) + fechamento automático da issue do pipeline quando o ciclo volta.

### Publicação (12/08/2026)
- Artigo **"Gamescom 2026: principais anúncios, jogos, datas e novidades"** (notícia, 39º artigo) gerado, aprovado no gate (**0 P0 / 0 P1 / 5 P2**, média ~9,3/10) e publicado.
- Observação operacional: na geração o **Gemini** estourou TPM/truncou (503) e o **Groq** recusou prompt grande (413) — a reserva em cadeia caiu no **OpenAI** e o artigo saiu normalmente.

### Verificação
- `npm test` → **381 asserts OK**; `npm run build` → **162 páginas**; portão `validar-artigo.mjs` → 0 falhas.

---

## Sessão 6 — 2026-08-05

**Cards por Seção + TOC no Topo + Sidebar Padrão + Alinhamento à Esquerda**

### Pipeline de Markdown (Astro)
- `remark-heading-blocks.mjs` criado: move a imagem do topo do bloco para antes do `h2` e adiciona link-âncora `#id` em seções sem âncora
- `rehype-article-sections.mjs` criado: agrupa conteúdo entre `##` em `<section class="article-section">` separadas por divisores
- Ambos registrados no `astro.config.mjs`; validados em todos os artigos (14 seções no artigo de headsets, 12 nas cadeiras, 0 `##` literais no `dist`)
- `src/lib/headings.ts` com `tagSlug` para extração de H2/H3 do TOC

### Layout do Artigo
- Texto alinhado à esquerda (removida justificação) no README e artigos
- TOC "Neste artigo" recolhível no topo do corpo do artigo, **todas as telas** — variante `sidebar` do `TableOfContents.astro` removida
- Sidebar do artigo agora reutiliza `Sidebar.astro` da home (banner 9:16 → Populares da Semana → Categorias → Comunidade), grid `340px`
- Capa nunca fica sob o header fixo: `<main>` usa `padding-top: calc(max(var(--content-top, var(--nav-height)), var(--nav-height)) + 8px)` no `Layout.astro`
- `--measure` definido no `:root` (`min(720px, 100%)`) — usado por TOC/ShareButtons
- Build OK (100 páginas), 145 asserts OK, preview HTTP 200

---

## Sessão 5 — 2026-07-02

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


