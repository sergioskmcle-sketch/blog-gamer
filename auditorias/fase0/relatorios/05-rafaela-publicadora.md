# Auditoria — Rafaela Publicadora (Pipeline de Publicação)
## Data: 2026-08-04

---

## 1. Visão Geral do Pipeline

O Blog Gamer possui **dois sistemas paralelos** de geração automática de artigos:

| Sistema | Linguagem | Localização | Status |
|---------|-----------|-------------|--------|
| **Node.js (original)** | JavaScript/ESM | `scripts/gerar-artigo.mjs` (~2756 linhas) | Ativo, usado localmente |
| **Python (automático)** | Python 3.13 | `automation/generate_article.py` (~1130 linhas) | Ativo, roda 24/7 via VM |

Ambos implementam o mesmo pipeline conceitual, mas com diferenças significativas em complexidade e capacidades. O sistema Python é o que efetivamente roda em produção via Google Cloud VM.

---

## 2. Seleção de Temas

### 2.1 Sistema Node.js (`scripts/gerar-artigo.mjs`)

**Fontes de trending:**
- RSS feeds: MeuPlayStation, GameVicio, IGN Brasil, TecMundo Games
- Reddit: r/gaming, r/gamesEcultura (hot posts)
- Google Trends via busca web (quando disponível)

**Classificação automática:**
- Extração de keywords por domínio: `GAME_KEYWORDS`, `CONSOLE_KEYWORDS`, `HARDWARE_KEYWORDS`, `EVENT_KEYWORDS`
- Função `classifyDomain()` categoriza trending como: `games`, `hardware`, `mixed`, `promo`, `unknown`
- Anti-mistura: artigos nunca misturam games e hardware no mesmo conteúdo

**Filtro de duplicatas:**
- `isTopicDuplicate()` compara com últimos 3 artigos e keywords recentes
- Threshold: ≥2 palavras em comum = duplicata
- `state.json` guarda `recent_keywords` e `recent_topics`

**Filtro de conteúdo proibido:**
- `FORBIDDEN_PATTERNS`: ~15 regex bloqueando apostas, cassino, caça-níqueis, blaze, bet365, etc.
- Aplicado em título + hint + ml_query antes de gerar

**Decisão via IA:**
- `analyzeTrendsWithAI()` envia headlines + trending + artigos cobertos para LLM
- LLM responde JSON com `{topic, category, hint, ml_query}`
- Categoria válida: `noticia`, `review`, `guia`, `lista`

### 2.2 Sistema Python (`automation/generate_article.py`)

**Rotação fixa de 8 categorias:**

| # | Categoria | Modo |
|---|-----------|------|
| 1 | noticia | informativo |
| 2 | review | melhores |
| 3 | guia | custo-beneficio |
| 4 | lista | custo-beneficio |
| 5 | lista | informativo |
| 6 | noticia | misto |
| 7 | review | misto |
| 8 | guia | misto |

- Rotação cíclica via `last_category_index` no `state.json`
- `is_topic_recent()` evita repetir categoria ou modo dos últimos 3 artigos
- Sem chamada a IA para decidir tema — é determinístico

### 2.3 Problemas Encontrados

| # | Severidade | Problema | Detalhes |
|---|-----------|----------|----------|
| T1 | 🟠 Alta | **Dois sistemas concorrentes** | Node.js e Python implementam lógica similar mas divergem em rotação, categorias e capacidades. Manutenção duplicada. |
| T2 | 🟡 Média | **Rotação Python fixa demais** | 8 passos cíclicos, sem adaptar-se a trending real. Pode gerar artigos sobre temas frios. |
| T3 | 🟡 Média | **Node.js usa LLM para escolher tema** | Mais inteligente, mas não está rodando em produção (VM usa Python). |
| T4 | 🟢 Baixa | **Divergência de categorias** | Python tem 9 categorias (`curiosidade`, `tutorial`, `comparativo`, `lancamento`), Node.js tem apenas 4. Artigos publicados usam categorias do Python. |

