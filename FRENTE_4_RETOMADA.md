# Frente 4 — prompt de retomada

> Cole este arquivo inteiro no início de uma nova sessão. Ele contém o estado real
> (medido em 06/08/2026, madrugada), as regras que **não podem ser quebradas**, e o
> que falta fazer dos dois lados.

---

## 1. Contexto

**Blog gamer** (Astro, GitHub Pages, repo `blog-gamer`). O pipeline de geração de artigo roda no
**GitHub Actions** (`.github/workflows/gerar-conteudo.yml` → `node scripts/gerar-artigo.mjs`,
cron 09:30 UTC). Hoje os artigos saem com links **sem comissão**: em
`scripts/gerar-artigo.mjs:1941` há literalmente `p.affiliate_link = p.permalink`, e os produtos
vêm do Google Shopping via Serper.dev (`scripts/google_shopping.mjs`).

**Objetivo:** monetizar o blog usando os produtos que o projeto **monitor-telegram** já descobre
e já afilia — sem que o blog gere uma única requisição ao Mercado Livre.

### As frentes do monitor (VM `34.29.27.155`, projeto `/opt/afiliados-monitor-v2/`)

| Frente | O que é | Serviço |
|---|---|---|
| 1 | Monitora grupos do Telegram (telethon) e extrai produtos das mensagens | `monitor-bot-ml.service` |
| 2 | Buscador: varre ofertas do ML por categoria e busca na Shopee por keyword | `searcher-ml.service` |
| 3 | Painel/dashboard onde o dono lança links manualmente | `searcher-panel.service` (:8081) |
| **4** | **O blog** — consome os produtos que 1/2/3 já acharam | `blog-produtos-api.service` (:8086) |

**Acesso:** `ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155` (sudo sem senha).
Zona GCP `us-central1-a`, projeto `project-475deb3a-7038-45fd-948`. A VM roda em **UTC**;
o código do monitor usa horário de Brasília (BRT = UTC−3).

---

## 2. REGRAS INVIOLÁVEIS — leia antes de tocar em qualquer coisa

### 2.1 Nunca use a sessão do Mercado Livre a partir do blog

**Isto já foi quebrado em 06/08/2026 e derrubou a operação do dono.** O que aconteceu:
testei geração de link de afiliado do ML a partir de processos novos, em sequência. O ML
invalidou a sessão (`401 auth_error`). A Frente 1 acumulou 3 falhas, **parou de postar produtos
do ML** (proteção do próprio código, para não postar sem comissão) e disparou alerta
`ml_cookies_expirados` no Telegram do dono às 23:18. Só voltou depois que ele exportou cookies
novos do navegador e eu instalei via `instalar_cookies_ml.sh`.

O aviso já estava escrito em `docs/CREDENCIAIS.md` e eu o interpretei como sendo sobre *onde* o
código roda. **Não é.** É sobre **quantos consumidores diferentes usam a mesma sessão**. Rodar na
mesma VM não isenta nada.

Consequências práticas, hoje em vigor:
- Existe uma **trava** em `adapters.py`: o caminho do ML só funciona com `BLOG_ML_ENABLED=1` no
  `/opt/blog-produtos-api/.env`. **A trava está desligada (ML bloqueado) e deve continuar assim.**
- O blog **não busca** e **não afilia** no ML. Ponto final.
- O único jeito seguro de o blog ter produto do ML é o que já está implementado: consumir o que
  as Frentes 1/2/3 já afiliaram.
- Se um dia for mesmo necessário acesso próprio ao ML, o caminho é **aprovar o app no programa de
  desenvolvedores do ML** (API oficial, sem cookies), não reativar a trava.

### 2.2 Nunca chame `getUpdates` do Telegram

O Telegram entrega cada atualização **uma única vez por token**. Se o serviço do blog escutar com
o token do bot da Frente 1, ele **rouba as mensagens** que o bot deveria receber e quebra a
detecção nos grupos — em silêncio, sem erro no log.

`aviso.py` só chama `sendMessage`. Se algum dia for preciso *receber*, crie um bot separado no
BotFather.

### 2.3 Zero downtime no monitor

