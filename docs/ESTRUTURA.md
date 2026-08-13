# Estrutura do Projeto

```
blog-gamer/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml                  # Publica dist/ no GitHub Pages
│   │   └── gerar-conteudo.yml          # Cron diário: npm test → gerar-artigo.mjs
│   │
├── docs/                              # Documentação (fonte de verdade)
│   ├── CREDENCIAIS.md
│   ├── DESIGN.md
│   ├── ESTRUTURA.md
│   ├── FLUXO.md
│   ├── METODOLOGIA.md                 # Critérios de ranking dos produtos
│   ├── PROGRESSO.md
│   ├── REGRAS.md
│   └── TROUBLESHOOTING.md
│
├── scripts/                           # Geração e manutenção (Node .mjs)
│   ├── gerar-artigo.mjs               # Pipeline principal de geração
│   ├── gerar-artigo-pilar.mjs         # Artigo pilar
│   ├── google_shopping.mjs            # Busca de produtos (Serper)
│   ├── product_naming.mjs             # Categorias únicas + nomenclatura
│   ├── monitor_api.mjs                # Cliente da Frente 4 (afiliados)
│   ├── download-images.mjs            # Baixa imagens dos produtos
│   ├── migrar-artigos.mjs             # Migra artigos para o novo formato
│   ├── limpar-imagens-orfas.mjs       # Remove imagens sem referência
│   └── regenerate-*.mjs               # Recria capas de artigos
│
├── src/
│   ├── content/artigos/               # Artigos (Markdown + frontmatter)
│   ├── data/
│   │   ├── blog-config.json           # Tema/fundo (aba Aparência do admin)
│   │   └── background-presets.json    # Presets de fundo
│   ├── components/                    # Astro (Header, ThemeToggle, Footer...)
│   ├── layouts/
│   │   └── Layout.astro               # Injetor do tema + fundo (anti-FOUC)
│   ├── pages/                         # Rotas Astro
│   ├── styles/
│   │   ├── global.css                 # Design system + temas dark/light
│   │   └── effects.css                # Efeitos (carbon, glass, scrollbars)
│   └── plugins/                       # Remark/rehype customizados
│
├── public/
│   ├── admin/                         # Painel admin (fonte de verdade)
│   │   ├── index.html                 # Editor (abas Aparência/Layout/Artigos/Produtos)
│   │   ├── editor.js
│   │   └── marked.min.js
│   ├── images/produtos/               # Imagens baixadas localmente
│   ├── images/backgrounds/            # Fundos enviados pelo admin (upload na aba Aparência/Layout)
│   └── CNAME                          # promogamer.com.br
│
├── skills/                            # Skills do opencode/agentes
│   ├── produtos-gamer/                # Regra de categoria única (aponta p/ product_naming.mjs)
│   ├── pesquisa-web/
│   ├── imagens-jogos/
│   └── validacao-artigo/
│
├── tailwind.config.mjs                # Paleta mapeada para CSS variables
├── astro.config.mjs                   # site: https://promogamer.com.br
├── .env                               # Chaves de API (NÃO versionado)
└── README.md
```

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `scripts/gerar-artigo.mjs` | Pipeline completo: descoberta → ranking → capa → Markdown |
| `scripts/monitor_api.mjs` | Cliente da Frente 4 (produtos com link de afiliado ML/Shopee) |
| `scripts/google_shopping.mjs` | Fallback de busca de produtos via Serper |
| `scripts/product_naming.mjs` | Categorias únicas e nomenclatura dos produtos |
| `scripts/migrar-artigos.mjs` | Migra artigos publicados para o novo formato |
| `scripts/limpar-imagens-orfas.mjs` | Remove imagens sem referência nos artigos |
| `src/data/blog-config.json` | Tema (dark/light) e fundo do blog (aba Aparência) |
| `src/data/afiliados_pendentes.json` | Produtos publicados sem link de afiliado (aba Pendências do admin) |
| `public/admin/index.html` | Painel admin publicado em `/admin/` |
| `src/layouts/Layout.astro` | Aplica tema e fundo vindos do `blog-config.json` |

## Geração de Conteúdo

Tudo acontece no **GitHub Actions** (`.github/workflows/gerar-conteudo.yml`), cron diário:

1. `npm test` (valida os testes antes de gerar)
2. `node scripts/gerar-artigo.mjs` → salva o artigo em `src/content/artigos/`
3. Push → `deploy.yml` publica no GitHub Pages

O pipeline **Python legado na VM** (`scheduler.py`, `generate_article.py`, `ml_affiliate.py`)
está **fora de uso** (token do GitHub expirado). Não é mais o sistema ativo.

## Temas e Fundo

- Config em `src/data/blog-config.json` (`theme`, `allowVisitorThemeToggle`, `background`)
- Presets de fundo em `src/data/background-presets.json`
- `Layout.astro` injeta o fundo (`:root:root`) e o script anti-FOUC antes do primeiro paint
- Tema claro: `:root[data-theme="light"]` em `src/styles/global.css`
- Painel admin (aba Aparência) salva essas configs e dispara o deploy
- **Upload de fundo** pelo admin grava a imagem em `public/images/backgrounds/` (máx. 4 MB) e usa
  URL relativa — nunca embute data-URI no CSS (ver `docs/TROUBLESHOOTING.md`)

## Painel Admin (`/admin/`)

Vive em `public/admin/` (fonte de verdade, publicado pelo build). Principais funções:

| Aba | Função | Onde salva |
|-----|--------|-----------|
| **Dashboard** | Estatísticas e ações rápidas | — |
| **Artigos** | CRUD completo de `src/content/artigos/*.md` | GitHub API |
| **Pendências** | Produtos sem link de afiliado (colar link, marcar resolvido) | `src/data/afiliados_pendentes.json` |
| **Editor** | Edição de metadados, markdown, botões de produto e prévia WYSIWYG | GitHub API |
| **Configurações** | Edição bruta de `tailwind.config.mjs` e `src/styles/global.css` | GitHub API |
| **Aparência** | Tema (dark/light), toggle para visitantes, fundo (preset/cor/imagem) | `src/data/blog-config.json` |
| **Layout** | Editor visual: cores, sliders (nav/logo/colunas/fontes), upload de logo e fundo | `src/styles/global.css` (bloco `EDITOR THEME OVERRIDES`) |

**Proteções implementadas (13/08/2026):** `injectThemeVars` aborta se o `global.css` vier vazio/sem
`@tailwind`; `getFile` baixa arquivos grandes via `download_url`; uploads de logo/fundo usam
`getFileMeta` (SHA sem decodificar binário) e `putFileRaw` com retry 409; CSS e logo salvam em
`try/catch` separados; `generateThemeCSS` não copia o fundo escuro para o tema claro.

## GitHub Pages

- Branch: `main`
- Build automático via GitHub Actions
- URL: `https://promogamer.com.br/`
- Domínio configurado em `public/CNAME`
- Imagens servidas de `/images/produtos/`
