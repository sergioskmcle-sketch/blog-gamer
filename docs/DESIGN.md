---
name: Promo Gamer
colors:
  bg-primary: "#050505"
  bg-secondary: "#0a0a0a"
  bg-card: "#111111"
  bg-elevated: "#1a1a1a"
  bg-glass: "rgba(10, 10, 10, 0.8)"
  purple: "#A855F7"
  purple-hover: "#9333EA"
  purple-dim: "rgba(168, 85, 247, 0.14)"
  purple-glow: "rgba(168, 85, 247, 0.25)"
  cyan: "#06B6D4"
  cyan-hover: "#0E7490"
  cyan-dim: "rgba(6, 182, 212, 0.12)"
  warning: "#FABC4E"
  yellow: "#FACC15"
  danger: "#FFB4AB"
  text-primary: "#FFFFFF"
  text-secondary: "#CFC2D6"
  text-muted: "#A1A1AA"
  border: "#1F1F1F"
  border-hover: "#333333"
  surface: "#0a0a0a"
  on-surface: "#FFFFFF"
  on-surface-variant: "#CFC2D6"
  outline: "#333333"
  surface-dim: "#050505"
  surface-bright: "#1a1a1a"
  surface-container-lowest: "#0a0a0a"
  surface-container-low: "#111111"
  surface-container: "#111111"
  surface-container-high: "#1a1a1a"
  surface-container-highest: "#222222"
  inverse-surface: "#E5E2E1"
  inverse-on-surface: "#313030"
  outline-variant: "#1F1F1F"
  surface-tint: "#A855F7"
  primary: "#A855F7"
  on-primary: "#ffffff"
  primary-container: "#A855F7"
  on-primary-container: "#ffffff"
  inverse-primary: "#9333EA"
  secondary: "#06B6D4"
  on-secondary: "#003640"
  secondary-container: "#06B6D4"
  on-secondary-container: "#00424E"
  tertiary: "#FABC4E"
  on-tertiary: "#432C00"
  error: "#FFB4AB"
  on-error: "#690005"
  error-container: "#93000A"
  on-error-container: "#FFDAD6"
  background: "#050505"
  on-background: "#E5E2E1"
  surface-variant: "#353534"
typography:
  h1:
    fontFamily: Geist
    fontSize: 2.5rem
    fontWeight: "700"
    letterSpacing: "-0.02em"
    lineHeight: 1.2
  h2:
    fontFamily: Geist
    fontSize: 1.75rem
    fontWeight: "600"
    letterSpacing: "-0.01em"
    lineHeight: 1.3
  h3:
    fontFamily: Geist
    fontSize: 1.35rem
    fontWeight: "600"
    lineHeight: 1.4
  h4:
    fontFamily: Geist
    fontSize: 1.15rem
    fontWeight: "600"
    lineHeight: 1.4
  body:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: 1.7
  body-md:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: 1.6
  display-lg:
    fontFamily: Geist
    fontSize: 3rem
    fontWeight: "700"
    letterSpacing: "-0.04em"
    lineHeight: 1.1
  headline-lg:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: "600"
    letterSpacing: "-0.02em"
    lineHeight: 1.2
  headline-md:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: "600"
    lineHeight: 1.3
  body-lg:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: "400"
    lineHeight: 1.6
  label-md:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: "500"
    letterSpacing: "0.02em"
    lineHeight: 1.2
  price:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: "700"
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 10px
  lg: 12px
  xl: 16px
  pill: 9999px
  DEFAULT: 0.5rem
  full: 9999px
spacing:
  xs: 4px
  base: 8px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  xxl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  max-content-width: 960px
---

## Brand & Style

**Promo Gamer** is a **premium gaming content portal** — a professional editorial platform focused on news, articles, reviews, guides, tutorials, hardware, games, eSports, and tech analysis. The brand communicates technology, innovation, and high performance — evoking supercars, premium PC builds, and elite gaming setups.

