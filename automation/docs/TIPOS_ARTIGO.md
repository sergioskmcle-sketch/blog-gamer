> 📌 **Nota (06/08/2026):** este é o **único** arquivo com este conteúdo — não existe cópia em
> `docs/`. Os demais arquivos de `automation/docs/` são duplicatas legadas, mas **este não é**.
>
> Atenção ao contexto: os arquivos vizinhos descrevem o pipeline **Python na VM**, que está
> desativado. O pipeline real hoje é o **GitHub Actions** (`scripts/gerar-artigo.mjs`).
> Trabalho em andamento: [`FRENTE_4_RETOMADA.md`](../../FRENTE_4_RETOMADA.md).
# Tipos de Artigo

## Resumo

| Tipo | Modo | Conteúdo | Imagens | Produtos |
|------|------|----------|---------|----------|
| **Informativo (com produtos)** | `informativo` | Conteúdo editorial (FAQ, lista, curiosidades) + seção "Produtos Recomendados" no final | RAWG inline (`<img class="article-game-img">`) | ✅ Afiliados apenas na seção final (se encontrar produtos) |
| **Informativo puro** | `informativo` | Conteúdo editorial (FAQ, lista, curiosidades) | RAWG inline (`<img class="article-game-img">`) | ❌ Nenhum (fallback quando ML não encontra produtos) |
| **Produto — Melhores** | `melhores` | ## Tópico → Imagem → Texto → Botão + tabela comparativa | Fotos reais do produto (`<img class="article-game-img">`) | ✅ Afiliados, ordenado do MAIS CARO para o mais barato |
| **Produto — Custo-Benefício** | `custo-beneficio` | ## Tópico → Imagem → Texto → Botão + tabela comparativa | Fotos reais do produto (`<img class="article-game-img">`) | ✅ Afiliados, ordenado do MAIS BARATO para o mais caro |
| **Misto** | `misto` | Conteúdo informativo + seção "Produtos Recomendados" no final | RAWG inline no conteúdo + fotos reais nos tópicos de produto | ✅ Afiliados apenas na seção final |

## Detalhamento

### 1. Informativo (`mode: informativo`)

- **Para que serve**: rankings, curiosidades, história dos games, listas de jogos, notícias
- **Conteúdo**: texto puro com seções, FAQ, conclusão, fontes
- **Imagens**: cada jogo citado em **negrito** recebe automaticamente um `<img class="article-game-img">` via RAWG API
- **Produtos**: se o Mercado Livre retornar produtos para `ml_query`, o artigo ganha a seção final "## Produtos Recomendados" com estrutura `## Nome → Imagem → Texto → Botão afiliado` (`affiliate: true`). Se não houver produtos, cai para informativo puro (`affiliate: false`)
- **Frontmatter**: `affiliate: true` (com produtos) ou `affiliate: false` (sem produtos)

### 2. Produto — Melhores (`mode: melhores`)

- **Para que serve**: reviews de produtos gamers, comparativos de hardware
- **Conteúdo**: cada produto segue a estrutura `## Nome → Imagem → Texto → Botão afiliado`, tabela comparativa, FAQ
- **Ordem de exibição**: do MAIS CARO para o mais barato (qualidade acima de preço)
- **Imagens**: fotos REAIS do produto (nunca screenshots de jogos)
- **Botão**: HTML simples `<a class="product-btn">`, sem `<div class="product-card">`
- **Frontmatter**: `affiliate: true`

### 3. Produto — Custo-Benefício (`mode: custo-beneficio`)

- **Para que serve**: guias de compra econômicos, "melhores pelo menor preço"
- **Conteúdo**: cada produto segue a estrutura `## Nome → Imagem → Texto → Botão afiliado`, tabela comparativa, FAQ
- **Ordem de exibição**: do MAIS BARATO para o mais caro (economia primeiro)
- **Imagens**: fotos REAIS do produto (nunca screenshots de jogos)
- **Botão**: HTML simples `<a class="product-btn">`, sem `<div class="product-card">`
- **Frontmatter**: `affiliate: true`

### 4. Misto (`mode: misto`)

- **Para que serve**: análises completas de jogos/eventos que naturalmente geram recomendações de produtos (ex: "tudo sobre GTA 6", "vale a pena comprar o PS5 Pro?")
- **Conteúdo**: 
  - Parte 1: conteúdo informativo normal (com imagens RAWG inline via **negrito**)
  - Parte 2: seção "## Produtos Recomendados" com estrutura `## Nome → Imagem → Texto → Botão afiliado`
- **Produtos**: apenas na seção final, não misturados no conteúdo editorial
- **Frontmatter**: `affiliate: true`

## Regras de Imagens

- Artigos `informativo` e `misto`: o script `generate_article.py` escaneia o corpo em busca de `**NomeDoJogo**` e insere `<img class="article-game-img">` automaticamente via RAWG API
- Artigos `melhores` e `custo-beneficio`: imagens são fotos REAIS do produto, inseridas ANTES do texto que descreve o produto
- A classe CSS `.article-game-img` está definida em `src/pages/blog/[...slug].astro`
- CSS usa `object-fit: contain` (formato natural da imagem, sem corte)
- Imagens devem ser de produto real (headset, teclado, etc.), nunca screenshots de jogos

## Como o Script Decide

O `generate_article.py` usa `TOPIC_SEEDS` (linha 106) para selecionar o tema do dia. Cada seed já tem `mode` definido:

- `mode: informativo` → tópicos editoriais (com produtos no final se o ML retornar resultados)
- `mode: melhores` → produtos premium
- `mode: custo-beneficio` → produtos econômicos
- `mode: misto` → análises com recomendações

O scheduler (`scheduler.py`) roda `main()` uma vez por dia, que picka o próximo seed da lista circular.
