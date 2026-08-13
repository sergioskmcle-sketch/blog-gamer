# Promo Gamer — Status do Projeto

> Última atualização: 2026-08-13

> ⚠️ **Este arquivo foi reescrito em 06/08/2026.** A versão anterior descrevia o pipeline Python
> na VM (`scheduler.py`, `generate_article.py`, `ml_affiliate.py`) como se fosse o sistema ativo.
> **Não é.** Aquele pipeline é legado e não funciona (token do GitHub expirado). O que gera
> artigo hoje é o **GitHub Actions**.

---

## 1. Como o blog funciona hoje

| Etapa | Onde | Arquivo |
|---|---|---|
| Agendamento | GitHub Actions (cron `30 9` e `30 21` UTC, 2x/dia) | `.github/workflows/gerar-conteudo.yml` |
| Testes (roda antes de gerar) | GitHub Actions | `scripts/test-injecao.mjs` (`npm test`) |
| Geração do artigo | GitHub Actions | `scripts/gerar-artigo.mjs` (~2.750 linhas) |
| Descoberta de produto | Frente 4 (ML/Shopee com afiliado) + fallback Serper/Google Shopping | `scripts/monitor_api.mjs` + `scripts/google_shopping.mjs` |
| Publicação | GitHub Pages | `.github/workflows/deploy.yml` |

**Nada disso roda na VM do blog.** Ver seção 4.

---

## 2. O que está pronto

### Automação
| Componente | Status |
|---|---|
| Geração diária via GitHub Actions | ✅ |
| Descoberta de produtos (Serper/Google Shopping) | ✅ |
| Imagens de jogos (RAWG) e de capa | ✅ |
| Injeção de produto e botão no artigo | ✅ |
| Testes automáticos antes de gerar | ✅ |
| **Links de afiliado** | ✅ **Ativo** — Frente 4 (`meli.la`, `s.shopee.com.br`) |

### Frontend (Astro 5)
| Componente | Status |
|---|---|
| Tema escuro, design system em `global.css` | ✅ |
| **Tema claro** (`:root[data-theme="light"]`) + toggle para visitantes | ✅ |
| **Fundo configurável** (preset/cor/imagem) via `src/data/blog-config.json` | ✅ |
| Cards por seção, TOC em acordeão, sidebar | ✅ |
| Estilo do botão de produto (`.product-btn`) | ✅ |
| Estilo do **botão duplo** (`.product-btns`) | ✅ Pronto |

### Frente 4 — produtos com afiliado
| Componente | Status |
|---|---|
| Serviço `blog-produtos-api` na VM do monitor (porta 8086) | ✅ Rodando |
| Banco de produtos afiliados (SQLite, 30 dias) | ✅ 792 produtos |
| Coletor automático a cada 10 min | ✅ |
| API de busca (`/api/produtos/buscar`, lote, health, catálogo) | ✅ |
| Aviso no Telegram quando falta produto | ⚠️ Bloqueado: falta `/start` no bot |
| **Cliente no blog (`monitor_api.mjs`)** | ✅ Pronto e ativo |
| **Botão duplo no artigo** | ✅ Pronto |

---

## 3. O que falta fazer

### 🔴 Alta prioridade — monetização ✅ concluído em 06/08/2026

O blog **agora gera comissão**: a Frente 4 está ativa em produção (`AFFILIATE_MODE=remote`,
merge `1435106`). O pipeline busca produtos com link de afiliado na API da VM **antes** do Serper
(que virou só fallback). Primeiro artigo com afiliado no ar: *"5 Melhores teclados gamer com
retroiluminação em 2024"* (5 produtos: 3 ML + 2 Shopee).