The visual style is **Dark Premium RGB** — true Black Piano (`#050505`) as the canvas, with a vibrant dual-accent system: **Electric Purple (`#A855F7`)** for technology and brand identity, **Cyan (`#06B6D4`)** for actions and important destinations (replaced the old lime neon green `#39FF14` in the Stitch v3 redesign). Typography is **Geist**, icons are **Material Symbols Outlined**. Colors are intense and energetic — no pastel, washed, or grayish tones.

**IMPORTANT:** This is a BLOG / CONTENT PORTAL, NOT a store, marketplace, or product showcase. Products appear ONLY contextually within articles (e.g., "Best Gaming Headsets", "Gaming Setup Guide"). Editorial content is the protagonist. The experience should feel like IGN, PC Gamer, Adrenaline, or Eurogamer — not an e-commerce site.

## Themes (Dark / Light)

O blog tem **dois temas**: **dark** (padrão, "Black Piano RGB") e **light** (papel). Nenhum dos dois é escolhido por CSS isolado — o tema é definido no elemento `<html>` e todos os componentes leem CSS variables.

### Como o tema é aplicado

1. **`src/data/blog-config.json`** guarda `theme` (`"dark"` | `"light"`) e `allowVisitorThemeToggle` (`true`/`false`).
2. **`src/layouts/Layout.astro`** injeta um `<script>` no `<head>` (anti-FOUC) que resolve o tema nesta ordem:
   `localStorage["blog-theme"]` → `blog-config.json.theme` → `prefers-color-scheme`.
   O script seta `data-theme="dark|light"` e as classes `dark`/`light` no `<html>` **antes** do primeiro paint.
3. **`src/components/ThemeToggle.astro`** (renderizado no header quando `allowVisitorThemeToggle: true`) alterna o tema do visitante e salva em `localStorage["blog-theme"]`.
4. Os seletores de tema no CSS são `:root { ... }` (dark) e `:root[data-theme="light"] { ... }` (light).

### Regra de ouro: nada de cor hardcoded

**Toda** cor de componente, borda, sombra e background deve vir de uma CSS variable (`var(--...)`). Cores em hex/rgba fixas dentro de componentes estão **proibidas** — quebrariam o tema claro e a personalização do painel. Exceções permitidas: cores *dentro* das definições das próprias variáveis no `global.css`, e overlays de fundo que são intencionalmente escuros nos dois temas (hexágonos do `html::before`, `carbon-overlay` do hero).

### Lista de variáveis do tema (global.css)

```
Cores:
  --bg-primary        fundo da página (dark #050505 / light #F8F9FA)
  --bg-secondary      fundo alternativo (#0a0a0a / #FFFFFF)
  --bg-card           fundo de cards (#111111 / #EDEEEF)
  --bg-elevated       fundo elevado (dropdowns, modais) (#1a1a1a / #E7E8E9)
  --bg-glass          header/modal glass (rgba 0.8 / rgba 255,255,255,0.8)
  --accent            principal (roxo) #A855F7 / #8127CF
  --accent-hover      #9333EA / #9C48EA
  --accent-dim        fundo suave do principal rgba(...0.14 / 0.10)
  --accent-glow       brilho do principal rgba(...0.25 / 0.18)
  --success           destaque (ciano) #06B6D4 / #00687A
  --warning           #FABC4E / #825100
  --danger            #FFB4AB / #BA1A1A
  --text-primary      #FFFFFF / #09090B
  --text-secondary    #CFC2D6 / #4D4354
  --text-muted        #A1A1AA / #A1A1AA
  --border            #1F1F1F / #CFC2D6
  --border-hover      #333333 / #7E7385
  --on-accent         texto sobre o principal (#fff nos dois)
  --selection-bg      / --selection-color
  --hex-overlay-color / --hex-overlay-opacity  (overlay de hexágonos)

Fundo do body (configurável em blog-config.json → aba Aparência do admin):
  --body-bg-color       cor base
  --body-bg-image       imagem/gradientes (presets em src/data/background-presets.json)
  --body-bg-size        --body-bg-position  --body-bg-repeat  --body-bg-attachment

Sombras e relevo:
  --shadow-sm / --shadow / --shadow-lg / --shadow-glow
  --emboss-high / --emboss-mid / --emboss-deep

Layout / tipografia:
  --nav-height  --logo-height  --logo-offset  --content-top
  --main-cols  --sidebar-cols  --max-width  --content-width
  --radius-sm / --radius / --radius-lg / --radius-xl
  --font-sans  --font-mono  --font-label  (Geist / JetBrains Mono / Geist)
  --transition / --transition-slow
```

