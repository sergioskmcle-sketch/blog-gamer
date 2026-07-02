# Troubleshooting

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
ls -la /home/sergioskm_cle/blog-gamer-automation/.env
```
Se não existir, copiar do backup ou recriar com as chaves.

## Conflito no Git push

**Problema**: `git push` falha porque o remote foi alterado ou há conflito.

**Solução**:
```bash
cd /home/sergioskm_cle/blog-gamer
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