---

## 3. Pesquisa e Coleta de Dados

### 3.1 Pesquisa Web (Tavily)

| Sistema | Uso | Configuração |
|---------|-----|-------------|
| Node.js | Pesquisa web + imagens | API Tavily, timeout 15s |
| Python | Pesquisa web básica | API Tavily, `search_depth: basic`, 5 resultados |

- Python: usa Tavily como única fonte de pesquisa web
- Node.js: combina Tavily + RSS + Reddit + Google Trends

### 3.2 Scraping de Produtos (Mercado Livre)

**Python (`automation/generate_article.py`):**
- Scraping direto via HTTP com User-Agent rotativo (4 agents)
- Parse de JSON-LD (`<script type="application/ld+json">`) das páginas ML
- Anti-bloqueio: cookies, delay 3-6s, retry com backoff, fallback com cookies
- Filtros: marcas gaming (68 brands whitelist), anti-produtos não-jogos (regex)
- Limite: 6-8 produtos por query

**Node.js (`scripts/gerar-artigo.mjs`):**
- Usa Google Shopping via `google_shopping.mjs` (API Serper) em vez de scraping direto
- Complementa com RAWG API para imagens de jogos

### 3.3 Links de Afiliado (Mercado Livre)

- `ml_affiliate.py` / `ml_affiliate.mjs`: gera links curtos `meli.la`
- Requer cookies de sessão (`ml_cookies.json`) — expiram periodicamente
- Cookie manual: extensão Cookie-Editor → exportar JSON → upload via SCP para VM
- Tag de afiliado: `sergioskm`

### 3.4 Imagens de Capa

**Hierarquia de fallback:**

```
1. OpenAI DALL-E (openai-cover.mjs / generate_ai_cover.py)
   ↓ falha
2. Stability AI (stability-cover.mjs)
   ↓ falha
3. RAWG API (imagens de jogos)
   ↓ falha
4. Thumbnails de produtos ML
   ↓ falha
5. Imagem default
```

- Node.js: pipeline completo com 3 estágios
- Python: gera capa IA via API ou usa thumbnail do produto
- Conversão de banners: `convert-banners.mjs` (PNG→WebP)

### 3.5 Problemas Encontrados

| # | Severidade | Problema | Detalhes |
|---|-----------|----------|----------|
| P1 | 🔴 Crítica | **Cookies ML expiram sem aviso** | Se cookies expiram, links de afiliado quebram silenciosamente. `cookie_keepalive.py` visita ML 1x/dia mas não valida se cookies ainda funcionam. |
| P2 | 🟠 Alta | **Python: 5 resultados Tavily** | Pesquisa rasa. Node.js combina Tavily+RSS+Reddit — muito mais robusto. |
| P3 | 🟠 Alta | **Sem validação de links afiliado** | Não há teste se o link `meli.la` realmente redireciona. Pode gerar links mortos. |
| P4 | 🟡 Média | **Capa IA pode falhar sem fallback visível** | Se todas as APIs de imagem falharem, artigo publica sem capa ou com path quebrado. |
| P5 | 🟡 Média | **Scraping ML frágil** | DataDome bloqueia periodicamente. Fallback com cookies nem sempre funciona. |

---

## 4. Geração de Conteúdo (LLM)

### 4.1 Modelo e Configuração

| Parâmetro | Node.js | Python |
|-----------|---------|--------|
| Provedor | Groq | Groq |
| Modelo | `llama-3.3-70b-versatile` | `llama-3.3-70b-versatile` |
| Max tokens | ~6000 (corpo) + ~900 (blurbs) | 8192 |
| Temperatura | 0.7-0.8 | 0.7 |
| Limite free tier | 30 req/min | 30 req/min |

### 4.2 Arquitetura de Geração

