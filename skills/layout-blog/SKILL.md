# Skill: Layout do Blog

## Descrição
Mantém a estrutura visual do blog e dos artigos. Define como cada componente renderiza na página.

## Stack Visual
- **Framework:** Astro 5
- **CSS:** Tailwind CSS
- **Template:** tema do blog em `src/layouts/`
- **Componentes:** componentes Astro em `src/components/`

## Estrutura de um Artigo (Renderização)

### Frontmatter → Header
```html
<h1>{title}</h1>
<img src={image} alt={title} class="cover-img" />
<div class="meta">
  <span>{category}</span>
  <span>{pubDate}</span>
  <span>{tags.join(', ')}</span>
</div>
```

### Intro (`## Introdução`)
- 1-2 parágrafos
- Gancho inicial
- `## Introdução` é o primeiro H2 de todo artigo (substituiu o antigo `## Índice`, que não existe mais)

### Seções H2 (tópicos) e H3 (sub-cards)
Cada heading vira um card visual via plugins de Markdown (`src/plugins/`), registrados no `astro.config.mjs`:

1. `remark-heading-blocks.mjs` — parseia headings ATX (`#` a `######`).
2. `rehype-article-sections.mjs` — `##` → `<section class="article-section">` (tópico); `###` → `<section class="article-subsection">` (sub-card) aninhado no tópico. Todo heading recebe `id` ASCII automático; âncora manual `## <a id="X"></a>Título` tem o `id` migrado para o próprio heading; imagem solta antes de heading é movida para depois dele.

```markdown
## Título do Tópico               ← vira card (article-section)

### Nome do Produto — Subtítulo    ← vira sub-card (article-subsection)

<img src="..." alt="..." class="article-game-img" loading="lazy" decoding="async" />
<p>Conteúdo...</p>

<a href="URL_SERPER" class="product-btn" target="_blank" rel="noopener">VER NA LOJA</a>
```

O TOC "Neste artigo" é extraído por `src/lib/headings.ts` (usa `tagSlug`); funciona com âncoras `## <a id="..."></a>Título` e com blocos puros.

### Product Button (NOT product-card)
```html
<a href="URL_SERPER" class="product-btn" target="_blank" rel="noopener">
  VER NA LOJA
</a>
```
- NUNCA: `<div class="product-card">` (formato legado, proibido)

### Tabela Comparativa
```markdown
| Produto | Preco | Destaque | Nota |
|---------|-------|----------|:----:|
| Produto A | R$ 199 | Feature X | 8.5 |
| Produto B | R$ 299 | Feature Y | 9.0 |
```

### FAQ
```html
<h3>Pergunta do usuário?</h3>
<p>Resposta direta e útil...</p>
```

### CTA Telegram
```html
<section class="cta-telegram">
  <h2>Quer mais ofertas?</h2>
  <p>Entra no nosso grupo VIP...</p>
  <a href="LINK_TELEGRAM">Entrar no Grupo</a>
</section>
```

### Fontes
```markdown
## Fontes
- [Nome da Fonte](URL)
- [Nome da Fonte](URL)
```

### Continue Explorando
```html
<section class="continue-exploring">
  <h2>Continue Explorando</h2>
  <div class="article-cards">
    <a href="/blog-gamer/blog/artigo-1">
      <img src="..." alt="..." />
      <h3>Título do Artigo</h3>
    </a>
    <a href="/blog-gamer/blog/artigo-2">
      <img src="..." alt="..." />
      <h3>Título do Artigo</h3>
    </a>
  </div>
</section>
```

## CSS Classes Relevantes
| Classe | Uso |
|--------|-----|
| `.article-game-img` | Imagem de jogo (RAWG) |
| `.article-product-img` | Imagem de produto (Serper) |
| `.product-btn` | Botão de afiliado |
| `.cover-img` | Imagem de capa |
| `.article-section` | Tópico `##` gerado pelos plugins de Markdown |
| `.article-subsection` | Sub-card `###` (borda lateral verde `#2ff801`) |
| `.toc-inline` | Sumário "Neste artigo" (topo do artigo, todas as telas) |
| `.toc-topic` | Item de tópico no TOC (`01`, `02`, …) |
| `.toc-sublist` | Lista de subtópicos aninhada (`02.1`, `02.2`, …) |
| `.toc-link-sub` | Link de subtópico no TOC |
| `.meta` | Metadados do artigo |
| `.cta-telegram` | CTA do Telegram |
| `.continue-exploring` | Seção de links internos |

## Layout das Páginas (Home, Artigo e Listagens)
- Estrutura única em todas as páginas: wrapper `max-w-page mx-auto px-gutter` → `grid grid-cols-1 lg:grid-cols-12 gap-xl my-xl`.
- Coluna principal: `style="grid-column: span var(--main-cols, 8) / span var(--main-cols, 8)"`; sidebar: `style="grid-column: span var(--sidebar-cols, 4) / span var(--sidebar-cols, 4)"`.
- As larguras vêm do painel admin (`--main-cols`/`--sidebar-cols` em `global.css`); NUNCA hardcodar `340px`/`col-span-*` — qualquer mudança no editor reflete em Home, artigo e listagens.
- `Sidebar.astro` (banner Telegram 9:16 → Populares da Semana → Categorias → Comunidade) é reutilizado em todas elas.
- TOC recolhível (`TableOfContents.astro`, sem variante) fica no topo do corpo do artigo em todas as telas; hierárquico: tópicos `01`, `02`, … e subtópicos `02.1`, `02.2`, …
- Capa nunca fica sob o header fixo: `<main>` usa `padding-top: calc(max(var(--content-top, var(--nav-height)), var(--nav-height)) + 8px)`.

## Responsividade
- Mobile-first: artigo legível em telas < 768px
- Imagens: largura 100% no mobile, max-width no desktop
- Tabelas: scroll horizontal no mobile
- Fonte: 16px base, 1.6 line-height

## Scripts Relacionados
- `src/layouts/` — template do artigo
- `src/components/` — componentes reutilizáveis
- `astro.config.*` — configuração do Astro