Nunca editar, parar ou reiniciar `monitor-bot-ml`, `searcher-ml` ou `searcher-panel`. O serviço
do blog é separado, na porta 8086. Após qualquer mexida, confirmar:

```bash
systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api
```

### 2.4 Disco

Se o disco encher, **perde-se o acesso SSH à VM**. Hoje: 30 GB totais, ~17,7 GB livres.
O banco da Frente 4 ocupa 0,57 MB (projeção: poucos MB). **O risco real é `/var/log`, com 6 GB**,
sendo 2,8 GB de journald sem teto configurado. Limpeza pendente (ver §6).

### 2.5 Leitura pura dos arquivos do monitor

`adapters.py` e `catalogo.py` **só leem** `/opt/afiliados-monitor-v2/`. Nunca escrevem lá.

---

## 3. O que JÁ ESTÁ PRONTO E FUNCIONANDO

### 3.1 Serviço `blog-produtos-api` (VM, porta 8086)

Rodando, `active`, versão `2.0.0-frente4`. Unit em
`/etc/systemd/system/blog-produtos-api.service`:
`ExecStart=/opt/afiliados-monitor-v2/venv/bin/python /opt/blog-produtos-api/app.py`,
`User=sergioskm_cle`, `Restart=always`, `MemoryMax=512M`.

**Reusa o venv do monitor** (já tem aiohttp 3.14.1). **Nunca rodar `pip` nesse venv** — o
`curl_cffi 0.16.0` é o que sustenta a sessão do ML.

Arquivos em `/opt/blog-produtos-api/` (cópia versionada em `infra/blog-produtos-api/`):

| Arquivo | Papel |
|---|---|
| `app.py` | Rotas, auth `X-API-Key`, rate limit de entrada, cache 30 min, tarefa do coletor |
| `busca.py` | Orquestra marketplaces e monta o modelo de produto do blog |
| `catalogo.py` | Banco SQLite: coleta, retenção, busca, travas de disco |
| `adapters.py` | **Único** ponto acoplado ao monitor. Bootstrap `configure()`, throttle, trava do ML |
| `aviso.py` | Mensagem no Telegram (só envia) |
| `.env` | `BLOG_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` (chmod 600) |
| `catalogo.db` | SQLite, 0,57 MB |

### 3.2 O banco (o coração da Frente 4)

As Frentes 1/2/3 gravam tudo que publicam em dois arquivos, mas **cortam em
`posted[-1000:]`** — a Frente 1 descarta ~150 produtos/dia. O coletor copia antes do descarte.

Fontes (somente leitura):
- `/opt/afiliados-monitor-v2/automation/state/posted.json` (Frente 1 e também a 3)
- `/opt/afiliados-monitor-v2/searcher/services/searcher/state/posted.json` (Frente 2)

> Para distinguir Frente 1 de Frente 3 no primeiro arquivo: registros da **Frente 1 têm
> `source_group_name`** (o grupo de origem); os da **Frente 3 vêm com `None`**.

Estado atual: **792 produtos** (646 ML + 146 Shopee), 0,57 MB, coletor a cada 10 min.
Retenção 30 dias, teto de 200 MB, e parada automática se o disco livre cair abaixo de 3 GB.
Guarda só texto e URL de imagem — **nunca a imagem**.

Entrada: ~215 produtos/dia (deduplicados por `fingerprint`, já que o mesmo produto é repostado em
vários grupos). Shopee entra a ~46/dia pela Frente 2 → ~1.400 em 30 dias, então **o banco se
equilibra sozinho**.

### 3.3 API

Base `http://34.29.27.155:8086`, header `X-API-Key` (exceto health). Firewall GCP liberado
(regra `allow-blog-api` tcp:8086 + tag `blog-api`), validado da internet.

| Rota | Estado |
|---|---|
| `GET /api/health` | ✅ marketplaces + estado do banco |
| `POST /api/produtos/buscar` | ✅ `{query, limit, marketplaces, min_price, max_price}` |
| `POST /api/produtos/buscar-lote` | ✅ até 5 queries |
| `GET /api/catalogo` | ✅ estatísticas do banco |
| `POST /api/afiliar` | ⚠️ funciona para Shopee; **ML travado de propósito** |
| `POST /api/faltantes` | ⚠️ implementado, mas o Telegram recusa (ver §5.1) |

