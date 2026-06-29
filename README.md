# Blog Gamer

Blog estático sobre o mundo gamer com links de afiliado (Mercado Livre, Shopee).

## Tecnologias

- [Astro](https://astro.build) — gerador de sites estáticos
- GitHub Pages — hospedagem gratuita

## Como publicar um artigo

1. Crie um arquivo `.md` em `src/content/artigos/`
2. adicione o frontmatter (título, descrição, data, tags, categoria)
3. escreva o conteúdo em markdown
4. Faça commit e push para o branch `main`
5. O GitHub Actions faz o deploy automaticamente

## Comandos

```bash
npm run dev     # servidor local
npm run build   # build de produção
npm run preview # preview do build
```

## Configurar GitHub Pages

1. Crie um repositório no GitHub chamado `blog-gamer`
2. Habilite GitHub Pages em Settings > Pages > source: GitHub Actions
3. Faça push do código
4. O blog estará em `https://sergioskmcle-sketch.github.io/blog-gamer`
