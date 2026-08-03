# Estrutura de Artigo — Blog Gamer

## Ordem do artigo (v1.2 — seção de Itens logo após a intro)

```
INTRODUÇÃO (sem H2): gancho + resumo dos critérios que definem a lista
## Os {N} Melhores {Itens} em 2026      ← PRIMEIRA seção (a principal)
   ## Nome do Produto — Subtítulo
   [IMAGEM]  ← foto real do produto (injetada automaticamente)
   [TEXTO]   ← 2-3 parágrafos sobre o produto
   [BOTÃO]   ← <a class="product-btn"> (afiliado, simples, sem card)
   ## Nome do Produto 2 — Subtítulo    ← repete N vezes
   ...
## Comparativo (tabela)
## Veredito / Qual X Escolher?
## FAQ
## Quer mais ofertas? (Telegram)
## Fontes
## Continue Explorando                 ← ÚNICO lugar com links internos
```

## Ordem de cada tópico (seção com produto)

```
## Nome do Produto — Subtítulo
[IMAGEM]    ← foto real do produto (não screenshot de jogo)
[TEXTO]     ← 2-3 parágrafos sobre o produto
[BOTÃO]     ← <a class="product-btn"> (afiliado, simples, sem card)
```

## Imagens dos itens

- Usar fotos REAIS do produto (headset, teclado, mouse, etc.)
- NUNCA usar screenshots de jogos ou imagens genéricas
- Cadeia de prioridade por item: thumbnail do ML (baixada para `public/images/produtos/`) → busca web (Tavily) → IA (último recurso)
- CSS: `object-fit: contain` (adapta ao formato natural da imagem)
- Removido: `aspect-ratio: 16/9` fixo (causava corte em imagens quadradas)
- A imagem é exibida ANTES do texto que descreve o produto

## Botão de afiliado

- HTML simples: `<a href="LINK" class="product-btn">VER NO MERCADO LIVRE</a>`
- NÃO usar `<div class="product-card">` com imagem integrada
- O botão é um link puro, sem container com texto/prós/contras/preço

## Capa (frontmatter.image)

- Deve ser a imagem de UM dos produtos do artigo
- NUNCA imagem de console, jogo ou genérica
- Deve representar o tema do artigo (ex: artigo de headsets → imagem de headset)

## CSS relevante (src/pages/blog/[...slug].astro)

```css
#articleBody .article-game-img {
  width: 100%;
  max-width: 600px;
  object-fit: contain;          /* mostra imagem inteira */
  border-radius: 10px;
  border: 1px solid var(--border);
  display: block;
  margin: 0.75rem 0;
}

#articleBody .product-btn {
  display: block;
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: #2ff801;
  color: #000;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
  border-radius: 10px;
  text-decoration: none;
  margin-top: 1rem;
}
```

## Exemplo completo de tópico

```markdown
## HyperX Cloud Stinger 2 Core — O Melhor para Quem Começa

<img src="https://http2.mlstatic.com/D_NQ_NP_870548-MLU77107727488_062024-O.webp" alt="HyperX Cloud Stinger 2 Core" class="article-game-img">

O HyperX Cloud Stinger 2 Core é a porta de entrada honesta para quem quer um headset gamer de qualidade sem estourar o orçamento. Com drivers de 40 mm sintonizados para médios limpos — ideais para ouvir passos, recargas e vozes em jogos —, ele entrega um som equilibrado que surpreende pelo preço.

O grande destaque é o peso: apenas 275 gramas. Você esquece que está usando o headset depois de vinte minutos. A construção em plástico resistente aguenta o tranco do dia a dia.

O ponto fraco? Não tem wireless e o design é simples. Mas para quem está começando, é imbatível na faixa de preço.

<a href="https://meli.la/1Bj3UZc" class="product-btn">VER NO MERCADO LIVRE</a>
```