Modelo devolvido (superset do shape atual do pipeline, para não quebrar
`sanitizeProducts`/`injectProductCards`):

```json
{
  "id": "...", "title": "...", "price": 181.0, "original_price": 0,
  "thumbnail": "...", "images": ["..."], "permalink": "...",
  "source": "Mercado Livre", "sources": ["mercadolivre"],
  "affiliate_link": "https://meli.la/2NMK1Tf",
  "offers": { "mercadolivre": {"permalink": "...", "affiliate_link": "...", "price": 181.0, "item_id": "..."} },
  "preco_de": "2026-08-05", "origem": "catalogo"
}
```

Campos de topo espelham sempre a **oferta mais barata**. `preco_de` é a data em que a frente
achou a oferta — **o preço não é de agora** (decisão do dono: o artigo não anuncia preço exato,
apenas avisa que pode ter mudado).

### 3.4 Cobertura medida

Todas as 8 consultas típicas de artigo devolveram 5 produtos, com mistura **3 ML + 2 Shopee**:
`mouse gamer`, `teclado mecanico`, `headset gamer`, `cadeira gamer`, `monitor gamer`,
`placa de video`, `notebook gamer`, `ssd nvme`.

Amostra real de "headset gamer": Redragon Pandora 2 R$ 181 (`meli.la/2NMK1Tf`), Redragon Hylas
R$ 160, Fone Gamer F3 R$ 115,88 (Shopee).

> **Armadilha já corrigida, não reintroduzir:** os marketplaces são **intercalados**, não
> concatenados. Concatenando, a primeira lista consome o limite inteiro e a segunda some — a
> Shopee ocupava as 5 vagas com acessórios de R$ 15 enquanto o ML tinha monitor e headset
> esperando.

---

## 4. O QUE FALTA — lado do blog (repo `blog-gamer`)

**Nada disso mexe na VM. É a parte sem risco.** Trabalho na branch `feat/afiliados-ml-shopee`.

### 4.1 Cliente HTTP — `scripts/monitor_api.mjs` (novo)

- `buscarProdutosRemoto(query, opts)`, `buscarProdutosLoteRemoto(queries, opts)`,
  `checarSaudeRemota()`, `normalizarProdutoRemoto(raw)`.
- `fetch` global + `AbortSignal.timeout(25_000)`, 2 tentativas com backoff.
- **Nunca lançar exceção**: toda falha vira `[]` + log. O artigo tem que sair de qualquer jeito.

### 4.2 `scripts/gerar-artigo.mjs`

- Constantes novas perto da L455-460: `AFFILIATE_MODE`, `MONITOR_API_URL`, `MONITOR_API_KEY`.
- Nova `fetchProdutos(searchQueries, topic)` encapsulando o bloco L1893-1921: se `remote` →
  `buscarProdutosLoteRemoto`; se vazio/erro → Serper; fallback fixo (L1923) por último.
- L1941-1943 vira `if (!p.affiliate_link) p.affiliate_link = p.permalink;` — **não sobrescrever
  o link remoto**.
- `sanitizeProducts` (L832): aceitar id que não é `MLB\d{8,}` (produtos Shopee).
- Botão duplo: nova `buildOfferButtonsHtml(p)` + `OFFER_META`, com
  `buildProductButtonHtml` (L904) delegando e **caindo no corpo atual quando não há `offers`** —
  é isso que preserva os asserts de label de loja em `test-injecao.mjs:102-112`.
- Exibir aviso de que o preço pode ter mudado (usar `preco_de`).

### 4.3 CSS — `src/pages/blog/[...slug].astro` (bloco `/* === Product Cards === */`, ~L354)

```css
#articleBody .product-btns { display:flex; flex-wrap:wrap; gap:.75rem; justify-content:center;
  max-width:420px; margin:1.5rem auto 0; }
#articleBody .product-btns .product-btn { margin:0; flex:1 1 180px; width:auto; }
#articleBody .product-btn--ml { background:#ffe600; color:#000; }
#articleBody .product-btn--shopee { background:#ee4d2d; color:#fff; }
```
Não tocar em `.product-btn` base — artigos antigos dependem dela.

