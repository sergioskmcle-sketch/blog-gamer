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

### Estrutura Geral

```
## Introdução
   TEXTO (sem imagem, sem botão)

## [Tópico do jogo/produto 1]
   TEXTO
   [IMAGEM] (nova, diferente da capa)
   [BOTÃO] afiliado

## [Tópico do jogo/produto 2]
   TEXTO
   [IMAGEM] (nova, diferente da capa)
   [BOTÃO] afiliado

## [Tópico do jogo/produto N]  ← repete N vezes
   TEXTO
   [IMAGEM] (nova, diferente da capa)
   [BOTÃO] afiliado

## Comparativo (tabela)
## Pros e Contras
## FAQ
## Conclusão
## Quer mais ofertas? (Telegram)
## Fontes
## Continue Explorando (2 artigos + "Mais Artigos")
```

### Estrutura de cada tópico de jogo/produto (repete N vezes)

```
## [Nome do Tópico]

TEXTO (parágrafos descritivos)

[IMAGEM] (nova, diferente da capa)

[BOTÃO] afiliado
```

### Regras de Botões de Afiliado

| Plataforma | Cor do botão | Texto | Destino |
|------------|-------------|-------|---------|
| Mercado Livre | Verde/Amarelo (`#2ff801`) | "Ver no Mercado Livre" | Link do produto específico no ML |
| Shopee (futuro) | Vermelho | "Ver na Shopee" | Link do produto específico na Shopee |

### Regras de Imagens

| Posição | Origem | Regra |
|---------|--------|-------|
| Capa | frontmatter.image | RAWG ou ML. Deve ser única no artigo |
| Tópico de jogo/produto | RAWG API (ou ML) | Deve ser DIFERENTE da capa |
| Artigos relacionados | frontmatter.image do artigo relacionado | Clicável |

### Regras de Texto

- **Introdução:** Sem imagem, sem botão. Apenas texto.
- **Tópicos de jogo/produto:** Texto + imagem + botão (sempre nessa ordem).
- **Mínimo de palavras:** 800 (ideal: 1500+)

---

## SEÇÕES PADRÃO (depois dos tópicos)

### Comparativo
- Tabela Markdown com todos os itens comparados

### Pros e Contras
- Subseção (###) para cada item
- **Prós** (3 itens) + **Contras** (2 itens)

### FAQ
- 3-5 perguntas e respostas
- Formato: **1. Pergunta?** Resposta...

### Conclusão
- 1-2 parágrafos + CTA

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
- Cards de produto (do mais barato ao mais caro)
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