| Tarefa | Estado |
|---|---|
| `scripts/monitor_api.mjs` (cliente da Frente 4, nunca lança exceção) | ✅ |
| `scripts/gerar-artigo.mjs` (busca Frente 4 antes do Serper; não sobrescreve `affiliate_link`) | ✅ |
| Botão duplo (`buildOfferButtonsHtml` + CSS em `[...slug].astro`) | ✅ |
| Testes (158 asserts, incl. botão duplo e cliente remoto) | ✅ |
| Secrets/variables no GitHub (`MONITOR_API_KEY`, `MONITOR_API_URL`, `AFFILIATE_MODE`) | ✅ |

📄 **Execução completa, passo a passo e com o código:
[`FRENTE_4_RETOMADA.md`](../FRENTE_4_RETOMADA.md) (STATUS no topo).**

### 🟡 Média prioridade
| Tarefa | Motivo |
|---|---|
| `/start` no `@MonitorDeGruposBot` (ação do dono) | Destrava o aviso de produtos faltantes |
| Limpar `/var/log` na VM do monitor | 6 GB, sendo 2,8 GB de journald sem teto. **Disco cheio = perda do acesso SSH** |
| Backup do banco da Frente 4 | Ele vive na VM do monitor e só se reconstrói parcialmente (as frentes guardam 1000 registros) |

### ✅ Concluído em 07/08/2026 — reformulação do tema e do admin

| Tarefa | Estado |
|---|---|
| Tema claro completo (dark + light, sem cor hardcoded) | ✅ |
| Config de tema/fundo em `src/data/blog-config.json` + `background-presets.json` | ✅ |
| Aba **Aparência** no admin (tema, toggle para visitantes, fundo preset/cor/imagem) | ✅ |
| Admin unificado em `public/admin/` (fonte de verdade) | ✅ |
| Docs: `DESIGN.md` (temas), `METODOLOGIA.md` (ranking), `SKILL.md` (categoria única), `README.md` | ✅ |
| Migração do domínio para `promogamer.com.br` (raiz, sem `/blog-gamer`) | ✅ |

### ✅ Concluído em 08/08/2026 — detalhes do produto na regeneração

O catálogo da Frente 4 e o Google Shopping não entregam marca/descrição/specs.
Na regeneração (`regenerar-artigos.mjs`), cada produto agora é enriquecido pela
**página oficial** (`extractMLProductData`: brand/description/specs via JSON-LD
e metas) com fallback **Tavily** (snippet). Os dados vão apenas para o prompt da
LLM (blurbs + corpo) como fonte de verdade — sem mudança visual nos cards.

| Tarefa | Estado |
|---|---|
| `extractMLProductData` devolve `brand`/`description`/`specs` | ✅ |
| `enrichProducts` (página oficial → fallback Tavily) | ✅ |
| Detalhes no `productBlock` + blurbs (regra: só specs fornecidas) | ✅ |
| Merge de detalhes em `product_dedupe.mjs` (mesclar) | ✅ |
| Testes (`extractMLProductData` com/sem JSON-LD) | ✅ |
| Docs (`METODOLOGIA.md`) | ✅ |

### ✅ Concluído em 11/08/2026 — notícias nunca abortam + pendências de afiliado

O abort de 10–11/08 (categoria console <3 produtos válidos → `exit(1)`) foi removido:
**artigos de notícia nunca abortam por falta de produtos** — rodam em fluxo informativo
(seção "Onde Jogar", sem cards de produto). E produto bom **sem link de afiliado**
não é mais descartado: é publicado com o botão `product-btn--pending` e registrado em
`src/data/afiliados_pendentes.json`, para o autor colar o link na aba **Pendências** do `/admin/`.

