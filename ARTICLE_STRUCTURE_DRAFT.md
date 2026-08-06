> 📎 **Versão antiga (06/08/2026):** a versão em uso é
> [`docs/ARTICLE_STRUCTURE_DRAFT.md`](docs/ARTICLE_STRUCTURE_DRAFT.md), que difere desta.
> Mantido por histórico.

# Estrutura de Artigos — Rascunho

> **Status:** Aguardando validação
> **Última atualização:** 2026-07-24

---

## CAMADA 1 — TEMPLATE ASTRO (não está no .md)

Renderizada pelo `[...slug].astro`. Ordem fixa:

```
1. [IMAGEM]     ← frontmatter.image (capa)
2. [BADGES]     ← category + tags.slice(0,3)
3. [TÍTULO h1]  ← frontmatter.title
4. [METADADOS]  ← autor • data • tempo de leitura
5. [DESCRIÇÃO]  ← frontmatter.description (1ª letra estilizada)
```

### Regras da Camada 1

| Campo | Regra |
|-------|-------|
| **Imagem** | wallpapper RAWG ou foto ML. Deve ser diferente das imagens do corpo |
| **Badges** | category (1) + até 3 tags |
| **Título** | Chamativo, curioso, plural (se falar de mais de 1 coisa). NUNCA genérico |
| **Metadados** | BLOG GAMER • data pt-BR • X MIN DE LEITURA |
| **Descrição** | Mínimo 150 caracteres. Deve prender o leitor e gerar curiosidade |

---

## CAMADA 2 — MARKDOWN (`<Content />`)

Tudo que está no `.md` depois do `---` do frontmatter.

### Estrutura Geral (v1.2 — seção de Itens logo após a intro)

```
INTRODUÇÃO (SEM H2, texto direto)
   TEXTO com gancho + resumo dos critérios que definem a lista

## Os {N} Melhores {Itens} em 2026   ← PRIMEIRA seção ## (a principal)
   ## [Nome do Item] — [Subtítulo]
      [IMAGEM] (foto do produto, injetada automaticamente)
      TEXTO (detalhes do item)
      [BOTÃO] afiliado (editável pelo painel)

   ## [Nome do Item 2] — [Subtítulo]  ← repete N vezes
      ...

## Comparativo (tabela)
## Veredito (bullets por perfil) — ou "Qual X Escolher?"
## FAQ
## Quer mais ofertas? (Telegram)
## Fontes
## Continue Explorando (2 artigos + "Mais Artigos") ← ÚNICO lugar com links internos
```

### Estrutura de cada tópico de jogo/produto (repete N vezes)

```
## [Nome do Item] — [Subtítulo]

[IMAGEM] (foto do produto — ML local, web ou IA; injetada automaticamente)

TEXTO (2-3 parágrafos com os principais detalhes)

[BOTÃO] afiliado (editável pelo painel admin)
```

### Regras de Botões de Afiliado

| Plataforma | Cor do botão | Texto | Destino |
|------------|-------------|-------|---------|
| Mercado Livre | Verde/Amarelo (`#2ff801`) | "Ver no Mercado Livre" | Link do produto específico no ML |
| Shopee (futuro) | Vermelho | "Ver na Shopee" | Link do produto específico na Shopee |

### Regras de Imagens

| Posição | Origem | Regra |
|---------|--------|-------|
| Capa | frontmatter.image | RAWG, ML ou IA. Deve ser única no artigo |
| Item da lista | foto do produto | Cadeia: thumbnail ML baixada (local) → busca web (Tavily) → IA (último recurso). Diferente da capa |
| Tópico de jogo (modo informativo) | RAWG API | Deve ser DIFERENTE da capa |
| Artigos relacionados | frontmatter.image do artigo relacionado | Clicável |

### Regras de Texto

- **Introdução:** Sem H2, sem imagem, sem botão. Gancho + resumo dos critérios da lista (não vira seção própria).
- **Tópicos de jogo/produto:** Título + imagem + texto + botão (nessa ordem).
- **Links internos:** SOMENTE na seção final "Continue Explorando". Nunca no meio do artigo.
- **Mínimo de palavras:** 800 (ideal: 1500+)

---

## SEÇÕES PADRÃO (depois dos tópicos)

### Comparativo
- Tabela Markdown com todos os itens comparados (Produto | Preço | Destaque | Nota 1-10)

### Veredito (ou "Qual X Escolher?")
- Bullets por perfil de usuário — nunca "depende do orçamento"

### FAQ
- 3-5 perguntas e respostas
- Formato: **1. Pergunta?** Resposta...

### Quer mais ofertas?
- Link para grupo Telegram

### Fontes
- Lista de URLs

### Continue Explorando
- 2 artigos da **mesma categoria** (mais recentes, excluindo o atual)
- Cada artigo: [IMAGEM] (clicável) + Título (clicável)
- [BOTÃO] "Mais Artigos" → link para página da categoria

---

## MODOS DE GERAÇÃO

### Modo Informativo (`affiliate: false`)
- Sem produtos, sem links de afiliado
- Imagens de jogos via RAWG (inline, após **negrito**)
- Mínimo 1200 palavras

### Modo Custo-Benefício (`affiliate: true`)
- Itens com foto + botão (bloco simples, do mais barato ao mais caro)
- Mínimo 1500 palavras

### Modo Misto (`affiliate: true`)
- Conteúdo informativo + produtos
- Mínimo 1200 palavras

---

## CAMADA 3 — SIDEBAR

Renderizada pelo `[...slug].astro`. Lado direito (desktop):

```
Banner Grupo Telegram (imagem)
CATEGORIAS (com contagem de artigos)
ARTIGOS RELACIONADOS (3 cards com imagem)
"Ofertas Gamer" CTA Telegram
```

---

## CATEGORIAS VÁLIDAS

| Slug | Nome |
|------|------|
| noticia | Notícia |
| review | Review |
| guia | Guia de Compra |
| lista | Lista |
| promocao | Promoção |
| curiosidade | Curiosidade |
| tutorial | Tutorial |
| comparativo | Comparativo |
| lancamento | Lançamento |
