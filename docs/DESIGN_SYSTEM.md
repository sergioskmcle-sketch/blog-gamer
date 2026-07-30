# Design System — Blog Gamer

> Portal de conteúdo gamer premium — Black Piano, roxo elétrico, verde limão neon. Experiência editorial de última geração.

---

## 1. Identidade Visual

O site é um **grande portal de conteúdo gamer profissional**. A experiência deve ser semelhante à de navegar em IGN, PC Gamer, Adrenaline, Eurogamer, TecMundo Games ou GameSpot — com uma identidade editorial forte e premium.

O foco principal é **conteúdo editorial**: notícias, artigos, análises, reviews, guias, tutoriais, lançamentos, tecnologia, hardware, jogos, eSports, tendências, listas e comparativos.

Produtos aparecem **apenas contextualmente** dentro de artigos (ex: "Melhores Headsets Gamer", "Setup Gamer", "SSD para Jogos"). O portal **não é uma loja, marketplace ou vitrine de produtos**.

O visual transmite **tecnologia, inovação e alto desempenho**, lembrando interfaces premium de supercarros, setups gamers de elite e hardware entusiasta.

Efeitos visuais enriquecem a experiência sem prejudicar leitura, performance ou acessibilidade. Nada exagerado. Toda animação é elegante e discreta.

## 2. Cores

Cores vibrantes e intensas — nada de tons pastel, lavados ou acinzentados. O preto é Black Piano verdadeiro (preto profundo brilhante), o roxo é elétrico e vivo, o verde é verde-limão neon que chama atenção imediatamente.

| Token | HEX | Uso |
|-------|-----|-----|
| `--bg-primary` | `#050505` | Black Piano verdadeiro — fundo principal |
| `--bg-secondary` | `#020203` | Fundo do footer, seções secundárias |
| `--bg-card` | `#0A0A0F` | Cards, containers, seções |
| `--bg-elevated` | `#12121C` | Dropdowns, modais, elementos sobrepostos |
| `--bg-glass` | `rgba(5, 5, 5, 0.88)` | Header sticky com glassmorphism |
| `--purple` | `#A855F7` | Roxo elétrico — links, badges, hover, tech identity |
| `--purple-hover` | `#9333EA` | Hover de elementos roxos |
| `--purple-dim` | `rgba(168, 85, 247, 0.12)` | Fundo sutil de tags e hover |
| `--purple-glow` | `rgba(168, 85, 247, 0.35)` | Sombra glow roxa |
| `--neon` | `#39FF14` | Verde limão neon — CTAs, preços (contextual em artigos), destaques |
| `--neon-hover` | `#2ED90E` | Hover de elementos neon |
| `--neon-dim` | `rgba(57, 255, 20, 0.1)` | Fundo sutil de ações neon |
| `--neon-glow` | `rgba(57, 255, 20, 0.3)` | Sombra glow verde neon |
| `--warning` | `#F97316` | Laranja — boxes de afiliado, avisos |
| `--yellow` | `#FACC15` | Amarelo — estrelas, destaques |
| `--danger` | `#EF4444` | Vermelho — descontos, erros |
| `--text-primary` | `#FFFFFF` | Títulos, textos principais |
| `--text-secondary` | `#D1D5E0` | Parágrafos, descrições |
| `--text-muted` | `#8088A0` | Metadados, timestamps, notas |
| `--border` | `#1C1C2E` | Bordas padrão |
| `--border-hover` | `#3D3D60` | Bordas em hover |

### Identidade RGB

| Cor | Significado |
|-----|-------------|
| Roxo elétrico (`#A855F7`) | Tecnologia, inovação, identidade da marca |
| Verde limão neon (`#39FF14`) | Ações importantes, CTAs, preços (contextual), destinos |
| Branco (`#FFFFFF`) | Equilíbrio, texto, hierarquia |

Iluminação RGB elegante — nunca parecer árvore de Natal.

## 3. Planos de Fundo

### Background em Fibra de Carbono Premium (CSS puro, sem imagens)

