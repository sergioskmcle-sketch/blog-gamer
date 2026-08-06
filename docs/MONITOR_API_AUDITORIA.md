# Auditoria da VM monitor-telegram — Fase 0

**Data:** 2026-08-05 · **Host:** `ml-monitor-telegram` (34.29.27.155) · **Acesso:** `ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155`
**Natureza:** somente leitura. Nenhum arquivo, serviço ou configuração foi alterado.
**Veredito:** ✅ **Premissas confirmadas — pode seguir para a Fase 1.** Com duas revisões
importantes no plano (ver "Impacto no plano").

---

## 1. Shopee — CONFIRMADO, e melhor que o assumido

A VM **não faz scraping** da Shopee para afiliação: usa a **API oficial do Programa de Afiliados
Shopee** (GraphQL).

- Endpoint: `https://open-api.affiliate.shopee.com.br/graphql`
- Módulo: `searcher/monitor_core/shopee_api.py` (159 linhas)
- Credenciais: `SHOPEE_APP_ID` / `SHOPEE_SECRET` em `searcher/.env` (assinatura HMAC, **sem cookies**)

Funções:

| Função | Assinatura | Retorno |
|---|---|---|
| `configure` | `configure(app_id=None, secret=None)` | — (obrigatório antes de usar) |
| `search_products` | `search_products(keyword='', page=1, limit=50, sort_type=1, item_id=None, shop_id=None)` | `(nodes, page_info)`. `nodes[]` traz `itemId, productName, price, priceMin, priceMax, priceDiscountRate, commissionRate, imageUrl, offerLink, productLink, shopId, shopName, ratingStar, sales`. Levanta `ShopeeRateLimitError` no código 10030; outros erros → `([], {})`. |
| `generate_short_link` | `generate_short_link(origin_url, sub_ids=None)` | `str` short link, ou `''` em qualquer falha. `sub_ids` (≤5) vira `utm_content` — **usar `['blog']` para separar a receita do blog da do Telegram**. |

**Descoberta decisiva:** o campo `offerLink` de `search_products` **já é o link de afiliado**.
Buscar produtos na Shopee custa **1 chamada** — não precisa de um segundo round-trip para afiliar.

Normalização pronta: `searcher/monitor_core/scraping/shopee_offers.py:31` — `_map_node(node)` já
converte o node no shape `{id, item_id, title, price, original_price, permalink, thumbnail,
images, discount_pct, rating, sales, offer_link, shop_name, commission_rate, _platform:'Shopee'}`.
É praticamente o shape do blog.

Outros módulos Shopee (para link avulso / URL colada, não necessários no fluxo de busca):
`scraping/shopee_scraper.py` (`parse_shopee_ids`, `fetch_shopee_product`,
`validate_shopee_affiliate_link`, `follow_shopee_short_url`) e `linkparse.extract_shopee`.

## 2. Mercado Livre

**Busca:** `searcher/monitor_core/scraping/offers.py:1355` — `search_ml(query, limit=150,
category=None)`. Não usa `/sites/MLB/search` (o comentário em `offers.py:325` confirma o **403**
para o app), e sim a página de ofertas via `fetch_with_retry` + `extract_json_chunk`, parseando
com `_parse_ml_item`. Retorna lista já ordenada por score (preço/desconto/rating/vendas).
Também existem `search_ml_products` (L787, fallback documentado do 403) e `search_ml_api` (L856).

**Afiliação:** `searcher/monitor_core/affiliate.py:70` — `generate_affiliate_link(product_url)`
→ **string**: short link `meli.la` no sucesso, **a própria URL do produto na falha**
(contrato antigo; detecta-se sucesso com `'meli.la' in result`).