| Tarefa | Estado |
|---|---|
| `shouldAbortProductSourcing` (notícia nunca aborta; exportado) | ✅ |
| `isNoticia` pula retry por categoria e shortlist | ✅ |
| `main()` preserva `noticia` quando tema vem de trending | ✅ |
| `resolverAfiliados` mantém produto sem link com `affiliate_pending: true` | ✅ |
| Botão `product-btn--pending` + seção "Onde Jogar" no prompt | ✅ |
| Registro `src/data/afiliados_pendentes.json` | ✅ |
| Aba **Pendências** no `/admin/` (copiar link, substituir `<a href>`, marcar resolvido, deploy) | ✅ |
| Testes (**304 asserts OK**) + build (**154 páginas**) | ✅ |
| Docs: `PIPELINE_ETAPAS.md`, `METODOLOGIA.md`, `TROUBLESHOOTING.md`, `README.md` | ✅ |

### ✅ Concluído em 11/08/2026 — etapa 6 (redação): montagem à prova de IA + foco misto

O P0 "5 Melhores sem seção por produto" saiu: a LLM não decide mais o posicionamento nem o
título da seção principal. Ela escreve a linha `[LISTA]` (sozinha, após a intro) e o heading
`## Os N Melhores…` é gerado em código (`buildListHeading`). O foco misto games×hardware foi
atacado em duas frentes: tema híbrido é rejeitado na descoberta (`isMixedDomain(kw)`) e o corpo
usa `temFocoMisto` (menção de jogo como contexto em artigo de hardware não conta como misto),
com retry de domínio no fluxo segmentado.

| Tarefa | Estado |
|---|---|
| Marcador `[LISTA]` + heading determinístico (`buildListHeading`) | ✅ |
| `splitMainBody` tolera contrato antigo (primeira linha `##`) | ✅ |
| `temFocoMisto`/`dominiosNoTexto` (foco real, sem falso positivo) | ✅ |
| Bloqueio de tema misto na descoberta (`isMixedDomain(kw)`) | ✅ |
| Feedback de domínio no fluxo segmentado (retry máx. 2) | ✅ |
| Word count alinhado com mínimos por categoria (`MIN_WORDS`) | ✅ |
| Testes (**323 asserts OK**) + build (**154 páginas**) | ✅ |
| Docs: `PIPELINE_ETAPAS.md` | ✅ |

### ✅ Concluído em 12/08/2026 — gate de revisão + funil de sourcing medido

Os relatórios de revisão (7 etapas) passaram de **documentação pós-fato** para **portão real**:
qualquer etapa reprovada (P0/P1) agora impede a publicação — o artigo novo é removido, a
regeneração restaura o backup do artigo anterior, o estado é revertido (`last_success`/`last_slug`)
e o pipeline aborta com `exit(1)`. Os dossiês são persistidos **antes** do gate (sempre existem,
mesmo no aborto) e há escape do operador (`IGNORE_REVIEW_GATE=1` ou `opts.forcePublicar`).
Também foram corrigidos o bug de severidade do título (SEO) e a medição do funil de sourcing.

| Tarefa | Estado |
|---|---|
| Gate de revisão com rollback em `gerar-artigo.mjs` | ✅ |
| Dossiês persistidos antes do gate (visíveis mesmo reprovados) | ✅ |
| Reversão de estado no aborto + `consecutive_failures` | ✅ |
| Escape do operador (`IGNORE_REVIEW_GATE=1` / `opts.forcePublicar`) | ✅ |
| Bug de severidade do título — keyword ausente/clickbait agora P1 (`revisar-etapas.mjs`) | ✅ |
| `revisarSourcing` com score formal: `queriesUsadas` no relatório (C1) | ✅ |
| Rodada vazia registra métrica (`sanitizeProducts`) — funil sem `undefined` (C2) | ✅ |
| `aposPiso` pós-truncamento + `descartadosTruncados` (C3) | ✅ |
| Testes (**347 asserts OK**) | ✅ |
| Docs: `PIPELINE_ETAPAS.md`, `PROGRESSO.md` | ✅ |

### ✅ Concluído em 12/08/2026 — gate em produção (P8) + desarme de falsos positivos (P12)