**Node.js (segmentado — mais sofisticado):**
1. `generateArticleFrontmatter()` — gera título, description, tags, category, mode
2. `generateProductBlurb()` — 1 chamada LLM por produto (tagline, corpo, nota, destaque)
3. `generateMainBody()` — 1 chamada LLM para intro + headings + FAQ + fontes + links internos
4. `injectSegmentedItems()` — montagem determinística (sistema insere fotos + botões + tabela)
5. `buildComparativoTable()` — tabela comparativa gerada por código, não por LLM

**Python (monolítico):**
1. 1 chamada LLM gera TUDO: frontmatter + corpo + FAQ + fontes + seção de produtos
2. Validação pós-geração: word count, campos obrigatórios, slug único
3. Injeção pós-geração: imagens RAWG para jogos citados, fixAffiliateUrls

### 4.3 Prompts e Tom

- Persona: "Editor-Chefe de portal gamer"
- Tom: "conversacional, sem parecer robo", "experiencia gamer"
- Regras: NUNCA mencionar IA, emojis proibidos, voz passiva proibida
- Estrutura obrigatória: Introdução → Corpo → FAQ → Conclusão → Produtos → Fontes

### 4.4 Validação

**Python:**
- `validate_article()`: word count mínimo, campos obrigatórios (title, description, tags, category, image)
- Slug único: se duplicado, adiciona timestamp
- `fix_affiliate_urls_in_body()`: substitui URLs genéricas por links de afiliado reais

**Node.js:**
- Validação mais robusta: `parseBlurb()`, `splitMainBody()`, fallback se LLM falha
- 2 tentativas para corpo principal
- Fallback estrutural mínimo se tudo falhar

### 4.5 Problemas Encontrados

| # | Severidade | Problema | Detalhes |
|---|-----------|----------|----------|
| L1 | 🔴 Crítica | **Placeholder `[PRODUTO:1]` publicado** | Artigo `cadeiras-gamer` tem placeholder visível no H2. Falha de validação no Python. |
| L2 | 🟠 Alta | **Node.js não roda em produção** | O sistema mais sofisticado (segmentado) está no Node.js. A VM roda Python (monolítico). |
| L3 | 🟠 Alta | **Sem verificação anti-alucinação** | LLM pode inventar preços, especificações ou datas. Não há cruzamento com dados reais do ML. |
| L4 | 🟡 Média | **Temperatura 0.7-0.8** | Pode gerar conteúdo repetido entre artigos ou inconsistências factuais. |
| L5 | 🟡 Média | **Word count mínimo variável** | Python: 1200-1500 palavras. Artigos publicados variam de ~500 a ~2000+. |

---

## 5. Deploy e Publicação

### 5.1 Pipeline de Deploy

**Sistema Python (produção via VM):**
```
1. generate_article.py salva .md em src/content/artigos/
2. git add -A → git commit → git push origin main
3. GitHub Pages via GitHub Actions (build_type: "workflow")
4. URL: https://sergioskmcle-sketch.github.io/blog-gamer/
```

**Sistema Node.js (manual/local):**
```
1. deploy.mjs via Octokit (API GitHub)
2. Push para branch main + branch gh-pages (dist built)
3. Configura GitHub Pages para workflow
```

### 5.2 Infraestrutura

| Componente | Detalhes |
|-----------|---------|
| **VM** | Google Cloud, Debian 13, IP 35.237.81.192 |
| **Usuário** | `sergioskm_cle` |
| **Frontend** | Astro 5 + Tailwind |
| **Deploy** | GitHub Pages (GitHub Actions) |
| **Scheduler** | systemd service `blog-gamer.service` |
| **Agendamento** | `scheduler.py` roda 24/7, executa 1x/dia às 10:00 UTC |

### 5.3 Scripts de Deploy Manuais

`deploy.mjs` (Node.js):
- Push via Octokit API (não CLI git)
- Allowlist: `src/`, `public/`, `.github/`, `scripts/`, configs
- Ignora: `node_modules`, `.git`, `.astro`, `dist`, `.env`, `ml_cookies.json`, `venv`
- Configura Pages para `build_type: "workflow"`

