# Tipos de Artigo

## Resumo

| Tipo | Modo | Conteúdo | Imagens | Produtos |
|------|------|----------|---------|----------|
| **Informativo puro** | `informativo` | Conteúdo editorial (FAQ, lista, curiosidades) | RAWG inline (`<img class="article-game-img">`) | ❌ Nenhum |
| **Produto — Melhores** | `melhores` | Product cards + tabela comparativa | ML thumbnails | ✅ Afiliados, ordenado do MAIS CARO para o mais barato |
| **Produto — Custo-Benefício** | `custo-beneficio` | Product cards + tabela comparativa | ML thumbnails | ✅ Afiliados, ordenado do MAIS BARATO para o mais caro |
| **Misto** | `misto` | Conteúdo informativo + seção "Produtos Recomendados" no final | RAWG inline no conteúdo + ML thumbnails nos cards | ✅ Afiliados apenas na seção final |

## Detalhamento

### 1. Informativo Puro (`mode: informativo`)

- **Para que serve**: rankings, curiosidades, história dos games, listas de jogos, notícias
- **Conteúdo**: texto puro com seções, FAQ, conclusão, fontes
- **Imagens**: cada jogo citado em **negrito** recebe automaticamente um `<img class="article-game-img">` via RAWG API
- **Produtos**: NUNCA incluir produtos, preços ou links de afiliado
- **Frontmatter**: `affiliate: false`

### 2. Produto — Melhores (`mode: melhores`)

- **Para que serve**: reviews de produtos gamers, comparativos de hardware
- **Conteúdo**: product cards HTML com prós/contras, tabela comparativa, FAQ
- **Ordem de exibição**: do MAIS CARO para o mais barato (qualidade acima de preço)
- **Produtos**: todos os produtos com links de afiliado
- **Frontmatter**: `affiliate: true`

### 3. Produto — Custo-Benefício (`mode: custo-beneficio`)

- **Para que serve**: guias de compra econômicos, "melhores pelo menor preço"
- **Conteúdo**: product cards HTML com prós/contras, tabela comparativa, FAQ
- **Ordem de exibição**: do MAIS BARATO para o mais caro (economia primeiro)
- **Produtos**: todos os produtos com links de afiliado
- **Frontmatter**: `affiliate: true`

### 4. Misto (`mode: misto`)

- **Para que serve**: análises completas de jogos/eventos que naturalmente geram recomendações de produtos (ex: "tudo sobre GTA 6", "vale a pena comprar o PS5 Pro?")
- **Conteúdo**: 
  - Parte 1: conteúdo informativo normal (com imagens RAWG inline via **negrito**)
  - Parte 2: seção "## Produtos Recomendados" com product cards HTML + links de afiliado
- **Produtos**: apenas na seção final, não misturados no conteúdo editorial
- **Frontmatter**: `affiliate: true`

## Regras de Imagens

- Artigos `informativo` e `misto`: o script `generate_article.py` escaneia o corpo em busca de `**NomeDoJogo**` e insere `<img class="article-game-img">` automaticamente via RAWG API
- Artigos `melhores` e `custo-beneficio`: as imagens vêm dos thumbnails do Mercado Livre (já inclusas nos product cards)
- A classe CSS `.article-game-img` está definida em `src/pages/blog/[...slug].astro`

## Como o Script Decide

O `generate_article.py` usa `TOPIC_SEEDS` (linha 106) para selecionar o tema do dia. Cada seed já tem `mode` definido:

- `mode: informativo` → tópicos editoriais puros
- `mode: melhores` → produtos premium
- `mode: custo-beneficio` → produtos econômicos
- `mode: misto` → análises com recomendações

O scheduler (`scheduler.py`) roda `main()` uma vez por dia, que picka o próximo seed da lista circular.
