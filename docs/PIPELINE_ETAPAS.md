# Pipeline do Blog Gamer — Mapa de Etapas (trabalho em progresso)

Documento de trabalho para resolver o pipeline **um problema de cada vez**, até deixar tudo funcionando.

**Status geral:** teste completo publicado em **11/08/2026** (`3-melhores-teclados-gamer-para-investir-em-2026`, 38 artigos) e re-medido em **12/08/2026** com os hooks atuais + 6 fixes de medição → **10/10 nas 6 etapas centrais** (Pesquisa, Redação, SEO, Design, Revisão, Publicação). Em **12/08/2026** foram adicionados: **gate de revisão** (relatórios agora BLOQUEIAM a publicação com rollback), correção do bug de severidade do título (SEO) e medição completa do funil de sourcing (C1-C3). Em **12/08/2026** o gate foi **commitado para produção (P8)** após **desarmar 2 falsos positivos** (`validateSourceCoverage` contava `R$` da tabela Comparativo e anos de links internos como claim) e rebaixar `fontesComUrl < 2` de P1 para P2 (P12). **Fases 3 e 4 (12/08/2026):** todas as pendências de verificação foram fechadas — V4 (`familiaRepetida` real no hook de pesquisa), V5 (portão de tema com Gemini), V9 (`.env.example` completo), V10 (regeneração passa pelo portão `validar-artigo.mjs`), V11 (notificação de falha no cron via issue única), V13 (OpenAI como LLM primário), V16 (Reddit com UA real + `AbortSignal.timeout`) e V20 (`MIN_WORDS` alinhado à persona). **Noite de 12/08/2026 (rodízio + fallback + gate corretor):** rodízio de categorias `N→G→N→L→N→R` baseado em `rotation_pos` (não mais `indexOf`, que era ambíguo com "notícia" repetida), **fallback de tema (P2)** com pool de candidatos no `main()` (keyword alternativa de trending + seeds estáticos, notícia por último como rede de segurança — dia de guia/lista/review que abortava agora tenta outro tema), **reserva da Tavily** via Serper (`buscarComReserva`), **regra das 900 palavras** para notícia (`MIN_WORDS.noticia=900`, alvo `900-1100`) e **gate com correção automática** (`corrigirPeloGate`): P0/P1 corrigíveis são resolvidos em código (seções vazias, base64, imagens frágeis, abertura proibida, marcadores restantes, description/tags), os passos deterministas são reaplicados (preços→marcadores→âncoras) e o artigo é revalidado antes de qualquer rollback. O workflow ganhou 2ª execução diária (21:30 UTC) e fecha a issue do pipeline automaticamente quando o ciclo volta a funcionar.
**Scores de referência:** re-medição dos 6 hooks de revisão sobre o artigo publicado (12/08, working dir, não commitado). **Validação em produção (12/08, noite):** o artigo **"Gamescom 2026: principais anúncios, jogos, datas e novidades"** (notícia, 39º) foi gerado com o pipeline novo (rodízio `rotation_pos`, pool de temas, gate corretor, reserva Tavily, 900 palavras) e aprovado no gate com **0 P0 / 0 P1 / 5 P2** (pesquisa 10, sourcing 10, redação 9, SEO 8, design 10, revisão 9, publicação 9). As 5 ressalvas P2: FAQ sem H3, tag genérica "jogos", seção "Quer mais ofertas?" sem Telegram e corpo com 1 imagem apenas (revisão/qualidade).
**Legenda:** ✅ funciona / ❌ falha / ⚠️ parcial. "Sem score formal" = não existe hook de revisão para a etapa.
**Legenda do gate:** "Bloqueia?" = se um P0/P1 nessa etapa impedir a publicação (via gate agregado ou portão hard).

---

## Tabela completa

