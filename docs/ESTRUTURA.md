# Estrutura do Projeto

```
blog-gamer/
├── docs/                              # Documentação do projeto
│   ├── CREDENCIAIS.md
│   ├── ESTRUTURA.md
│   ├── FLUXO.md
│   ├── REGRAS.md
│   └── TROUBLESHOOTING.md
│
├── scripts/
│   └── download-images.mjs            # Download de imagens locais
│
├── src/
│   ├── content/
│   │   └── artigos/                   # Artigos gerados (Markdown + frontmatter)
│   └── ...
│
├── public/
│   └── images/
│       └── produtos/                  # Imagens baixadas localmente
│
├── .env                               # Chaves de API (NÃO versionado)
├── generate_article.py                # Script principal de geração
├── ml_affiliate.py                    # Geração de links de afiliado
├── scheduler.py                       # Agendador (roda na VM)
├── state.json                         # Estado da última geração
├── ml_cookies.json                    # Cookies do ML (NÃO versionado)
└── README.md
```

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `generate_article.py` | Pipeline completo: scraping ML → Groq → git push |
| `ml_affiliate.py` | Gera links de afiliado meli.la usando API do ML |
| `scheduler.py` | Roda na VM, executa geração diária + download de imagens |
| `download-images.mjs` | Baixa imagens dos artigos localmente, substitui CDN |
| `state.json` | Controla qual categoria será gerada na próxima execução |
| `ml_cookies.json` | Cookies de sessão do ML (obrigatório para scraping) |

## Categorias de Artigos

O sistema roda em ciclo pelas categorias:

1. `noticia` — Lançamentos de games, consoles
2. `review` — Análises de jogos
3. `guia` — Guias de compra (periféricos, equipamentos)
4. `lista` — Listas (jogos, promoções)
5. `promocao` — Ofertas e descontos

## VM vs Local

| Ambiente | Onde roda | Frequência |
|----------|-----------|------------|
| VM (Google Cloud) | `scheduler.py` via systemd | Diário 10:00 UTC |
| Local (PC) | Manual (`node scripts/download-images.mjs`) | Sob demanda |

## GitHub Pages

- Branch: `main`
- Build automático via GitHub Actions
- URL: `https://sergioskmcle-sketch.github.io/blog-gamer/`
- Imagens servidas de `/blog-gamer/images/produtos/`