PRIORIDADE MÁXIMA. O fundo deve ter aparência de **material Black Piano com fibra de carbono realista**, gerado inteiramente por CSS sem imagens externas. Inspirado nos acabamentos de fibra de carbono utilizados em supercarros, gabinetes gamers premium, notebooks topo de linha e periféricos de elite.

A textura deve ser **maior, mais definida, mais nítida e com maior resolução** que uma textura simples. Deve transmitir luxo e materialidade real — nunca parecer apenas um padrão repetitivo.

### Camadas do Background

```
Camada 1: #050505 — Base Black Piano verdadeiro (preto profundo brilhante)
Camada 2: Fibra de carbono premium (múltiplos repeating-linear-gradient em 30º/60º/120º/150º com fibras maiores e mais espaçadas, opacidade 5-8%)
Camada 3: Micro-reflexos simulando verniz Black Piano (linear-gradient com ângulos variados, opacidade 2-4%, animação sutil)
Camada 4: Efeito glossy com variações de brilho (radial-gradient com posições aleatorizadas, opacidade 3-6%)
Camada 5: Leve noise/granulação de alta resolução (CSS gradient + pseudo-elemento, opacidade ~2%)
Camada 6: Reflexos diagonais suaves (linear-gradient 135º e 315º, opacidade ~3%)
Camada 7: Gradiente radial roxo elétrico no centro (opacidade ~5%, 600px blur)
Camada 8: Iluminação verde neon em regiões estratégicas (CTAs, hero)
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
- Glow verde neon atrás dos principais botões CTA (~30% opacidade)
- Glow roxo suave nos cards ao passar o mouse
- Pequenos reflexos verdes próximos aos CTAs
- Variações de brilho no fundo conforme posição do cursor (integrado ao efeito magnético)

Nunca exagerar. A textura deve transmitir luxo e materialidade real.

## 4. Tipografia

| Propriedade | Valor |
|-------------|-------|
| Fonte principal | Inter (400, 500, 600, 700, 800) |
| Fonte mono | JetBrains Mono (400, 500) |
| Body size | 1rem / line-height 1.7 |
| Título H1 | 2.5rem, 800 weight, -0.02em letter-spacing, gradiente roxo→neon (opcional) |
| Título H2 | 1.75rem, 700 weight, cor `--purple` |
| Título H3 | 1.35rem, 600 weight |
| Título H4 | 1.15rem, 600 weight |
| Preço | `--neon`, bold, com data ao lado em `--text-muted` |
| Links | `--purple` com hover `--purple-hover`, underline animado no hover |

## 5. Efeito Magnético do Cursor (Stitch-like)

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
| `mt-1` / `mb-1` | 0.5rem (8px) |
| `mt-2` / `mb-2` | 1rem (16px) |
| `mt-3` / `mb-3` | 1.5rem (24px) |
| `mt-4` / `mb-4` | 2rem (32px) |
| `mt-5` / `mb-5` | 3rem (48px) |

## 8. Microanimações

Todos os componentes interativos respondem ao usuário:

### Cards
- Leve elevação no hover (translateY -3px)
- Sombra mais intensa (`--shadow-lg` + `--purple-glow`)
- Borda iluminada (vira `--border-hover`)

### Botões
- Pequeno aumento de escala (transform scale 1.03)
- Brilho suave (`--purple-glow` ou `--neon-glow`)
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
| 2 | Elevated (dropdowns, modais) | `--shadow-lg` + `--purple-glow` |
| 3 | Hero, CTAs principais | `--shadow-lg` + `--neon-glow` |

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
- Border: 1px `--border`, hover vira `--border-hover` + `--purple-glow`
- Border-radius: `--radius-lg` (14px)
- Padding: 1.5rem
- Hover: translateY(-3px), `--shadow-lg`, borda iluminada roxa

### Botão primário (`.btn`)

- Background: `--purple` (#A855F7) para tech / `--neon` (#39FF14) para ações
- Hover: `--purple-hover` ou `--neon-hover` + glow correspondente
- Scale hover: 1.03
- Padding: 0.7rem 1.6rem
- Border-radius: 8px
- Font: 600, 0.9rem

### Botão ghost (`.btn-ghost`)

- Background: transparente
- Border: 1px `--border`
- Hover: border vira `--purple` + `--purple-dim` background

### Tag / Badge

- Pill (border-radius: 20px)
- `tag-purple`: bg `--purple-dim`, border 1px `--purple`, texto roxo
- `tag-neon`: bg `--neon-dim`, border 1px `--neon`, texto neon
- Uppercase para categorias

### Affiliate Box (contextual em artigos)

- Usado **apenas dentro de artigos** quando há recomendação de produto
- Background: gradient de `--bg-card` + `rgba(249, 115, 22, 0.05)`
- Border-left: 3px `--warning` (#F97316)
- Padding: 1.2rem
- Título em `--warning`
- Preço em `--neon` com data ao lado em `--text-muted`

### Preço (contextual em artigos)

Sempre exibir o preço em `--neon`, bold, com a data ao lado em `--text-muted` (ex: "R\$ 2.499 — Atualizado em 02/07/2026").
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
- Hover na linha: bg `--purple-dim`

### Header

- Sticky no topo
- Glassmorphism: `--bg-glass` + backdrop-filter blur(16px)
- Border-bottom: 1px `--border`
- Logo com brilho suave roxo atrás
- Dropdown: `--bg-elevated`, `--transition-slow` (0.35s)
- Links com underline animado no hover
- **NÃO** incluir botão de Login, Entrar, Perfil ou avatar de usuário
- **NÃO** incluir qualquer referência a autenticação

### Footer

- Background: `--bg-secondary` (#020203)
- Grid de 4 colunas (1.5fr 1fr 1fr 1fr)
- Links em `--text-muted`, hover `--purple`

### Hero (Artigo em Destaque)

- Halo roxo elétrico atrás como iluminação ambiente (`--purple-halo`)
- Gradiente sutil com toque neon nas bordas
- **Artigo principal em destaque** — não produtos
- Título do artigo em H1 com gradiente roxo→neon (opcional)
- Categoria, autor e data do artigo
- Call-to-action: "Ler matéria completa" em verde neon
- Glow verde neon no CTA principal (`--neon-halo`)

## 12. Glow & Sombras

| Token | Valor |
|-------|-------|
| `--shadow-sm` | 0 1px 3px rgba(0,0,0,0.5) |
| `--shadow` | 0 4px 12px rgba(0,0,0,0.6) |
| `--shadow-lg` | 0 8px 32px rgba(0,0,0,0.75) |
| `--purple-glow` | 0 0 30px rgba(168,85,247,0.35) |
| `--neon-glow` | 0 0 25px rgba(57,255,20,0.3) |
| `--purple-halo` | 0 0 80px rgba(168,85,247,0.25) |
| `--neon-halo` | 0 0 60px rgba(57,255,20,0.2) |

## 13. Responsivo

| Breakpoint | Ajustes |
|------------|---------|
| <=1024px | Grid-4 vira 2 colunas, sidebar abaixo do conteúdo |
| <=768px | Grid-3/2/4 viram 1 coluna, H1 1.75rem, H2 1.35rem |
| <=480px | H1 1.5rem, content-width 100% |

Caso o dispositivo seja mais lento ou o usuário prefira `prefers-reduced-motion`, simplificar ou desativar efeitos (cursor magnetico, particulas, parallax) automaticamente. A experiência continua excelente em celulares.

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
| `src/styles/global.css` | Variáveis CSS, texturas, estilos globais, cursor effect |
| `src/styles/effects.css` | Cursor magnético, partículas, background layers, carbon fiber CSS |
| `src/layouts/Layout.astro` | Meta tags, theme-color (#050505), Google Fonts |
| `src/components/Header.astro` | Header glassmorphism + underline animado |
| `src/components/Footer.astro` | Footer escuro com grid |
| `src/components/ArticleCard.astro` | Card com hover elevado + borda roxa |
| `src/components/HeroSection.astro` | Hero com halo roxo + gradiente neon |
| `src/components/Sidebar.astro` | Sidebar editorial (categorias, artigos populares) |
| `src/components/CursorEffect.astro` | Efeito magnético do cursor |
| `src/pages/blog/[...slug].astro` | Template de artigo |