Os hooks de revisão e o gate foram **commitados** — o CI passa a rodar com o pipeline completo.
Antes do commit foram desarmados os falsos positivos que travariam o gate em **todo artigo de
produto** (o `validateSourceCoverage` contava os `R$` da tabela Comparativo como "preço em prosa"
→ P1 → rollback + `exit(1)`):

| Tarefa | Estado |
|---|---|
| `validateSourceCoverage` ignora linhas de tabela (`\|`), seção "Continue Explorando" e anchors `<a id>` nos checks de `R$`/ano/nota (`gerar-artigo.mjs`) | ✅ |
| Anos em links internos do rodapé não geram "ano sem suporte nas fontes" | ✅ |
| `fontesComUrl < 2` rebaixado de P1 para P2 (fecha P12); `description < 120` mantido P1 (o `validate()` já garante ≥120) | ✅ |
| Re-verificação do artigo publicado (hooks atuais): **10/10 em todas as etapas** — gate simulado aprovado | ✅ |
| Testes (**350 asserts OK**) | ✅ |
| Docs: `PIPELINE_ETAPAS.md` (seção "Verificação de código"), `PROGRESSO.md` | ✅ |

### ✅ Concluído em 12/08/2026 — sourcing destravado (V6, V7, V8) + P12 contínuo

As pendências de Fase 2 que faziam **cadeiras/teclados abortarem** e repetiam
busca idêntica nas rodadas extras foram fechadas junto com a continuação do
desarme de falsos positivos (P12) no gate de produto:

| Tarefa | Estado |
|---|---|
| **V6** — queries do lote remoto entram em `triedQueries` (`gerar-artigo.mjs:2942-2946`): rodadas extras giram keywords de retry em vez de reenviar a mesma busca 4× | ✅ |
| **V7** — produto com nota mas **sem** `ratingCount` não reprova por volume (`product_ranking.mjs:198-213`): piso de volume só vale quando o dado chega (Frente 4 não manda volume em várias categorias) | ✅ |
| **V8** — `ThunderX3`, `LuvinCo`, `MyMax` no `KNOWN_BRANDS` (`product_naming.mjs:155-157`): cadeira passa o gate de identidade pela marca | ✅ |
| `AFFILIATE_MODE` default `remote` (Frente 4 primária) + `.env.example` sincronizado | ✅ |
| **P12 cont.** — marca "Blue" só com contexto (Yeti/Snowball/etc., nunca "light blue"); `1080P`/`60FPS` não são modelo (`product_naming.mjs`); volume `>=100` não compensa nota < 3.5 (`product_ranking.mjs`) | ✅ |
| Testes (**365 asserts OK**) | ✅ |
| Docs: `PIPELINE_ETAPAS.md`, `PROGRESSO.md`, `METODOLOGIA.md` | ✅ |

### ✅ Concluído em 12/08/2026 (noite) — rodízio N→G→N→L→N→R + fallback de tema + gate corretor + reserva Tavily

O ciclo de categorias trocou `noticia → review → guia → lista` (baseado em `indexOf`, ambíguo com "notícia" repetida) por **`N→G→N→L→N→R`** com um contador `rotation_pos` no `state.json` — notícia ocupa posições pares e vira a maioria dos dias (notícia nunca aborta no sourcing). Quando um dia de guia/lista/review aborta, o `main()` agora tenta um **pool de temas** (keyword alternativa do trending → seeds estáticos → notícia por último) em vez de `exit(1)`. O gate de revisão, além de bloquear, passou a **corrigir automaticamente** P0/P1 determinísticos (seções vazias, base64, imagens frágeis, abertura proibida, marcadores restantes, description/tags), reaplicar os passos deterministas e revalidar antes do rollback. A **Tavily** ganhou reserva via **Serper** e notícia passou a exigir **900 palavras** (alvo 900-1100).