### 4.4 `scripts/test-injecao.mjs`

Sem framework: `assert` + helpers `ok`/`igual`, roda por `npm test` (o CI executa antes de gerar).
Acrescentar: 2 offers → exatamente 2 `<a>` + wrapper; 1 offer → sem wrapper; sem `offers` → caminho
legado intacto; marketplace desconhecido ignorado; `normalizarProdutoRemoto` contra fixture;
`sanitizeProducts` aceitando id Shopee; `injectProductCards` com bloco duplo.
**Testes de rede ficam fora do `npm test`** — o CI não pode depender da VM.

### 4.5 Workflow e segredos

Adicionar ao `env` do step de geração em `.github/workflows/gerar-conteudo.yml`:
`AFFILIATE_MODE` (variable), `MONITOR_API_URL` (variable), `MONITOR_API_KEY` (secret).

A chave está em `/opt/blog-produtos-api/.env` na VM:
```bash
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'sudo sed -n "s/^BLOG_API_KEY=//p" /opt/blog-produtos-api/.env'
```
Guardar como secret `MONITOR_API_KEY` no GitHub. **Nunca colar valor real em arquivo ou commit.**

### 4.6 Ativação

`AFFILIATE_MODE` começa `legacy` (comportamento atual). Vira `remote` só depois de validado.
Rollback = mudar a variável de volta, sem deploy e sem código.

---

## 5. O QUE FALTA — lado do monitor

### 5.1 Aviso no Telegram — **bloqueado, depende do dono**

`POST /api/faltantes` está implementado, mas o Telegram responde
**`400 Bad Request: chat not found`**. Motivo: um bot não pode iniciar conversa; o dono nunca
abriu chat privado com o `@MonitorDeGruposBot`.

**Ação do dono:** abrir o Telegram, procurar **@MonitorDeGruposBot** e enviar `/start`.
Depois testar:
```bash
KEY=$(sudo sed -n 's/^BLOG_API_KEY=//p' /opt/blog-produtos-api/.env)
curl -s -X POST -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"forcar":true,"faltantes":[{"query":"teste","encontrados":0,"precisa":3}]}' \
  http://127.0.0.1:8086/api/faltantes
```
O `chat_id` (`1720736456`) veio de `admin_chat_id` em `/opt/afiliados-monitor-v2/automation/config.yaml`.

O ciclo desenhado pelo dono: Frente 4 não acha → avisa no privado → ele pesquisa e lança pela
**Frente 3** → produto vai ao grupo → entra no banco automaticamente.

### 5.2 Capturar Shopee dos grupos — **decisão do dono, não fazer sem ordem**

`/opt/afiliados-monitor-v2/automation/config.yaml` linha 7: **`mode: ml`**. A Frente 1 sabe
processar Shopee (`extract_all_shopee_urls`, `follow_shopee_short_url`, modos `ml|shopee|both`),
mas está instruída a ignorar. Por isso só 4 produtos Shopee em 1.000 vindos dos grupos.

Trocar para `mode: both` capturaria Shopee dos grupos — **mas também faria a Frente 1 publicar
produtos Shopee no grupo do Telegram do dono**, mudando o conteúdo do canal, e exigiria
reiniciar a Frente 1. Não é necessário: a Frente 2 já traz ~46 Shopee/dia.

### 5.3 Higiene pendente (sem urgência)

- **`/var/log` com 6 GB**, journald com 2,8 GB sem teto. Sugerido:
  `journalctl --vacuum-size=500M` + `SystemMaxUse=500M` em `/etc/systemd/journald.conf`.
  Liberaria ~2,3 GB. **Não executado — pedir autorização.**
- Backup morto `automation/ml_cookies.json.bak-20260806-022714` (sessão inválida). Pode apagar.
- ~128 arquivos `.bak-*` de código antigo espalhados em `/opt/afiliados-monitor-v2/`.
- **Credenciais em texto puro** (o dono optou por **não rotacionar agora**):
  `searcher/services/searcher/auth_ml.py:14-15` (client id/secret do ML) e `ml_proxy` no
  `config.yaml` (usuário e senha do proxy). Ambas apareceram em saída de terminal durante a
  auditoria — considerar expostas.
