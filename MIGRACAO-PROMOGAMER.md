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
O domínio `promogamer.com.br` ainda **não está ativo/configurado**. Pendências:

1. **Registro.br** — confirmar pagamento/ativação do domínio.
2. **DNS** — apontar o domínio para o GitHub Pages com um dos registros A:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
   - (ou CNAME para `sergioskmcle-sketch.github.io`, se o Registro.br suportar)
3. **GitHub** → Settings → Pages → Custom domain: `promogamer.com.br`.

---

## 6. Próximos passos

1. Usuário termina o registro/ativação do domínio e aponta o DNS.
2. Configurar Custom domain no GitHub Pages.
3. **Commit + push** das alterações.
4. **Google Search Console**:
   - Verificar propriedade do domínio `promogamer.com.br`.
   - Enviar o sitemap `https://promogamer.com.br/sitemap-index.xml`.
5. A URL antiga (`sergioskmcle-sketch.github.io/blog-gamer`) redireciona automaticamente para o novo domínio.

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
| `admin/editor.js` | Upload de logo e base `/` na raiz |
| `dist/sitemap-index.xml` | Sitemap gerado no build |
