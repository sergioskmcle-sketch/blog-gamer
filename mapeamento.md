# Mapeamento do Promo Gamer

Este documento explica **como o blog funciona**, do início ao fim, em linguagem simples.

---

## 1. O que é o Promo Gamer

```
┌─────────────────────────────────────────────────────────┐
│                    BLOG GAMER                            │
│  Artigos criados automaticamente por IA                  │
│  Publicados no GitHub Pages (hospedagem gratuita)        │
│  Links de afiliado do Mercado Livre em cada artigo       │
└─────────────────────────────────────────────────────────┘
```

O blog foca em:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│  Notícias de jogos e     │  │  Reviews de periféricos   │
│  consoles                │  │  (mouse, teclado, headset,│
│                          │  │   monitor)                │
└──────────────────────────┘  └──────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────┐
│  Listas dos melhores     │  │  Guias de compra e       │
│  produtos com preços     │  │  Comparativos            │
│  do Mercado Livre        │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

---

## 2. Estrutura de um Artigo

Antes de entender como o artigo é **gerado**, é importante entender como ele **fica** no final. Essa é a parte mais importante de todo o documento.

### 2.1 O Frontmatter (o topo do arquivo)

Todo artigo é um arquivo `.md` (Markdown). No topo dele, tem uma parte chamada **frontmatter** — é um bloco de informações entre `---` que diz ao blog o que o artigo é.

```
┌─────────────────────────────────────────────────────────────┐
│  EXEMPLO DE FRONTMATTER                                     │
│                                                             │
│  ---                                                        │
│  title: "GTA 6: Data de Lançamento, Preço e Tudo..."       │
│  description: "GTA 6 chega em 19 de novembro de 2026..."   │
│  pubDate: 2026-07-26                                        │
│  category: "noticia"                                        │
│  tags: ["gta 6", "rockstar games", "ps5", "xbox"]          │
│  affiliate: true                                            │
│  image: "/images/produtos/capa-gta6.webp"       │
│  ---                                                        │
└─────────────────────────────────────────────────────────────┘
```

Cada campo significa:

```
┌────────────────┬────────────────────────────────┬────────────────────────────────────┐
│  CAMPO         │  O QUE É                       │  EXEMPLO                           │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  title         │  Título do artigo              │  "GTA 6: Data de Lançamento,       │
│                │  (55-65 caracteres, SEO)        │   Preço e Tudo que Sabemos"        │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  description   │  Resumo para o Google          │  "GTA 6 chega em 19 de            │
│                │  (120-160 caracteres)           │   novembro de 2026..."             │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  pubDate       │  Data de publicação            │  2026-07-26                        │
│                │  (AAAA-MM-DD)                   │                                    │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  category      │  Tipo do artigo                │  "noticia"                         │
│                │  (só 5 opções)                  │  "review" "guia" "lista"           │
│                │                                │  "promocao"                        │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  tags          │  Palavras-chave para Google    │  ["gta 6", "rockstar games",       │
│                │  (mínimo 3)                     │   "ps5", "xbox series x"]          │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  affiliate     │  Se tem link de afiliado       │  true  (ou  false)                 │
├────────────────┼────────────────────────────────┼────────────────────────────────────┤
│  image         │  URL da imagem de capa         │  "/images/produtos/     │
│                │                                │   capa-gta6.webp"                  │
└────────────────┴────────────────────────────────┴────────────────────────────────────┘
```

### 2.2 Estrutura de um Tópico (a parte central do artigo)

Cada artigo é dividido em **tópicos** (seções). Cada tópico segue um padrão fixo com **4 elementos**:

```
┌─────────────────────────────────────────────────────────────┐
│  ESTRUTURA DE UM TÓPICO                                     │
│                                                             │
│  1. TÍTULO      → ## Nome da Seção                         │
│  2. IMAGEM      → [IMG:Nome do Jogo/Produto]                │
│  3. TEXTO       → 2 a 4 parágrafos explicando              │
│  4. AFILIADO    → [PRODUTO:1]                               │
└─────────────────────────────────────────────────────────────┘
```

Exemplo prático de um tópico dentro do artigo:

```markdown
## God of War Ragnarök: Tanto Faz o Preço?
[IMG:God of War Ragnarok]

God of War Ragnarök continua a saga de Kratos e Atreus pela mitologia nórdica. 
O jogo entregou mais de 50 horas de conteúdo, gráficos de tirar o fôlego e um 
combate que evoluiu muito em relação ao anterior. Se você tem um PS5, é quase 
obrigatório...

[PRODUTO:1]
```

O que acontece com cada elemento:

```
┌────────────┬─────────────────────────────┬─────────────────────────────────────────┐
│  ELEMENTO  │  NO MARKDOWN                │  NO BLOG (HTML)                         │
├────────────┼─────────────────────────────┼─────────────────────────────────────────┤
│  Título    │  ## God of War Ragnarök:    │  Um título chamativo e específico       │
│            │  Tanto Faz o Preço?         │  (não genérico como "Análise")          │
├────────────┼─────────────────────────────┼─────────────────────────────────────────┤
│  Imagem    │  [IMG:God of War Ragnarok]  │  Foto real do jogo buscada no RAWG      │
│            │                             │  (banco de dados de jogos)              │
├────────────┼─────────────────────────────┼─────────────────────────────────────────┤
│  Texto     │  2 a 4 parágrafos           │  Texto escrito pela IA com opinião,     │
│            │                             │  dados reais, linguagem de gamer        │
├────────────┼─────────────────────────────┼─────────────────────────────────────────┤
│  Afiliado  │  [PRODUTO:1]                │  Botão verde "VER NO MERCADO LIVRE"     │
│            │                             │  que leva ao produto                    │
└────────────┴─────────────────────────────┴─────────────────────────────────────────┘
```

**Regras importantes:**

