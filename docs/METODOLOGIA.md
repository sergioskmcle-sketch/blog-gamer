# Metodologia de Ranking — "Top 5 / Melhores"

Este documento explica, de forma pública e auditável, como o Promo Gamer decide a
ordem e a nota dos produtos nos rankings (guias "Top 5", "Melhores …", "Melhor
custo-benefício" etc.). Ele dá credibilidade às listas: **nada aqui é palpite**.

## De onde vêm os produtos

Os produtos vêm do **Google Shopping via Serper** (geo Brasil, `gl=br`), que retorna
título, preço, imagem, link da loja e — quando a loja fornece — **nota média
(`rating`) e número de avaliações (`ratingCount`)**.

Antes de qualquer ranking, o pipeline:

1. Filtra itens que não são do tema do artigo (categoria única — ex.: um artigo de
   teclado **nunca** lista mouse).
2. Remove itens sem preço, links quebrados/duplicados e produtos "falsos" (acessórios
   genéricos, listagens, artigos de blog).
3. Ordena por relevância ao tópico (com o score composto abaixo).

## Os 5 critérios do score composto

Cada produto recebe um **score 0–1** (sinais ausentes valem **0**, nunca `NaN`; tudo
é normalizado antes de ponderar):

| Critério | Peso | Como é medido |
|----------|------|---------------|
| **Avaliações de consumidores** | 25% | Nota média nas lojas (`rating`), normalizada para 0–5. |
| **Volume de avaliações** | 20% | `log10(ratingCount)` normalizado — muitas avaliações = mais confiável. |
| **Consenso editorial** | 25% | Quantas vezes o modelo (marca + modelo) é citado em reviews e rankings independentes consultados na pesquisa (Serper Search + Tavily). |
| **Reputação da marca** | 15% | Marca reconhecida na categoria (`detectBrand`). |
| **Custo-benefício** | 15% | Preço em relação à **mediana** da lista: pontuação máxima entre 0,6× e 1,2× a mediana; penaliza preço suspeito de falso (< 0,3×) e muito acima da média (> 2,5×). |

A ordem final da lista é o score descrescente. O score de tokens/tema é usado apenas
como **critério de desempate**.

## Nota da tabela comparativa (1–10)

A **nota** exibida não é inventada pela IA. Ela é derivada do score objetivo:

```
nota = round(score × 10, 1)   // escala 1–10, uma casa decimal
```

## Requisito mínimo para entrar na lista

Para entrar no ranking, o produto precisa satisfazer **pelo menos 2** destes critérios:

- `rating >= 4.0`
- `ratingCount >= 20`
- citado em pelo menos 1 review independente (`mentions >= 1`)
- marca conhecida da categoria (`KNOWN_BRANDS`)

Produtos que não atingem o mínimo são descartados — **a menos que** descartá-los deixe
a lista com menos produtos que o mínimo aceitável para o artigo; nesse caso os melhores
restantes entram e o fato é registrado nos logs.

## Por que entrou (coluna auditável)

A tabela comparativa inclui a coluna **"Por que entrou"**, preenchida com os critérios
objetivos que o produto atendeu (ex.: `4,6★ (1.2k avaliações) · citado em 3 reviews`).
Assim o leitor consegue auditar a posição de cada modelo.

## Seção "Como Escolhemos" no artigo

Todo ranking inclui uma seção de metodologia gerada por **template** (não pela IA),
explicando que a seleção usa:

- avaliações de consumidores (nota e volume),
- consenso editorial (reviews e rankings independentes),
- reputação da marca,
- especificações técnicas do que o modelo entrega,
- custo-benefício (preço frente à mediana da categoria),

e que modelos sem o mínimo de critérios ficam de fora.

## Implementação

- `scripts/product_ranking.mjs` — sinais, `scoreProduct()`, `rankProducts()`, pesos e mínimo de critérios (`MIN_CRITERIA`).
- `scripts/product_naming.mjs` — categoria única e `detectBrand()`.
- `scripts/google_shopping.mjs` — captura `rating`, `ratingCount` e `offers` dos resultados.
- `scripts/gerar-artigo.mjs` — aplica o ranking, deriva a nota, monta a coluna "Por que entrou" e injeta a seção "Como Escolhemos".

> **Nota de transparência:** quando um sinal não existe (ex.: a loja não devolve
> avaliações), ele vale 0 e o produto depende dos demais critérios. Listas curtas e
> corretas são sempre preferidas a listas longas e erradas — se o filtro deixar a lista
> abaixo do mínimo, o gerador **falha e não publica** em vez de publicar errado.
