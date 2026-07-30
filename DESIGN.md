---
name: Blog Gamer
colors:
  bg-primary: "#050505"
  bg-secondary: "#020203"
  bg-card: "#0A0A0F"
  bg-elevated: "#12121C"
  bg-glass: "rgba(5, 5, 5, 0.88)"
  purple: "#A855F7"
  purple-hover: "#9333EA"
  purple-dim: "rgba(168, 85, 247, 0.12)"
  purple-glow: "rgba(168, 85, 247, 0.35)"
  neon: "#39FF14"
  neon-hover: "#2ED90E"
  neon-dim: "rgba(57, 255, 20, 0.1)"
  neon-glow: "rgba(57, 255, 20, 0.3)"
  warning: "#F97316"
  yellow: "#FACC15"
  danger: "#EF4444"
  text-primary: "#FFFFFF"
  text-secondary: "#D1D5E0"
  text-muted: "#8088A0"
  border: "#1C1C2E"
  border-hover: "#3D3D60"
  surface: "#0A0A0F"
  on-surface: "#FFFFFF"
  on-surface-variant: "#D1D5E0"
  outline: "#1C1C2E"
  surface-dim: "#050505"
  surface-bright: "#1E1E2A"
  surface-container-lowest: "#020203"
  surface-container-low: "#0A0A0F"
  surface-container: "#0E0E16"
  surface-container-high: "#161622"
  surface-container-highest: "#1E1E2A"
  inverse-surface: "#E8E8F0"
  inverse-on-surface: "#1A1A24"
  outline-variant: "#2A2A3E"
  surface-tint: "#A855F7"
  primary: "#C084FC"
  on-primary: "#1A0040"
  primary-container: "#A855F7"
  on-primary-container: "#F5F0FF"
  inverse-primary: "#9333EA"
  secondary: "#39FF14"
  on-secondary: "#003300"
  secondary-container: "#39FF14"
  on-secondary-container: "#002800"
  tertiary: "#F97316"
  on-tertiary: "#3A1500"
  error: "#EF4444"
  on-error: "#3A0000"
  error-container: "#8B0000"
  on-error-container: "#FFDADA"
  background: "#050505"
  on-background: "#E8E8F0"
  surface-variant: "#161622"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2.5rem
    fontWeight: "800"
    letterSpacing: "-0.02em"
    lineHeight: 1.2
  h2:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: "700"
    letterSpacing: "-0.01em"
    lineHeight: 1.3
  h3:
    fontFamily: Inter
    fontSize: 1.35rem
    fontWeight: "600"
    lineHeight: 1.4
  h4:
    fontFamily: Inter
    fontSize: 1.15rem
    fontWeight: "600"
    lineHeight: 1.4
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: 1.7
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: "400"
    lineHeight: 1.6
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: "400"
    lineHeight: 1.6
  label:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: "500"
    lineHeight: 1.5
    letterSpacing: "0.05em"
  price:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: "700"
    lineHeight: 1.4
  h1-mobile:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: "800"
    letterSpacing: "-0.02em"
    lineHeight: 1.2
  h2-mobile:
    fontFamily: Inter
    fontSize: 1.35rem
    fontWeight: "700"
    letterSpacing: "-0.01em"
    lineHeight: 1.3
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  pill: 9999px
  DEFAULT: 0.5rem
  full: 9999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  max-content-width: 720px
---

## Brand & Style

**Blog Gamer** is a **premium gaming content portal** — a professional editorial platform focused on news, articles, reviews, guides, tutorials, hardware, games, eSports, and tech analysis. The brand communicates technology, innovation, and high performance — evoking supercars, premium PC builds, and elite gaming setups.

The visual style is **Dark Premium RGB** — true Black Piano (`#050505`) as the canvas, with a vibrant dual-accent system: **Electric Purple (`#A855F7`)** for technology and brand identity, **Lime Neon Green (`#39FF14`)** for actions and important destinations. Colors are intense and energetic — no pastel, washed, or grayish tones.

**IMPORTANT:** This is a BLOG / CONTENT PORTAL, NOT a store, marketplace, or product showcase. Products appear ONLY contextually within articles (e.g., "Best Gaming Headsets", "Gaming Setup Guide"). Editorial content is the protagonist. The experience should feel like IGN, PC Gamer, Adrenaline, or Eurogamer — not an e-commerce site.

## Background & Texture

The background uses a **CSS-only** layered depth system — no external images — creating a **premium Black Piano carbon fiber** finish (supercar-grade, not a simple repeating pattern).

### Background Layers