### Onde cada tema é definido

- **`src/styles/global.css`** — `:root` (dark) e `:root[data-theme="light"]` (light). Também contém `--body-bg-*` como fallback padrão (preset carbono-roxo).
- **`src/styles/effects.css`** — efeitos (carbon-shine, glass-nav, scrollbars) também leem variáveis.
- **`tailwind.config.mjs`** — toda a paleta do Tailwind mapeada para as variáveis (`primary: var(--accent)`, `surface: var(--bg-primary)`, `black-piano: var(--bg-primary)`, etc.).
- **`src/layouts/Layout.astro`** — injeta `:root:root { --body-bg-* }` com os valores de `blog-config.json` (especificidade maior que o `:root` do global.css, então o config sempre vence).

## Background & Texture

The background uses a **CSS-only** layered depth system — no external images — creating a **premium Black Piano carbon fiber** finish (supercar-grade, not a simple repeating pattern). O fundo é configurável pelo admin (preset/cor/imagem); o padrão atual é **cor sólida** `#050505` (dark) / `#F8F9FA` (light).

### Background Layers (preset carbono-roxo)

```
Layer 1: #050505 — True Black Piano base (deep glossy black)
Layer 2: Premium carbon fiber weave — multiple repeating-linear-gradients at 30/60/120/150 degrees (5-8% opacity, larger 16-24px fibers)
Layer 3: Micro-reflections simulating Black Piano varnish (linear-gradient varied angles, 2-4% opacity, subtle animation)
Layer 4: Glossy effect with brightness variations (radial-gradient randomized positions, 3-6% opacity)
Layer 5: High-resolution noise/granulation (CSS gradient + pseudo-element, ~2% opacity)
Layer 6: Soft diagonal reflections (linear-gradient 135/315 degrees, ~3% opacity)
Layer 7: Electric purple radial glow from center (~5% opacity, 600px blur)
Layer 8: Cyan glow in strategic regions (hero, CTA areas)
Layer 9: Minute blurred floating particles at very low opacity (~1.5%), drifting slowly
```

### Premium Carbon Fiber CSS Specification

Multiple overlapping `repeating-linear-gradient` at various angles for realistic woven appearance:

```css
/* Main weave — 30 degree angle */
repeating-linear-gradient(30deg,
  rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px,
  transparent 2px, transparent 18px)

/* Cross weave — 150 degree angle */
repeating-linear-gradient(150deg,
  rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1.5px,
  transparent 1.5px, transparent 16px)

/* Micro-weave detail — 60 degrees */
repeating-linear-gradient(60deg,
  rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px,
  transparent 1px, transparent 24px)

/* Cross micro-weave — 120 degrees */
repeating-linear-gradient(120deg,
  rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 0.8px,
  transparent 0.8px, transparent 20px)
```

Larger fibers (16-24px spacing), more defined strokes (1-2px), slightly higher opacity (3-4%) to be **noticeable yet elegant**.

The texture must feel like **real material** — never like a repetitive pattern. It should convey luxury, depth, and premium craftsmanship.

## Colors

Vibrant, intense colors — no pastel, washed, or grayish tones. The dual-accent palette is built around an electric RGB identity (Stitch v3):

