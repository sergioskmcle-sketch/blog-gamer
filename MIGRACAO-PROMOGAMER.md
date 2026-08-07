# Migração: Blog Gamer → Promo Gamer

Documento técnico da migração de marca e de domínio do projeto, do repositório GitHub Pages `https://sergioskmcle-sketch.github.io/blog-gamer` para o domínio próprio **`https://promogamer.com.br`** servido na raiz (sem subcaminho).

---

## 1. Objetivo

- Renomear o site de **"Blog Gamer"** para **"Promo Gamer"**.
- Migrar o endereço de publicação de `https://sergioskmcle-sketch.github.io/blog-gamer` para `https://promogamer.com.br` (raiz, sem `/blog-gamer`).
- Manter o **GitHub Pages** como hospedagem.

---

## 2. Contexto e decisões

| Item | Decisão |
|---|---|
| Nome do site | **Promo Gamer** |
| Domínio | **promogamer.com.br** (registro no Registro.br solicitado pelo usuário) |
| Estrutura de URL | Raiz do domínio, sem `base` (remoção de `/blog-gamer`) |
| Hospedagem | GitHub Pages (mantida) |
| Logo | Mantida a imagem atual (`public/images/logo-blog.webp`) — decisão do usuário |

---

## 3. Alterações aplicadas

### 3.1 Substituição em massa

Aplicada em **86 arquivos (427 ocorrências)**:

- `sergioskmcle-sketch.github.io` → `promogamer.com.br`
- `/blog-gamer` → `` (remoção do subcaminho)
- `Blog Gamer` → `Promo Gamer`

**Diretórios/arquivos propositalmente NÃO alterados:**

- `dist/` (gerado pelo build)
- `blog/` (raiz — artefato antigo versionado, não afeta o deploy)
- `auditorias/` (relatórios históricos)
- `squads/`, `mcps/`, `.claude/`, `node_modules/`, `.astro/`, `.git/`
- `package-lock.json`
- `PROMPT_*`, `PROMPT_CONEXAO.md`
- `automation/docs/CREDENCIAIS.md`

### 3.2 Configuração do Astro

**`astro.config.mjs`:**
- `site: "https://promogamer.com.br"`
- Removido `base: "/blog-gamer"` → site agora é servido na raiz
- Mantido `output: "static"`

### 3.3 Domínio

- Criado **`public/CNAME`** contendo `promogamer.com.br` (é copiado para o build e instrui o GitHub Pages a usar o domínio).

### 3.4 Scripts corrigidos (capas)

Blocos que ficaram inválidos após a remoção do prefixo `""`/`startsWith("")`:

- `scripts/gerar-artigo.mjs` — `fm.image = coverImage` direto
- `scripts/gerar-artigo-pilar.mjs` — `const capaPath = capaIA`
- `scripts/regenerate-cadeiras-cover.mjs`
- `scripts/regenerate-fones-cover.mjs`
- `scripts/regenerate-monitores-cover.mjs`
- `scripts/regenerate-psplus-cover.mjs`
- `scripts/regenerate-xbox-cover.mjs`

### 3.5 Links internos

`scripts/gerar-artigo.mjs` já gera/valida links internos no formato `[texto](/blog/slug-do-artigo/)` (sem `blog-gamer`), tanto no prompt de geração quanto na validação (`linkRegex`).

### 3.6 Fundo liso e remoção do efeito de cursor

Decisão do usuário após a migração: o site passou a ter **fundo liso** (sem textura/hexágonos) e o **efeito de brilho que seguia o cursor foi removido**.

- **`src/data/blog-config.json`** → `background.mode: "solid"` (`--body-bg-image: none`).
- **`src/layouts/Layout.astro`** → adicionado `!important` em `--body-bg-image` nos 3 ramos (`preset`, `image`, `solid`) para corrigir o conflito de especificidade com `:root[data-theme="light"]` do `global.css` (que reaplicava a textura no tema claro).
- **`src/styles/global.css`** → removido o overlay `html::before` (hexágonos) do tema escuro e do claro.
- **`src/components/CursorEffect.astro`** → **deletado** (era o brilho roxo radial que seguia o mouse); removido do `Layout.astro` e o CSS `.carbon-shine`/`.magnet-lens` foi limpo de `effects.css`.
- **`public/admin/index.html`** → `imgUrl()` passou a usar base dinâmica via `getBlogBase()`/`window.location`, sem URL fixa (`https://promogamer.com.br`), para funcionar em qualquer base de publicação.