```
Layer 1: #050505 — True Black Piano base (deep glossy black)
Layer 2: Premium carbon fiber weave — multiple repeating-linear-gradients at 30/60/120/150 degrees (5-8% opacity, larger 16-24px fibers)
Layer 3: Micro-reflections simulating Black Piano varnish (linear-gradient varied angles, 2-4% opacity, subtle animation)
Layer 4: Glossy effect with brightness variations (radial-gradient randomized positions, 3-6% opacity)
Layer 5: High-resolution noise/granulation (CSS gradient + pseudo-element, ~2% opacity)
Layer 6: Soft diagonal reflections (linear-gradient 135/315 degrees, ~3% opacity)
Layer 7: Electric purple radial glow from center (~5% opacity, 600px blur)
Layer 8: Lime neon green glow in strategic regions (hero, CTA areas)
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

Vibrant, intense colors — no pastel, washed, or grayish tones. The dual-accent palette is built around an electric RGB identity:

- **Electric Purple (`#A855F7`):** The primary brand color. Used for links, category badges, hover states, secondary buttons, and tech-identity elements. Communicates innovation and premium technology. More intense and alive than before.
- **Lime Neon Green (`#39FF14`):** The action color. Used for CTAs, prices, "buy" buttons, affiliate highlights, and important metrics. A true neon green that immediately commands attention.
- **Warning Orange (`#F97316`):** Reserved for affiliate disclosure boxes and special callouts.
- **Surface Strategy:** True Black Piano `#050505` background, with cards stepping up through `#0A0A0F` and `#12121C`. Borders use `#1C1C2E`.

### RGB Identity
- **Purple** = Technology & brand
- **Neon Green** = Actions & prices
- **White** = Balance & readability

## Typography

**Inter** remains the primary typeface for its exceptional legibility and neutral modern character. **JetBrains Mono** is reserved for code, technical specs, and metadata labels.

- **Headings (H1-H4):** High-contrast white (`#FFFFFF`). H1 may use a subtle purple-to-neon gradient effect. H2 uses purple to anchor section breaks.
- **Body Text:** `#D1D5E0` for comfortable reading. Muted `#8088A0` for metadata.
- **Prices:** Always in **Lime Neon Green** (`#39FF14`), bold weight (`price` typography), with the date displayed beside them in `#8088A0`. Example: "R$ 2.499 — Atualizado em 02/07/2026"
- **Links:** Electric Purple (`#A855F7`) with animated underline expansion on hover.

## Layout & Spacing

Content-First model with constrained readability. Max content width 720px for articles. 12-column responsive grid.

## Elevation & Depth

Three levels of depth, with elevated elements appearing to float:

- **Level 1 (Cards):** `#0A0A0F` background, `--shadow` (0 4px 12px rgba(0,0,0,0.6))
- **Level 2 (Elevated):** `#12121C` background, `--shadow-lg` + purple glow (0 0 30px rgba(168,85,247,0.35))
- **Level 3 (Hero/CTAs):** Strongest elevation with neon green glow accents (0 0 25px rgba(57,255,20,0.3))

## Glassmorphism

Applied to sticky header, modals, and premium cards. Uses `rgba(5, 5, 5, 0.88)` with backdrop-filter blur(12-16px), thin light borders (`1px solid #1C1C2E`), and elegant shadowing.

## Components

### Article Card
- Background: `#0A0A0F`
- Border: 1px solid `#1C1C2E`, hover shifts to `#3D3D60` with purple glow
- Border-radius: 14px
- Hover: translateY(-3px) with shadow-lg + purple glow (0 0 30px rgba(168,85,247,0.35))
- Transition: 0.25s ease
- Cursor proximity: subtle purple glow when cursor approaches

### Primary Button (Tech)
- Background: `#A855F7` (electric purple)
- Hover: `#9333EA` with purple glow
- Scale on hover: 1.03
- Padding: 0.7rem 1.6rem
- Border-radius: 8px
- Font: 600 weight
- Cursor proximity: gentle green glow when cursor approaches

### Primary Button (Action - CTA)
- Background: `#39FF14` (lime neon green)
- Hover: `#2ED90E` with neon glow
- Scale on hover: 1.03
- Used for: "Ver Preço", "Comprar", "Melhor Oferta"
- Cursor proximity: intensified green glow when cursor approaches

### Tag / Category Badge
- Pill shape (border-radius: 20px)
- Purple variant: bg `rgba(168,85,247,0.12)`, border `1px solid rgba(168,85,247,0.3)`, purple text
- Neon variant: bg `rgba(57,255,20,0.1)`, border `1px solid rgba(57,255,20,0.3)`, neon text
- Uppercase category labels

### Affiliate Box (contextual within articles only)
- Used **only within articles** when a product recommendation is relevant
- Background: gradient from `#0A0A0F` to `rgba(249,115,22,0.05)`
- Border-left: 3px solid `#F97316` (orange)
- Price in lime neon green with date next to it in muted gray

