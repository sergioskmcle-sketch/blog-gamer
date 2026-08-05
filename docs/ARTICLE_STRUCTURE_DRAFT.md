# Estrutura de Artigo — Blog Gamer

## Ordem do artigo (v1.3 — lista com tópico + itens em H3)

```
## Introdução                                 ← H2 (sempre presente; substituiu o "## Índice")
## <a id="os-5-melhores-..."></a>Os {N} Melhores {Itens} em 2026   ← tópico H2 (a seção principal)
   ### Nome do Produto — Subtítulo           ← item (sub-card, H3)
   [IMAGEM]  ← foto real do produto (logo APÓS o H3)
   [TEXTO]   ← 2-3 parágrafos sobre o produto
   [BOTÃO]   ← <a class="product-btn"> (afiliado, simples, sem card)
   ### Nome do Produto 2 — Subtítulo          ← repete N vezes
   ...
## Comparativo (tabela)
## Como Escolher? / Veredito
## FAQ
## Quer mais ofertas? (Telegram)
## Fontes
## Continue Explorando                       ← ÚNICO lugar com links internos
```

- Listas de produtos usam **um tópico `##` agrupador + cada produto como `###`**. Artigos informativos (não-listas) usam `##` para cada seção e `###` para perguntas de FAQ, dicas e subtópicos.
- `## Índice` manual **não existe mais** — foi removido de todos os artigos; o TOC é renderizado automaticamente.
- Hierarquia visual: `##` = tópico (`section.article-section`, título roxo); `###` = sub-card (`section.article-subsection`, borda lateral verde `#2ff801`).

## Ordem de cada tópico (item de lista)

```
### Nome do Produto — Subtítulo     ← H3 (pode ter âncora <a id="...">)
[IMAGEM]    ← foto real do produto (não screenshot de jogo), logo APÓS o H3
[TEXTO]     ← 2-3 parágrafos sobre o produto
[BOTÃO]     ← <a class="product-btn"> (afiliado, simples, sem card)
```

A imagem é exibida **após o título** (ordem título → imagem → texto → botão), mesmo quando o markdown foi escrito com a imagem antes do heading — o plugin `rehype-article-sections.mjs` move imagens pendentes para depois do heading.

## Imagens dos itens

- Usar fotos REAIS do produto (headset, teclado, mouse, etc.)
- NUNCA usar screenshots de jogos ou imagens genéricas
- Cadeia de prioridade por item: thumbnail do Google Shopping/Serper (baixada para `public/images/produtos/`) → busca web (Tavily) → IA (último recurso)
- CSS: `object-fit: contain` (adapta ao formato natural da imagem)
- Removido: `aspect-ratio: 16/9` fixo (causava corte em imagens quadradas)
- A imagem é exibida ANTES do texto que descreve o produto

## Botão de produto

- HTML simples: `<a href="LINK" class="product-btn">VER NA KABUM</a>` (texto com o nome da loja)
- NÃO usar `<div class="product-card">` com imagem integrada
- O botão é um link puro, sem container com texto/prós/contras/preço
- Texto e link são editáveis no painel `/admin/` (aba Produtos)

## Capa (frontmatter.image)

- Deve ser a imagem de UM dos produtos do artigo
- NUNCA imagem de console, jogo ou genérica
- Deve representar o tema do artigo (ex: artigo de headsets → imagem de headset)

## CSS relevante (plugins de Markdown + src/pages/blog/[...slug].astro)

> A renderização é feita por dois plugins de pipeline em `src/plugins/` (registrados no `astro.config.mjs`), não por CSS manual:

- `remark-heading-blocks.mjs` — parseia headings ATX (`#` a `######`) e os converte em nós de heading.
- `rehype-article-sections.mjs` — agrupa o conteúdo entre `##` consecutivos em `<section class="article-section">` (tópicos) e cada `###` em `<section class="article-subsection">` (sub-card) aninhado no tópico atual. O `h2` fica como primeiro elemento do tópico; o `h3`, como primeiro do sub-card.
- **IDs automáticos**: todo heading recebe um `id` (slug ASCII, mesma regra de `tagSlug` em `src/lib/headings.ts`). Âncora manual `## <a id="X"></a>Título` tem o `id` migrado para o próprio heading (o `<a>` é removido) — evita id duplicado quando o Astro re-gera ids via github-slugger após este plugin.
- **Imagem após o título**: um `<img>` solto logo antes de um heading (formato antigo) é movido para logo após o heading, garantindo a ordem título → imagem → texto em qualquer formato.
- O estilo das seções e cards vive em `[...slug].astro` sob `#articleBody .article-section` e `#articleBody .article-subsection` (regras globais no `<style is:global>` do template).

```css
#articleBody .article-section { /* tópico gerado pelo rehype-article-sections */ }
#articleBody .article-subsection { /* sub-card H3: borda verde #2ff801, fundo escuro sutil */ }

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

Tabelas recebem zebra sutil (`tr:nth-child(even)`) via CSS em `[...slug].astro`.

## Sumário "Neste artigo"

- TOC recolhível no topo do corpo do artigo, **em todas as telas** (desktop e mobile) — componente `src/components/TableOfContents.astro`, chamado como `<TableOfContents headings={headings} />`.
- **Hierárquico**: tópicos `##` numerados `01`, `02`, … e subtópicos `###` numerados `02.1`, `02.2`, … (classes `toc-topic`, `toc-sublist`, `toc-link-sub`).
- Prefixos de numeração em títulos de `###` (ex.: `1. Altura e peso`) são removidos do texto exibido via `stripNumber()`.
- Os slugs vêm de `src/lib/headings.ts` (exclui `/^índice$/i`); cada link do TOC resolve para o `id` de um heading real (gerado pelo plugin ou pela âncora manual).
- A página do artigo reutiliza a mesma estrutura de layout da Home: wrapper `max-w-page mx-auto px-gutter` → `grid grid-cols-1 lg:grid-cols-12 gap-xl my-xl` com colunas `span var(--main-cols, 8)` e `span var(--sidebar-cols, 4)` (larguras controladas pelo painel admin em `global.css` — nunca hardcodar `340px`/`col-span-*`). Sidebar = `Sidebar.astro` (banner 9:16 → Populares → Categorias → Comunidade).
- A capa nunca fica sob o header fixo: `<main>` usa `padding-top: calc(max(var(--content-top, var(--nav-height)), var(--nav-height)) + 8px)`.

## Exemplo completo de tópico

```markdown
### <a id="hyperx-cloud-stinger-2-core"></a>HyperX Cloud Stinger 2 Core — O Melhor para Quem Começa

<img src="https://http2.mlstatic.com/D_NQ_NP_870548-MLU77107727488_062024-O.webp" alt="HyperX Cloud Stinger 2 Core" class="article-game-img">

O HyperX Cloud Stinger 2 Core é a porta de entrada honesta para quem quer um headset gamer de qualidade sem estourar o orçamento. Com drivers de 40 mm sintonizados para médios limpos — ideais para ouvir passos, recargas e vozes em jogos —, ele entrega um som equilibrado que surpreende pelo preço.

O grande destaque é o peso: apenas 275 gramas. Você esquece que está usando o headset depois de vinte minutos. A construção em plástico resistente aguenta o tranco do dia a dia.

O ponto fraco? Não tem wireless e o design é simples. Mas para quem está começando, é imbatível na faixa de preço.

<a href="https://www.kabum.com.br/p/123456" class="product-btn">VER NA KABUM</a>
```