---

## 4. Validação executada

- **Grep em `src/`**: zero ocorrências de `blog-gamer`, `github.io` ou `Blog Gamer`.
- **Grep global**: restaram apenas em `blog/` (artefato antigo, ignorável) e `auditorias/` (histórico, ignorável).
- **Grep em `dist/`**: só links legítimos do repositório GitHub (`github.com/sergioskmcle-sketch`) no `admin`, que são corretos.
- **Build local** (`npm run build`): **OK**, 145 páginas geradas na raiz, sem erros.
- **`dist/sitemap-index.xml`** → `https://promogamer.com.br/sitemap-0.xml`
- **`dist/CNAME`** → `promogamer.com.br`
- **`dist/robots.txt`** → `Sitemap: https://promogamer.com.br/sitemap-index.xml`
- **`src/pages/rss.xml.js`** → título "Promo Gamer", base `https://promogamer.com.br`, links `/blog/slug/`.

---

## 5. Estado atual

### 5.1 Concluído
- Renomeação de marca aplicada.
- Configuração do domínio e remoção da base concluída.
- CNAME criado.
- Scripts de capa corrigidos.
- Build validado localmente.
- Logo mantida (decisão do usuário).
- **DNS propagado** no Registro.br: `A` raiz → `185.199.108.153` e `CNAME www` → `sergioskmcle-sketch.github.io`, confirmado em resolvers públicos (1.1.1.1, 8.8.8.8, 9.9.9.9, OpenDNS).
- **Custom domain ativo** no GitHub Pages: `promogamer.com.br` (API `gh api .../pages` → `cname: "promogamer.com.br"`).
- **Site publicado e validado** em `https://promogamer.com.br` (raiz, www, sitemap, RSS, robots, admin, artigo de exemplo — todos HTTP 200).
- **Fundo liso** (sem textura) aplicado nos temas escuro e claro, corrigindo conflito de especificidade CSS com `!important`.
- **Efeito de cursor removido** (`CursorEffect.astro` deletado).
- **`imgUrl()` no admin** agora usa base dinâmica (`getBlogBase()`/`window.location`), sem URL fixa.

### 5.2 Pendências menores
1. **Enforce HTTPS** no GitHub (Settings → Pages): o certificado já é servido, mas `https_enforced` ainda aparece `false` na API — habilitar quando o GitHub liberar o botão.
2. **Google Search Console** (opcional):
   - Verificar propriedade do domínio `promogamer.com.br`.
   - Enviar o sitemap `https://promogamer.com.br/sitemap-index.xml`.
3. A URL antiga (`sergioskmcle-sketch.github.io/blog-gamer`) não redireciona automaticamente para o novo domínio — o GitHub Pages serve o site antigo com o custom domain configurado; visitantes diretos da URL `.github.io` veem o site normalmente, sem redirect explícito.

---

## 6. Próximos passos

1. Habilitar **Enforce HTTPS** no GitHub quando disponível.
2. **Google Search Console**: verificar propriedade `promogamer.com.br` e enviar `https://promogamer.com.br/sitemap-index.xml`.
3. Monitorar por alguns dias: DNS, certificado, uptime e índices de busca.

---

## 7. Arquivos relevantes

| Arquivo | Papel |
|---|---|
| `astro.config.mjs` | `site` e remoção da `base` |
| `public/CNAME` | Domínio para o GitHub Pages |
| `public/robots.txt` | Sitemap novo |
| `src/pages/rss.xml.js` | RSS com novo domínio/título |
| `scripts/gerar-artigo.mjs` | Links internos `/blog/slug/` e capa |
| `scripts/gerar-artigo-pilar.mjs` | Capa |
| `scripts/regenerate-*-cover.mjs` | Capas regeneradas sem prefixo |
| `src/components/Header.astro` | Logo e nome "Promo Gamer" |
| `admin/editor.js` | Upload de logo e base dinâmica via `getBlogBase()` |
| `admin/index.html` | `imgUrl()` com base dinâmica (`window.location`), sem URL fixa |
| `dist/sitemap-index.xml` | Sitemap gerado no build |
| `src/data/blog-config.json` | `background.mode: "solid"` (fundo liso) |
| `src/layouts/Layout.astro` | `--body-bg-image: none !important` nos 3 ramos |
| `src/styles/global.css` | Sem overlay `html::before` (hexágonos removidos) |
| `src/styles/effects.css` | `.carbon-shine`/`.magnet-lens` removidos |
