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

### 5.2 Aguardando o usuário (bloqueado)
O domínio `promogamer.com.br` está **registrado e com DNS configurado** no Registro.br, mas ainda **não está ativo/propagado**. Pendências:

1. **DNS (já adicionado no painel Registro.br, aguardando propagação de até 1h–3h):**
   - `A` → `185.199.108.153` (raiz; campo Nome **vazio**, o painel não aceita `@`)
   - `CNAME www` → `sergioskmcle-sketch.github.io`
2. **GitHub** → Settings → Pages → Custom domain: `promogamer.com.br` (deve ser feito na conta dona `sergioskmcle-sketch`, após a propagação do DNS).
3. Habilitar **Enforce HTTPS** após o certificado ser emitido.

---

## 6. Próximos passos

1. Usuário aguarda a propagação do DNS (até 1h para alterações, até 3h para mudança de modo) e confirma no painel do Registro.br.
2. Configurar Custom domain `promogamer.com.br` no GitHub Pages (conta dona `sergioskmcle-sketch`).
3. Habilitar **Enforce HTTPS**.
4. **Commit + push** das alterações.
5. **Google Search Console**:
   - Verificar propriedade do domínio `promogamer.com.br`.
   - Enviar o sitemap `https://promogamer.com.br/sitemap-index.xml`.
6. A URL antiga (`sergioskmcle-sketch.github.io/blog-gamer`) redireciona automaticamente para o novo domínio.

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