| # | Etapa | Agente | Funciona? | Bloqueia? | Score | O que faz | Falha real / situação atual |
|---|-------|--------|-----------|-----------|-------|-----------|------------------------------|
| 1 | **Disparo** | GitHub Actions (sem agente) | ✅ sim | — | sem score formal | cron 09:30 e 21:30 UTC → checkout → `npm ci` → `npm test` → roda gerador | **Sem falha conhecida** — cron de hoje executou |
| 2 | **Setup / Pre-flight** | pipeline (sem agente) | ✅ sim | — | sem score formal | valida chaves (GEMINI/GROQ obrigatórias), lê `state.json`, cooldown 20h, cobertura games/hardware, janela de famílias | **Sem falha conhecida** — passou: 4 chaves OK, cooldown OK, cobertura 14/20, 32 famílias |
| 3 | **Descoberta de tema** | Ana Pesquisadora | ✅ sim | ✅ | **10/10** | RSS (11 portais) + Reddit + Tavily News → IA escolhe keyword → anti-repetição por família → esteira de categoria | **Sem falha bloqueante**; desvios: Reddit todo 403, Gemini/Groq estouram TPM (cai no OpenAI). Anti-repetição rejeitou headset/ps5/gta/xbox corretamente |
| 4 | **Pesquisa de fundo** | Ana Pesquisadora | ✅ sim | ✅ | **10/10** | Tavily busca, consenso editorial (Serper/Tavily), shortlist editorial, fatos verificados | **Sem falha conhecida**; parecer LLM é só registro (não retroage) |
| 5 | **Sourcing de produtos** | pipeline (Ana/Frente 4) + Marcos Comprador | ⚠️ parcial (teclados passa; cadeiras aborta) | ✅ | **score formal novo** (`revisarSourcing`) | shortlist → Frente 4 (Monitor API) + Google Shopping → filtro de categoria → dedup → piso de qualidade → truncamento → afiliados → gate ≥3 | **Corrigido (11/08)**: notícia nunca aborta; produto sem link vira `product-btn--pending` + `afiliados_pendentes.json`. **Corrigido (12/08, C1-C3)**: funil por rodada registrado no relatório (mesmo em rodada vazia), `aposPiso` fiel ao final e `descartadosTruncados` novo. **Aberto**: *cadeiras* ainda aborta (só 1 produto no piso); produto sem afiliado **publica** se ao menos 1 tiver link |
| 6 | **Redação** | Carlos Redator | ✅ sim | ✅ | **10/10** | LLM segmentada (frontmatter+blurb por item+corpo) ou chamada única; 3 tentativas com feedback; montagem determinística em código | **Medição corrigida (12/08)**: check de preços em prosa exclui a tabela comparativa. **Pendência**: `minWords` 650 default ≠ alvo da persona (700-1100) |
| 7 | **SEO** | Felipe Otimizador | ✅ sim | ✅ | **10/10** | checkTitle/keyword nos 40%, frontmatter, links internos, normalizar anos | **Corrigido (12/08)**: capa resolvida antes do hook; `fontesComUrl` conta os dois formatos. **Corrigido (12/08, B)**: bug de severidade — keyword ausente/clickbait eram sempre P2, agora P1. **Atenção**: `fontesComUrl < 2` (P1) e `description < 120` (P1) agora BLOQUEIAM — risco de falso positivo |
| 8 | **Design / Imagens** | Lucas Designer | ✅ sim | ✅ | **10/10** | RAWG jogos, Tavily fallback, capa IA (OpenAI→Stability→fallbacks), thumbs de produto, injeção de marcadores | **Medição corrigida (12/08)**: `fs.existsSync` resolve contra `public/`. **Pendência**: check de `alt` é P3 e fraco (não garante por-imagem). **Corrigido (13/08)**: queda progressiva do nome no RAWG e no fallback Tavily (`progressiveGameQueries`), filtro de URLs frágeis (`isFragileImageUrl`), preferência de hosts estáveis e `AbortSignal.timeout` no `fetch` |
| 9 | **Revisão final** | Juliana Revisora | ✅ sim | ✅ | **10/10** | validação final hard/soft + cobertura de fontes + parecer | **Medição corrigida (12/08)**: `[IMG:]` só vale sem produtos; heading com `<a id>` limpo antes de comparar. **Pendência**: cobertura de fontes é `soft` (não bloqueia) |
| 10 | **Publicação** | Rafaela Publicadora | ✅ sim | ✅ | **10/10** | markdown final, slug único, salvar `.md`, atualizar `state.json`, salvar relatórios de revisão | **Medição corrigida (12/08)**: Fontes com URLs cruas contadas. **Mudança (12/08, A)**: relatórios são persistidos ANTES do gate; reprovado → rollback |
| 11 | **Pós** | GitHub Actions (sem agente) | ✅ sim | — | sem score formal | `validar-artigo.mjs` (portão) → commit → push → deploy | **Sem falha conhecida** (não chegou a rodar hoje — pipeline morreu na etapa 5) |

---

## Gates de publicação (como o pipeline realmente impede artigo ruim)

Antes de 12/08/2026 existiam **2 portões reais** e 5 scorecards que apenas documentavam. Agora existe **1 gate agregado** que cobre as 7 etapas:

