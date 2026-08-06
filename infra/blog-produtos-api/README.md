# blog-produtos-api

Serviço que roda na VM **monitor-telegram** (`34.29.27.155`) e serve produtos com link de
afiliado (Shopee + Mercado Livre) para o pipeline do blog-gamer.

Estes arquivos são a **cópia versionada** do que está em `/opt/blog-produtos-api/` na VM.
Editar aqui não muda nada em produção — é preciso enviar (ver "Deploy").

- **Instruções de execução: [`FRENTE_4_RETOMADA.md`](../../FRENTE_4_RETOMADA.md)**
- Auditoria da VM: [`docs/MONITOR_API_AUDITORIA.md`](../../docs/MONITOR_API_AUDITORIA.md)
- Plano original (histórico): [`PLANO_ML_SHOPEE_MONITOR.md`](../../PLANO_ML_SHOPEE_MONITOR.md)

## Estado: Frente 4 no ar (2026-08-06)

Serviço rodando, versão `2.0.0-frente4`. Serve produtos **com link de afiliado** para o blog a
partir de um banco alimentado pelas Frentes 1/2/3 do monitor. **Zero requisições ao Mercado
Livre.**

| Rota | Estado |
|---|---|
| `GET /api/health` | ✅ marketplaces + estado do banco |
| `POST /api/produtos/buscar` | ✅ |
| `POST /api/produtos/buscar-lote` | ✅ até 5 consultas |
| `GET /api/catalogo` | ✅ estatísticas |
| `POST /api/afiliar` | ⚠️ só Shopee — **ML travado de propósito** |
| `POST /api/faltantes` | ⚠️ falta o dono mandar `/start` ao `@MonitorDeGruposBot` |

Banco: 792 produtos (646 ML + 146 Shopee), 0,57 MB, coletor a cada 10 min, retenção de 30 dias.

⛔ **A trava `BLOG_ML_ENABLED` em `adapters.py` deve permanecer desligada.** Ativá-la faz este
serviço usar a sessão do ML — que é compartilhada com as Frentes 1 e 2 e não suporta um segundo
consumidor. Em 06/08/2026 isso derrubou a sessão e parou a Frente 1 por ~1h.

| Arquivo | Papel |
|---|---|
| `app.py` | Rotas, auth por `X-API-Key`, rate limit de entrada, cache TTL 1800s, tarefa do coletor |
| `busca.py` | Orquestra os marketplaces e monta o modelo de produto do blog |
| `catalogo.py` | Banco SQLite: coleta, busca, retenção de 30 dias, travas de disco |
| `aviso.py` | Mensagem no Telegram — **só envia, nunca chama `getUpdates`** |
| `adapters.py` | **Único** ponto de acoplamento com `/opt/afiliados-monitor-v2/`. Bootstrap `configure()`, throttle de saída e buscas |
| `blog-produtos-api.service` | Unit do systemd |

## O banco (coração da Frente 4)

As Frentes 1/2/3 gravam o que publicam, mas cortam em `posted[-1000:]` — a Frente 1 descarta
~150 produtos/dia. O coletor lê os dois `posted.json` a cada 10 min (**leitura pura**) e copia o
que é novo antes do descarte.

Travas de crescimento em `catalogo.py`: retenção de 30 dias, teto de 200 MB e parada automática
se o disco livre cair abaixo de 3 GB. Guarda só texto e URL de imagem, **nunca a imagem**.
Disco cheio nesta VM significa perder o acesso SSH.

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
5. **Nunca chamar `getUpdates`** do Telegram: roubaria as mensagens do bot da Frente 1.
6. **Nunca usar a sessão do ML** a partir daqui (trava `BLOG_ML_ENABLED`, desligada).

## Configuração

`/opt/blog-produtos-api/.env` (`chmod 600`, **não versionado**):
```
BLOG_API_KEY=<openssl rand -hex 32>
```

Os segredos dos marketplaces **não** são duplicados aqui: `adapters.py` lê seletivamente
`SHOPEE_APP_ID`, `SHOPEE_SECRET`, `ML_COOKIES_PATH`, `ML_CLIENT_ID` e `ML_CLIENT_SECRET` de
`/opt/afiliados-monitor-v2/searcher/.env` (é de lá que o `searcher-ml.service` os tira; no
`config.yaml` esses campos estão vazios). `TELEGRAM_BOT_TOKEN` e `PANEL_TOKEN` moram no mesmo
arquivo e são deliberadamente ignorados.

## Deploy

```bash
scp -i ~/.ssh/id_opencode app.py busca.py catalogo.py adapters.py aviso.py     sergioskm_cle@34.29.27.155:/opt/blog-produtos-api/
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
     -d '{"query":"headset gamer","limit":5}' $B/api/produtos/buscar   # 200 com produtos
curl -s -H "X-API-Key: $KEY" $B/api/catalogo | python3 -m json.tool   # estado do banco
```

## Nota de projeto: onde mora o rate limit

O limite em `app.py` (5 req/s, burst 20) é **anti-abuso da porta HTTP** e nada mais. O limite
que protege ML e Shopee (1 req/s por marketplace) está em **`adapters.py`** (`_throttle`), em
volta das chamadas de saída.

Trocar os dois de lugar faz o serviço se estrangular sozinho sem proteger ninguém — foi
exatamente o que aconteceu no primeiro gate da Fase 1, quando um limite de entrada de 1 req/s
fez uma requisição de validação legítima receber 429.
