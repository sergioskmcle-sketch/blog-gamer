# Promo Gamer — Status do Projeto

> Última atualização: 2026-08-06

> ⚠️ **Este arquivo foi reescrito em 06/08/2026.** A versão anterior descrevia o pipeline Python
> na VM (`scheduler.py`, `generate_article.py`, `ml_affiliate.py`) como se fosse o sistema ativo.
> **Não é.** Aquele pipeline é legado e não funciona (token do GitHub expirado). O que gera
> artigo hoje é o **GitHub Actions**.

---

## 1. Como o blog funciona hoje

| Etapa | Onde | Arquivo |
|---|---|---|
| Agendamento | GitHub Actions (cron `30 9 * * *`) | `.github/workflows/gerar-conteudo.yml` |
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
| [`../PLANO_ML_SHOPEE_MONITOR.md`](../PLANO_ML_SHOPEE_MONITOR.md) | Plano original (histórico) |
| [`../infra/blog-produtos-api/README.md`](../infra/blog-produtos-api/README.md) | Código do serviço e deploy |