1. **Gate de sourcing** (`shouldAbortProductSourcing`) — aborta lista/review com categoria de produto detectada e menos de `MIN_PRODUCTS` válidos; **notícia nunca aborta**.
2. **Portão hard do `validate()`** — reprova segmentação (produto sem `###`/linha na tabela), preço fora da prosa, etc.; regenera o corpo até 2x e, se persistir, `exit(1)`.
3. **Gate de revisão (NOVO, 12/08/2026)** — `gerar-artigo.mjs` (~linha 3714), roda **depois** de persistir os dossiês:
   - Se qualquer etapa sair `reprovado` (qualquer P0/P1), o artigo é **removido** (novo) ou **restaurado** do backup (regeneração);
   - `state.last_success`/`last_slug` são revertidos (o artigo não conta como publicado) e `consecutive_failures` é incrementado;
   - `exit(1)` — o cron/CI enxerga a falha;
   - **Escape do operador:** `IGNORE_REVIEW_GATE=1` no ambiente ou `opts.forcePublicar` publica mesmo reprovado (log WARN).

> O parecer LLM gerado pelas revisões continua sendo **registro morto** (não dispara retry nem corrige o texto). Nenhuma UI/admin lê os dossiês em `output/reviews/` — auditoria manual.

---

## Ajustes de 12/08/2026 (gate + SEO + sourcing)

- **A — Gate de revisão com rollback** (`gerar-artigo.mjs`): backup do arquivo antes do write; gate após `salvarRevisoes`/`salvarOcorrencias`; remove/restaura + reverte estado + `exit(1)`.
- **B — Bug de severidade do título (SEO)** (`revisar-etapas.mjs` ~linha 206): o ternário `? "P2" : "P2"` era código morto. Agora: keyword ausente / expressão genérica/clickbait → **P1**; título curto/longo → **P2**; começa com minúscula → **P3**.
- **C1 — `queriesUsadas` no relatório** (`revisar-etapas.mjs`): item P3 "Queries de busca executadas" lista as queries do funil (antes o parâmetro era morto).
- **C2 — Rodada vazia registra métrica** (`gerar-artigo.mjs`, `sanitizeProducts`): o `ultimoRound` é criado ANTES do guard — rodada que zera o pool entra no funil com `bruto: 0` (antes `rodadas` podia ficar vazio e o log de aborto imprimia `undefined`).
- **C3 — Funil fiel ao truncamento** (`gerar-artigo.mjs` ~linha 1380): `aposPiso` passa a refletir a entrega final pós `MAX_PRODUCTS` e novo campo `descartadosTruncados` mostra a perda do corte.

---

## Fases 3 e 4 (12/08/2026 — fechamento das pendências de verificação)

- **V4 — `familiaRepetida` real no hook de pesquisa** (`gerar-artigo.mjs`): `buildFamilyDates(excludeSlug)` lê `pubDate` dos artigos publicados (ignorando o próprio arquivo em regeneração) e `isFamiliaRepetida(hint)` retorna `true` se alguma família foi coberta nos últimos `FAMILY_REFRESH_DAYS`; o resultado é passado a `revisarPesquisa` — o item do checklist agora mede de verdade em vez de passar sempre.
- **V5 — Portão de tema por IA com Gemini**: o gate `analyzeTrendsWithAI` roda quando `GROQ_API_KEY || GEMINI_API_KEY` (antes só GROQ), alinhado ao `fetchLLM` que tenta Gemini 1º.
- **V9 — `.env.example` completo**: todas as chaves usadas em `scripts/` documentadas em 5 seções (IA, ML, monitor, automação, comportamento).
- **V10 — Regeneração passa pelo portão**: `regenerar-artigos.mjs` executa `node scripts/validar-artigo.mjs <slug>` após gravar com `--apply` e `exit(1)` se reprovar.
- **V11 — Notificação de falha no cron**: `gerar-conteudo.yml` ganhou step `if: failure()` que abre uma issue única (label `pipeline`; não duplica se já aberta) com link do run; requer `permissions: issues: write`. Oportunamente pode virar webhook/Telegram reaproveitando o mesmo step.
- **V13 — OpenAI como LLM primário**: o pre-flight do `main()` aceita `OPENAI_API_KEY` sozinha (antes exigia Gemini/Groq e só usava OpenAI como fallback).
- **V16 — Reddit como sinal vivo**: UA de Chrome real + `AbortSignal.timeout(15000)` (a option `timeout` não existe no fetch do Node — era bug certo de 403/timeout).
- **V20 — `MIN_WORDS` alinhado à persona**: `noticia` 600→**800** (900 ficava acima do teto do alvo 700-900 de notícia e a geração nunca atingia — recalibrado após run de 12/08); defaults dos hooks standalone 650→700.

---

## Verificação de código (12/08/2026 — Fase 0+1)

Levantamento do que funciona / não funciona em cada etapa, validado contra o código (`file:line`).
Itens **[CORRIGIDO]** saíram na Fase 0+1 (desarme de falsos positivos + gate commitado, P8/P12).