| Tarefa | Estado |
|---|---|
| Rodízio `N→G→N→L→N→R` + `rotation_pos` (`gerar-artigo.mjs`, `gerar-status.cjs`) | ✅ |
| Fallback de tema — pool de candidatos no `main()` (fecha P2) | ✅ |
| Gate com correção (`montarMarkdown` + `corrigirPeloGate` + revalidação) | ✅ |
| Reserva da Tavily via Serper (`buscarComReserva`) | ✅ |
| `MIN_WORDS.noticia` 900 + alvo `900-1100` | ✅ |
| Workflow: 2ª execução diária (21:30 UTC) + fechar issue do pipeline no sucesso | ✅ |
| Testes (**381 asserts OK**) + build (**158 páginas**) | ✅ |
| Docs: `PIPELINE_ETAPAS.md`, `PROGRESSO.md` | ✅ |

**Validação em produção (12/08/2026):** artigo **"Gamescom 2026: principais anúncios, jogos, datas e novidades"** (notícia, 39º) gerado com o pipeline novo, aprovado no gate (**0 P0 / 0 P1 / 5 P2**, média ~9,3/10) e publicado. Na geração, o **Gemini** estourou TPM/truncou (503) e o **Groq** recusou o prompt grande (413) — a reserva em cadeia caiu no **OpenAI** e o artigo saiu normal (ver `docs/TROUBLESHOOTING.md`).

### ✅ Concluído em 13/08/2026 — artigo de smart TV reprovado excluído + categoria `tv` + gate de lista plural

O artigo **"Melhores smart tv gamer 4K em 2026: A melhor escolha"** (40º, gerado em 12/08) foi reprovado na auditoria
do operador: título plural ("Melhores") com **um único item** e produto absurdo — **"Console Sony Fable Standard"**
(console Sony + Fable, nome que não existe). O artigo foi **excluído** e o `state.json` revertido para o estado anterior
(Gamescom, 39 artigos). A causa raiz era a combinação de 4 lacunas, todas corrigidas:

| Lacuna | Correção |
|---|---|
| "smart tv" não era categoria de produto → `detectArticleCategory` retornava `null`, sem filtro de categoria nem `MIN_PRODUCTS` | Categoria **`tv`** adicionada em `PRODUCT_CATEGORIES` (`product_naming.mjs`): smart tv/smartv/televisão/tv 4k/uhd/oled/qled/neo qled/mini led/nano cell, com excludes (suporte, cabo, controle, tv box, stick, antena, monitor, película, remoto) |
| `classifyDomain("smart tv gamer")` caía em `unknown` → tratado como domínio **games** → busca de produto usava query de jogo (`ps5 jogo ps5`) e achava console | `HARDWARE_KEYWORDS` ganhou `smart tv`, `smartv`, `televisão`, `televisao`, `tv` (`gerar-artigo.mjs`) → domínio vira `hardware` e a busca mira TVs |
| Notícia isenta do funil de produtos + sem gate de coerência | `CATEGORY_BRANDS.tv` (Samsung/LG/Sony), `CATEGORY_FALLBACK_KEYWORDS.tv` e capa default por categoria |
| **Nenhum gate impedia lista plural com 1 produto** (o "Os 1 Melhores" saiu) | **Gate novo** em `validate()` (`gerar-artigo.mjs`): título/heading que prometem lista plural ("Melhores"/"Os N Melhores" com N≥2) com **menos de 2 produtos** vira erro **hard** (bloqueia publicação); com 0 produtos vira alerta soft. Mesmo critério em `validar-artigo.mjs` (lista com <2 produtos reprova) |

