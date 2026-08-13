# Design System — Promo Gamer

> Portal de conteúdo gamer premium — preto profundo, roxo elétrico, ciano neon. Fonte **Geist** e ícones **Material Symbols**. Experiência editorial de última geração.

---

## 1. Identidade Visual

O site é um **grande portal de conteúdo gamer profissional**. A experiência deve ser semelhante à de navegar em IGN, PC Gamer, Adrenaline, Eurogamer, TecMundo Games ou GameSpot — com uma identidade editorial forte e premium.

O foco principal é **conteúdo editorial**: notícias, artigos, análises, reviews, guias, tutoriais, lançamentos, tecnologia, hardware, jogos, eSports, tendências, listas e comparativos.

Produtos aparecem **apenas contextualmente** dentro de artigos (ex: "Melhores Headsets Gamer", "Setup Gamer", "SSD para Jogos"). O portal **não é uma loja, marketplace ou vitrine de produtos**.

O visual transmite **tecnologia, inovação e alto desempenho**, lembrando interfaces premium de supercarros, setups gamers de elite e hardware entusiasta.

Efeitos visuais enriquecem a experiência sem prejudicar leitura, performance ou acessibilidade. Nada exagerado. Toda animação é elegante e discreta.

## 2. Cores

Cores vibrantes e intensas — nada de tons pastel, lavados ou acinzentados. O preto é Black Piano verdadeiro (preto profundo brilhante), o roxo é elétrico e vivo, e o ciano é o tom de ação/destaque (substituiu o verde limão neon do design anterior).

| Token | Dark | Light | Uso |
|-------|------|-------|-----|
| `--bg-primary` | `#050505` | `#F8F9FA` | Fundo principal |
| `--bg-secondary` | `#0a0a0a` | `#FFFFFF` | Fundo alternativo / surface-pure |
| `--bg-card` | `#111111` | `#EDEEEF` | Cards, containers, seções (surface-container) |
| `--bg-elevated` | `#1a1a1a` | `#E7E8E9` | Dropdowns, modais, elementos sobrepostos (surface-container-high) |
| `--bg-glass` | `rgba(10, 10, 10, 0.8)` | `rgba(255, 255, 255, 0.8)` | Header sticky com glassmorphism |
| `--accent` | `#A855F7` | `#8127CF` | Roxo — links, badges, hover, tech identity |
| `--accent-hover` | `#9333EA` | `#9C48EA` | Hover de elementos roxos |
| `--accent-dim` | `rgba(168, 85, 247, 0.14)` | `rgba(129, 39, 207, 0.10)` | Fundo sutil de tags e hover |
| `--accent-glow` | `rgba(168, 85, 247, 0.25)` | `rgba(129, 39, 207, 0.18)` | Sombra glow roxa |
| `--success` (ciano) | `#06B6D4` | `#00687A` | Ações, CTAs, badges de guia, destaque (substitui o neon) |
| `--success-dim` | `rgba(6, 182, 212, 0.12)` | `rgba(0, 104, 122, 0.10)` | Fundo sutil de ações ciano |
| `--warning` | `#FABC4E` | `#825100` | Laranja/âmbar — boxes de afiliado, avisos |
| `--danger` | `#FFB4AB` | `#BA1A1A` | Vermelho — descontos, erros |
| `--text-primary` | `#FFFFFF` | `#09090B` | Títulos, textos principais |
| `--text-secondary` | `#CFC2D6` | `#4D4354` | Parágrafos, descrições |
| `--text-muted` | `#A1A1AA` | `#A1A1AA` | Metadados, timestamps, notas |
| `--border` | `#1F1F1F` | `#CFC2D6` | Bordas padrão (outline-variant) |
| `--border-hover` | `#333333` | `#7E7385` | Bordas em hover (outline) |

### Identidade RGB

| Cor | Significado |
|-----|-------------|
| Roxo elétrico (`#A855F7` / `#8127CF`) | Tecnologia, inovação, identidade da marca |
| Ciano (`#06B6D4` / `#00687A`) | Ações, CTAs, destaques, badges de guia |
| Branco / preto | Equilíbrio, texto, hierarquia |

Iluminação RGB elegante — nunca parecer árvore de Natal.

## 3. Planos de Fundo

