# Sessões Anteriores

> Histórico das últimas 5 sessões. Conforme novas sessões forem adicionadas, a mais antiga é removida.

---

## Sessão 8 — 2026-08-13 (atual)

**Exclusão de artigo de smart TV reprovado + categoria `tv` + gate de lista plural**

### Pipeline (`scripts/`)
- **Artigo reprovado excluído:** "Melhores smart tv gamer 4K em 2026: A melhor escolha" (40º, gerado em 12/08) — título plural com 1 item e produto absurdo ("Console Sony Fable Standard"). Removidos `.md`, capa, imagem do produto e entrada de `afiliados_pendentes.json`; `state.json` revertido para o estado anterior (Gamescom, 39 artigos).
- **Categoria `tv` criada** (`product_naming.mjs`): `PRODUCT_CATEGORIES.tv` (smart tv/smartv/televisão/tv 4k/uhd/oled/qled/neo qled/mini led/nano cell, com excludes para suporte/cabo/controle/tv box/stick/antena/monitor/película/remoto) + `CATEGORY_BRANDS.tv` (Samsung/LG/Sony) + `TAIL_STOP`.
- **`HARDWARE_KEYWORDS`** ganhou `smart tv`, `smartv`, `televisão`, `televisao`, `tv` (`gerar-artigo.mjs`) — tema de smart TV agora é domínio `hardware` (antes caía em `games` e buscava console). Também `CATEGORY_FALLBACK_KEYWORDS.tv` e capa default por categoria.
- **Gate de lista plural (novo):** no `validate()` (`gerar-artigo.mjs`), título/heading que prometem lista plural ("Melhores"/"Os N Melhores" com N≥2) com **menos de 2 produtos** vira erro **hard** — impede "Os 1 Melhores". `validar-artigo.mjs` reprova lista com <2 produtos na validação pós-geração.

### Verificação
- `npm test` → **419 asserts OK** (15 novos: detecção de categoria tv, coerência console≠tv, gate de lista plural).
- `validar-artigo.mjs --all` → **0 falhas novas** (as 84 existentes são de artigos antigos, confirmadas idênticas antes das mudanças via stash).

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