| # | Etapa | Achado | Situação |
|---|-------|--------|----------|
| V1 | Revisão | `validateSourceCoverage` (`gerar-artigo.mjs:2637`) contava `R$` da tabela Comparativo (linhas `\|`) como "preço em prosa" → P1 no gate → **reprovava todo artigo de produto** | **[CORRIGIDO]** linhas `\|`, seção "Continue Explorando" e anchors `<a id>` excluídas antes dos checks de preço/ano/nota |
| V2 | Revisão | Anos em links internos do rodapé (ex.: `/blog/...-2025-.../`) geravam "ano sem suporte nas fontes" | **[CORRIGIDO]** mesmo filtro acima |
| V3 | SEO | `fontesComUrl < 2` era P1 (bloqueante) — tema com 1 fonte boa abortava | **[CORRIGIDO]** rebaixado para P2 (fecha P12) |
| V4 | Pesquisa | `familiaRepetida` é recebido pelo hook (`revisar-etapas.mjs:105`) mas nunca passado pelo gerador (`gerar-artigo.mjs:2829-2836`) → o item "Família não repetida" passa sempre (a trava real está só na descoberta) | **[CORRIGIDO (Fase 3)]** `buildFamilyDates(excludeSlug)` + `isFamiliaRepetida()` reais passados a `revisarPesquisa` (`gerar-artigo.mjs`) — o item do checklist mede a janela de `FAMILY_REFRESH_DAYS` |
| V5 | Descoberta | Portão de tema por IA chaveado em `GROQ_API_KEY` (`gerar-artigo.mjs:702`) mas `fetchLLM` tenta Gemini 1º → só-GEMINI pula a escolha por IA | **[CORRIGIDO (Fase 3)]** portão roda quando `GROQ_API_KEY || GEMINI_API_KEY` (`gerar-artigo.mjs:722`) |
| V6 | Sourcing | `triedQueries` só é populado no ramo Google Shopping (`gerar-artigo.mjs:2974`) → lote remoto da Monitor API reenviado idêntico 4× nas rodadas extras | **[CORRIGIDO (12/08)]** consultas enviadas pelo lote remoto agora entram em `triedQueries` (`gerar-artigo.mjs:2942-2946`) — as rodadas extras giram as keywords de retry em vez de repetir a mesma busca |
| V7 | Sourcing | Piso de qualidade: produto com rating mas sem `ratingCount` vira `NaN >= 20 === false` (`product_ranking.mjs:197-205`) → **principal causa de *cadeiras* abortar com 1 produto** | **[CORRIGIDO (12/08)]** volume só reprova quando `ratingCount` chega (`product_ranking.mjs:198-213`) — nota sem volume segue valendo; piso da nota/volume combinados mantido |
| V8 | Sourcing | `KNOWN_BRANDS` (`product_naming.mjs:83-154`) sem marcas de cadeira (ThunderX3, LuvinCo, MyMax); `detectModel` quase nunca pega modelo de cadeira | **[CORRIGIDO (12/08)]** `ThunderX3`, `LuvinCo` e `MyMax` adicionados ao `KNOWN_BRANDS` (`product_naming.mjs:155-157`) |
| V9 | Setup | `.env.example` não lista `RAWG_API_KEY`, `STABILITY_API_KEY`, `FAMILY_REFRESH_DAYS`, `MIN_PRODUCTS`, `FORCE_TOPIC`, `SKIP_COVER`, `IGNORE_REVIEW_GATE` nem os extras reais (`GITHUB_TOKEN`, `ADMIN_API_KEY`, `JWT_SECRET`, `ML_COOKIES_B64`, `ML_AFFILIATE_TAG`) | **[CORRIGIDO (Fase 4)]** `.env.example` reescrito com as 5 seções (IA, ML, monitor, automação, comportamento) cobrindo todos os `process.env` usados em `scripts/` |
| V10 | Pós | `regenerar-artigos.mjs` não passa por `validar-artigo.mjs` (confia só no `validate()` interno) | **[CORRIGIDO (Fase 3)]** após `generateArticle` com `--apply`, o script roda `node scripts/validar-artigo.mjs <slug>` via `execFileSync` e `exit(1)` se reprovar |
| V11 | Global | Cron sem notificação de falha — se o gate abortar, ninguém é avisado | **[CORRIGIDO (Fase 3)]** step `if: failure()` no `gerar-conteudo.yml` cria **issue única** (label `pipeline`, não duplica se já aberta) com link do run; permission `issues: write` |
| V12 | Revisão | Doc afirmava cobertura de fontes "soft", mas o hook marca **P1** (`revisar-etapas.mjs:292`) — na prática bloqueia | Comportamento intencional (P1) |
| V13 | Setup | `main()` exige GEMINI ou GROQ (`gerar-artigo.mjs:2687`) — OpenAI sozinho não roda o pipeline (só fallback) | **[CORRIGIDO (Fase 4)]** `OPENAI_API_KEY` também conta como LLM primário no pre-flight (`gerar-artigo.mjs:2722`) |
| V14 | Redação | Fluxo segmentado usa máx. **2** tentativas no corpo (`gerar-artigo.mjs:4173`); fluxo único usa 3 (`:3223`) | Documentado |
| V15 | Redação | "minWords 650 default" do hook só vale em chamada standalone — no pipeline o caller passa `MIN_WORDS` por categoria (`:3110, 3336, 3629`), que bate com `MIN_WORDS_SEO` | Documentado; sem gap real |
| V16 | Disparo | Reddit 403 sempre (`gerar-artigo.mjs:659-675`): UA fraco + `timeout: 15000` inválido no fetch do Node (`:663`) — sinal morto | **[CORRIGIDO (Fase 4)]** UA de Chrome real + `AbortSignal.timeout(15000)` (`gerar-artigo.mjs:678`) — Reddit volta a ser sinal vivo (datacenter ainda pode 403, mas o timeout inválido era bug certo) |
| V17 | Disparo | RSS real: **11 feeds** (`:159-171`), doc antiga dizia 10 | Documentado |
| V18 | Testes | Asserts reais: **365** (`npm test`, 12/08 — after Fase 0+1 + Fases 3/4) | Atualizado |
| V20 | Redação | `MIN_WORDS.noticia = 600` vs alvo do próprio código (700-900) → notícia passava bem abaixo do objetivo (`gerar-artigo.mjs:2357`) | **[CORRIGIDO (Fase 4)]** `noticia` subiu para **800**; defaults standalone dos hooks (650) alinhados a 700 (`revisar-etapas.mjs:157,288`). *Nota (run 12/08): primeiro tentei 900 — acima do teto do alvo de notícia (700-900), a geração nunca atingia (814 máx) e o gate reprovava toda notícia; recalibrado para 800.* `ABSOLUTE_MIN_WORDS=500` segue como piso de última tentativa |