| Tarefa | Estado |
|---|---|
| Exclusão do artigo `.md` + capa + imagem do produto + entrada de `afiliados_pendentes.json` | ✅ |
| `state.json` revertido (39 artigos, último Gamescom) | ✅ |
| Categoria `tv` em `PRODUCT_CATEGORIES` + `CATEGORY_BRANDS` + `TAIL_STOP` (`product_naming.mjs`) | ✅ |
| `HARDWARE_KEYWORDS` com smart tv/televisão/tv + `CATEGORY_FALLBACK_KEYWORDS.tv` + capa default (`gerar-artigo.mjs`) | ✅ |
| Gate de lista plural no `validate()` (hard com <2 produtos) | ✅ |
| `validar-artigo.mjs` reprova lista com <2 produtos | ✅ |
| Testes (**419 asserts OK** — 15 novos: categoria tv, coerência console≠tv, gate de lista plural) | ✅ |
| `validar-artigo.mjs --all` sem novas falhas (84 pré-existentes de artigos antigos, confirmadas por stash) | ✅ |
| Docs: `PROGRESSO.md`, `PIPELINE_ETAPAS.md` | ✅ |

Com a categoria `tv` registrada, um tema futuro de smart TV vira categoria `tv`: o "Console Sony Fable Standard"
seria descartado pelo filtro de categoria no sourcing e reprovado pelo gate (`productMatchesCategory(console, "tv") === false`).

### ✅ Concluído em 13/08/2026 — estrutura de lista (TOC/imagens) + grounding por Google + regeneração do "Melhores Jogos para PC"

Análise do artigo **"Melhores Jogos para PC em 2026: 5 Títulos Indispensáveis"** (40º, gerado em 13/08) revelou 3 problemas
que o pipeline novo passou a resolver:

