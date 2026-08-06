> 📌 **Sucedido pela Frente 4 (ago/2026).** A ideia central — centralizar a afiliação na VM
> do monitor — foi mantida, mas o desenho mudou: o blog **não gera** link do ML (a sessão não
> suporta um segundo consumidor) e passou a **consumir um banco** alimentado pelas Frentes
> 1/2/3. Ver [`FRENTE_4_RETOMADA.md`](FRENTE_4_RETOMADA.md). Mantido como histórico.

# PLANO — Geração de Links de Afiliado via API Remota (monitor-telegram)

> ⚠️ **PLANO SUPERADO (ago/2026)** — Esta era a proposta de centralizar a geração de links `meli.la` num serviço na VM do monitor-telegram usando cookies do ML. O ML foi **fechado** como fonte e os cookies **aposentados**; o blog hoje usa **Google Shopping via Serper.dev** com links diretos (sem comissão) e edição de texto/link no painel `/admin/`. Mantido apenas como histórico da decisão.

> Plano exclusivo para a migração da geração de links de afiliado.
> **Decisão fixa:** o blog-gamer **não usa mais cookies** do Mercado Livre.
> A geração de links (que exige sessão autenticada) passa a ser feita pelo projeto
> `monitor-telegram` (outra VM), consumida via HTTP.

---

## 1. Contexto / Problema

O ML bloqueia quando os mesmos cookies de sessão são usados em **duas VMs simultaneamente**.

Hoje o blog-gamer gera links de afiliado com cookies próprios em dois pontos:

| Pipeline | Arquivo | Cookie |
|---|---|---|
| Node (GitHub Actions / CI) | `scripts/ml_affiliate.mjs:352` (`generateAffiliateLink`) | `ML_COOKIES_B64` (secret) |
| Python (VM do blog) | `automation/ml_affiliate.py:124` (`generate_affiliate_link`) | `ml_cookies.json` |

Além disso existem `scripts/fix-article-links.mjs` e `automation/fix_article_links.py`, que
substituem URLs com `?tag=sergioskm` por short links (`meli.la`) usando cookies — ficarão obsoletos.

**Solução adotada:** centralizar a geração de links de afiliado no projeto `monitor-telegram`
(VM `34.29.27.155`), que já mantém a sessão autenticada do ML (`ml_cookies.json` + CSRF + API
interna `createLink`/`stripe/user/links`). O blog-gamer pesquisa o produto, extrai os dados
(incluindo o link normal) e envia esse link para o serviço HTTP do monitor-telegram, que
responde com o link de afiliado pronto.

---

## 2. Regra de ouro: zero downtime

Durante toda a implementação, **nenhum dos dois projetos pode parar**:

- `monitor-telegram`: serviços `monitor-bot-ml.service` e `searcher-ml.service` continuam
  operando normalmente (bot postando ofertas, health check ativo).
- `blog-gamer`: pipeline Node (CI) e pipeline Python (VM) seguem gerando artigos normalmente.

Princípios:
1. Toda mudança é feita em **fases**, com **validação** antes de ativar.
2. Toda ativação é reversível (flag de configuração, não substituição de código).
3. O endpoint na VM de afiliados nasce em **serviço separado** — nunca se mexe/restarta o bot.
4. Fallback `?tag=sergioskm` garante que a geração de artigo nunca falha por causa do serviço remoto.
5. Limpeza de cookies/fixers só depois de o novo fluxo provar estabilidade.

---

## 3. Arquitetura

```
blog-gamer (este repositório)
  ├─ Node (GitHub Actions / CI)
  └─ Python (VM do blog)

            │  POST http://<VM-afiliados>:8085/api/affiliate-link
            │  Header: X-API-Key: <chave>
            │  Body:   { "url": "<link normal do produto>" }
            ▼
   afiliados-api.service  (NOVO serviço na VM 34.29.27.155, porta 8085)
            │
            │  reutiliza generate_affiliate_link() + ml_cookies.json
            │  (cookies, CSRF, API interna do ML createLink / stripe/user/links)
            ▼
            200 → { "ok": true, "affiliate_url": "https://meli.la/..." }
            erro → { "ok": false, "error": { "code": "...", "message": "..." } }

   Fallback no blog-gamer se a chamada falhar:
     link normal + "?tag=sergioskm"
```

VMs envolvidas:

| Projeto | VM | IP | Serviços |
|---|---|---|---|
| blog-gamer (pipeline Python) | VM do blog | `35.237.81.192` | `blog-gamer.service` |
| monitor-telegram (afiliados) | ml-monitor-telegram | `34.29.27.155` | `monitor-bot-ml.service`, `searcher-ml.service`, **`afiliados-api.service` (novo)** |

Acesso SSH ao monitor-telegram: `ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155`.

---

## 4. Contrato de API (a implementar na VM do monitor-telegram)

### 4.1 Endpoint principal

```
POST /api/affiliate-link
Header: X-API-Key: <chave compartilhada>
Body (JSON):
  {
    "url": "https://produto.mercadolivre.com.br/..."
  }
```

Respostas:

```jsonc
// 200 — sucesso
{ "ok": true, "affiliate_url": "https://meli.la/..." }

// 400/502/503 — erro (códigos mapeados do retorno atual da função)
{ "ok": false, "error": { "code": "no_cookies|no_csrf|auth_error|api_error|network_error", "message": "..." } }

// 401 — X-API-Key inválida ou ausente
{ "ok": false, "error": { "code": "unauthorized", "message": "..." } }
```

Códigos de erro derivam do retorno de `generate_affiliate_link()` em
`/opt/afiliados-monitor-v2/automation/monitor_bot.py:900`:

| code | significado | ação sugerida no blog |
|---|---|---|
| `no_cookies` | `ml_cookies.json` ausente/vazio | fallback + alerta |
| `no_csrf` | sessão ML não autenticada | fallback + alerta |
| `auth_error` | API respondeu 401/403 (cookies rejeitados) | fallback + alerta |
| `api_error` | API respondeu outra coisa / sem link | fallback |
| `network_error` | timeout / DNS / conexão | fallback |

### 4.2 Comportamento do serviço

- Reutilizar a lógica existente `generate_affiliate_link()` (módulo standalone
  `/opt/afiliados-monitor-v2/searcher/monitor_core/affiliate.py` — mesma lógica do bot).
- Ler o mesmo `ml_cookies.json` (`/opt/afiliados-monitor-v2/automation/ml_cookies.json`,
  dono `sergioskm_cle`). Rodar o serviço como `sergioskm_cle` para manter a leitura.
- Cache em memória com TTL de 1h (mesma estratégia de `AFFILIATE_CACHE`), chave = URL do produto.
- Tag de afiliado fixa: `sergioskm` (do `config.yaml`).

### 4.3 Endpoints opcionais (futuro)

- `POST /api/affiliate-links` — lote de até 5 URLs (reduz round-trips quando o artigo tem vários produtos).
- `GET /api/affiliate/health` — `{ ok: true, has_cookies, cookies_age_hours }` para alertar
  antes de rodar uma geração inteira (integrar ao `public/status.json` do blog).

---

## 5. Implementação na VM do monitor-telegram (zero downtime)

**Nunca** editar/restartar `monitor-bot-ml.service` (porta 8080) nem `searcher-ml.service`.
O endpoint nasce em um **novo** serviço:

1. Criar `afiliados-api.py` (aiohttp, mesmo padrão do `WebPanel` do monitor-telegram):
   - rota `POST /api/affiliate-link`;
   - validação de `X-API-Key` (chave compartilhada, lida de config/env);
   - rate limit 1 req/s nessa rota (o painel atual usa 10 req/s);
   - chama `generate_affiliate_link()` via `asyncio.to_thread` (é bloqueante).
2. Criar unit file `/etc/systemd/system/afiliados-api.service`
   (`User=sergioskm_cle`, `Restart=always`, porta 8085).
3. Abrir porta `8085` no firewall do GCP (único passo manual; não derruba nada).
4. Testar com `curl` (link real + casos de erro) e conferir que `GET /api/status` do bot (8080)
   continua respondendo.

---

## 6. Mudanças no blog-gamer

### 6.1 Cliente Node (`scripts/ml_affiliate.mjs`)

- Adicionar `generateAffiliateLinkRemote(productUrl, config)` usando `fetch`
  para `POST {AFFILIATE_SERVICE_URL}/api/affiliate-link` com header `X-API-Key`.
- Manter as funções de busca atuais (já são cookie-free: `searchML`, `searchMLviaGoogle`, `searchMLDirect`).
- **Remover** `generateAffiliateLink` com cookies e o código de CookieJar/CSRF.
- Cache local em memória (TTL ~50min) para evitar chamadas duplicadas entre CI e VM.
- Fallback: `{ short_url: productUrl + '?tag=sergioskm' }` em qualquer erro (com log de WARN).
- Comportamento controlado por `AFFILIATE_MODE` (`remote` | `legacy`), default `legacy` na 1ª versão.