- Contas `opencode-access` e `monitor-bot`, com sudo total: **o dono decidiu manter**.

---

## 6. Estado dos serviços e verificação rápida

```bash
# tudo de pé?
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 \
  'systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api'

# saúde + banco
curl -s http://34.29.27.155:8086/api/health | python -m json.tool

# busca (precisa da chave)
curl -s -X POST -H "X-API-Key: $MONITOR_API_KEY" -H 'Content-Type: application/json' \
  -d '{"query":"headset gamer","limit":5}' http://34.29.27.155:8086/api/produtos/buscar
```

Deploy de alteração no serviço:
```bash
scp -i ~/.ssh/id_opencode app.py busca.py catalogo.py adapters.py aviso.py \
    sergioskm_cle@34.29.27.155:/opt/blog-produtos-api/
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'sudo systemctl restart blog-produtos-api'
# e conferir que as outras três frentes seguem active
```

---

## 7. Documentos relacionados no repo

- `PLANO_ML_SHOPEE_MONITOR.md` — plano original (fases 0-2 concluídas; a fase 3 mudou de rumo
  quando se descobriu que o ML não tem busca por keyword utilizável).
- `docs/MONITOR_API_AUDITORIA.md` — auditoria da VM, assinaturas dos módulos, decisões do dono.
- `infra/blog-produtos-api/` — código do serviço versionado + README.

## 8. Fatos técnicos que custaram caro (não redescobrir)

1. **O ML não tem busca por palavra-chave utilizável nesta VM.** `/sites/MLB/search` → 403 (app
   não aprovada); `/ofertas?search=` → **ignora o termo** e devolve o feed genérico (duas queries
   diferentes retornam a mesma lista); `lista.mercadolivre.com.br` → devolve só o esqueleto da
   página. A Frente 2 não "pesquisa": ela **varre ofertas por categoria** (Informática, Games) e
   filtra por um vocabulário de 13 famílias.
2. **A Shopee usa a Open API oficial de afiliados** (GraphQL,
   `open-api.affiliate.shopee.com.br`, autenticada por `SHOPEE_APP_ID`/`SHOPEE_SECRET`). O campo
   **`offerLink` que já vem na busca é o link de afiliado** — chamar `generate_short_link` depois
   é requisição desperdiçada. Sem cookies, sem sessão que caia.
3. **Os módulos do monitor são stateful**: exigem `configure()` antes de usar (padrão em
   `engine.py:312/389/613`). Faltando `offers.configure`, a lista de user-agents fica vazia e
   todo fetch morre com `Cannot choose from an empty sequence` — parece bloqueio do ML, mas é
   bootstrap faltando.
4. **Os segredos não estão no `config.yaml`** (lá estão vazios) — vêm de
   `/opt/afiliados-monitor-v2/searcher/.env`, carregado via `EnvironmentFile` pelo
   `searcher-ml.service`. `adapters.py` lê **seletivamente** só as chaves que precisa;
   `TELEGRAM_BOT_TOKEN` e `PANEL_TOKEN` ficam de fora de propósito.
5. **`generate_affiliate_link` do ML devolve string**, e em caso de falha devolve **a própria
   URL do produto**. Sucesso é, e só é, conter `meli.la`. Tratar o retorno como sucesso sem
   checar isso publica link sem comissão.
6. **Rate limit no lugar certo:** 1 req/s **por marketplace** fica em `adapters.py`, em volta das
   chamadas de saída. O limite de `app.py` (5 req/s, burst 20) é só anti-abuso da porta HTTP.
   Inverter os dois estrangula o serviço sem proteger ninguém — aconteceu no gate da Fase 1.
7. **A Frente 2 tem janela de horário** (`active_start: 07:00`, `active_end: 23:59`, BRT). Ficar
   silenciosa fora disso é o comportamento correto, não falha. A Frente 1 não tem janela: é
   reativa aos grupos, e à noite eles esfriam.