Proteções já embutidas em `affiliate.py` (herdamos de graça, não reimplementar):
- Cache `AFFILIATE_CACHE`, TTL **7200s**.
- Circuit breaker: 3 falhas seguidas → 300s sem sequer tentar (`AFFILIATE_BREAKER_*`).
- Razões de falha classificadas: `no_cookies`, `no_csrf`, `auth_error`.
- `curl_cffi` com `impersonate='chrome131'` + UA fixo — é o que mantém a sessão viva.

**Sessão:** `automation/ml_cookies.json` (17 KB, modificado em **2026-08-02**, ~3 dias antes desta
auditoria). Leitura via `affiliate.load_cookies()`. Existe `instalar_cookies_ml.sh` para renovar.

## 3. Bootstrap obrigatório (os módulos são stateful)

Nenhum módulo funciona sem `configure()` antes. Padrão de referência em
`searcher/services/searcher/engine.py`:

| Linha | Chamada |
|---|---|
| 312 / 584 | `shopee_configure(app_id=..., secret=...)` |
| 389 | `offers_configure(...)` |
| 613 | `aff_configure(...)` → `affiliate.configure(config, cookies_path, user_agents, cookie_fetch_interval, ua_fixo, proxy)` |

`monitor_core/__init__.py` está **vazio** — não há fachada; é preciso importar submódulo a
submódulo. `monitor_core/config.py:10` tem `load_config(config_path)` para ler o config do
searcher (é dele que saem `shopee_app_id`, `shopee_secret`, `ml_cookies_path`).

→ O `adapters.py` do serviço novo deve replicar exatamente essa sequência de `configure()` no
startup, lendo o mesmo config/`.env` do searcher **em modo leitura**.

## 4. Ambiente

| Item | Valor |
|---|---|
| Python | 3.13.5 |
| SO | Debian 13 / kernel 6.12.94 |
| Venv | `/opt/afiliados-monitor-v2/venv` — **aiohttp 3.14.1**, `curl_cffi 0.16.0`, `requests 2.34.2`, `requests-toolbelt` |
| Serviços ativos | `monitor-bot-ml` (:8080), `searcher-ml`, `searcher-panel` (:8081) |
| Serviço falho | `sp-dbg.service` (`systemd-run` avulso de debug do panel — pré-existente, ignorar) |
| Portas em uso | 22, 25, 53, 8080, 8081, 5355, 20201, 20202, 20241 (cloudflared, localhost) |
| **8086** | **livre** ✅ |
| cloudflared | binário rodando (métricas em `127.0.0.1:20241`), mas `systemctl is-active cloudflared` = **inactive** → sobe por outra unit/nome. Investigar antes de propor túnel. |

## 5. Impacto no plano — duas revisões

### 5.1 Shopee vira o caminho primário, ML vira enriquecimento

A Shopee autentica por **API key HMAC**, sem cookies e sem sessão de navegador: não expira
sozinha, não tem fingerprint, não tem breaker. O ML depende de `ml_cookies.json`, que já tem
histórico de expirar e cujo módulo carrega um circuit breaker justamente por isso.

Então o `busca.py` deve consultar **Shopee primeiro** (rápido, 1 chamada, link de afiliado já
incluso) e tratar o ML como enriquecimento que pode falhar sem comprometer o resultado. O
fallback cruzado do briefing continua valendo — só muda a ordem e a expectativa de
confiabilidade. Na prática: se o ML cair, o artigo **ainda sai monetizado** (só com botão Shopee).

### 5.2 Venv — reusar o existente, sem nunca instalar nele

O plano previa venv próprio. Mas `monitor_core` depende de `curl_cffi` com `impersonate` numa
versão específica, e duplicar isso convida a drift silencioso justamente na parte frágil
(a sessão do ML). Recomendação revisada: o serviço novo usa
`/opt/afiliados-monitor-v2/venv/bin/python` — que **já tem aiohttp 3.14.1**, ou seja, zero
instalação, zero `pip`, zero risco de mexer nas dependências do bot. O código do serviço fica
isolado em `/opt/blog-produtos-api/`; só o interpretador é compartilhado.