- **Electric Purple (`#A855F7` dark / `#8127CF` light):** The primary brand color. Used for links, category badges, hover states, secondary buttons, and tech-identity elements. Communicates innovation and premium technology.
- **Cyan (`#06B6D4` dark / `#00687A` light):** The action color (replaced the old lime neon green `#39FF14`). Used for CTAs, prices, "buy" buttons, affiliate highlights, and important metrics.
- **Warning Amber (`#FABC4E`):** Reserved for affiliate disclosure boxes and special callouts.
- **Surface Strategy:** True Black Piano `#050505` background (dark) / `#F8F9FA` (light), with cards stepping up through `#111111` and `#1a1a1a`. Borders use `#1F1F1F`.

### RGB Identity
- **Purple** = Technology & brand
- **Cyan** = Actions & prices
- **White/Black** = Balance & readability

## Typography

**Geist** is the primary typeface (100–900). Icons use **Material Symbols Outlined**.

- **Headings (H1-H4):** High-contrast `#FFFFFF` (dark) / `#09090B` (light). H1 may use `display-lg` (3rem) in the hero.
- **Body Text:** `#CFC2D6` for comfortable reading. Muted `#A1A1AA` for metadata.
- **Prices:** Always in **Cyan** (`--success`), bold weight (`price` typography), with the date displayed beside them in `--text-muted`. Example: "R$ 2.499 — Atualizado em 02/07/2026"
- **Links:** Electric Purple (`#A855F7`) with animated underline expansion on hover.

## Layout & Spacing

Content-First model with constrained readability. Container 1200px, grid 12 colunas (conteúdo 8 / sidebar 4). Spacing tokens: `xs 4px, base 8px, sm 12px, md 24px, lg 48px, xl 80px`.

## Elevation & Depth

Three levels of depth, with elevated elements appearing to float:

- **Level 1 (Cards):** `#111111` background, `--shadow` (0 4px 12px rgba(0,0,0,0.5))
- **Level 2 (Elevated):** `#1a1a1a` background, `--shadow-lg` + purple glow (0 0 20px rgba(168,85,247,0.22))
- **Level 3 (Hero/CTAs):** Strongest elevation with cyan glow accents (0 0 20px rgba(6,182,212,0.4) on hover)

## Glassmorphism

Applied to sticky header, modals, and premium cards. Uses `rgba(10, 10, 10, 0.8)` with backdrop-filter blur(16px), thin light borders (`1px solid #1F1F1F`), and elegant shadowing.

## Components

### Article Card
- Background: `#111111` (surface-container), hover `#1a1a1a` (surface-container-high)
- Border: 1px solid `#1F1F1F`, hover `border-secondary/50` + cyan glow
- Border-radius: 12px (`rounded-xl`)
- Imagem: ratio 16:9 (`pt-[56.25%]`), badge colorido por categoria no topo
- Transition: 0.25s ease
- Título e descrição `line-clamp`, data com ícone calendar

### Primary Button (Tech)
- Background: `#A855F7` (electric purple)
- Hover: `#9333EA` with purple glow
- Scale on hover: 1.03
- Padding: 0.7rem 1.6rem
- Border-radius: 8px
- Font: 600 weight

### Primary Button (Action - CTA)
- Background: `#06B6D4` (cyan)
- Hover: glow ciano (0 0 20px rgba(6,182,212,0.4))
- Scale on hover: 1.02 / 1.03
- Used for: "Ver Preço", "Comprar", "Melhor Oferta", "Entrar no Grupo"
- Font: `label-md`, uppercase, bold

### Tag / Category Badge
- Pill shape (border-radius: 9999px)
- Purple variant: bg `--accent-dim`, border `1px solid --accent`, purple text
- Cyan variant: bg `--success-dim`, border `1px solid --success`, cyan text
- Badge de card por categoria: review → roxo, notícia → neutro, guia → ciano, promoções → vermelho
- Uppercase category labels