> **Nota (redesign Stitch v3, 13/08/2026):** o fundo do body é **configurável pelo admin** (aba
> Aparência → `src/data/blog-config.json`), com modos `preset` / `cor sólida` / `imagem`. O padrão
> atual é **cor sólida `#050505`** (dark) / `#F8F9FA` (light). O preset "carbono roxo" (fibra de
> carbono) continua disponível em `src/data/background-presets.json`. O admin **nunca** embute
> data-URI no CSS — uploads vão para `public/images/backgrounds/`.

### Background em Fibra de Carbono Premium (CSS puro, sem imagens) — preset

PRIORIDADE MÁXIMA (quando o preset "carbono-roxo" estiver ativo). O fundo deve ter aparência de **material Black Piano com fibra de carbono realista**, gerado inteiramente por CSS sem imagens externas. Inspirado nos acabamentos de fibra de carbono utilizados em supercarros, gabinetes gamers premium, notebooks topo de linha e periféricos de elite.

A textura deve ser **maior, mais definida, mais nítida e com maior resolução** que uma textura simples. Deve transmitir luxo e materialidade real — nunca parecer apenas um padrão repetitivo.

### Camadas do Background (preset carbono)

```
Camada 1: #050505 — Base Black Piano verdadeiro (preto profundo brilhante)
Camada 2: Fibra de carbono premium (múltiplos repeating-linear-gradient em 30º/60º/120º/150º com fibras maiores e mais espaçadas, opacidade 5-8%)
Camada 3: Micro-reflexos simulando verniz Black Piano (linear-gradient com ângulos variados, opacidade 2-4%, animação sutil)
Camada 4: Efeito glossy com variações de brilho (radial-gradient com posições aleatorizadas, opacidade 3-6%)
Camada 5: Leve noise/granulação de alta resolução (CSS gradient + pseudo-elemento, opacidade ~2%)
Camada 6: Reflexos diagonais suaves (linear-gradient 135º e 315º, opacidade ~3%)
Camada 7: Gradiente radial roxo elétrico no centro (opacidade ~5%, 600px blur)
Camada 8: Iluminação ciano em regiões estratégicas (CTAs, hero)
Camada 9: Partículas desfocadas de baixa opacidade (~1.5%)
```

### Especificação da Textura de Fibra de Carbono Premium

A textura de fibra de carbono é gerada com **múltiplos `repeating-linear-gradient`** sobrepostos, criando tramas cruzadas em diferentes ângulos para simular a aparência real da fibra de carbono tecida:

```css
/* Trama principal — ângulo 30º */
repeating-linear-gradient(
  30deg,
  rgba(255, 255, 255, 0.035) 0px,
  rgba(255, 255, 255, 0.035) 2px,
  transparent 2px,
  transparent 18px
)

/* Trama secundária — ângulo 150º (cruzamento) */
repeating-linear-gradient(
  150deg,
  rgba(255, 255, 255, 0.03) 0px,
  rgba(255, 255, 255, 0.03) 1.5px,
  transparent 1.5px,
  transparent 16px
)

/* Micro-trama — ângulo 60º (detalhes finos) */
repeating-linear-gradient(
  60deg,
  rgba(255, 255, 255, 0.015) 0px,
  rgba(255, 255, 255, 0.015) 1px,
  transparent 1px,
  transparent 24px
)

/* Micro-trama cruzada — ângulo 120º */
repeating-linear-gradient(
  120deg,
  rgba(255, 255, 255, 0.012) 0px,
  rgba(255, 255, 255, 0.012) 0.8px,
  transparent 0.8px,
  transparent 20px
)
```

Fibras maiores (16-24px de espaçamento), mais definidas (traços de 1-2px), com opacidade ligeiramente maior que a versão anterior (3-4%) para serem **perceptíveis porém elegantes**.

### Micro-Reflexos e Efeito Glossy

Para simular o verniz Black Piano, adicionar reflexos sutis:

```css
/* Reflexo principal — diagonal superior */
background-image:
  linear-gradient(
    135deg,
    transparent 30%,
    rgba(255, 255, 255, 0.015) 40%,
    transparent 50%
  ),
  /* ... demais camadas */
```

O efeito glossy é obtido com pequenas variações de brilho usando `radial-gradient` com posições quase aleatórias (pré-definidas em CSS) para criar a ilusão de profundidade e materialidade.