### 6.2 Cliente Python (`automation/ml_affiliate.py`)

- Adicionar `generate_affiliate_link_remote(product_url)` usando `requests`.
- **Remover** `_generate_affiliate_link_raw`, `load_cookies`, `extract_csrf`, CSRF/headers internos.
- Manter cache TTL e `build_affiliate_url` para o fallback `?tag=sergioskm`.
- Comportamento controlado por `AFFILIATE_MODE` (`remote` | `legacy`).

### 6.3 Configuração / secrets

| Config | Onde | Valor |
|---|---|---|
| `AFFILIATE_SERVICE_URL` | `.env`, `.github/workflows/gerar-conteudo.yml`, `automation/.env.example` | `http://34.29.27.155:8085` |
| `AFFILIATE_SERVICE_API_KEY` | idem (secret no GitHub) | chave compartilhada |

Workflow `gerar-conteudo.yml:48`: substituir `ML_COOKIES_B64` pelos novos secrets
`AFFILIATE_SERVICE_URL` e `AFFILIATE_SERVICE_API_KEY`.

### 6.4 Limpeza (fase final, só após estável)

- Remover `ml_cookies.json` e `ml_cookies_base64.txt` da raiz (com backup local antes).
- Remover secret `ML_COOKIES_B64` do GitHub.
- Remover/descontinuar `scripts/fix-article-links.mjs` e `automation/fix_article_links.py`
  (obsoletos: a API já devolve `meli.la` direto).
- Remover referências a cookies do código de busca no Python.

---

## 7. Fases de implementação (com gates de validação)

| # | Fase | Gate de validação | Impacto no serviço |
|---|---|---|---|
| 1 | **VM afiliados**: subir `afiliados-api.service` (8085) sem tocar no bot | `curl` link real → `{ok, affiliate_url}`; erros → `{ok:false, code}`; `GET /api/status` do bot (8080) intacto | nenhum |
| 2 | **blog Node**: cliente `remote` + secrets, default `legacy` | teste local; run manual (workflow_dispatch) com `remote`; cards saem com `meli.la` | nenhum (default legacy) |
| 3 | **blog Python**: idem + migrar `scrape_ml_products` off-cookies (Tavily/API) | run do scheduler com `remote`; cards com `meli.la` | nenhum (default legacy) |
| 4 | **Ativação**: default `remote` | acompanhar 2–3 gerações reais | se falhar, voltar flag p/ `legacy` |
| 5 | **Limpeza**: cookies, secrets, fixers | blog continua gerando artigos sem cookies; `ML_COOKIES_B64` revogado | nenhum |
| 6 | **Futuro**: named tunnel HTTPS + health no `status.json` | — | — |

**Rollback:** em qualquer fase, reverter `AFFILIATE_MODE` para `legacy` restaura o comportamento
anterior instantaneamente (o código antigo só é removido na fase 5).

---

## 8. Pendências / decisões em aberto

- [ ] Quais pipelines chamam a API remota (CI, VM ou ambos) — decidir na fase 2/3.
- [ ] Migração cookie-free da busca no Python (`scrape_ml_products`, `automation/generate_article.py:320`)
      para Tavily/API ML.
- [ ] Abertura da porta 8085 no firewall do GCP (manual).
- [ ] Geração/rotação da chave `AFFILIATE_SERVICE_API_KEY`.
- [ ] Definir se o serviço novo na VM usa `monitor_core/affiliate.py` (searcher) ou
      duplica a lógica de `monitor_bot.py` — preferência: `monitor_core/affiliate.py` (módulo standalone).
- [ ] Opcional: endpoints de lote e health.

---

## 9. Referências relevantes

- blog-gamer: `scripts/ml_affiliate.mjs`, `automation/ml_affiliate.py`,
  `automation/generate_article.py` (`scrape_ml_products` em `:320`),
  `.github/workflows/gerar-conteudo.yml`.
- monitor-telegram (VM 34.29.27.155): `/opt/afiliados-monitor-v2/automation/monitor_bot.py:900`
  (`generate_affiliate_link`), `/opt/afiliados-monitor-v2/automation/web_panel.py`,
  `/opt/afiliados-monitor-v2/searcher/monitor_core/affiliate.py`,
  `/opt/afiliados-monitor-v2/automation/ml_cookies.json`.
- Docs: `docs/TROUBLESHOOTING.md` (erros de scraping/block do ML), `docs/PROGRESSO.md` (infra VM).
