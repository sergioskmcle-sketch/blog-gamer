# blog-produtos-api

Serviço que roda na VM **monitor-telegram** (`34.29.27.155`) e serve produtos com link de
afiliado (Shopee + Mercado Livre) para o pipeline do blog-gamer.

Estes arquivos são a **cópia versionada** do que está em `/opt/blog-produtos-api/` na VM.
Editar aqui não muda nada em produção — é preciso enviar (ver "Deploy").

- Plano geral: [`PLANO_ML_SHOPEE_MONITOR.md`](../../PLANO_ML_SHOPEE_MONITOR.md)
- Auditoria da VM: [`docs/MONITOR_API_AUDITORIA.md`](../../docs/MONITOR_API_AUDITORIA.md)

## Estado: Fase 2 concluída (2026-08-05)

Busca real na Shopee funcionando, individual e em lote, com cache de 30 min e link de afiliado
verificado ponta a ponta (o short link resolve com `utm_medium=affiliates`). O Mercado Livre
responde com `warning` e não quebra nada — chega na Fase 3, junto do pareamento cruzado.

| Arquivo | Papel |
|---|---|
| `app.py` | Rotas, auth por `X-API-Key`, rate limit de entrada, cache TTL 1800s |
| `busca.py` | Orquestra os marketplaces e monta o modelo de produto do blog |
| `adapters.py` | **Único** ponto de acoplamento com `/opt/afiliados-monitor-v2/`. Bootstrap `configure()`, throttle de saída e buscas |
| `blog-produtos-api.service` | Unit do systemd |

### Por que a Shopee não gera link

`shopee_api.search_products` só lista produtos **já no programa de afiliados**, e o campo
`offerLink` que vem na resposta já é o link de afiliado. Chamar `generate_short_link` depois
seria uma requisição a mais contra o rate limit, para obter o que já se tem.

A exceção é atribuição: o `offerLink` vem sem `subIds`, então a receita do blog e a do Telegram
aparecem juntas no painel da Shopee. Separar exige `generate_short_link(productLink,
sub_ids=['blog'])` — **uma chamada extra por produto**. Decisão em aberto (ver plano).

## Princípios que não podem ser quebrados

1. **Zero downtime.** Nunca editar nem reiniciar `monitor-bot-ml`, `searcher-ml` ou
   `searcher-panel`. Este serviço é separado, na porta 8086.
2. **Read-only no monitor.** `adapters.py` só lê config, `.env` e cookies de
   `/opt/afiliados-monitor-v2/`. Nunca escreve.
3. **Venv compartilhado, sem `pip`.** Usa `/opt/afiliados-monitor-v2/venv/bin/python` (já tem
   aiohttp 3.14.1). Instalar qualquer coisa nele arrisca a sessão do ML, que depende de uma
   versão específica do `curl_cffi`.
4. **Falha parcial não derruba nada.** Um marketplace quebrado vira `ready:false` no health;
   o outro segue servindo.

## Configuração

`/opt/blog-produtos-api/.env` (`chmod 600`, **não versionado**):
```
BLOG_API_KEY=<openssl rand -hex 32>
```

Os segredos dos marketplaces **não** são duplicados aqui: `adapters.py` lê seletivamente
`SHOPEE_APP_ID`, `SHOPEE_SECRET` e `ML_COOKIES_PATH` de
`/opt/afiliados-monitor-v2/searcher/.env` (é de lá que o `searcher-ml.service` os tira; no
`config.yaml` esses campos estão vazios). `TELEGRAM_BOT_TOKEN` e `PANEL_TOKEN` moram no mesmo
arquivo e são deliberadamente ignorados.

## Deploy

```bash
scp -i ~/.ssh/id_opencode app.py adapters.py sergioskm_cle@34.29.27.155:/opt/blog-produtos-api/
ssh -i ~/.ssh/id_opencode sergioskm_cle@34.29.27.155 'sudo systemctl restart blog-produtos-api'
```

Depois de qualquer restart, confirmar que os outros três serviços seguem de pé:
```bash
systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api
```

## Smoke

```bash
KEY=$(sudo sed -n 's/^BLOG_API_KEY=//p' /opt/blog-produtos-api/.env)
B=http://127.0.0.1:8086

curl -s $B/api/health | python3 -m json.tool                       # 200, ready nos dois
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/produtos/buscar   # 401
curl -s -X POST -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
     -d '{"query":"ab"}' $B/api/produtos/buscar                    # 400
curl -s -X POST -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
     -d '{"query":"mouse gamer wireless","limit":5}' $B/api/produtos/buscar   # 501 (Fase 1)
```

## Nota de projeto: onde mora o rate limit

O limite em `app.py` (5 req/s, burst 20) é **anti-abuso da porta HTTP** e nada mais. O limite
que protege ML e Shopee (1 req/s por marketplace) vai em `busca.py`, em volta das chamadas de
saída, na Fase 2/3.

Trocar os dois de lugar faz o serviço se estrangular sozinho sem proteger ninguém — foi
exatamente o que aconteceu no primeiro gate da Fase 1, quando um limite de entrada de 1 req/s
fez uma requisição de validação legítima receber 429.