### Efeitos de Luz

- Brilho suave atrás do logotipo (halo roxo ~30% opacidade)
- Halo roxo elétrico atrás do banner principal / hero (~25% opacidade, 200px blur)
- Glow ciano atrás dos principais botões CTA
- Glow roxo suave nos cards ao passar o mouse

Nunca exagerar. A textura deve transmitir luxo e materialidade real.

## 4. Tipografia

| Propriedade | Valor |
|-------------|-------|
| Fonte principal | **Geist** (100–900) |
| Ícones | **Material Symbols Outlined** |
| Body size | 1rem / line-height 1.7 |
| Título H1 | 2.5rem, 700 weight, -0.02em letter-spacing |
| Título H2 | 1.75rem, 600 weight |
| Título H3 | 1.35rem, 600 weight |
| Título H4 | 1.15rem, 600 weight |
| Display (hero) | `display-lg` 3rem, 700 weight, -0.04em (headline tokens: `headline-lg` 2rem, `headline-md` 1.5rem, `body-lg` 1.125rem, `body-md` 1rem, `label-md` 0.875rem) |
| Preço | `--success` (ciano), bold, com data ao lado em `--text-muted` |
| Links | `--accent` com hover `--accent-hover`, underline animado no hover |

## 5. Efeito Magnético do Cursor (Stitch-like)

> ⚠️ **Removido no redesign Stitch v3 (13/08/2026).** O componente `CursorEffect.astro` não
> existe mais no código atual. Esta seção é mantida como histórico do conceito original.

Implementar efeito inspirado no Stitch by Google. Quando o cursor se mover pela página:

### Onda Magnética Principal

- Uma **onda magnética suave** acompanha o movimento do cursor
- A onda **deforma levemente a iluminação do fundo** ao passar
- Cria uma sensação de **energia se propagando** como um campo magnético
- A textura de fibra de carbono ganha um **brilho sutil** localizado próximo ao cursor
- **Partículas dispersas** movimentam-se discretamente na direção do cursor
- Um **halo luminoso muito suave** (~80px de raio, opacidade 8-12%) circunda o cursor

### Interação com Componentes

Quando o cursor passa **próximo de um card**:
- O card recebe uma **leve iluminação roxa** na borda próxima ao cursor
- A sombra do card inclina-se sutilmente na direção do cursor

Quando o cursor passa **próximo de um botão**:
- O glow verde do botão **aumenta discretamente** de intensidade
- Pequenas partículas verdes migram em direção ao botão

Quando o cursor passa **próximo de imagens**:
- Um **pequeno reflexo** acompanha a posição do cursor sobre a imagem
- O brilho da imagem varia sutilmente conforme o cursor se move

### Comportamento

- A intensidade do efeito **responde à velocidade** do mouse (mais rápido = mais intenso)
- O efeito **desaparece gradualmente** quando o cursor para
- Tudo é **extremamente suave** — transmite sofisticação, nunca exagero
- Nunca dificulta a leitura
- Sempre em camada **inferior ao conteúdo**
- GPU accelerated (transform, opacity, will-change)
- Deve ser implementado via JavaScript com detecção de posição do mouse + CSS para os efeitos visuais
- Respeitar `prefers-reduced-motion`

## 6. Glassmorphism

Sempre que fizer sentido:

- Transparência suave (`--bg-glass`)
- Leve desfoque (backdrop-filter blur 12-16px)
- Bordas claras discretas (1px `--border` com opacidade)
- Sombras elegantes

Header sticky, modais, cards especiais.

## 7. Espaçamento (grid 8px)

| Classe | Valor |
|--------|-------|
| `xs` | 4px |
| `base` | 8px |
| `sm` | 12px |
| `md` | 24px |
| `lg` | 48px |
| `xl` | 80px |
| `gutter` | 24px |

## 8. Microanimações

Todos os componentes interativos respondem ao usuário:

### Cards
- Leve elevação no hover (translateY -3px)
- Sombra mais intensa (`--shadow-lg` + `--accent-glow`)
- Borda iluminada (vira `--border-hover`)

### Botões
- Pequeno aumento de escala (transform scale 1.03)
- Brilho suave (`--accent-glow` ou `--success-dim`)
- Transição fluida (0.25s ease)