---

## Sub-etapas

### 3. Descoberta de tema (Ana)
```
RSS (10 portais, ~155 headlines) → Reddit (403, morre) → Tavily News (10)
→ IA escolhe keyword → anti-repetição por família → fallback estático → esteira de categoria
```
- Acertos: anti-repetição multi-família funcionando.
- Desvios: Reddit 403 em todos os subreddits; Gemini/Groq estouram TPM → fallback OpenAI.

### 5. Sourcing de produtos (o gargalo)
```
shortlist editorial → queries remotas (Monitor API, até 3 rodadas) → Google Shopping por query
→ filtro de categoria → dedup semântico → piso de qualidade (preço/marca/avaliações)
→ truncamento (MAX_PRODUCTS) → resolverAfiliados → gate ≥3 produtos → aborta se faltar
```
- **Corrigido (11/08/2026) — notícias:** `shouldAbortProductSourcing` faz notícias NUNCA abortarem por falta de produtos; rodam em fluxo informativo (seção "Onde Jogar", sem cards de produto). Artigo de lista/review só aborta se a categoria de produto for detectada.
- **Corrigido (11/08/2026) — produto sem link:** não é mais descartado. Vira `product-btn--pending` no artigo e entra em `src/data/afiliados_pendentes.json`, resolvido manualmente na aba **Pendências** do `/admin/`.
- **Corrigido (12/08/2026) — medição do funil (C1-C3):** `revisarSourcing` agora tem score formal por rodada (`bruto→aposCategoria→aposDedup→aposPiso→final`), registra rodada vazia e o truncamento de `MAX_PRODUCTS`.
- Falhas abertas: `AFFILIATE_MODE` vazio → `legacy` (exige SERPER); oferta fraca da Monitor API em `remote`; Steam Deck/Nintendo "marca desconhecida"; **produto sem link de afiliado ainda publica** se ao menos 1 produto tiver link (P1 só dispara se `comAfiliado === 0`).

### 6. Redação (Carlos)
```
FLUXO SEGMENTADO (com produtos): frontmatter + blurb por item + corpo com "[LISTA]"
  → heading da lista gerado em código (buildListHeading) → montagem determinística
  → revalidação → parecer. Loop com feedback de domínio (máx 2 tentativas).
FLUXO ÚNICO (sem produtos): LLM escreve tudo → validate → feedback → até 3 tentativas
```
- **Corrigido (11/08/2026) — montagem à prova de IA:** a LLM escreve a linha `[LISTA]`
  (sozinha, logo após a intro) e o heading `## Os N Melhores…` é gerado em código por
  `buildListHeading`. `splitMainBody` tolera o contrato antigo (primeira linha `##`).