### Affiliate Box (contextual within articles only)
- Used **only within articles** when a product recommendation is relevant
- Background: gradient from `#111111` to `rgba(250,188,78,0.05)`
- Border-left: 3px solid `--warning` (#FABC4E)
- Price in cyan with date next to it in muted gray

### Price Display (contextual within articles only)
- Always rendered in **Cyan** (`--success`)
- Bold weight, larger size than surrounding text
- Date appended beside price: "R$ 2.499 — Atualizado em DD/MM/AAAA"
- Date in `--text-muted`, normal weight, smaller size
- **NEVER** display prices on Home Page or in isolated showcases

### Table
- Header: `#1a1a1a` background, uppercase, mono typography
- Rows: alternating from `#111111`, `#1F1F1F` dividers
- Hover: `--accent-dim` background

### Header (Sticky)
- Glassmorphism: `rgba(10,10,10,0.8)` with backdrop-filter blur(16px)
- Border-bottom: 1px solid `#1F1F1F`
- Logo + "PROMO GAMER" (altura/posição configuráveis via `--logo-height`/`--logo-offset`)
- Nav links: uppercase, hover roxo
- Botões redondos (busca, tema, menu) com Material Symbols
- **NO** login button, profile button, avatar, or authentication references

### Footer
- Background: `#0a0a0a` (surface-container-lowest)
- Grid: 4 colunas (descrição + institucional + redes)
- Links: `--text-muted`, hover cyan
- Ícones sociais via Material Symbols

### Hero (Featured Article)
- Imagem de fundo com gradiente de baixo (`from-background via-background/60`)
- Altura `h-[400px] sm:h-[500px]`, zoom suave no hover
- **Featured editorial article** — NOT products
- Título em `display-lg`, hover roxo
- Badge de categoria roxo + metadata (tempo relativo + autor)
- Hero inteiro é o link (sem botão separado)

### Sidebar (Editorial — Home Page)
- **Popular / Most Read articles**: lista numerada (1–4) com título e categoria
- **Categorias**: chips clicáveis
- **Newsletter**: card com input + botão "Assinar"
- Banner do Telegram (9:16) preservado
- **NO** products, prices, or commercial showcases on Home Page sidebar
- Products appear **only within article pages** when contextually relevant

### Home Page Sections (Editorial Only)
1. **Hero (Featured Article)**: Large image, title, category, metadata
2. **Últimas Atualizações**: card grid (2 colunas desktop)
3. **Reviews & Analysis**: Featured section for hardware and game reviews
4. **Categories**: Visual category navigation (Hardware, Games, eSports, etc.)
5. **Most Read Articles**: Sidebar list
6. **Releases**: Gaming industry news

**Rules:**
- **NEVER** display products, prices, "Buy" or "See Price" buttons on Home Page
- Home Page sidebar contains **editorial content only**
- Products appear **only within articles** when contextually relevant
- Visitor must feel they entered a portal like IGN or PC Gamer — not a store

## Micro-animations

All interactive components respond to the user:

- **Cards:** Elevate 3px + shadow + purple glow + illuminated border. Cursor proximity triggers subtle purple glow on card edges.
- **Buttons:** Scale 1.03 + glow + smooth 0.25s transition.
- **Images:** Subtle zoom (1.02-1.1) on hover.
- **Links:** Gradual color transition + animated underline.

Transitions use `0.25s ease` by default, `0.4s ease` for reveals. GPU-accelerated properties only (transform, opacity).

## Responsive & Performance

- **<=1024px:** Grid-4 to 2 columns, sidebar below content
- **<=768px:** Single column, H1 to 1.75rem
- **<=480px:** H1 to 1.5rem, edge-to-edge content

All effects use GPU acceleration. 60 FPS target. Respects `prefers-reduced-motion`: disables cursor effect, particles, and parallax. Graceful degradation on slower devices.

## Key Differentiator

This is a **premium gaming content portal**, not a store. Products appear **only within articles** when contextually relevant (e.g., "Best Gaming Headsets", "SSD Comparison", "Gaming Notebook Review"). When prices are displayed within articles, they must show the **date** beside them in muted text. Example: "[Product Name] — R$ 2.499 — Atualizado em 02/07/2026". The price is always in **Cyan** (`--success`) bold, the date in **text-muted** normal weight.

The Home Page is **purely editorial**: featured article, latest news, reviews, categories, popular articles. No product showcases, no prices, no commercial vitrines.
