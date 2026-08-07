# Troubleshooting

## ⛔ Sessão do ML cai com 401 / Frente 1 para de postar

**Sintoma:** `generate_affiliate_link` devolve a própria URL do produto em vez de `meli.la`;
`reason=auth_error`; a Frente 1 do monitor para de publicar produtos do ML no grupo; chega no
Telegram do dono o alerta **"Cookies do Mercado Livre expiraram"**.

**Causa mais provável: um segundo programa usou a sessão do ML.** A sessão é compartilhada pelas
Frentes 1 e 2 e **não suporta outro consumidor**. O ML interpreta o padrão como conta
comprometida e invalida a sessão.

**Ocorrido em 06/08/2026:** testes de geração de link a partir do serviço do blog (processos
soltos, várias chamadas em sequência, algumas em URLs que nem eram de produto) derrubaram a
sessão. Linha do tempo: último post normal 23:09 → sessão cai ~23:12 → Frente 1 acumula 3 falhas,
**para de postar** e alerta às 23:18 → cookies renovados 23:27 → normalizado.

**Por que o dano foi contido:** a Frente 1 se recusa a postar sem comissão (comentário "Problema
5" no código). Ela segura o produto e avisa, em vez de publicar link sem afiliação.

**Correção:**
1. O dono exporta cookies novos de um navegador **logado** no ML.
2. Instalar **sempre** pelo script (ele valida a sessão, faz backup e acerta permissões):
   ```bash
   sudo /opt/afiliados-monitor-v2/instalar_cookies_ml.sh /tmp/cookies_novos.json
   ```
3. **Não precisa reiniciar nada** — as frentes releem o arquivo a cada chamada.
4. Verificar (uma única chamada, não repetir em série):
   ```bash
   curl -s http://34.29.27.155:8086/api/health | python -m json.tool
   ```

**Prevenção (regra permanente):** o blog **nunca** gera link de afiliado do ML. Produtos do ML
chegam pelo banco da Frente 4, com o link já gerado pelas frentes. A trava `BLOG_ML_ENABLED` em
`adapters.py` fica **desligada**.

---

## Frente 1 ou 2 "pararam" (mas provavelmente não pararam)

Antes de investigar, verifique o esperado:

| Frente | Comportamento normal |
|---|---|
| **Frente 2** (`searcher-ml`) | Só opera **07:00–23:59 (Brasília)**. Silêncio fora disso é correto, não falha. |
| **Frente 1** (`monitor-bot-ml`) | Não tem janela: é **reativa** aos grupos. De madrugada os grupos esfriam e intervalos de 1h são normais. |

Como confirmar que estão vivas:
```bash
# processos ativos
systemctl is-active monitor-bot-ml searcher-ml searcher-panel blog-produtos-api

# a Frente 1 está lendo os grupos? (arquivo atualizado nos últimos minutos = sim)
stat -c "%y %n" /opt/afiliados-monitor-v2/automation/state/last_seen.json

# houve alerta de cookie?
python3 -c "import json;print(json.load(open('/opt/afiliados-monitor-v2/automation/state/alerts.json')).get('ml_cookies_expirados'))"
```

⚠️ **Atenção ao ler `posted.json`:** os registros da **Frente 1** têm `source_group_name`
preenchido; os da **Frente 3** (post manual) vêm com `None`. Confundir os dois leva a concluir
que a Frente 1 está funcionando quando não está.

---

## Bot do Telegram para de detectar produtos nos grupos, sem erro no log

**Causa:** alguém chamou `getUpdates` com o token do bot. O Telegram entrega cada atualização
**uma única vez por token** — o segundo processo rouba as mensagens do bot, silenciosamente.

**Correção:** parar o processo que está escutando. O serviço do blog só pode usar `sendMessage`.
Se for preciso receber mensagens, criar um bot separado no BotFather.

---

## Aviso do blog no Telegram falha com "chat not found"

**Causa:** o Telegram não permite que um bot inicie conversa. O dono precisa mandar `/start` para
o `@MonitorDeGruposBot` uma vez.

**Correção:** abrir o Telegram, procurar o bot, enviar `/start`. Depois testar `/api/faltantes`.

---

## Busca no ML devolve produtos sem relação com a consulta

**Não é bug — é limitação conhecida.** O ML **ignora o parâmetro `?search=`** na página de
ofertas e devolve o feed genérico (duas consultas diferentes retornam a mesma lista). Também:
`/sites/MLB/search` responde 403 e `lista.mercadolivre.com.br` devolve só o esqueleto da página.

**Não existe busca por palavra-chave utilizável no ML nesta VM.** A Frente 2 não pesquisa: ela
varre ofertas **por categoria** e filtra por vocabulário. O blog obtém produtos do ML apenas pelo
banco da Frente 4.

---

## `Cannot choose from an empty sequence` ao usar módulos do monitor

**Causa:** faltou chamar `configure()` antes de usar o módulo. Sem `offers.configure`, a lista de
user-agents fica vazia e todo download falha. **Parece bloqueio do ML, mas é bootstrap faltando.**

**Correção:** replicar a sequência de `engine.py` (linhas 312, 389 e 613). Já implementado em
`adapters.py:_bootstrap_ml()`.

---

## Disco cheio na VM do monitor (perda de acesso SSH)

**O risco real não é o banco da Frente 4** (0,57 MB, com teto de 200 MB e parada automática
abaixo de 3 GB livres). É **`/var/log`, com 6 GB**, sendo 2,8 GB de journald sem limite.

```bash
df -h /
journalctl --disk-usage
sudo journalctl --vacuum-size=500M          # libera ~2,3 GB
# depois: SystemMaxUse=500M em /etc/systemd/journald.conf
```

---

## ML Listing redireciona para account-verification

**Problema**: `lista.mercadolivre.com.br/{query}` retorna página de verificação de conta.

**Causa**: Session sem cookies ou cookies inválidos.

**Solução**: Carregar cookies de `ml_cookies.json` ANTES do primeiro GET:
```python
s = requests.Session()
s.cookies.update(cc)  # cc = cookies carregados
s.headers.update({...})
r = s.get(url, timeout=20)
```

## Tavily não encontra produtos do ML

**Problema**: Tavily retorna 0 URLs de produto do Mercado Livre.

**Causa**: ML product pages têm `noindex` e não aparecem em buscadores.

**Solução**: Usar a listing page do ML diretamente (`lista.mercadolivre.com.br`). Tavily é apenas fallback.

## /p/MLBXXXXXX retorna 404

**Problema**: Acessar `https://www.mercadolivre.com.br/p/MLB5613164752` retorna 404.

**Causa**: O ID extraído tem 10+ dígitos — não é um product ID, é um search result ID.

**Solução**: Usar regex `MLB\d{8}\b` (8 dígitos) em vez de `MLB\d{9,}`. Product IDs têm **8 dígitos** (ex: `MLB20878236`).

## Imagem .webp bloqueada (GIF placeholder)

**Problema**: ML CDN retorna uma imagem GIF de 52KB (header `47 49 46 38 39 61`) no lugar da imagem real.

**Causa**: ML bloqueia hotlinking de `.webp`.

**Solução**: O `download-images.mjs` detecta o bloqueio (tamanho ≈ 52KB, header GIF89a), segue o link de afiliado e extrai a `og:image` da página do produto.

## Preço não extraído (price = 0.0)

**Problema**: JSON-LD retorna price = 0.

**Causa**: O preço pode estar em formato diferente no JSON-LD (ex: `offers` é uma lista, ou price está em `priceSpecification`).

**Solução**: O pipeline tenta, em ordem:
1. JSON-LD: `offers.price` → `offers.priceSpecification.price`
2. `__INITIAL_STATE__`: `item.price` → `item.base_price`
3. Regex HTML: `andes-money-amount__fraction`
4. Meta tag: `<meta itemprop="price">`

## Link de afiliado não é meli.la curto

**Problema**: O link gerado é `https://www.mercadolivre.com.br/p/MLBXXXXXX?tag=sergioskm` em vez de `https://meli.la/xxxx`.

**Causa**: API de afiliados falhou — cookie `_csrf` ausente ou URL do produto incorreta.

**Solução**:
1. Verificar se `ml_cookies.json` contém `_csrf`
2. Usar a URL original do produto (não a `/p/MLBXXXXXX` encurtada)
3. Se persistir, renovar cookies (exportar do navegador)

## Artigo com produtos inventados

**Problema**: O artigo contém produtos para categorias que não foram fornecidas (ex: teclados, mouses sem dados reais).

**Causa**: O Groq recebeu apenas headsets na lista de produtos, mas o hint pedia "teclado, mouse, monitor". A IA inventou para completar.

**Solução**: A query de scraping deve cobrir todas as subcategorias, separadas por vírgula (ex: `headset gamer,teclado mecanico gamer,mouse gamer`).

## Scheduler não roda

**Problema**: O serviço não gerou artigo no horário agendado.

**Diagnóstico**:
```bash
sudo systemctl status blog-gamer.service
tail -50 logs/geracao.log
```

**Solução**:
```bash
sudo systemctl restart blog-gamer.service
```

## .env não encontrado

**Problema**: `generate_article.py` falha com "GROQ_API_KEY não configurada".

**Solução**: Verificar se `.env` existe no diretório de automação:
```bash
ls -la /home/sergioskm_cle-automation/.env
```
Se não existir, copiar do backup ou recriar com as chaves.

## Conflito no Git push

**Problema**: `git push` falha porque o remote foi alterado ou há conflito.

**Solução**:
```bash
cd /home/sergioskm_cle
git pull --rebase origin main
git push origin main
```

Em caso de conflito:
```bash
git stash
git pull origin main
git stash pop
# Resolver conflitos manualmente
git add -A
git commit -m "merge: resolucao de conflitos"
git push origin main
```

---

## Deploy não dispara automaticamente após o push do artigo

**Sintoma:** o `gerar-conteudo.yml` publica um artigo novo no `main`, mas o `deploy.yml` não roda
sozinho.

**Causa:** pushes feitos com o `GITHUB_TOKEN` do Actions **não disparam novos workflows** (regra
do GitHub, exceto `workflow_dispatch`). Por isso o `gerar-conteudo.yml` termina com o passo
"Disparar deploy" (`gh workflow run deploy.yml`), que é o caminho confiável — não o `on: push`.

**Regra prática:** todo run do `gerar-conteudo.yml` que muda arquivos **deve** gerar um run de
deploy em seguida (dado pelo próprio pipeline). Se você fez push manual de artigo/merge, dispare o
deploy na mão:
```bash
gh workflow run deploy.yml --ref main
```

---

## 06/08/2026 — Pane global do GitHub Actions (webhooks throttled)

**Sintoma:** runs ficam em `queued` por muitos minutos; push ao `main` não cria run de deploy;
deploys falham com `Service Unavailable`.

**Causa:** incidente global do GitHub (*Incident with Actions*), com webhooks processando ~15%
dos eventos e runners atribuídos a jobs inválidos. Afetou Actions e Pages.

**O que funcionou:** (1) disparar `workflow_dispatch` manual em vez de confiar no push;
(2) o `deploy.yml` usa `concurrency` que **não cancela** run em andamento, então run antigo que
falhou é irrelevante se o último passou; (3) o `actions/checkout` resolve o `main` **no momento
em que o job roda**, então um deploy disparado depois já inclui o artigo novo.