- **Corrigido (11/08/2026) — foco misto:** `temFocoMisto` mede o peso real dos dois
  domínios no corpo — menção de jogo como contexto em artigo de hardware não conta como
  misto. Tema híbrido (`isMixedDomain(kw)`) é rejeitado na descoberta.
- **Corrigido (12/08, V20):** `minWords` agora segue a persona do código — `MIN_WORDS` por categoria (guia 1000, review 800, lista 800, notícia **800**) e defaults standalone dos hooks em 700; o piso de última tentativa segue `ABSOLUTE_MIN_WORDS=500`. Anti-padrões IA (confira/descubra) continuam P2, não bloqueiam.

---

## Etapas sem score formal (buracos de medição)

- **1, 2, 11** não têm hook de revisão — só o teste de ponta a ponta cobre as centrais.
- **Etapa 5** tinha "sem score formal" até 12/08/2026; agora tem `revisarSourcing` com funil por rodada (C1-C3).

---

## Falhas conhecidas (detalhado — 12/08/2026)

| # | Etapa | Falha | Severidade | Impacto |
|---|-------|-------|-----------|---------|
| 1 | Pesquisa | Parecer LLM não retroage (nenhum retry guiado pelo parecer) | Média | Problema detectado não corrige o artigo |
| 2 | Pesquisa | Claims só checados se `cobertura.claims > 0` (cobertura vazia = sem verificação) | Média | Fatos não verificados passam |
| 3 | Pesquisa | "Mínimo de 3 fontes" é P2 (só 0 fontes é P1) → artigo com 1-2 fontes publica | Baixa | Cobertura rasa |
| 4 | Sourcing | Produto sem link de afiliado publica se ao menos 1 tiver link (P1 só com `comAfiliado === 0`) | Alta | Artigo "com afiliado" sem comissão |
| 5 | Redação | `minWords` 650 ≠ alvo da persona (700-1100) — **CORRIGIDO (Fase 4, V20)**: `noticia` 600→900, defaults 650→700 | — | Fechado em V20 |
| 6 | Redação | Anti-padrões IA (confira/descubra) são P2 (não bloqueiam) | Baixa | Tom robotizado publica |
| 7 | SEO | `fontesComUrl < 2` era P1 → tema com poucas fontes abortava artigo bom (falso positivo) — **CORRIGIDO (Fase 0): agora P2** | — | Fechado em P12 |
| 8 | SEO | `description < 120` é P1 (assimétrico: `> 160` é P2) | Média | Falso positivo |
| 9 | SEO | Keyword fora dos 40% iniciais é P2 (não bloqueia) | Baixa | Keyword mal posicionada publica |
| 10 | Design | Check de `alt` é P3 e medido errado (conta, não garante por-imagem) | Baixa | Acessibilidade não garantida |
| 11 | Revisão | Cobertura de fontes é `soft` — não afeta o gate | Média | Texto sem citar fontes passa |
| 12 | Publicação | `revisarPublicacao` roda após o write (correção reativa; o gate rollback cobre) | Baixa | Correção sempre a posteriori |
| 13 | Global | Nenhuma UI/admin lê os dossiês (`output/reviews/`) | Média | Auditoria só manual |
| 14 | Global | Parecer LLM é registro morto em todas as etapas | Média | LLM gasto sem uso |
| 15 | Global | Afiliados pendentes publicados até correção manual no `/admin/` | Média | Rendimento zero até arrumar |
| 16 | Pesquisa | `familiaRepetida` nunca passado ao hook `revisarPesquisa` (V4) — **CORRIGIDO (Fase 3)** | — | Fechado em V4 |
| 17 | Descoberta | Portão de tema chaveado em GROQ (V5) — **CORRIGIDO (Fase 3)** | — | Fechado em V5 |
| 18 | Sourcing | Lote remoto reenviado idêntico nas rodadas extras (V6) — **CORRIGIDO (12/08)** | — | Fechado em V6 |
| 19 | Sourcing | Piso mata rating sem `ratingCount` (V7) — **CORRIGIDO (12/08)** | — | Fechado em V7 |
| 20 | Setup | `.env.example` incompleto (V9) — **CORRIGIDO (Fase 4)** | — | Fechado em V9 |
| 21 | Pós | Regeneração sem `validar-artigo.mjs` (V10) — **CORRIGIDO (Fase 3)** | — | Fechado em V10 |
| 22 | Global | Sem notificação de falha no cron (V11) — **CORRIGIDO (Fase 3)** | — | Fechado em V11 |

---

## Teste completo 11/08 + re-medição 12/08 (referência)