### 5.4 Ausência de CI/CD

- **Nenhum diretório `.github/workflows/`** existe
- Deploy depende de push para `main` (trigger automático do GitHub Pages)
- Sem testes automatizados no pipeline de deploy
- Sem linting ou type-checking antes de publicar

### 5.5 Problemas Encontrados

| # | Severidade | Problema | Detalhes |
|---|-----------|----------|----------|
| D1 | 🔴 Crítica | **Sem CI/CD pipeline** | Artigos publicados direto no `main`. Sem testes, sem review, sem staging. |
| D2 | 🔴 Crítica | **Sem testes automatizados** | `test-injecao.mjs` é o único teste (unitário de injecão). Nenhum teste de frontmatter, validação ou deploy. |
| D3 | 🟠 Alta | **Deploy manual do Node.js** | `deploy.mjs` requer `GH_TOKEN` como env var. Não automatizado. |
| D4 | 🟠 Alta | **Sem rollback** | Se artigo publicado tem erro, não há mecanismo de reverter automaticamente. |
| D5 | 🟡 Média | **`.github/workflows/` ausente** | Mesmo que GitHub Pages deploya via Actions, não há workflow customizado para build/test. |

---

## 6. Automação e Agendamento

### 6.1 Scheduler (`automation/scheduler.py`)

```python
# Executa 1x/dia às 10:00 UTC
schedule.every().day.at('10:00').do(run_generate)
# Executa imediatamente ao iniciar
run_generate()
# Heartbeat a cada 60s
```

- Systemd service com `Restart=always`, `RestartSec=30`
- Heartbeat: escreve timestamp em `heartbeat.txt` a cada ciclo
- Log: `logs/geracao.log` com timestamps UTC

### 6.2 Cookie Keepalive (`automation/cookie_keepalive.py`)

- Executa 1x/dia às 06:00 UTC (conforme README)
- Visita páginas de produtos ML para manter sessão ativa
- Não valida se cookies ainda funcionam

### 6.3 Heartbeat Watchdog (`automation/heartbeat_watchdog.py`)

- Monitora se scheduler está vivo
- Lê `heartbeat.txt` e detecta se está desatualizado

### 6.4 State Management

**`state.json`:**
```json
{
  "last_success": "2026-08-03",
  "consecutive_failures": 0,
  "total_articles": 17,
  "last_slug": "perifericos-gamer-os-5-melhores-teclados-mecanicos-de-2026",
  "last_category": "lista"
}
```

**`article_history.json`:**
- Lista de artigos gerados: título, slug, categoria, modo, data, query ML, produtos
- Usado para evitar repetição de temas

### 6.5 Problemas Encontrados

| # | Severidade | Problema | Detalhes |
|---|-----------|----------|----------|
| A1 | 🟠 Alta | **1 artigo/dia, sem flexibilidade** | Se LLM ou ML APIs falham, perde-se o dia. Sem retry no mesmo dia. |
| A2 | 🟠 Alta | **Sem alertas de falha** | `consecutive_failures` rastreado mas não notificado. Nenhum webhook/email. |
| A3 | 🟡 Média | **Scheduler é um loop `while True`** | Não usa systemd timer nem cron. Se scheduler crashar, systemd reinicia, mas pode perder execução do dia. |
| A4 | 🟡 Média | **Log em arquivo apenas** | `geracao.log` cresce indefinidamente. Sem rotação de logs. |

---

## 7. Interface de Administração

### 7.1 Editor (`admin/`)

- `admin/index.html` — página de edição
- `admin/editor.js` — lógica do editor
- `admin/marked.min.js` — parser markdown
- Permite visualizar e editar artigos publicados
- Interface web simples, sem autenticação visível

### 7.2 Scripts de Status

| Script | Função |
|--------|--------|
| `gerar-status.cjs` | Gera JSON de status do blog |
| `check.mjs` / `check2.mjs` | Verifica estado do deploy |
| `status.mjs` | Mostra status geral |
| `runs.mjs` | Lista runs do GitHub Actions |
| `wait.mjs` | Aguarda conclusão de deploy |
| `checkdeploy.mjs` | Verifica se deploy foi concluído |

