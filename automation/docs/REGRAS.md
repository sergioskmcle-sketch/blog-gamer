# Regras de Funcionamento

## Pipeline de Geração de Artigo

```
pick_topic() → scrape_ml_products() → generate_affiliate_link() → call_groq() → git_push() → download-images.mjs
```

### 1. pick_topic()
- Lê `state.json` para saber qual categoria e slug foram usados por último
- Avança para a próxima categoria no ciclo (noticia → review → guia → lista → promocao)
- Salva o índice no `state.json`

### 2. scrape_ml_products()
- A query pode ser separada por vírgulas para buscar múltiplas subcategorias (ex: `headset gamer,teclado mecanico gamer,mouse gamer`)
- Acessa `lista.mercadolivre.com.br/{query}` **com cookies desde a primeira requisição**
- Extrai IDs de 8 dígitos (`MLB\d{8}`) do HTML — IDs de 10+ dígitos **não** funcionam
- Visita cada `/p/{MLB_ID}` com uma nova Session (mas mesmos cookies)
- Extrai dados via:
  1. JSON-LD (`<script type="application/ld+json">`) — nome, preço, imagem
  2. `__INITIAL_STATE__` (fallback)
  3. Regex `andes-money-amount__fraction` (fallback preço)
  4. `<meta property="og:image">` (fallback imagem)
  5. `<title>` (fallback nome)
- Ordena produtos do mais barato para o mais caro
- Retorna no máximo 8 produtos

### 3. generate_affiliate_link()
- Usa `ml_affiliate.py` para gerar links curtos `meli.la/xxxx`
- Requer cookie `_csrf` válido em `ml_cookies.json`
- Se falhar, usa URL original do produto com `?tag=sergioskm`

### 4. call_groq()
- Monta prompt com lista de produtos (título, preço, imagem, link de afiliado)
- Regras do prompt:
  - Mínimo 1200 palavras
  - ✅ para 3 benefícios, ❌ para 2 pontos negativos por produto
  - Ordenar do mais barato para o mais caro
  - Tabela comparativa no final
  - Links de afiliado exatos (sem modificar)
  - Frontmatter YAML obrigatório
- Usa modelo `llama-3.3-70b-versatile`
- Retries com backoff em caso de rate limit (429)

### 5. git_push()
- Configura remote com `GITHUB_TOKEN`
- Commit + push para `origin main`

### 6. download-images.mjs (pós-geração)
- Lê todos os artigos em `src/content/artigos/`
- Baixa imagens de `http2.mlstatic.com` para `public/images/produtos/`
- Substitui URLs CDN por paths locais (`/blog-gamer/images/produtos/...`)
- Se CDN bloquear (retorna GIF placeholder), segue link de afiliado e extrai `og:image`
- Commit + push das imagens

## Regras de Scraping

### Cookies
- **OBRIGATÓRIO**: Session com cookies ANTES do primeiro GET
- Carregar de `ml_cookies.json` no início de cada função que acessa ML
- Usar mesmos cookies para listing + product pages + affiliate API
- NÃO usar cookies para Tavily ou Google (sites externos)

### User-Agents
- Chrome 130/131 (`Mozilla/5.0 ... Chrome/130.0.0.0 Safari/537.36`)
- Rotacionar aleatoriamente entre os disponíveis

### Headers
- `Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7`
- `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8`
- `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site` (browser-like)

### Rate Limit
- 2-4 segundos entre requisições de produto
- 3-6 segundos entre chamadas de API
- Backoff de 30s em rate limit da Groq

## IDs de Produto
- Produtos do ML têm IDs de **8 dígitos** (ex: `MLB20878236`)
- IDs de 10+ dígitos no listing page **não são** product IDs
- Usar regex `MLB\d{8}\b` para extrair IDs válidos

## Ciclo de Categorias
```
noticia → review → guia → lista → promocao → (volta)
```
- Controlado por `last_category_index` em `state.json`
- Um artigo por dia (verificado por `last_article_date`)
- Se já gerou hoje, pula

## Agendamento (VM)
- Systemd service: `blog-gamer.service`
- Executa `scheduler.py` que chama:
  1. `generate_article.py`
  2. `download-images.mjs`
  3. Git commit + push de imagens
- Horário: 10:00 UTC diariamente
- Logs: `logs/geracao.log`

## Imagens
- ML CDN (`http2.mlstatic.com`) bloqueia `.webp` com GIF placeholder (52KB, header `47 49 46 38 39 61`)
- Solução: baixar localmente e servir do GitHub Pages
- Fallback: seguir link de afiliado → extrair `og:image` da página do produto
- Path local: `/blog-gamer/images/produtos/{filename}`