### Imagens
- Zoom extremamente discreto no hover (scale 1.02)
- Animação suave

### Links
- Mudança gradual de cor
- Pequeno underline animado (expande da esquerda)

Todas as transições: `--transition` (0.25s ease), GPU accelerated (transform, opacity).

## 9. Profundidade

Diferentes níveis de profundidade. Elementos mais importantes parecem levemente elevados. Evitar aparência totalmente plana.

| Nível | Elemento | Sombra |
|-------|----------|--------|
| 0 | Background | — |
| 1 | Cards, containers | `--shadow` |
| 2 | Elevated (dropdowns, modais) | `--shadow-lg` + `--accent-glow` |
| 3 | Hero, CTAs principais | `--shadow-lg` + `--success-dim` |

## 10. Home Page (Editorial)

A Home Page é **exclusivamente editorial**. Nenhum produto, preço ou vitrine comercial aparece na página inicial.

### Seções da Home Page

1. **Hero (Matéria Principal)**: Artigo em destaque com imagem grande, título, categoria e CTA "Ler matéria"
2. **Notícias Recentes / Últimas Matérias**: Grid de artigos em cards (3 colunas no desktop)
3. **Reviews & Análises**: Seção destacada com análises de hardware e jogos
4. **Categorias**: Navegação visual pelas categorias do blog (Hardware, Jogos, eSports, etc.)
5. **Matérias Mais Lidas**: Lista sidebar com artigos populares
6. **Lançamentos**: Novidades do mundo gamer

### Regras

- **Nunca** exibir produtos, preços, botões "Comprar" ou "Ver Preço" na Home
- Sidebar da Home deve conter **apenas conteúdo editorial** (artigos populares, categorias)
- Produtos aparecem **somente dentro de artigos** quando contextualmente relevantes
- O visitante deve sentir que entrou em um portal como IGN ou PC Gamer — não em uma loja

## 11. Componentes

### Card

- Background: `--bg-card`
- Border: 1px `--border`, hover vira `--border-hover` + `--accent-glow`
- Border-radius: `--radius-lg` (12px)
- Padding: 1.5rem
- Hover: translateY(-3px), `--shadow-lg`, borda iluminada roxa

### Botão primário (`.btn`)

- Background: `--accent` (roxo) para tech / `--success` (ciano) para ações
- Hover: `--accent-hover` / ciano mais escuro + glow correspondente
- Scale hover: 1.03
- Padding: 0.7rem 1.6rem
- Border-radius: 8px
- Font: 600, 0.9rem

### Botão ghost (`.btn-ghost`)

- Background: transparente
- Border: 1px `--border`
- Hover: border vira `--accent` + `--accent-dim` background

### Tag / Badge

- Pill (border-radius: 20px)
- `tag-purple`: bg `--accent-dim`, border 1px `--accent`, texto roxo
- `tag-cyan`: bg `--success-dim`, border 1px `--success`, texto ciano
- Badge de card colorido por categoria: review → roxo, notícia → neutro, guia → ciano, promoções → vermelho
- Uppercase para categorias

### Affiliate Box (contextual em artigos)