```
┌─────────────────────────────────────────────────────────────┐
│  REGRAS DOS TÓPICOS                                         │
│                                                             │
│  • Cada tópico tem no mínimo 2 e no máximo 4 parágrafos    │
│  • O título deve ser ESPECÍFICO                             │
│    ✗ "Detalhes do Jogo"                                     │
│    ✓ "God of War Ragnarök: Tanto Faz o Preço?"             │
│  • Cada tópico defende uma IDEIA/TESE                       │
│    (não é só uma lista de informações soltas)               │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Estrutura Completa do Artigo (corpo)

O corpo do artigo (depois do frontmatter) segue esta ordem:

```
┌─────────────────────────────────────────────────────────────┐
│  ESTRUTURA COMPLETA DO ARTIGO                               │
│                                                             │
│  0. IMAGEM DE CAPA (no frontmatter)                         │
│     → Campo "image" no frontmatter                          │
│     → Define a imagem exibida na listagem e compartilhamento│
│                                                             │
│  1. INTRODUÇÃO                                              │
│     → Gancho inicial (um fato concreto)                     │
│     → Contexto sobre o tema                                 │
│                                                             │
│  2. TÓPICOS (2 a 4 seções, cada uma com:)                   │
│     → Título (##)                                           │
│     → Imagem [IMG:Nome]                                     │
│     → Texto (2-4 parágrafos)                                │
│     → Produto [PRODUTO:N] (só se tiver)                     │
│                                                             │
│  3. COMPARATIVO (opcional)                                  │
│     → Tabela comparando produtos                            │
│                                                             │
│  4. PROS E CONTRAS                                          │
│     → Para cada produto: 3 prós + 2 contras                 │
│                                                             │
│  5. FAQ                                                     │
│     → 3 a 4 perguntas e respostas                           │
│                                                             │
│  6. CONCLUSÃO                                               │
│     → Recomendação clara (para quem é bom, para quem não)   │
│                                                             │
│  7. QUER MAIS OFERTAS?                                      │
│     → Link para o grupo do Telegram                         │
│                                                             │
│  8. FONTES                                                  │
│     → Lista de URLs usadas na pesquisa                      │
│                                                             │
│  9. CONTINUE EXPLORANDO (opcional)                          │
│     → Links para outros artigos relacionados                │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Exemplo de um Artigo Inteiro (simplificado)

Para ficar claro, aqui está como fica um artigo real (simplificado):

```markdown
---
title: "3 Headsets Gamer Baratos que Vale a Pena em 2026"
description: "Veja os 3 melhores headsets gamer custo-benefício disponíveis no Mercado Livre, com preços a partir de R$ 89."
pubDate: 2026-07-26
category: "lista"
tags: ["headset gamer", "headset barato", "periférico gamer", "custo benefício", "mercado livre"]
affiliate: true
image: "/images/produtos/headset-capa.webp"
---

## Introdução
Todo gamer precisa de um bom headset, mas nem todo mundo pode pagar R$ 500. 
A boa notícia é que existem opções muito boas por menos de R$ 150...

## Havit HV-G92: O Mais Vendido do Mercado Livre
[IMG:Headset Gamer Havit]
O Havit HV-G92 é o headset mais vendido do Mercado Livre por um motivo: 
custa menos de R$ 100 e entrega um som surpreendente para o preço. 
O microfone não é o melhor do mundo, mas para jogos casuais, funciona...
[PRODUTO:1]

## Redragon Scylla: Conforto para Sessões Longas
[IMG:Headset Gamer Redragon]
Se você joga por horas seguidas, o Redragon Scylla é a melhor opção dessa lista. 
As almofadas de espuma viscoelástica não machucam as orelhas mesmo depois de 3h...
[PRODUTO:2]

## Cooler Master MH752: O Melhor Som
[IMG:Headset Cooler Master]
Se áudio é prioridade, o Cooler Master MH752 é imbatível na faixa de preço. 
Ele tem drivers de 40mm que entregam graves potentes e agudos limpos...
[PRODUTO:3]

## Comparativo

| Modelo | Preço | Conexão | Microfone | Nota |
|--------|-------|---------|-----------|------|
| Havit HV-G92 | R$ 89 | P3 USB | Básico | ⭐⭐⭐⭐ |
| Redragon Scylla | R$ 129 | P3 USB | Bom | ⭐⭐⭐⭐ |
| Cooler Master MH752 | R$ 149 | P3 USB | Ótimo | ⭐⭐⭐⭐⭐ |

## Pros e Contras

### Havit HV-G92
**Prós:** Barato, leve, boa qualidade de som
**Contras:** Microfone frágil, acabamento simples

### Redragon Scylla
**Prós:** Confortável, bom microfone, cabo resistente
**Contras:** Pesado para algumas pessoas

### Cooler Master MH752
**Prós:** Som excelente, design premium, confortável
**Contras:** Mais caro, fio trançado pode incomodar

## FAQ

**1. Qual o melhor headset custo-benefício?**
O Havit HV-G92, pelo preço de menos de R$ 100, é difícil de superar...

**2. Funciona no PlayStation e Xbox?**
Sim, todos os três funcionam em PS4, PS5, Xbox e PC via conexão P3...

**3. O microfone serve para gravar?**
Para streaming casual sim, mas para gravação profissional, invista em um microfone dedicado...

## Conclusão
Se o bolso é curto, o Havit HV-G92 resolve. Se quer mais conforto, o Redragon Scylla. 
Se quer o melhor som, o Cooler Master MH752. Não tem como errar com nenhum dos três.

## Quer mais ofertas?
[Grupo do Telegram](https://t.me/...)

## Fontes
- Mercado Livre: https://lista.mercadolivre.com.br/headset-gamer
- Revisão do TechPowerUp: https://...
```

### 2.5 Categorias e como elas alternam

O blog tem 5 categorias. Elas **sempre** alternam nesta ordem fixa:

```
┌─────────────────────────────────────────────────────────────┐
│  ROTAÇÃO DE CATEGORIAS                                      │
│                                                             │
│  noticia → review → guia → lista → promocao → (repete)     │
│                                                             │
│  Se o último artigo foi "notícia", o próximo será "review"  │
│  Se o último foi "review", o próximo será "guia", etc.      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Como as Marcações viram HTML

O artigo escrito pela IA tem **marcações especiais** (textos entre colchetes) que o sistema depois **substitui por HTML bonito**. É como um "preencher lacunas".

### Marcação de Imagem: `[IMG:Nome]`

```
┌──────────────────────────────────┬──────────────────────────────────┐
│  O QUE A IA ESCREVE              │  O QUE APARECE NO BLOG           │
├──────────────────────────────────┼──────────────────────────────────┤
│  ## God of War: Título           │  <h2>God of War: Título</h2>     │
│  [IMG:God of War Ragnarok]      │  <img src="foto-real.jpg"        │
│                                  │       class="article-game-img">  │
└──────────────────────────────────┴──────────────────────────────────┘
```

**Como funciona:**

```
┌─────────────────────────────────────────────────────────────┐
│  1. A IA escreve [IMG:God of War Ragnarok] antes de um     │
│     título                                                  │
│  2. O sistema busca a imagem no RAWG (banco de dados de     │
│     jogos)                                                  │
│  3. Se não encontrar, busca no Tavily (pesquisa na internet)│
│  4. Substitui a marcação por uma tag <img> com a foto       │
└─────────────────────────────────────────────────────────────┘
```

### Marcação de Produto: `[PRODUTO:N]`

```
┌──────────────────────────────────┬──────────────────────────────────┐
│  O QUE A IA ESCREVE              │  O QUE APARECE NO BLOG           │
├──────────────────────────────────┼──────────────────────────────────┤
│  [PRODUTO:1]                     │  ┌────────────────────────────┐  │
│                                  │  │ 🖱️ HyperX Cloud II        │  │
│                                  │  │ 💰 R$ 349,90               │  │
│                                  │  │ [VER NO MERCADO LIVRE]     │  │
│                                  │  └────────────────────────────┘  │
└──────────────────────────────────┴──────────────────────────────────┘
```

**Como funciona:**

```
┌─────────────────────────────────────────────────────────────┐
│  1. O sistema busca produtos no Mercado Livre e gera links  │
│     de afiliado                                             │
│  2. A IA recebe os dados do produto com sua marcação        │
│     (ex: [PRODUTO:1])                                       │
│  3. A IA coloca [PRODUTO:1] no local adequado do artigo     │
│  4. O sistema substitui a marcação por um card HTML com     │
│     imagem, preço e botão de afiliado                       │
└─────────────────────────────────────────────────────────────┘
```

### O que acontece se a IA esquecer de usar as marcações?

```
┌─────────────────────────────────────────────────────────────┐
│  BACKUP AUTOMÁTICO                                          │
│                                                             │
│  • Se a IA NÃO usou nenhuma marcação de produto:            │
│    → Produtos são injetados antes da segunda seção ##        │
│                                                             │
│  • Se a IA usou ALGUMAS mas esqueceu outras:                 │
│    → As esquecidas são ignoradas (decisão editorial da IA)  │
│                                                             │
│  • Se a IA NÃO usou marcação de imagem:                     │
│    → Sistema procura nomes de jogos em negrito no texto     │
│    → Injeta imagens antes desses parágrafos                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Visão Geral — Como os Artigos São Gerados

Existem **duas formas** de gerar artigos:

```
┌──────────────────────────────────┬──────────────────────────────────┐
│  PIPELINE PRINCIPAL              │  PIPELINE SECUNDÁRIA             │
│  (a completa)                    │  (a simples)                     │
├──────────────────────────────────┼──────────────────────────────────┤
│  Roda todo dia                  │  Roda todo dia                   │
│  Roda no GitHub Actions          │  Roda em um servidor (VM)        │
│                                  │  no Google Cloud                 │
├──────────────────────────────────┼──────────────────────────────────┤
│  Pesquisa trending + produtos    │  Escolhe tema + produtos         │
│  + artigo com IA + imagens       │  + artigo com IA + publica       │
│  + publica                       │                                  │
├──────────────────────────────────┼──────────────────────────────────┤
│  É a que realmente importa       │  Versão mais antiga e simples    │
└──────────────────────────────────┴──────────────────────────────────┘
```

---

## 5. Pipeline Principal — Passo a Passo

### Passo 1: O sistema acorda

```
┌─────────────────────────────────────────────────────────────┐
│  TODO 2 DIAS, ÀS 9H30 DA MANHÃ (horário de Brasília)      │
│  O GitHub Actions dispara automaticamente.                  │
│                                                             │
│  Também é possível disparar manualmente pelo painel do      │
│  GitHub.                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Passo 2: Verificação de segurança

```
┌─────────────────────────────────────────────────────────────┐
│  ANTES DE TUDO, o sistema verifica:                         │
│                                                             │
│  • Já geramos um artigo há menos de 20 horas?               │
│    → Se SIM, para tudo (não cria artigos demais)            │
│                                                             │
│  • Se alguém pediu para forçar a geração?                   │
│    → Ignora a verificação                                   │
└─────────────────────────────────────────────────────────────┘
```

### Passo 3: Descoberta do tema

O sistema precisa decidir **sobre o que escrever**. Ele faz 4 coisas:

**3a. Coleta tendências da internet**

```
┌─────────────────────────────────────────────────────────────┐
│  SITES E FORUNS MONITORADOS                                 │
│                                                             │
│  • MeuPlayStation     → notícias de PlayStation             │
│  • GameVicio          → notícias gerais de games            │
│  • IGN Brasil         → notícias internacionais traduzidas  │
│  • TecMundo Games     → notícias de tecnologia e games      │
│  • Reddit r/gaming    → o que está em alta nos games        │
│  • Reddit r/gamesEcultura → games em português              │
└─────────────────────────────────────────────────────────────┘
```

**3b. Extrai palavras-chave**

De todos os títulos, o sistema conta quais palavras aparecem mais. Se "GTA 6" aparece 15 vezes, é porque está em alta.

**3c. Escolhe o tema (com ajuda da IA, opcionalmente)**

```
┌─────────────────────────────────────────────────────────────┐
│  COM IA:  Envia tendências para o Groq e pede para          │
│          escolher o tema mais relevante                     │
│                                                             │
│  SEM IA: Escolhe automaticamente com base nas palavras-     │
│          chave que mais apareceram                          │
└─────────────────────────────────────────────────────────────┘
```

**3d. Rotação de categorias**

```
┌─────────────────────────────────────────────────────────────┐
│  1. NOTÍCIA        → algo que aconteceu                     │
│  2. REVIEW         → análise de produto/jogo                │
│  3. GUIA DE COMPRA → o que comprar                          │
│  4. LISTA          → os melhores de algo                    │
│  5. PROMOÇÃO       → ofertas e descontos                    │
│                                                             │
│  (sempre nesta ordem, repetindo)                            │
└─────────────────────────────────────────────────────────────┘
```

### Passo 4: Pesquisa sobre o tema

```
┌─────────────────────────────────────────────────────────────┐
│  O TAVILY (serviço de pesquisa automatizada) busca 5        │
│  resultados na internet sobre o tema escolhido.             │
│                                                             │
│  É como fazer uma pesquisa no Google, mas de forma automática│
└─────────────────────────────────────────────────────────────┘
```

### Passo 5: Busca de produtos no Mercado Livre

```
┌─────────────────────────────────────────────────────────────┐
│  SÓ acontece se a categoria for: review, guia, lista ou     │
│  promoção (notícias não precisam de produtos)               │
└─────────────────────────────────────────────────────────────┘
```

**Duas tentativas de busca:**

```
┌──────────────────────────┬──────────────────────────────────┐
│  TENTATIVA 1 (via Google)│  TENTATIVA 2 (via API do ML)     │
├──────────────────────────┼──────────────────────────────────┤
│  Usa Tavily para pesquisar│  Usa Tavily para encontrar IDs   │
│  no Google: "mouse gamer  │  de produtos (MLB12345678)       │
│  Mercado Livre preço"    │                                  │
├──────────────────────────┼──────────────────────────────────┤
│  Encontra links de       │  Consulta a API oficial do       │
│  produtos, visita cada   │  Mercado Livre para pegar        │
│  página e lê dados       │  detalhes                        │
└──────────────────────────┴──────────────────────────────────┘
```

**Filtros aplicados:**

```
┌─────────────────────────────────────────────────────────────┐
│  FILTROS DE PRODUTO                                         │
│                                                             │
│  ✓ Só produtos gamer (remove whey protein, parafusadeira)   │
│  ✓ Só marcas conhecidas (Logitech, Razer, HyperX, Corsair) │
│  ✓ Sem duplicatas                                           │
│  ✓ Máximo 4 produtos por artigo                             │
└─────────────────────────────────────────────────────────────┘
```

### Passo 6: Geração dos links de afiliado

```
┌─────────────────────────────────────────────────────────────┐
│  PARA CADA PRODUTO ENCONTRADO, o sistema gera um link       │
│  de afiliado (rastreia se alguém comprou através do blog):  │
│                                                             │
│  1. Visita a página do produto no Mercado Livre             │
│  2. Pega uma "chave de segurança" (CSRF token)              │
│  3. Envia pedido para a API do ML: "crie um link curto"     │
│  4. ML retorna: meli.la/abc123                               │
│                                                             │
│  Se falhar → tenta outro método                             │
│  Se falhar de novo → usa link original com código na URL    │
└─────────────────────────────────────────────────────────────┘
```

### Passo 7: Escrita do artigo pela IA

O sistema tenta primeiro o Gemini (`gemini-flash-latest`). Se falhar (quota, 503, truncamento), cai para Groq (`openai/gpt-oss-120b`). Se Groq falhar, tenta OpenAI (`gpt-4o-mini`).

```
┌─────────────────────────────────────────────────────────────┐
│  O QUE É ENVIADO PARA A IA                                  │
│                                                             │
│  • O tema escolhido                                         │
│  • As informações da pesquisa                               │
│  • Os produtos com preços e links de afiliado               │
│  • Instruções detalhadas de como escrever                   │
│    (incluindo a estrutura da seção 2)                       │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  REGRAS QUE A IA SEGUE                                      │
│                                                             │
│  • Tom: "escreva como um gamer experiente, natural,         │
│    sem parecer robô"                                        │
│  • Título: 55-65 caracteres, palavra-chave no início        │
│  • Marcações: usar [IMG:Nome] e [PRODUTO:N] corretamente    │
│  • Proibições: não mencionar IA, não inventar dados,        │
│    não repetir frases                                       │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  TENTA ATÉ 3 VEZES                                          │
│                                                             │
│  Se o artigo não passar na validação:                       │
│  • Título ruim → tenta de novo                              │
│  • Poucas palavras → tenta de novo                          │
│  • Sem marcações → tenta de novo                            │
│                                                             │
│  Envia os erros para a IA corrigir a cada tentativa.        │
└─────────────────────────────────────────────────────────────┘
```

### Passo 8: Pós-processamento (injeção de imagens e produtos)

```
┌─────────────────────────────────────────────────────────────┐
│  DEPOIS QUE O ARTIGO É ESCRITO, o sistema substitui as      │
│  marcações por HTML:                                        │
│                                                             │
│  [IMG:Nome]                                                 │
│    → Busca imagem no RAWG (com busca inteligente)           │
│    → Se não encontrar, busca no Tavily                      │
│    → Injeta <img> no artigo                                 │
│                                                             │
│  [PRODUTO:N]                                                │
│    → Pega dados do produto + link de afiliado               │
│    → Injeta card HTML com botão verde                       │
│                                                             │
│  IMAGEM DE CAPA                                             │
│    → Escolhe entre 4 opções (detalhado abaixo)              │
└─────────────────────────────────────────────────────────────┘
```

#### 8.1 Imagens do corpo: [IMG:Nome]

```
┌─────────────────────────────────────────────────────────────┐
│  PARA CADA MARCAÇÃO [IMG:Nome] no artigo:                   │
│                                                             │
│  1. Primeiro tenta RAWG (banco de dados de jogos):          │
│     → Busca o jogo pelo nome                                │
│     → Se encontrar, usa a imagem de fundo (background_image)│
│                                                             │
│  2. Se RAWG não tiver, usa Tavily (pesquisa na internet):   │
│     → Busca imagens do jogo/produto na web                  │
│                                                             │
│  3. Se nenhum encontrar, a seção fica sem imagem            │
│                                                             │
│  IMPORTANTE: A imagem da capa NUNCA é repetida no corpo.    │
│  Se o jogo da capa aparece num tópico, usa outra imagem     │
│  desse mesmo jogo (outra screenshot, outra arte).           │
└─────────────────────────────────────────────────────────────┘
```

#### 8.2 Produtos do corpo: [PRODUTO:N]

```
┌─────────────────────────────────────────────────────────────┐
│  PARA CADA MARCAÇÃO [PRODUTO:N] no artigo:                  │
│                                                             │
│  1. Pega os dados do produto N (nome, preço, imagem, link)  │
│  2. Injeta um card HTML com:                                │
│     → Imagem do produto                                     │
│     → Nome e preço                                           │
│     → Botão verde "VER NO MERCADO LIVRE" (link de afiliado) │
└─────────────────────────────────────────────────────────────┘
```

#### 8.3 Imagem de capa (campo "image" do frontmatter)

A imagem de capa é a foto que aparece na listagem do blog e no compartilhamento (WhatsApp, redes sociais). O sistema escolhe nesta ordem de preferência:

```
┌────┬────────────────────────────┬─────────────────────────────────────────────┐
│  # │  FONTE                     │  QUANDO USA                                │
├────┼────────────────────────────┼─────────────────────────────────────────────┤
│  1 │  Imagem do jogo (RAWG)     │  Se o artigo tem jogos marcados com [IMG:] │
│    │                            │  → Usa a imagem do primeiro jogo encontrado│
├────┼────────────────────────────┼─────────────────────────────────────────────┤
│  2 │  Imagem do produto (ML)    │  Se não achou imagem de jogo mas tem       │
│    │                            │  produtos do Mercado Livre                 │
│    │                            │  → Usa thumbnail do produto mais caro      │
├────┼────────────────────────────┼─────────────────────────────────────────────┤
│  3 │  Imagem gerada por IA      │  Se NÃO achou imagem de jogo E NÃO achou  │
│    │  (OpenAI GPT-5)            │  imagem de produto com boa resolução      │
│    │                            │  → Gera uma imagem nova com IA            │
│    │                            │  (detalhes abaixo)                         │
├────┼────────────────────────────┼─────────────────────────────────────────────┤
│  4 │  Imagem genérica (RAWG)    │  Último recurso: busca imagem genérica     │
│    │                            │  usando a keyword trending do tema         │
└────┴────────────────────────────┴─────────────────────────────────────────────┘
```

#### 8.4 Como funciona a geração da capa com IA (OpenAI)

**QUANDO é usada:**

```
┌─────────────────────────────────────────────────────────────┐
│  A IA só é chamada quando:                                  │
│                                                             │
│  1. Não existem imagens de jogos marcados no artigo         │
│  2. Não foi possível obter imagem de produto como capa      │
│  3. Existem produtos do Mercado Livre disponíveis           │
│     (senão, não há material para a IA usar como referência)  │
│                                                             │
│  Em resumo: é um FALLBACK — o sistema tenta tudo antes      │
│  de recorrer à geração por IA.                              │
└─────────────────────────────────────────────────────────────┘
```

**COMO funciona (passo a passo):**

```
┌─────────────────────────────────────────────────────────────┐
│  1. O script openai-cover.mjs recebe:                       │
│     → Lista de produtos do ML (até 6)                       │
│     → Categoria do artigo (guia, review, lista, etc.)       │
│     → Slug do artigo (para nomear o arquivo)                │
│                                                             │
│  2. BAIXA THUMBNAILS dos produtos:                          │
│     → Visita a URL de cada imagem dos produtos              │
│     → Converte para base64 (dados embutidos na requisição)  │
│                                                             │
│  3. ANALISA BRILHO da primeira thumbnail:                   │
│     → Calcula média de brilho dos pixels                    │
│     → Escura (< 128) → usa fundo CLARO para contraste      │
│     → Clara (≥ 128) → usa fundo ESCURO para contraste      │
│                                                             │
│  4. MONTA O PROMPT baseado na categoria:                    │
│                                                             │
│     ┌──────────────┬──────────────────────────────────────┐ │
│     │  CATEGORIA   │  ESTILO DA IMAGEM                    │ │
│     ├──────────────┼──────────────────────────────────────┤ │
│     │  guia        │  Produtos em vitrine profissional    │ │
│     │  review      │  1-2 produtos em mesa de gamer       │ │
│     │  lista       │  Múltiplos produtos em prateleira    │ │
│     │  noticia     │  Cena de gaming realista             │ │
│     │  promocao    │  Produtos em destaque, iluminação    │ │
│     │              │  vibrante                            │ │
│     └──────────────┴──────────────────────────────────────┘ │
│                                                             │
│  5. ENVIA PARA A OPENAI:                                    │
│     → Modelo: GPT-5                                        │
│     → API: /v1/responses                                   │
│     → Envio: thumbnails + prompt + dica de contraste        │
│     → Resolução: 1536x1024 (16:9 landscape)                │
│     → Qualidade: low (custo otimizado)                     │
│                                                             │
│  6. A IA RETORNA uma imagem:                                │
│     → Salva como PNG em public/images/capas/{slug}.png      │
│     → Retorna o caminho /images/capas/{slug}.png            │
│                                                             │
│  7. O campo "image" do frontmatter é preenchido com         │
│     esse caminho                                            │
│                                                             │
│  Se QUALQUER etapa falhar (sem API key, sem thumbnails,     │
│  erro da OpenAI), o sistema simplesmente pula e fica        │
│  sem capa AI — não é bloqueante.                             │
└─────────────────────────────────────────────────────────────┘
```

**Exemplo visual do fluxo:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Artigo: "3 Melhores Headsets Gamer"                        │
│  Categoria: guia                                            │
│  Produtos ML: Havit R$89, Redragon R$129, HyperX R$249     │
│                                                             │
│  → Sem jogos marcados no artigo                              │
│  → Thumbnails dos 3 headsets baixadas                       │
│  → Brilho: produto é escuro → fundo claro                   │
│  → Prompt: "produtos em vitrine profissional, fundo claro"  │
│  → OpenAI gera imagem 1536x1024 photorealistic             │
│  → Salva: public/images/capas/3-melhores-headsets-gamer.png │
│  → Frontmatter: image: "/images/capas/3-melhores-headsets-  │
│    gamer.png"                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Passo 9: Salvar o artigo

```
┌─────────────────────────────────────────────────────────────┐
│  O artigo é salvo como arquivo .md na pasta:                │
│  src/content/artigos/                                       │
│                                                             │
│  Contém: frontmatter + corpo preenchido                     │
└─────────────────────────────────────────────────────────────┘
```

### Passo 10: Atualizar estado

```
┌─────────────────────────────────────────────────────────────┐
│  O arquivo state.json é atualizado com:                     │
│                                                             │
│  • Data do último artigo gerado                             │
│  • Slug (nome do arquivo)                                   │
│  • Categoria do último artigo                               │
│  • Palavras-chave usadas recentemente                       │
│  • Temas cobertos recentemente                              │
│                                                             │
│  → Isso evita artigos repetidos                             │
└─────────────────────────────────────────────────────────────┘
```

### Passo 11: Publicar no GitHub

```
┌─────────────────────────────────────────────────────────────┐
│  1. Adiciona o novo artigo                                  │
│  2. Cria commit: "feat: artigo gerado automaticamente -     │
│     [nome-do-artigo]"                                       │
│  3. Envia para o branch main                                │
└─────────────────────────────────────────────────────────────┘
```

### Passo 12: Deploy (publicação)

```
┌─────────────────────────────────────────────────────────────┐
│  1. GitHub Actions roda: astro build                        │
│     (transforma Markdown em HTML)                           │
│  2. Publica no GitHub Pages                                 │
│                                                             │
│  → Artigo está no ar!                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Pipeline Secundária — Passo a Passo

Esta é a versão mais simples que roda em um servidor (VM) no Google Cloud. Roda todo dia às 10h00 (horário de Brasília).

### Passo 1: O sistema acorda

```
┌─────────────────────────────────────────────────────────────┐
│  TODO DIA, ÀS 10H00 (horário de Brasília)                   │
│  O scheduler dispara automaticamente no Google Cloud.        │
└─────────────────────────────────────────────────────────────┘
```

### Passo 2: Verificação de segurança

```
┌─────────────────────────────────────────────────────────────┐
│  O sistema lê o arquivo state.json e verifica:               │
│                                                             │
│  • Se "last_article_date" é igual à data de hoje             │
│    → Se SIM, para tudo (só 1 artigo por dia)                │
│  • Se não, continua com a geração                           │
└─────────────────────────────────────────────────────────────┘
```

### Passo 3: Escolha do tipo de artigo e tema

O sistema tem **13 templates pré-definidos** (chamados de `TOPIC_SEEDS`). Cada um define: categoria, modo, dica de tema e query de busca no ML.

```
┌────┬──────────────┬────────────────┬──────────────────────────────────────────┬─────────────────────────────────────┐
│  # │  CATEGORIA   │  MODO          │  DICA DE TEMA (hint)                     │  QUERY ML                           │
├────┼──────────────┼────────────────┼──────────────────────────────────────────┼─────────────────────────────────────┤
│  1 │  noticia     │  informativo   │  lançamento de game, evento, anúncio     │  lançamento jogo ps5 xbox mídia     │
│  2 │  review      │  melhores      │  review de jogo popular, análise         │  jogo original ps5 xbox mídia       │
│  3 │  guia        │  custo-benefício│  melhores headsets, teclado, mouse      │  headset gamer teclado mouse monitor │
│  4 │  lista       │  custo-benefício│  melhores jogos para console            │  jogo original ps4 ps5 xbox         │
│  5 │  lista       │  informativo   │  jogos mais populares, rankings          │  (sem query ML)                     │
│  6 │  promocao    │  custo-benefício│  promoções Steam, ofertas de games      │  jogo promoção ps5 xbox pc          │
│  7 │  curiosidade │  informativo   │  curiosidades sobre consoles clássicos   │  console retro game boy             │
│  8 │  tutorial    │  informativo   │  como montar setup gamer, dicas          │  setup gamer periférico rgb         │
│  9 │  comparativo │  melhores      │  comparativo entre consoles, placas      │  console playstation xbox placa     │
│ 10 │  lancamento  │  melhores      │  lançamento de console, jogo aguardado   │  lançamento jogo ps5 xbox 2026      │
│ 11 │  noticia     │  misto         │  tudo sobre jogo novo, análise completa  │  console ps5 xbox nintendo          │
│ 12 │  review      │  misto         │  review completo de jogo, vale a pena    │  jogo original ps5 xbox 2026        │
│ 13 │  guia        │  misto         │  guia completo sobre console ou jogo     │  console video game ps5 xbox        │
└────┴──────────────┴────────────────┴──────────────────────────────────────────┴─────────────────────────────────────┘
```

**Como a escolha funciona:**

```
┌─────────────────────────────────────────────────────────────┐
│  ROTAÇÃO COM ANTI-REPETIÇÃO                                 │
│                                                             │
│  1. O state.json guarda o índice do último template usado   │
│  2. Avança para o próximo índice (circular: 12 → 0)         │
│  3. Verifica o article_history.json (últimas 3 entradas):   │
│     → Se a categoria ou modo já foi usado recentemente,     │
│       pula para o próximo template                          │
│  4. Tenta até 5 vezes para encontrar um não-repetido        │
│  5. Salva o novo índice no state.json                       │
│                                                             │
│  Exemplo:                                                   │
│  • Último artigo: #3 (guia, custo-benefício)                │
│  • Próximo tenta: #4 (lista, custo-benefício)               │
│  → Modo "custo-benefício" repetido? Pula para #5            │
│  → #5 (lista, informativo) → OK, usa esse                   │
└─────────────────────────────────────────────────────────────┘
```

### Passo 4: Pesquisa sobre o tema

```
┌─────────────────────────────────────────────────────────────┐
│  O TAVILY busca 5 resultados na internet usando a "hint"    │
│  do template escolhido como query de pesquisa.              │
│                                                             │
│  Exemplo: se o hint é "melhores headsets gamers",           │
│  o Tavily pesquisa por isso e retorna links relevantes.     │
│                                                             │
│  Os resultados são formatados como texto para a IA:         │
│  - Título do artigo: URL                                     │
│  - Título do artigo: URL                                     │
└─────────────────────────────────────────────────────────────┘
```

### Passo 5: Busca de produtos no Mercado Livre

```
┌─────────────────────────────────────────────────────────────┐
│  SÓ acontece se o MODO for: misto, melhores ou              │
│  custo-benefício (modo informativo não precisa de produtos) │
└─────────────────────────────────────────────────────────────┘
```

**Como funciona o scraping:**

```
┌─────────────────────────────────────────────────────────────┐
│  SCRAPING DIRETO (sem API oficial do ML)                    │
│                                                             │
│  1. Usa a "query ML" do template como termo de busca        │
│  2. Acessa a página de listagem:                            │
│     lista.mercadolivre.com.br/{termos-separados-por-hifen}  │
│  3. Extrai IDs de produtos (MLB12345678) do HTML             │
│  4. Se não encontrar, usa Tavily como fallback para         │
│     encontrar IDs                                           │
│  5. Para cada ID, visita a página do produto:               │
│     mercadolivre.com.br/p/MLB12345678                       │
│  6. Extrai dados do HTML (2 métodos):                        │
│     → JSON-LD (dados estruturados)                           │
│     → window.__INITIAL_STATE__ (dados internos)             │
│                                                             │
│  Dados extraídos: nome, preço, preço original, imagens,     │
│  avaliação, reviews, frete grátis, parcelas, atributos      │
└─────────────────────────────────────────────────────────────┘
```

**Filtros aplicados:**

```
┌─────────────────────────────────────────────────────────────┐
│  FILTROS DE PRODUTO                                         │
│                                                             │
│  ✓ Whitelist de marcas gamer:                               │
│    Logitech, Razer, HyperX, Corsair, SteelSeries, ASUS ROG,│
│    MSI, Samsung, LG UltraGear, AOC, Redragon, Husky, etc.  │
│    (50+ marcas)                                             │
│                                                             │
│  ✓ Exceção: categorias "de jogos" (noticia, lista,          │
│    curiosidade, tutorial, lancamento, promocao) NÃO         │
│    aplicam o filtro de marca                                │
│                                                             │
│  ✓ Remove produtos não-gamer:                               │
│    jogos de lençol, tabuleiro, aparelho de jantar, etc.     │
│    (lista de termos proibidos)                              │
│                                                             │
│  ✓ Sem duplicatas                                           │
│                                                             │
│  ✓ Máximo 8 produtos por artigo                             │
│                                                             │
│  ✓ Ordenação:                                               │
│    • Modo "melhores" → mais caro primeiro                   │
│    • Modo "custo-benefício" → mais barato primeiro          │
└─────────────────────────────────────────────────────────────┘
```

### Passo 6: Geração dos links de afiliado

```
┌─────────────────────────────────────────────────────────────┐
│  PARA CADA PRODUTO ENCONTRADO, o sistema gera um link       │
│  de afiliado:                                               │
│                                                             │
│  1. Função generate_affiliate_link():                       │
│     → Visita a página do produto no Mercado Livre           │
│     → Pega uma "chave de segurança" (CSRF token)            │
│     → Envia pedido para a API do ML: "crie um link curto"   │
│     → ML retorna: meli.la/abc123                             │
│                                                             │
│  2. Se falhar → tenta método alternativo                    │
│  3. Se falhar de novo → usa link original com tag na URL    │
│                                                             │
│  O link é salvo no campo "affiliate_url" de cada produto    │
│  e depois injetado no corpo do artigo                       │
└─────────────────────────────────────────────────────────────┘
```

### Passo 7: Geração da imagem de capa

```
┌─────────────────────────────────────────────────────────────┐
│  ANTES DE ESCREVER o artigo, o sistema escolhe a imagem     │
│  de capa:                                                   │
│                                                             │
│  1. Se modo for "informativo":                              │
│     → Busca wallpaper de jogo no RAWG (API de imagens)      │
│     → Usa o "hint" do template como termo de busca          │
│                                                             │
│  2. Se tiver produtos:                                       │
│     → Usa get_best_cover_image():                           │
│       • Para categorias de jogos → tenta RAWG primeiro      │
│       • Para outros → usa thumbnail do produto mais caro    │
│         (ou último não-jogo da lista)                       │
│     → Melhora a resolução da imagem ML (troca -F por -O)   │
│                                                             │
│  3. A imagem é incluída no frontmatter como campo "image"   │
│                                                             │
│  IMPORTANTE: Esta pipeline NÃO usa OpenAI para gerar capa.  │
│  Só a pipeline principal tem essa capacidade.               │
└─────────────────────────────────────────────────────────────┘
```

### Passo 8: Escrita do artigo pela IA

O sistema tenta primeiro o Gemini (`gemini-flash-latest`). Se falhar, usa Groq (`llama-3.3-70b-versatile`):

```
┌─────────────────────────────────────────────────────────────┐
│  O QUE É ENVIADO PARA A IA                                  │
│                                                             │
│  • Categoria do artigo (noticia, review, guia, etc.)        │
│  • Modo do artigo (informativo, melhores, custo-benefício,  │
│    misto)                                                   │
│  • Dica do tema (hint)                                       │
│  • Fontes da pesquisa Tavily                                │
│  • Produtos com preços, imagens e links de afiliado         │
│    (se o modo tiver produtos)                               │
│  • Imagem de capa (URL)                                     │
└─────────────────────────────────────────────────────────────┘
```

**Os 4 modos de artigo:**

```
┌────────────┬──────────────────────────────────────────────────────────────────────────┐
│  MODO      │  COMO FUNCIONA                                                           │
├────────────┼──────────────────────────────────────────────────────────────────────────┤
│            │  • Artigo PURAMENTE informativo                                          │
│ informativo│  • NÃO inclui produtos, preços nem links de afiliado                     │
│            │  • Tema: curiosidades, histórias, dados, tutoriais                      │
│            │  • Estrutura: introdução → 5-7 seções → FAQ → fontes                    │
│            │  • Mínimo: 1200 palavras                                                │
├────────────┼──────────────────────────────────────────────────────────────────────────┤
│            │  • Artigo focado em PRODUTOS                                             │
│  melhores  │  • Produtos do MAIS CARO ao MAIS BARATO                                  │
│            │  • Cada produto: imagem + descrição + botão "VER NO MERCADO LIVRE"       │
│            │  • Inclui tabela comparativa + FAQ                                       │
│            │  • Mínimo: 1500 palavras                                                │
├────────────┼──────────────────────────────────────────────────────────────────────────┤
│            │  • Artigo focado em PRODUTOS                                             │
│custo-      │  • Produtos do MAIS BARATO ao MAIS CARATO                                │
│benefício   │  • Cada produto: imagem + descrição + botão "VER NO MERCADO LIVRE"       │
│            │  • Inclui tabela comparativa + FAQ                                       │
│            │  • Mínimo: 1500 palavras                                                │
├────────────┼──────────────────────────────────────────────────────────────────────────┤
│            │  • ARTIGO HÍBRIDO: informativo + produtos                                │
│   misto    │  • Primeiro: conteúdo informativo (4-6 seções)                           │
│            │  • Depois: seção "Produtos Recomendados" com todos os produtos           │
│            │  • Os produtos ficam APENAS na seção final (misturados no corpo)         │
│            │  • Mínimo: 1200 palavras                                                │
└────────────┴──────────────────────────────────────────────────────────────────────────┘
```

**Regras que a IA segue:**

```
┌─────────────────────────────────────────────────────────────┐
│  REGRAS DA IA (pipeline secundária)                         │
│                                                             │
│  • Tom: "escreva como um gamer experiente, natural"         │
│  • Título SEO: 55-65 caracteres                             │
│  • Descrição: 100-160 caracteres                            │
│  • Tags: mínimo 3                                           │
│  • NUNCA mencionar IA                                       │
│  • NUNCA inventar dados — usar só as fontes fornecidas      │
│  • NUNCA começar com "Neste artigo..." ou "Hoje vamos..."   │
│  • Usar **Nome do Jogo** em negrito (para injecao de imagens)│
│  • Para modos com produtos: usar <img> + <a class="product-btn">│
│  • Frontmatter YAML entre "---" (abrir e fechar)            │
│                                                             │
│  Validação automática:                                       │
│  • Título mínimo 10 caracteres                              │
│  • Descrição entre 50-160 caracteres                        │
│  • Categoria válida                                         │
│  • Mínimo 800 palavras (erro) / 1500 ideal (warning)        │
│  • Sem produtos proibidos (whey, parafusadeira, etc.)        │
│  • Sem produtos duplicados                                   │
│                                                             │
│  Se falhar na validação → o script para com erro            │
└─────────────────────────────────────────────────────────────┘
```

### Passo 9: Pós-processamento (imagens e afiliados)

```
┌─────────────────────────────────────────────────────────────┐
│  DEPOIS QUE O ARTIGO É ESCRITO, o sistema processa:         │
│                                                             │
│  1. CORREÇÃO DE LINKS DE AFILIADO:                          │
│     → Percorre o corpo do artigo                             │
│     → Substitui qualquer URL do produto pelo link de         │
│       afiliado correto (garante que nenhum link fique errado)│
│                                                             │
│  2. INJEÇÃO DE IMAGENS RAWG:                                │
│     → Procura nomes de jogos em negrito no corpo: **Nome**  │
│     → Para cada jogo, busca imagem no RAWG (API)            │
│     → Injeta <img> antes do negrito:                        │
│       **Fortnite** → <img src="rawg.jpg"> **Fortnite**      │
│                                                             │
│  3. ESCREVE O ARQUIVO FINAL:                                │
│     → Junta frontmatter YAML + corpo processado             │
│     → Salva como {slug}.md                                   │
└─────────────────────────────────────────────────────────────┘
```

### Passo 10: Salvar e publicar

```
┌─────────────────────────────────────────────────────────────┐
│  SALVAR O ARTIGO:                                           │
│  • Caminho: src/content/artigos/{slug}.md                   │
│  • Slug gerado a partir do título (normalizado)             │
│  • Se slug duplicado → adiciona timestamp                   │
│                                                             │
│  ATUALIZAR ESTADO:                                          │
│  • state.json: data, slug, índice da categoria              │
│  • article_history.json: título, slug, categoria, modo,     │
│    data, query ML, quantidade de produtos                   │
│                                                             │
│  PUBLICAR:                                                   │
│  • git add -A                                               │
│  • git commit -m "feat: artigo gerado automaticamente - {slug}" │
│  • git push origin main                                     │
│  • GitHub Actions roda: astro build → publica no Pages      │
│                                                             │
│  → Artigo está no ar!                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Scripts Auxiliares

```
┌──────────────────────────┬──────────────────────────────────────────┐
│  SCRIPT                  │  O QUE FAZ                               │
├──────────────────────────┼──────────────────────────────────────────┤
│  ml_affiliate.mjs /      │  Gera links de afiliado do Mercado       │
│  ml_affiliate.py         │  Livre (visita página, pega chave de     │
│                          │  segurança, pede link curto à API)       │
├──────────────────────────┼──────────────────────────────────────────┤
│  openai-cover.mjs        │  Gera imagens de capa com IA (OpenAI     │
│                          │  GPT-5), analisa brilho das imagens      │
│                          │  para guiar a geração                    │
├──────────────────────────┼──────────────────────────────────────────┤
│  gerar-artigo-pilar.mjs  │  Gera artigos "pilares" (guias           │
│                          │  completos com 9 seções, cada uma com    │
│                          │  pesquisa e produtos separados)          │
├──────────────────────────┼──────────────────────────────────────────┤
│  download-images.mjs     │  Baixa imagens do Mercado Livre para     │
│                          │  o servidor local (mais rápido)          │
├──────────────────────────┼──────────────────────────────────────────┤
│  gerar-status.cjs        │  Gera arquivo de status do blog (conta   │
│                          │  artigos, verifica APIs, gera JSON)      │
├──────────────────────────┼──────────────────────────────────────────┤
│  gerar-placas-video.mjs  │  Pipeline dedicada para artigos sobre    │
│                          │  placas de vídeo                         │
├──────────────────────────┼──────────────────────────────────────────┤
│  gerar-lista-monitores   │  Pipeline dedicada para artigos sobre    │
│  .mjs                    │  monitores gamer                         │
├──────────────────────────┼──────────────────────────────────────────┤
│  gerar-gta6.mjs          │  Gera artigo sobre GTA 6 com template    │
│                          │  pré-definido (conteúdo hardcoded)       │
└──────────────────────────┴──────────────────────────────────────────┘
```

---

## 8. Workflows do GitHub Actions

```
┌──────────────────────────┬────────────────────┬─────────────────────┐
│  WORKFLOW                │  QUANDO RODA       │  O QUE FAZ          │
├──────────────────────────┼────────────────────┼─────────────────────┤
│  gerar-conteudo.yml      │  A cada 2 dias     │  Roda o script      │
│                          │  às 9h30 UTC       │  principal de       │
│                          │  (6h30 BRT)        │  geração de artigo  │
├──────────────────────────┼────────────────────┼─────────────────────┤
│  gerar-artigo-pilar.yml  │  Manual            │  Roda script de     │
│                          │                    │  artigo pilar       │
├──────────────────────────┼────────────────────┼─────────────────────┤
│  deploy.yml              │  Sempre que algo   │  astro build +      │
│                          │  vai para o branch │  publica no         │
│                          │  main              │  GitHub Pages       │
└──────────────────────────┴────────────────────┴─────────────────────┘
```

---

## 9. Credenciais (Chaves de API)

```
┌────────────────────────┬─────────────────────────────────┬─────────────────────┐
│  NOME                  │  PARA QUE SERVE                  │  ONDE É USADA       │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  GEMINI_API_KEY        │  Acesso ao Google Gemini         │  Todos os scripts   │
│                        │  (IA primária)                    │  de geração         │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  GROQ_API_KEY          │  Acesso ao Groq (fallback)       │  Todos os scripts   │
│                        │                                  │  de geração         │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  TAVILY_API_KEY        │  Ferramenta de pesquisa na       │  Todos os scripts   │
│                        │  internet                        │  de pesquisa        │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  ML_CLIENT_ID          │  Identificação do app no         │  Busca de produtos  │
│                        │  Mercado Livre                   │  via API            │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  ML_CLIENT_SECRET      │  Senha do app no Mercado Livre   │  Busca de produtos  │
│                        │                                  │  via API            │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  ML_COOKIES_B64        │  Cookies de sessão do navegador  │  Geração de links   │
│                        │                                  │  de afiliado        │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  RAWG_API_KEY          │  Banco de dados de imagens de    │  Injeção de imagens │
│                        │  jogos                           │                     │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  OPENAI_API_KEY        │  IA que gera imagens de capa     │  Geração de capa    │
│                        │                                  │  com IA             │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  GITHUB_TOKEN          │  Permissão para enviar           │  Git push + API     │
│                        │  alterações ao GitHub             │  do GitHub          │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  ADMIN_API_KEY         │  Senha do painel administrativo  │  Login no admin     │
├────────────────────────┼─────────────────────────────────┼─────────────────────┤
│  ML_AFFILIATE_TAG      │  Código de afiliado              │  Todos os scripts   │
│                        │  (sergioskm)                     │  de afiliado        │
└────────────────────────┴─────────────────────────────────┴─────────────────────┘
```

---

## 10. Arquivos de Estado

```
┌──────────────────────────┬────────────────────────────────────┬─────────────────────┐
│  ARQUIVO                 │  O QUE REGISTRA                    │  PARA QUE SERVE     │
├──────────────────────────┼────────────────────────────────────┼─────────────────────┤
│  state.json (raiz)       │  Último artigo, data, slug,        │  Evitar artigos     │
│                          │  categoria, palavras-chave e       │  repetidos e manter │
│                          │  temas usados                      │  rotação            │
├──────────────────────────┼────────────────────────────────────┼─────────────────────┤
│  state.json              │  Índice da última categoria,       │  Controle da        │
│  (automation/)           │  data do último artigo, slug       │  pipeline           │
│                          │                                    │  secundária         │
├──────────────────────────┼────────────────────────────────────┼─────────────────────┤
│  article_history.json    │  Histórico completo: título, slug, │  Verificar o que    │
│                          │  categoria, modo, data, query,     │  já foi escrito     │
│                          │  produtos                          │                     │
├──────────────────────────┼────────────────────────────────────┼─────────────────────┤
│  public/status.json      │  Saúde do blog: total de artigos,  │  Dashboard de       │
│                          │  último deploy, categorias, status  │  status             │
│                          │  das APIs                          │                     │
└──────────────────────────┴────────────────────────────────────┴─────────────────────┘
```

---

## 11. Painel Administrativo

```
┌─────────────────────────────────────────────────────────────┐
│  PAINEL ADMINISTRATIVO                                      │
│  (site interno, não público)                                │
│                                                             │
│  O QUE PERMITE FAZER:                                       │
│  • Ver lista de todos os artigos                            │
│  • Criar, editar e excluir artigos                          │
│  • Definir artigo destaque                                  │
│  • Ver estatísticas de visualização                         │
│  • Alterar cores e configurações do blog                    │
│                                                             │
│  COMO FUNCIONA:                                             │
│  • Servidor FastAPI na VM                                   │
│  • Autenticação por senha                                   │
│  • API do GitHub para ler/escrever artigos                  │
│  • SQLite para contagem de visualizações                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Resumo do Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│  A CADA 2 DIAS:                                            │
│                                                             │
│  GitHub Actions acorda                                      │
│    → Verifica se pode gerar                                 │
│    → Lê notícias e Reddit (tendências)                      │
│    → Pesquisa na internet (Tavily)                          │
│    → Busca produtos no Mercado Livre                        │
│    → Gera links de afiliado                                 │
│    → IA escreve o artigo (Gemini → Groq → OpenAI)          │
│    → Injeta imagens [IMG:Nome] → <img> (RAWG + OpenAI)     │
│    → Injeta produtos [PRODUTO:N] → card com botão verde    │
│    → Salva o arquivo .md (frontmatter + corpo)              │
│    → Envia para o GitHub                                    │
│    → GitHub Pages publica o blog                            │
│    → Artigo está no ar!                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Como Saber se o Blog Está Funcionando

```
┌─────────────────────────────────────────────────────────────┐
  ONDE OLHAR PARA VERIFICAR A SAÚDE DO BLOG                  │
│                                                             │
│  1. status.json (raiz do repositório)                       │
│     → Mostra último sucesso, último erro e falhas seguidas  │
│                                                             │
│  2. public/status.json (site publicado)                     │
│     → Mostra saúde geral, total de artigos e status das APIs│
│                                                             │
│  3. GitHub Actions → aba "Actions"                          │
│     → Mostra se o workflow rodou e se deu erro             │
│                                                             │
│  4. Dashboard do Gemini (aistudio.google.com) ou GROQ       │
│     (console.groq.com) → Mostra chamadas e uso das APIs    │
└─────────────────────────────────────────────────────────────┘
```

### Campos importantes do `state.json`

```
┌───────────────────────┬────────────────────────────────────────┐
│  CAMPO                │  SIGNIFICADO                           │
├───────────────────────┼────────────────────────────────────────┤
│  last_success         │  Data do último artigo publicado       │
│  last_error           │  Mensagem do último erro               │
│  consecutive_failures │  Quantas falhas seguidas aconteceram   │
│  total_articles       │  Total de artigos no blog              │
└───────────────────────┴────────────────────────────────────────┘
```

Se `consecutive_failures` for maior que 0 e `last_error` não for `null`, algo deu errado na geração.

### Erro comum já corrigido

Em julho de 2026, o workflow começou a falhar com:

```
Cannot read properties of undefined (reading 'slice')
```

Esse erro acontecia no tratamento de erros do script. Quando uma API (GROQ, Tavily, OpenAI, etc.) retornava um erro sem uma mensagem de texto, o script tentava cortar essa mensagem com `.slice()` e quebrava. A correção foi validar se o valor existe antes de usar `.slice()`.

### Consumo de API

O blog usa poucas chamadas de API comparado a outros projetos:

| Serviço | Uso típico do blog | Limite |
|---------|-------------------|--------|
| Gemini | 3–9 chamadas por dia (3 tentativas × 3 gerações) | 30 RPM free |
| GROQ | 2–3 chamadas por dia (fallback) | 200K tokens/dia |
| Tavily | 1–2 buscas por dia | 1000 consultas/mês |
| RAWG | 5–10 buscas por dia | Free tier |

O Gemini é sempre tentado primeiro. Se ele falha (comum no free tier por rate limit), o sistema cai para Groq, que é mais estável mas tem limite menor de tokens.

---

*Este documento foi criado para análise do pipeline do blog. Explica todos os processos de geração de artigos, desde a pesquisa até a postagem.*