| Problema observado | Causa raiz | Correção |
|---|---|---|
| No índice, os jogos apareciam como tópicos soltos (deveriam ser subtópicos recolhíveis) | fluxo sem produtos deixava a estrutura a critério da LLM — cada jogo virava `##` top-level | **`ensureListStructure`** (`gerar-artigo.mjs`): para lista/review de games com 0 produtos, insere o heading-pai `## Os N Melhores ... em {ano}` e rebaixa os itens para `###` (TOC aninhado, mesmo padrão do FAQ) |
| Imagens no container errado (a do Cyberpunk caía dentro do bloco do Baldur's Gate) | prompt mandava `[IMG:]` **antes** do `##`, e `repositionImageMarkers` movia o marcador para antes do título — o `rehype-article-sections` agrupava a imagem na seção anterior | prompt e `repositionImageMarkers` agora colocam o `[IMG:]` na linha **após** o título (imagem dentro da própria seção, abaixo do título, acima do texto) |
| Lista de "2026" era de jogos antigos (BG3 2023, Cyberpunk 2020...), e "Cyberpunk 2077" virou "Cyberpunk 2026" | a LLM escolhia do próprio conhecimento; a pesquisa só alimentava um bloco "CONTEXTO"; `normalizarAnos` reescrevia todo `20XX` | **Grounding por Google** (`scripts/games_candidates.mjs`): Serper (reserva Tavily) busca "melhores jogos de pc {ano}" → LLM extrai títulos candidatos → prompt ganha "CANDIDATOS OBRIGATÓRIOS" e o `validate()` marca item fora da lista como **P2** (regenera, aceita com ressalva). **`normalizarAnosPreposicional`** protege nomes/modelos (só reescreve ano após "de/em/para/até") |

Reforços extras da sessão:

| Tarefa | Estado |
|---|---|
| `montarQueryPesquisa` — limpa a query ("melhores melhores jogos para pc, jogos gratis..." → "jogos para pc Brasil 2026") | ✅ |
| `buildInternalLinksBlock(excludeSlug)` — não linka o próprio artigo em regeneração | ✅ |
| Gate corretor no último retry do fluxo de chamada única (antes de `exit(1)` por hard, tenta `corrigirPeloGate` e revalida) | ✅ |
| `validateSourceCoverage` fiscaliza só o "intervalo de claim" ([ano-3, ano+1] exceto o ano do artigo) — ano de lançamento de jogo (2021) não vira P1 falso | ✅ |
| **Regeneração** do artigo "Melhores Jogos para PC em 2026" com o pipeline novo: heading-pai + 5 itens `###` grounded (Baldur's Gate 3, Elden Ring Nightreign, Resident Evil Requiem, Mina the Hollower, ARC Raiders), imagens dentro das seções, capa nova, sem self-link | ✅ |
| `npm test` **443 asserts OK** (+24) · `npm run build` **166 páginas** · `validar-artigo.mjs` **0 falhas** | ✅ |
| Docs: `PROGRESSO.md`, `PIPELINE_ETAPAS.md`, `METODOLOGIA.md`, `ORIENTACOES_EDITORIAIS.md`, `README.md` | ✅ |

### 🟢 Baixa prioridade
| Tarefa | Motivo |
|---|---|
| Remover código morto | `scripts/ml_affiliate.mjs`, `automation/ml_affiliate.py`, `scripts/fix-article-links.mjs` — fora do pipeline |
| Limpar docs duplicados | `automation/docs/*` duplica `docs/*` |
| Aprovar app no programa de devs do ML | Único caminho seguro para o blog ter acesso próprio ao ML |

---

## 4. Arquitetura real

```
GitHub Actions  ← É AQUI QUE TUDO ACONTECE
  └─ npm test  →  node scripts/gerar-artigo.mjs
        ├─ Frente 4 (ATIVA) ................. links COM comissão (meli.la / s.shopee)
        │        HTTP :8086 + X-API-Key
        │        ▼
        │      VM monitor-telegram (34.29.27.155)
        │        ├─ Frente 1  monitor-bot-ml     → grupos do Telegram
        │        ├─ Frente 2  searcher-ml        → varre ofertas ML + busca Shopee
        │        ├─ Frente 3  searcher-panel     → painel de post manual
        │        └─ Frente 4  blog-produtos-api  → API + banco (catalogo.db)
        │              ↑ lê (somente leitura) os posted.json das frentes 1/2/3
        └─ Serper.dev (Google Shopping) ....... fallback quando a VM está fora

VM do blog (35.237.81.192) ......... LEGADO, fora de uso, token expirado
GitHub Pages ....................... site publicado
```

---

## 5. Comandos úteis

```bash
# Rodar os testes (o CI roda isto antes de gerar)
npm test

# Build do site
npm run build

# Gerar artigo localmente (precisa das chaves no .env)
node scripts/gerar-artigo.mjs

# Disparar a geração no GitHub
gh workflow run gerar-conteudo.yml -f force=true

# Saúde da Frente 4 + estado do banco
curl -s http://34.29.27.155:8086/api/health | python -m json.tool

# Os 4 serviços da VM do monitor (os 3 primeiros nunca podem sair de "active")
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api'
```

---

## 6. Documentação

| Arquivo | Conteúdo |
|---|---|
| [`FRENTE_4_RETOMADA.md`](../FRENTE_4_RETOMADA.md) | **Instruções de execução da Frente 4** — comece por aqui |
| [`CREDENCIAIS.md`](CREDENCIAIS.md) | Chaves, hosts, portas, onde fica cada segredo |
| [`MONITOR_API_AUDITORIA.md`](MONITOR_API_AUDITORIA.md) | Auditoria da VM do monitor e decisões do dono |
| [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Problemas conhecidos, incluindo o incidente da sessão do ML |
| [`DESIGN.md`](DESIGN.md) | Design system e **temas dark/light** (variáveis, regra de cor) |
| [`METODOLOGIA.md`](METODOLOGIA.md) | Critérios de ranking dos produtos (TAREFA 6) |
| [`../PLANO_ML_SHOPEE_MONITOR.md`](../PLANO_ML_SHOPEE_MONITOR.md) | Plano original (histórico) |
| [`../infra/blog-produtos-api/README.md`](../infra/blog-produtos-api/README.md) | Código do serviço e deploy |