## 6b. Decisões do dono sobre os achados (2026-08-05)

| Achado | Decisão | Estado |
|---|---|---|
| 6 backups de `ml_cookies.json` com sessões antigas | **Apagar** | ✅ Feito com `shred`. Um deles pertencia a `monitor-bot` e outro a `root` — eram legíveis por mais contas que o arquivo original. Sessão ativa e serviços intactos. |
| Credenciais em texto puro (`auth_ml.py`, `ml_proxy` no `config.yaml`) | **Não rotacionar agora**; manter na VM | ⏸ Em aberto. As duas apareceram em saída de terminal durante a auditoria, então considerar expostas. |
| Contas `opencode-access` e `monitor-bot` com sudo total | **Manter as duas** | ✅ Decidido. Ver abaixo. |
| Atribuição de comissão por `subIds` na Shopee | **Adiar** | ⏸ Receita do blog e do Telegram seguem somadas no painel. |

### Sobre as contas extras

Nenhuma foi criada manualmente: no GCP, cadastrar uma chave SSH cria a conta Linux
automaticamente e a coloca em `google-sudoers` (`NOPASSWD:ALL`) — daí o sudo total. É o padrão
da plataforma, não erro de configuração.

- **`opencode-access`** (18/jun): chave em metadata de **projeto** → vale para **todas as VMs do
  projeto**, incluindo a VM do blog. Nenhum processo rodando. Provável canal de acesso de
  ferramenta de automação — remover pode trancar o acesso à máquina.
- **`monitor-bot`** (19/jul): chave em metadata de **instância**, só nesta VM. Nenhum processo
  rodando (todos os serviços rodam como `sergioskm_cle`).

Remover a conta pelo Linux **não resolve**: ela é recriada no próximo acesso enquanto a chave
existir no metadata do GCP. A remoção real é tirar a chave no console.

Também há **6 chaves `google-ssh` de `sergioskm.cle@gmail.com` expiradas em 01/jul/2026** no
metadata da instância — inertes, apenas sujeira.

## 6. Achados de segurança (fora do escopo, mas registrados)

1. **`searcher/services/searcher/auth_ml.py:14-15` tem `CLIENT_ID` e `CLIENT_SECRET` do ML
   hardcoded em texto puro.** Se esse diretório for um repositório git com remote, as credenciais
   estão versionadas. Recomendo mover para o `.env` e **rotacionar** no painel de aplicações do ML.
2. `searcher/.env` contém `SHOPEE_SECRET`, `TELEGRAM_BOT_TOKEN`, `PANEL_TOKEN` e as credenciais
   do ML. Conferir permissão do arquivo e se está fora de qualquer git.
3. `:8080` e `:8081` (painel do searcher, protegido só por `PANEL_TOKEN`) estão em `0.0.0.0`,
   ou seja, expostos conforme o firewall do GCP permitir. Vale checar as regras vigentes.
4. Muitos `.bak-<timestamp>` versionando código antigo no mesmo diretório (inclusive
   `ml_cookies.json.bak*` com **sessões antigas em claro**). Vale um expurgo.

## 7. Checklist da Fase 1

- [ ] `/opt/blog-produtos-api/` com `app.py` (health + rotas 501) e `adapters.py` (bootstrap `configure()`)
- [ ] `ExecStart=/opt/afiliados-monitor-v2/venv/bin/python /opt/blog-produtos-api/app.py`
- [ ] `/opt/blog-produtos-api/.env` (`BLOG_API_KEY`, `chmod 600`)
- [ ] `blog-produtos-api.service` — `User=sergioskm_cle`, `Restart=always`, `MemoryMax=512M`
- [ ] Regra de firewall GCP `allow-blog-api` tcp:8086
- [ ] Gate: `systemctl is-active monitor-bot-ml searcher-ml searcher-panel` → todos `active`