### 7.3 Problemas Encontrados

| # | Severidade | Problema | Detalhes |
|---|-----------|----------|----------|
| AD1 | 🟡 Média | **Admin sem autenticação** | Qualquer pessoa com URL pode acessar o editor. |
| AD2 | 🟢 Baixa | **Scripts de deploy redundantes** | `deploy.mjs`, `deploy2.mjs`, `deploy3.mjs`, `deploy4.mjs` — múltiplas versões sem documentação de qual usar. |

---

## 8. Artigos Publicados (Análise do Pipeline)

### 8.1 Frontmatter Inconsistências

| Campo | Esperado | Encontrado | Problema |
|-------|----------|------------|----------|
| `category` | Sempre quoted | Mix: `"noticia"` vs `lista` (unquoted) | YAML parsing pode falhar em edge cases |
| `affiliate` | Boolean | `true`/`false` | OK |
| `image` | Path local ou URL | Mix: `/blog-gamer/images/capas/...` vs `https://media.rawg.io/...` vs `https://nintendo.com/...` | URLs externas podem quebrar |
| `mode` | Ausente no Node.js | Presente em battle-royale (`informativo`) | Campo não padronizado |
| `tags` | Array | Mix: inline `[a, b]` e multi-line YAML | Funcional mas inconsistente |

### 8.2 Dates

- Mais antigo: 2026-07-03 (`melhores-fones-de-ouvido-gamer`)
- Mais recente: 2026-08-03 (`perifericos-gamer-os-5-melhores-teclados-mecanicos-de-2026`)
- 17 artigos em ~1 mês = ~4 artigos/semana (acima do target de 1/dia)

### 8.3 Categorias dos Artigos Publicados

| Categoria | Quantidade | Artigos |
|-----------|:----------:|---------|
| noticia | 4 | god-of-war-laufey, desconto-gta-6, resident-evil, mouse-gamer |
| review | 2 | headset-gamer, monitores-gamer |
| guia | 4 | placas-de-video-amd, playstation-julho, fones-de-ouvido, cadeiras-gamer |
| lista | 4 | gta-6-performance, battle-royale, teclados-mecanicos, switch-2-ps5 |
| promocao | 2 | xbox-game-pass-julho, xbox-summer-sale-bundles |

---

## 9. Resumo de Problemas por Prioridade

### 🔴 Crítica (P0) — Correção Imediata

| # | Problema | Impacto |
|---|---------|---------|
| D1 | Sem CI/CD pipeline | Qualquer push ao main publica artigo sem validação |
| D2 | Sem testes automatizados | Bugs como `[PRODUTO:1]` passam despercebidos |
| L1 | Placeholder `[PRODUTO:1]` publicado | Experiência do leitor quebrada |
| P1 | Cookies ML expiram sem aviso | Links de afiliado quebram silenciosamente |

### 🟠 Alta (P1) — Correção em 1-2 semanas

| # | Problema | Impacto |
|---|---------|---------|
| T1 | Dois sistemas concorrentes | Manutenção duplicada, divergências |
| T3 | Node.js mais sofisticado não roda em produção | Pipeline subótimo em uso |
| P2 | Tavily com 5 resultados (Python) | Pesquisa rasa, conteúdo menos fundamentado |
| P3 | Sem validação de links afiliado | Links mortos prejudicam receita |
| L2 | Sem verificação anti-alucinação | Dados incorretos publicados |
| D3 | Deploy manual do Node.js | Processo frágil |
| D4 | Sem rollback | Erros ficam publicados |
| A1 | 1 artigo/dia sem retry | Dias sem conteúdo se APIs falharem |
| A2 | Sem alertas de falha | Problemas não detectados |

### 🟡 Média (P2) — Correção em 1 mês