Run publicado: `3-melhores-teclados-gamer-para-investir-em-2026` (FORCE_TOPIC `teclados gamer|lista`,
SKIP_COVER, AFFILIATE_MODE=remote, manter publicado → 38 artigos). A rodada de *cadeiras* abortou de novo
no sourcing (1 produto passou no piso de qualidade, precisa 3).

O `revisoes.json` gerado no run usava hooks antigos; a re-medição rodou os **hooks atuais** sobre o artigo
publicado. Os 6 problemas restantes eram **falsos positivos dos medidores** (não do conteúdo) e foram corrigidos:

1. **SEO capa** — `revisarSeo` rodava antes da capa ser resolvida → `fm.image` vazio → falso "Artigo sem imagem de capa". Movido para depois de `fm.image = coverImage`.
2. **SEO fontes** — `fontesComUrl` contava só `](https://...)`; a seção Fontes usa URLs cruas (`- https://...`) → "0 fontes". Agora conta os dois formatos.
3. **Design imagens** — `fs.existsSync(p.path)` com URL do site resolvia para `C:\images\...` no Windows → "3 imagens inexistentes" (os arquivos existem em `public/images/produtos/`). Agora resolve contra `public/`.
4. **Redação preços** — check de preços em prosa contava os R$ da tabela comparativa. Agora exclui as linhas da tabela.
5. **Revisão `[IMG:]`** — aviso de "sem marcador [IMG:]" disparava em artigo de produto (que usa fotos locais nos cards). Agora só vale para artigos sem produtos.
6. **Revisão headings** — o check "produto como seção própria" quebrava quando `injectHeadingAnchors` insere `<a id="..."></a>` no heading. Agora limpa o anchor antes de comparar.

Re-medição (12/08): **Pesquisa 10/10 · Redação 10/10 · SEO 10/10 · Design 10/10 · Revisão 10/10 · Publicação 10/10**. `npm test` (365 asserts) passou sem regressão após os ajustes A/B/C, a Fase 0+1 e as Fases 3/4 (V4/V5/V9/V10/V11/V13/V16/V20).

---

## Plano de resolução (um problema de cada vez)

> Marcar com `[x]` conforme for resolvido.

- [x] **P1 — Destravar etapa 5 (sourcing de produtos console)**
      `shouldAbortProductSourcing` faz **notícia nunca abortar** (11/08/2026); produto sem link de afiliado
      vira `product-btn--pending` + `afiliados_pendentes.json` em vez de ser descartado.
- [x] **P2 — Etapa 5: fallback de tema** — concluído em 12/08/2026 (noite): o `main()` monta um **pool de candidatos** (tema principal → keywords alternativas do mesmo trending via `buildTopicFromKeyword` → seeds estáticos da categoria do dia → notícia por último). Em vez de `exit(1)`, o sourcing lança erro e o próximo candidato é tentado; todos falharem → `exit(1)` (mantém a issue automática).
- [ ] **P3 — Config `AFFILIATE_MODE=remote`** (hoje `legacy` exige SERPER e derruba cadeiras/teclados).
- [x] **P4 — Etapa 6: montagem segmentada** (seção própria por produto; preservar `category`).
      Corrigido em 11/08/2026 com o marcador `[LISTA]` + heading em código; foco misto
      bloqueado na descoberta e com feedback no fluxo segmentado (`temFocoMisto`).
- [x] **P5 — Etapa 7: SEO — medição corrigida (12/08/2026).**
      O hook rodava antes da capa ser resolvida (`fm.image` vazio → falso "sem capa") e `fontesComUrl`
      só contava links markdown (Fontes com URLs cruas davam 0). Movido para depois da resolução da
      capa + contagem dos dois formatos → re-medição **10/10** sobre o artigo publicado.
- [x] **P6 — Etapa 8: Design — medição corrigida (12/08/2026).**
      `fs.existsSync(p.path)` recebia a URL do site (`/images/produtos/...`) e resolvia para
      `C:\images\...` no Windows → imagens sempre "inexistentes". Agora resolve contra `public/` → re-medição **10/10**.