- Usado **apenas dentro de artigos** quando há recomendação de produto
- Background: gradient de `--bg-card` + `rgba(250, 188, 78, 0.05)`
- Border-left: 3px `--warning` (#FABC4E)
- Padding: 1.2rem
- Título em `--warning`
- Preço em `--success` (ciano) com data ao lado em `--text-muted`

### Preço (contextual em artigos)

Sempre exibir o preço em `--success` (ciano), bold, com a data ao lado em `--text-muted` (ex: "R\$ 2.499 — Atualizado em 02/07/2026").
**Nunca** exibir preços na Home Page ou em vitrines isoladas — apenas dentro de artigos onde o produto é contextualmente relevante.

### Sidebar (Editorial)

- Seções exclusivamente editoriais
- **Artigos populares / Mais lidos**: lista vertical com título e data
- **Categorias**: links para categorias do blog (ex: Hardware, Jogos, eSports, Reviews)
- **Lançamentos recentes**: novidades do mundo gamer
- **Newsletter**: call-to-action para assinar (opcional)
- **NÃO** incluir produtos, preços ou vitrines comerciais
- Produtos aparecem **apenas na sidebar de páginas de artigo** quando relevantes ao conteúdo

### Tabela

- Header: bg `--bg-elevated`, uppercase, label-mono
- Células: border-bottom 1px `--border`
- Hover na linha: bg `--accent-dim`

### Header

- Sticky no topo
- Glassmorphism: `--bg-glass` + backdrop-filter blur(16px)
- Border-bottom: 1px `--border`
- Logo com altura/posição configuráveis (`--logo-height`, `--logo-offset`)
- Dropdown: `--bg-elevated`, `--transition-slow` (0.35s)
- Links com underline animado no hover
- **NÃO** incluir botão de Login, Entrar, Perfil ou avatar de usuário
- **NÃO** incluir qualquer referência a autenticação

### Footer

- Background: `--bg-secondary`
- Grid de 4 colunas (descrição + institucional + redes)
- Links em `--text-muted`, hover `--success` (ciano)
- Ícones sociais via Material Symbols

### Hero (Artigo em Destaque)

- Imagem de fundo com gradiente de baixo (`from-background`)
- **Artigo principal em destaque** — não produtos
- Título do artigo em H1 `display-lg`
- Categoria em badge roxo, metadata (tempo relativo + autor)
- Call-to-action: "Ler matéria" (tema antigo) → hoje o hero inteiro é o link
- Cor de hover do título: roxo

## 12. Glow & Sombras

| Token | Valor |
|-------|-------|
| `--shadow-sm` | 0 1px 3px rgba(0,0,0,0.4) |
| `--shadow` | 0 4px 12px rgba(0,0,0,0.5) |
| `--shadow-lg` | 0 8px 32px rgba(0,0,0,0.6) |
| `--accent-glow` | 0 0 20px rgba(168,85,247,0.22) |
| `--success-dim` | 0 0 20px rgba(6,182,212,0.4) (hover de CTAs ciano) |

## 13. Responsivo

| Breakpoint | Ajustes |
|------------|---------|
| <=1024px | Grid-4 vira 2 colunas, sidebar abaixo do conteúdo |
| <=768px | Grid-3/2/4 viram 1 coluna, H1 1.75rem, H2 1.35rem |
| <=480px | H1 1.5rem, content-width 100% |

Caso o dispositivo seja mais lento ou o usuário prefira `prefers-reduced-motion`, simplificar ou desativar animações automaticamente. A experiência continua excelente em celulares.

## 14. Performance

- Todos os efeitos utilizam aceleração GPU (transform, opacity, will-change)
- Animações mantêm alta taxa de quadros (60 FPS)
- `prefers-reduced-motion`: desativa animações e efeitos pesados
- Fallback suave para dispositivos mais lentos

## 15. Animações

| Token | Duração | Uso |
|-------|---------|-----|
| `--transition` | 0.25s ease | Hover, cor, borda, scale |
| `--transition-slow` | 0.4s ease | Dropdown, modal, reveal |

## 16. Arquivos de implementação

| Arquivo | O que contém |
|---------|--------------|
| `src/styles/global.css` | Variáveis CSS (paleta dark/light), estilos globais, tipografia Geist |
| `src/styles/effects.css` | Glass nav, scrollbar, affiliate-box |
| `src/layouts/Layout.astro` | Meta tags, theme-color (#050505 dark / #F8F9FA light), injeção do fundo (blog-config.json), Google Fonts (Geist + Material Symbols), themeCss por tema |
| `src/components/Header.astro` | Header glass `bg-surface/80` + logo "PROMO GAMER" + ThemeToggle (Material Symbols) |
| `src/components/Footer.astro` | Footer em grid 4 colunas com redes (Material Symbols) |
| `src/components/ArticleCard.astro` | Card com imagem 16:9, badge por categoria, hover ciano |
| `src/components/HeroSection.astro` | Hero `h-[400px]/sm:h-[500px]` com gradiente e metadata |
| `src/components/Sidebar.astro` | Sidebar editorial (Populares, Categorias chips, Newsletter + banner Telegram) |
| `src/components/TableOfContents.astro` | TOC "Nesta Análise" com borda ciano e subtópicos recolhíveis |
| `src/pages/blog/[...slug].astro` | Template de artigo (hero full-bleed, TOC, lightbox, barra de progresso) |
