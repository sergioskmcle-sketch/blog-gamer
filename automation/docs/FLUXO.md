# Fluxo de Geração de Artigo

## Diagrama do Pipeline

```
scheduler.py (10:00 UTC)
    │
    ├── 1. generate_article.py
    │       │
    │       ├── load_state() → state.json
    │       │
    │       ├── pick_topic()
    │       │   └── Avança índice: last_category_index + 1
    │       │
    │       ├── Tavily search (topic.hint)
    │       │   └── 5 resultados para fontes do artigo
    │       │
    │       ├── scrape_ml_products(topic.ml_query)
    │       │   │
    │       │   ├── Carrega cookies (ml_cookies.json)
    │       │   ├── Session com cookies + headers
    │       │   ├── GET lista.mercadolivre.com.br/{query}
    │       │   │   └── Regex: MLB\d{8} → 50-500 IDs
    │       │   ├── Para cada ID (até 16):
    │       │   │   ├── GET /p/MLBXXXXXX (nova Session, mesmos cookies)
    │       │   │   ├── JSON-LD → title, price, image
    │       │   │   └── Fallbacks se necessário
    │       │   └── Ordena por price → retorna top 8
    │       │
    │       ├── generate_affiliate_link() para cada produto
    │       │   └── POST /gz/affiliates/v1 → meli.la/xxxxx
    │       │
    │       ├── call_groq() com prompt + produtos
    │       │   ├── system_prompt (regras, frontmatter)
    │       │   ├── user_prompt (produtos, hint, fontes)
    │       │   └── Retorna Markdown com frontmatter YAML
    │       │
    │       ├── parse_frontmatter() + validate_article()
    │       │
    │       ├── Salva em src/content/artigos/{slug}.md
    │       │
    │       └── git_push() → commit + push
    │
    ├── 2. download-images.mjs
    │       │
    │       ├── Lê todos os artigos
    │       ├── Para cada imagem CDN:
    │       │   ├── Baixa para public/images/produtos/
    │       │   └── Se bloqueado (GIF): segue link → extrai og:image
    │       └── Substitui URLs CDN por /blog-gamer/images/produtos/...
    │
    └── 3. Git commit + push das imagens
```

## Exemplo de Log Comentado

```
Tema escolhido: guia - melhores headsets gamers, teclado mecanico, mouse gamer, monitor, cadeira
  ↑ pick_topic() encontrou categoria 'guia', hint com 5 subcategorias

Tavily: 5 resultados
  ↑ 5 links de blog para usar como fontes no artigo

Scraping ML: headset gamer,teclado mecanico gamer,mouse gamer,monitor gamer,cadeira gamer
  ↑ ml_query com 5 sub-queries separadas por vírgula

IDs unicos: 223
  ↑ Soma de IDs de 8 dígitos encontrados nas listing pages

Visitando 16 produtos...
  ↑ Processando até 16 product pages (para garantir 8 válidos)

Produtos: 8 (by price)
  ↑ 8 produtos extraídos com sucesso, ordenados por preço

Gerando links de afiliado...
  ... -> https://meli.la/2DZN4JR
  ↑ Link curto gerado via API de afiliados

Chamando Groq...
  ↑ Enviando prompt com 8 produtos para geração do artigo

Artigo salvo em: /home/.../artigos/melhores-periféricos-para-gamers-uma-análise-completa.md
  ↑ Markdown salvo

Artigo ... commitado e enviado com sucesso!
  ↑ Git push concluído

Concluido!
```

## Estados do state.json

```
Antes da geração:
  {"last_category_index": 1, "last_article_date": null, "last_slug": null}

Após geração bem-sucedida:
  {"last_category_index": 2, "last_article_date": "2026-07-02", "last_slug": "melhores-periféricos-para-gamers-uma-análise-completa"}

Se executar de novo no mesmo dia:
  → "Artigo ja gerado hoje, pulando" (não modifica state)
```

## Fluxo de Imagens

```
Artigo usa: https://http2.mlstatic.com/D_NQ_NP_698387-MLA112152526650_062026-O.webp
                        ↓
download-images.mjs tenta baixar
                        ↓
        ┌─── HTTP 200 + não é GIF? ───→ Salva na pasta
        │
        └─── HTTP 200 + é GIF (52KB)? ─→ Segue link de afiliado
                    ↓
            Extrai <meta property="og:image"> da página do produto
                    ↓
            Salva JPG na pasta
                        ↓
Artigo atualizado: /blog-gamer/images/produtos/D_NQ_NP_698387-...webp
```

## Watchdog e Heartbeat

```
scheduler.py (loop 24/7)
    │
    ├── A cada 60s: escreve timestamp em heartbeat.txt
    ├── Se geracao pendente: executa generate_article.py
    │
    └── Se scheduler travar/congelar:
            │
            ▼
heartbeat-watchdog.timer (a cada 5 min)
    │
    ├── Lê heartbeat.txt
    ├── heartbeat.txt existe?
    │   ├── NÃO → Service acabou de iniciar (<120s)?
    │   │   ├── SIM → Aguarda, não faz nada
    │   │   └── NÃO → systemctl restart blog-gamer.service
    │   │
    │   └── SIM → Há quanto tempo?
    │       ├── <300s → OK, tudo normal
    │       ├── >300s → systemctl restart blog-gamer.service
    │       └── >600s → Ping 35.237.81.192 + restart
    │
    └── Fim

SSH Keepalive
    │
    ├── Servidor (VM): ClientAliveInterval 60 / ClientAliveCountMax 3
    │   └── sshd envia keepalive a cada 60s, tolera 3 falhas
    │
    └── Cliente (PC local): ServerAliveInterval 60 / ServerAliveCountMax 3
        └── conexão SSH nunca "trava" por idle
```