| # | Problema | Impacto |
|---|---------|---------|
| T2 | Rotação Python fixa | Temas desatualizados |
| P4 | Capa IA sem fallback visível | Artigos sem imagem |
| P5 | Scraping ML frágil | Perda periódica de produtos |
| L4 | Temperatura 0.7-0.8 | Conteúdo repetitivo |
| L5 | Word count inconsistente | Artigos rasos |
| A3 | Scheduler loop while True | Possível perda de execução |
| A4 | Log sem rotação | Disco lotando |
| AD1 | Admin sem autenticação | Acesso não autorizado |

### 🟢 Baixa (P3) — Melhorias Contínuas

| # | Problema | Impacto |
|---|---------|---------|
| T4 | Divergência de categorias | Metadata inconsistente |
| AD2 | Scripts de deploy redundantes | Confusão manutenção |

---

## 10. Recomendações

### 10.1 Unificar Sistemas

| Ação | Esforço | Prioridade |
|------|:-------:|:----------:|
| Migrar lógica Node.js (RSS, Reddit, AI topic selection) para Python | Alto | P1 |
| OU: Migrar Python para Node.js e rodar via PM2/systemd | Alto | P1 |
| Decidir UM sistema e deprecar o outro | Baixo | P1 |

### 10.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml (a criar)
name: Build & Deploy
on:
  push:
    branches: [main]
jobs:
  validate:
    - Verificar frontmatter válido
    - Word count >= mínimo
    - Sem placeholders ([PRODUTO:1], [IMG:xxx])
    - Links de afiliado retornam 200
    - Sem imagens base64
  build:
    - npm run build
  deploy:
    - Upload para GitHub Pages
```

### 10.3 Validação Pré-Publicação

```python
# Checklist obrigatório antes de git push:
- [ ] Frontmatter YAML válido
- [ ] title: 55-65 chars
- [ ] description: 120-160 chars
- [ ] category: valor válido
- [ ] image: arquivo existe ou URL acessível
- [ ] Sem placeholders visíveis
- [ ] Word count >= 1200
- [ ] Links internos >= 2
- [ ] Fontes >= 2 com URLs
- [ ] Imagens sem base64
```

### 10.4 Monitoramento

| Ação | Ferramenta |
|------|-----------|
| Alerta de falha | Webhook Discord/Telegram após 2 failures consecutivos |
| Validação de cookies ML | Teste semanal de link afiliado real |
| Log rotation | `logrotate` ou `logging.handlers.RotatingFileHandler` |
| Health check | Endpoint que expõe `state.json` + último success |

### 10.5 Quick Wins

| Ação | Esforço | Impacto |
|------|:-------:|:-------:|
| Adicionar `validate_article()` no Node.js | Baixo | Evita placeholders |
| Criar `.github/workflows/validate.yml` | Baixo | CI básica |
| Adicionar retry no mesmo dia (Python) | Baixo | Mais conteúdo |
| Notificação via Telegram bot em falha | Baixo | Visibilidade |
| Log rotation no scheduler | Baixo | Limpeza |

---

## 11. Métricas Consolidadas

| Métrica | Valor |
|---------|-------|
| Total de artigos publicados | 17 |
| Período | 2026-07-03 a 2026-08-03 (31 dias) |
| Média de artigos/semana | ~4 |
| Sistemas de geração | 2 (Node.js + Python) |
| APIs utilizadas | 8 (Gemini, Groq, Tavily, OpenAI, Stability, RAWG, Serper, ML) |
| Testes automatizados | 1 (`test-injecao.mjs`) |
| CI/CD pipelines | 0 |
| Deploy manual | Sim (scripts deploy*.mjs) |
| Automação 24/7 | Sim (VM Google Cloud + systemd) |
| Cookies manuais | Sim (renovação periódica via SCP) |

---

*Relatório gerado por Rafaela Publicadora — Auditoria de Pipeline de Publicação Fase 0*
*Data: 2026-08-04 | Blog Gamer | 17 artigos em src/content/artigos/*