- [ ] **P9 — Etapa 5: cadeiras ainda aborta no sourcing** (1 produto passou no piso, precisa 3) — teclados passou; **mitigado em 12/08/2026 (noite)** pelo fallback de tema (P2): o dia de cadeira agora tenta outro tema e, se nada do tipo funcionar, cai para notícia — o blog publica mesmo sem produto de cadeira. O sourcing de cadeiras em si segue sem 3 produtos bons.
- [x] **P7 — Medição da etapa 5** (`revisarSourcing` com funil por rodada) — concluído em 12/08/2026 com C1-C3 (`queriesUsadas` no relatório, rodada vazia registrada, `aposPiso` pós-truncamento + `descartadosTruncados`).
- [x] **P10 — Gate de revisão com rollback (12/08/2026)** — relatórios das 7 etapas BLOQUEIAM a publicação (P0/P1); artigo removido/restaurado, estado revertido, `exit(1)`; escape `IGNORE_REVIEW_GATE=1`/`opts.forcePublicar`.
- [x] **P11 — Bug de severidade do título (SEO, 12/08/2026)** — keyword ausente/clickbait agora P1; curto/longo P2; minúscula P3 (`revisar-etapas.mjs`).
- [x] **P12 — Falsos positivos do gate no SEO** — **CORRIGIDO (12/08, Fase 0):** `validateSourceCoverage` ignora tabela Comparativo, "Continue Explorando" e anchors `<a id>` (preço/ano/nota); `fontesComUrl < 2` rebaixado de P1 para P2. `description < 120` mantido P1 (o `validate()` do gerador já garante ≥120 antes do write — sem risco real de falso positivo).
- [x] **P22 — Rodízio de categorias `N→G→N→L→N→R` com `rotation_pos` (12/08/2026, noite)** — `CATEGORY_ROTATION` com notícia em posições pares (maioria dos dias = notícia, que nunca aborta no sourcing); avanço por posição inteira no `state.json` (migração: deriva de `last_category` via `indexOf`, ciclo se auto-corrige em 6 dias); `gerar-status.cjs` sincronizado (removeu `promocao`, morto).
- [x] **P23 — Gate com correção automática (12/08/2026, noite)** — além de deletar/rollback, o gate tenta `corrigirPeloGate` (seções `##` vazias, imagens base64, imagens frágeis de redes sociais, abertura proibida, marcadores `[IMG:]/[PRODUTO:]` restantes, description < 120, tags < 3), reaplica os passos deterministas (`stripPricesFromBody` → `stripLeftoverMarkers` → `injectHeadingAnchors`) e revalida as 5 etapas determinísticas (Redação/SEO/Design/Revisão/Publicação). Só faz rollback se a correção não zerar as reprovações (pesquisa/sourcing/misto/word count continuam bloqueando).
- [x] **P24 — Reserva da Tavily via Serper (12/08/2026, noite)** — `buscarComReserva` em `pesquisar-fundo.mjs` tenta a Tavily e, em falha/cota, usa o Serper (Google) já presente no projeto; sem reserva, cai no erro original. Cobre as 3 profundidades (básico/médio/profundo).
- [x] **P25 — Regra das 900 palavras (12/08/2026, noite)** — `MIN_WORDS.noticia` 800→900 e faixa-alvo única `900-1100` para o prompt (antes `700-900` era contraditória com o mínimo 900: a geração nunca atingiria).
- [x] **P8 — Commit dos hooks (concluído em 12/08/2026)** — `pesquisar-fundo.mjs`, `revisar-etapas.mjs`, `auto-melhoria.mjs`, `prompts/` + mudanças de `gerar-artigo.mjs`/`test-injecao.mjs` commitados; o CI passa a rodar com o gate ativo.
- [x] **P13 — Etapa 5: piso de avaliação tolera rating sem `ratingCount`** (`product_ranking.mjs:197-205`) — concluído em 12/08 (V7).
- [x] **P14 — Etapa 5: `triedQueries` no ramo remoto** — concluído em 12/08 (V6).
- [x] **P15 — Etapa 5: ampliar `KNOWN_BRANDS`/`detectModel`** para cadeiras e acessórios — concluído em 12/08 (V8).
- [x] **P16 — Etapa 3: passar `familiaRepetida` ao hook `revisarPesquisa`** — concluído na Fase 3 (V4).
- [x] **P17 — Etapa 3: portão de tema usa o mesmo fallback do `fetchLLM`** (não só GROQ) — concluído na Fase 3 (V5).
- [x] **P18 — Etapa 11: `regenerar-artigos.mjs` passa por `validar-artigo.mjs`** — concluído na Fase 3 (V10).
- [x] **P19 — Global: notificação de falha no cron** — concluído na Fase 3 (V11): issue única do GitHub (label `pipeline`) no `gerar-conteudo.yml` em vez de Telegram/webhook (não depende de secret novo).
- [x] **P21 — Redação: `MIN_WORDS` alinhado à persona** — concluído na Fase 4 (V20): `noticia` 600→900, defaults 650→700.
- [ ] **P20 — Higiene**: `.env.example` completo, remover scripts mortos (`deploy*.mjs`, `check*.mjs`, `status.mjs`, `runs.mjs`, `wait.mjs`, `fixpush*.mjs`, `nojekyll.mjs`, `automation/*.py`), tirar `promocao` das categorias, alinhar whitelists (16 vs 19 domínios).