### Price Display (contextual within articles only)
- Always rendered in **Lime Neon Green** (`#39FF14`)
- Bold weight, larger size than surrounding text
- Date appended beside price: "R$ 2.499 — Atualizado em DD/MM/AAAA"
- Date in `#8088A0` (text-muted), normal weight, smaller size
- **NEVER** display prices on Home Page or in isolated showcases

### Table
- Header: `#12121C` background, uppercase, label-mono typography
- Rows: alternating from `#0A0A0F`, `#1C1C2E` dividers
- Hover: `rgba(168,85,247,0.12)` background

### Header (Sticky)
- Glassmorphism: `rgba(5,5,5,0.88)` with backdrop-filter blur(16px)
- Border-bottom: 1px solid `#1C1C2E`
- Logo glow: subtle electric purple halo behind logo
- Nav links: animated underline (expands left to right on hover)
- Dropdown: `#12121C` background, 0.4s ease transition
- **NO** login button, profile button, avatar, or authentication references

### Footer
- Background: `#020203`
- Grid: 4 columns (1.5fr 1fr 1fr 1fr)
- Links: `#8088A0`, hover to `#A855F7`

### Hero (Featured Article)
- Ambient electric purple halo glow behind the heading (0 0 80px rgba(168,85,247,0.25))
- Subtle neon green accent at CTA edges (0 0 60px rgba(57,255,20,0.2))
- **Featured editorial article** — NOT products
- Article title in H1 with optional purple→neon gradient on large screens
- Article category, author, and date metadata
- CTA: "Read full article" in neon green
- Focus on editorial content, not commerce

### Sidebar (Editorial — Home Page)
- **Popular / Most Read articles**: vertical list with title and date
- **Categories**: links to blog categories (Hardware, Games, eSports, Reviews)
- **Recent releases**: gaming industry news
- **Newsletter signup** (optional)
- **NO** products, prices, or commercial showcases on Home Page sidebar
- Products appear **only within article pages** when contextually relevant

### Home Page Sections (Editorial Only)
1. **Hero (Featured Article)**: Large image, title, category, "Read full article" CTA
2. **Latest News / Recent Articles**: Card grid (3 columns desktop)
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
- **Buttons:** Scale 1.03 + glow + smooth 0.25s transition. Cursor proximity triggers green glow.
- **Images:** Subtle zoom (1.02) on hover + subtle reflection following cursor.
- **Links:** Gradual color transition + animated underline.

Transitions use `0.25s ease` by default, `0.4s ease` for reveals. GPU-accelerated properties only (transform, opacity).

## Cursor Magnetic Effect (Stitch-inspired)

A sophisticated magnetic cursor effect. When the cursor moves across the page:

### Magnetic Wave
- A **smooth magnetic wave** follows cursor movement
- The wave **subtly deforms background illumination**
- Creates a sensation of **energy propagating** like a magnetic field
- Carbon fiber texture gains **localized gentle brightness** near cursor
- **Dispersed particles** drift subtly toward cursor direction
- A **very soft luminous halo** (~80px radius, 8-12% opacity) surrounds cursor

### Component Interaction
- **Cards** near cursor: edge receives **subtle purple illumination**, shadow tilts toward cursor
- **Buttons** near cursor: green glow **intensifies discreetly**, small green particles drift toward button
- **Images** near cursor: **small reflection** follows cursor position, brightness varies subtly

### Behavior
- Intensity responds to mouse **speed** (faster = stronger)
- **Fades out gradually** when cursor stops
- Extremely **smooth and sophisticated** — never exaggerated
- Never hinders readability
- Always rendered **below content layer**
- GPU accelerated (transform, opacity, will-change)
- Implemented via JS mouse position detection + CSS visual effects
- Respects `prefers-reduced-motion`

## Responsive & Performance

- **<=1024px:** Grid-4 to 2 columns, sidebar below content
- **<=768px:** Single column, H1 to 1.75rem
- **<=480px:** H1 to 1.5rem, edge-to-edge content

All effects use GPU acceleration. 60 FPS target. Respects `prefers-reduced-motion`: disables cursor effect, particles, and parallax. Graceful degradation on slower devices.

## Key Differentiator

This is a **premium gaming content portal**, not a store. Products appear **only within articles** when contextually relevant (e.g., "Best Gaming Headsets", "SSD Comparison", "Gaming Notebook Review"). When prices are displayed within articles, they must show the **date** beside them in muted text. Example: "[Product Name] — R$ 2.499 — Atualizado em 02/07/2026". The price is always in **Neon Green** bold, the date in **text-muted** normal weight.

The Home Page is **purely editorial**: featured article, latest news, reviews, categories, popular articles. No product showcases, no prices, no commercial vitrines.
