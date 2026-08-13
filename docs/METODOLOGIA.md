# Metodologia de Ranking — "Top 5 / Melhores"

Este documento explica, de forma pública e auditável, como o Promo Gamer decide
**quais** produtos entram num ranking (guias "Top 5", "Melhores …", "Melhor
custo-benefício" etc.), em que **ordem** e com **qual nota**. Ele dá
credibilidade às listas: **nada aqui é palpite**.

## De onde vêm os produtos

Os candidatos vêm de até três fontes, combinadas num único pool antes de
qualquer filtro:

1. **Shortlist editorial** (`scripts/editorial_shortlist.mjs`) — antes de
   buscar preço, o sistema consulta fontes confiáveis (Serper Search + Tavily)
   por `melhores {categoria} gamer {ano}` e afins, e usa uma chamada de IA para
   extrair os **modelos especificos** citados (marca + modelo, nunca
   "mouse gamer" genérico). Esses modelos viram query prioritária de busca —
   o sistema passa a procurar nomeadamente por "Logitech G Pro X Superlight 2"
   em vez de só "mouse gamer".
2. **Frente 4** (`scripts/monitor_api.mjs`) — banco de produtos do Mercado
   Livre/Shopee com link de afiliado já gerado.
3. **Google Shopping via Serper** (`scripts/google_shopping.mjs`, geo Brasil,
   `gl=br`) — título, preço, imagem, link da loja e, quando a loja fornece,
   **nota média (`rating`, escala 0–5) e número de avaliações
   (`ratingCount`)**.

O sistema coleta até um **pool de ~20 candidatos** (`CANDIDATE_POOL` em
`scripts/gerar-artigo.mjs`) antes de filtrar e ranquear — a lista final de 5
não é mais "os 5 primeiros que a busca devolveu", é o resultado de comparar um
pool maior.

## Detalhes do produto (marca, descrição, specs)

O catálogo da Frente 4 e o Google Shopping entregam apenas **título, preço,
imagem, link de afiliado** e (quando a loja fornece) nota/avaliações — **não**
marca, descrição ou especificações. Para os itens do artigo não ficarem com
prosa genérica, a **regeneração** (`scripts/regenerar-artigos.mjs`,
`opts.enrichNames`) enriquece cada produto com:

- **Página oficial do produto** (`extractMLProductData` em
  `scripts/ml_affiliate.mjs`) — lê o HTML da página (sem sessão/cookie):
  `brand` via JSON-LD (`brand.name`) ou `meta[itemprop="brand"]`, com fallback
  de `detectBrand` no título; `description` via `meta[name=description]`,
  `og:description` ou JSON-LD; `specs` via JSON-LD `additionalProperty`.
- **Fallback Tavily** (`enrichWithTavilyDetails` em
  `scripts/gerar-artigo.mjs`) — busca `"<titulo>"` e usa o título + snippet do
  resultado como descrição, com marca detectada no texto.

Esses campos (`p.brand`, `p.description`, `p.specs`) **só alimentam o prompt da
LLM** (blurbs e corpo) como **fonte de verdade**: o texto pode citar as specs
listadas, mas **nunca** inventar número fora delas. Não há mudança visual nos
cards. Falha de enriquecimento nunca quebra o pipeline — o item segue sem o
campo. O cron diário **não** roda este passo (só a regeneração), para não
adicionar chamadas extras.

## Pipeline de limpeza (`sanitizeProducts`)

Antes de qualquer ranking, o pipeline, nesta ordem:

1. Remove itens que não são produto (blog, listagem, variante de vendedor) e
   duplicata exata por `id`/URL.
2. Descarta itens sem preço.
3. Filtra pela **categoria única do artigo** (ex.: um artigo de teclado
   **nunca** lista mouse) — usando `detectArticleCategory`/`productMatchesCategory`
   de `scripts/product_naming.mjs`. Categorias hoje suportadas: teclado, mouse,
   mousepad, headset, monitor, **tv (smart TV)**, cadeira, placa de vídeo,
   processador, console, controle, notebook, webcam, microfone, gabinete, cooler,
   fonte, SSD, memória RAM.
4. Limpa o nome de cada produto (`cleanProductTitle`), preservando o nome bruto
   em `raw_title`.
5. **Dedup semântico** (`scripts/product_dedupe.mjs`, `dedupeProducts()`) —
   ver seção abaixo.
6. Ranqueia por score objetivo (`rankProducts`).
7. Aplica o **piso de elegibilidade** (`filterEligible`) — ver seção abaixo.
8. Trunca para o tamanho final da lista (`MAX_PRODUCTS`, hoje 5) — só agora,
   depois de comparar o pool inteiro.

## Dedup semântico: quando dois anúncios são o mesmo produto

Comparar só `id`/URL não bastava: "Mouse Razer Deathadder Essential" e "Mouse
Razer 6400dpi Deathadder Essential" são anúncios diferentes do **mesmo
produto** (mesma imagem, inclusive), e o pipeline antigo listava os dois.

`scripts/product_dedupe.mjs` decide identidade por uma escada de sinais, do
mais forte ao mais fraco:

1. **Mesmo id de catálogo/anúncio** (MLB do Mercado Livre, `productId` do
   Google Shopping, `item_id` de cada oferta) → mesmo produto.
2. **Mesma URL canônica** (host + path, sem query/tracking) → mesmo produto.
3. **Categorias diferentes** (ex.: mouse vs. teclado) → **nunca** o mesmo
   produto, mesmo que o nome compartilhe marca/modelo.
4. **Specs conflitantes** (ex.: `TKL` vs. `full`, `27"` vs. `24"`, geração
   `Superlight` vs. `Superlight 2`) → produtos diferentes. Uma spec que
   aparece só de um lado (ex.: "6400 DPI" citado num anúncio e omitido no
   outro) **não** é conflito — é ruído de anúncio, não variante de produto.
5. **Mesma imagem** de produto (chave = nome do arquivo sem sufixo de
   redimensionamento do CDN) e sem conflito de spec → mesmo produto.
6. **Mesma marca + mesmo modelo** detectados (`detectBrand`/`detectModel`) →
   mesmo produto.
7. **Nome equivalente** — similaridade de tokens (Dice) ≥ 0,82 sobre o nome
   normalizado (sem ano, sem specs numéricas com unidade, sem ruído de
   anúncio) → mesmo produto.

Quando dois candidatos são identificados como o mesmo produto, o sistema
mantém o **melhor representante** (quem tem link de afiliado, depois quem tem
mais avaliações, depois melhor nota, depois o mais barato) e **mescla** nele
as ofertas/imagem/avaliação do outro — assim o mesmo produto vendido em duas
lojas vira **um item com dois botões**, não duas posições da lista.

O portão de qualidade (`scripts/validar-artigo.mjs`) também roda essa
comparação sobre os produtos publicados: um artigo com dois títulos do mesmo
produto **falha a validação**.

## Piso de elegibilidade (quem pode entrar no "Top N")

Antes de ranquear, cada candidato precisa passar em **todos** estes critérios
(`eligibilityCheck` / `filterEligible` em `scripts/product_ranking.mjs`) — um
produto caro não entra só por ser caro, e um barato não entra só por ser
barato:

| Critério | Regra |
|----------|-------|
| **Preço plausível** | Entre 0,35× e 2,2× a mediana de preço da lista. Fora disso: risco de anúncio errado/acessório (muito abaixo) ou preço fora de mercado (muito acima). |
| **Prova de compra real** | `rating >= 4.0` **ou** `ratingCount >= 100` com `rating >= 3.5` (nota alta compensa poucas avaliações; muitas avaliações compensam nota mediana — **nunca** nota catastrófica). O piso de volume só vale quando o produto **chega** com `ratingCount` (a Frente 4 não entrega volume em várias categorias). |
| **Volume mínimo de avaliações** | `ratingCount >= 20` quando `ratingCount` existe (relaxado para `>= 10` só se isso for necessário para não deixar a lista abaixo do mínimo de produtos do artigo). |
| **Identidade reconhecível** | Marca conhecida (`KNOWN_BRANDS`) **ou** modelo detectável (`detectModel`, ex. "RTX 4060", "K552") **ou** ao menos 1 menção editorial. |

Para não deixar falso positivo passar só por parecer identificável, a detecção é
conservadora: marca ambígua só conta com contexto ("Blue" é marca só em
microfones Yeti/Snowball/etc., nunca em "mousepad light blue") e resolução
(1080P) ou taxa de quadros (60FPS) nunca são tratadas como modelo.

Produtos que não atendem ao piso são descartados **e o motivo é registrado no
log** (`log("INFO"/"WARN", "Fora do piso de qualidade: ...")`), para
auditoria. Só quando o piso deixaria a lista abaixo do mínimo aceitável para o
artigo o sistema relaxa o volume de avaliações — nunca preço, marca/modelo ou
nota/volume combinados.

## Os 6 critérios do score objetivo

Quem passa no piso é então ranqueado por um **score 0–1** (sinais ausentes
valem **0**, nunca `NaN`; tudo normalizado antes de ponderar):

| Critério | Peso | Como é medido |
|----------|------|---------------|
| **Consenso editorial** | 30% | Quantas vezes marca **e** modelo (não só a marca) são citados juntos em reviews e rankings independentes consultados na pesquisa (Serper Search + Tavily). Marca sozinha bate em qualquer review de periférico — só marca+modelo prova que aquele item específico foi avaliado. |
| **Custo-benefício** | 20% | Preço em relação à **mediana** da lista: pontuação máxima entre 0,6× e 1,2× a mediana. |
| **Avaliações de consumidores** | 20% | Nota média nas lojas (`rating`), normalizada de 0–5 para 0–1. |
| **Volume de avaliações** | 15% | `log10(ratingCount)` normalizado — muitas avaliações = mais confiável. |
| **Reputação da marca** | 10% | Marca reconhecida na categoria (`detectBrand`). |
| **Aderência de specs** | 5% | Quantas especificações relevantes da categoria (DPI, Hz, switch, wireless...) aparecem no nome do produto — sinal de que é um candidato real, não um resultado de busca genérico. |

A ordem final da lista é o score decrescente. A sobreposição de
tokens/tema é usada apenas como **critério de desempate**.

## Nota da tabela comparativa (0–5 estrelas)

A **nota** exibida na tabela **nunca** é o score objetivo acima, e **nunca**
é inventada pela IA. É sempre o `rating` real coletado da fonte do produto,
escala **0 a 5** — a mesma escala do Mercado Livre e da maioria das lojas
brasileiras:

```
Nota: 4,8/5 (vírgula decimal, nunca "/10", nunca > 5)
```

Ratings recebidos fora da escala 0–5 (ex.: uma fonte que use 0–10) são
normalizados na entrada (`normalizeRating` em `google_shopping.mjs` e
`monitor_api.mjs`) — dividido por 2 e registrado em log — em vez de vazar
como "5,5/5" ou "8/5" para o artigo. O score objetivo (0–1) que decide a
**ordem** da lista é um número interno (`p.score`) e nunca é mostrado ao
leitor como "nota".

## Link de afiliado: etapa obrigatória, sem geração própria

Depois que a lista final está fechada, `resolverAfiliados()` roda **sempre**,
fora de qualquer condicional de disponibilidade de API:

1. Produto que já chegou com `affiliate_link` pronto (Frente 4) segue direto.
2. Produto sem link NÃO é mais descartado (ago/2026): é publicado com o
   **permalink** do produto e a flag `affiliate_pending: true`, e registrado em
   `src/data/afiliados_pendentes.json`. O autor corrige o link na aba
   **Pendências** do painel `/admin/` (que atualiza o `<a href>` do botão no
   markdown e dispara o deploy). O blog **nunca** gera o link de afiliado por
   conta própria — link de afiliado é sempre manual.
3. **Notícias nunca abortam por falta de produtos**: artigos de categoria
   `noticia` seguem com 0..n produtos (fluxo informativo com `## Fontes`).
   Artigos de lista/review só abortam se a categoria de produto foi detectada
   e ficou abaixo do mínimo (`MIN_PRODUCTS`) — nunca publicam artigo errado.


> **Regra permanente (ver `docs/TROUBLESHOOTING.md`): o blog nunca gera link
> de afiliado do Mercado Livre por conta própria.** A sessão/cookie do ML é
> compartilhada com o monitor-telegram e não suporta um segundo consumidor —
> uma chamada feita a partir do processo do blog já derrubou essa sessão em
> produção (06/08/2026), tirando as Frentes 1/2 do ar. Por isso
> `resolverAfiliados()` **não** tenta gerar link via `ml_affiliate.mjs` com
> cookie local: produto do ML só entra com link já pronto vindo da Frente 4.
> `generateAffiliateLink()` continua existindo em `scripts/ml_affiliate.mjs`
> apenas para os scripts manuais/legados (`fix-article-links.mjs`,
> `gerar-lista-monitores.mjs`, `gerar-placas-video.mjs`) — nenhum deles roda
> no pipeline automatizado (`gerar-conteudo.yml`).

`scripts/validar-artigo.mjs` verifica, no artigo já montado, que o número de
botões de compra bate com o número de produtos da lista — produto sem botão
reprova a validação.

## Por que entrou (coluna auditável)

A tabela comparativa inclui a coluna **"Por que entrou"**, preenchida com os
critérios objetivos que o produto atendeu (ex.: `4,6★ de nota media · citado
em 3 reviews · marca Logitech`). Assim o leitor consegue auditar a posição de
cada modelo.

## Seção "Como Escolhemos" no artigo

Todo ranking inclui uma seção de metodologia gerada por **template** (não pela
IA), explicando o piso de elegibilidade e os critérios de ranking acima.

## Ano do artigo

O ano usado em títulos, queries de busca e prompts vem de uma fonte única
(`scripts/tempo.mjs`, `ANO_ATUAL`), nunca hardcoded. Como reforço, o sistema
corrige deterministicamente (sem depender do modelo) qualquer ano fora do
intervalo válido (ano corrente ou o seguinte) que apareça no título, na
description ou no heading da lista antes de publicar. `validar-artigo.mjs`
reprova artigo com ano desatualizado no título/description.

**No corpo do artigo** a correção é contextual (`normalizarAnosPreposicional`,
13/08/2026): só reescreve o ano precedido de "de/em/para/até" (ex.: "jogos de
2024"→2026). Nome de jogo com ano no título ("Cyberpunk **2077**") e número de
modelo ("RTX 2060") ficam intactos — antes um `20XX` solto virava o ano
corrente e corrompia o conteúdo.

## Listas de games: grounding por Google e hierarquia (13/08/2026)

- **Grounding** — listas de games ("melhores jogos de PC {ano}") consultam o
  Google antes de escrever: `scripts/games_candidates.mjs` busca
  (Serper + reserva Tavily), a LLM extrai títulos candidatos e o prompt
  obriga a escolher entre eles ("CANDIDATOS OBRIGATÓRIOS"). O `validate()`
  marca item fora da lista como **P2** (regenera; última tentativa publica com
  ressalva). A LLM deixa de listar clássicos antigos como "melhores de {ano}".
- **Hierarquia** — o TOC trata `##` como tópico e `###` como subtópico
  recolhível. Para listas de games sem produtos, `ensureListStructure` garante
  a seção de Itens como `## Os N Melhores ... em {ano}` com cada jogo como
  `### Nome — Subtítulo` (imagem logo após o título, dentro da própria seção).

## Implementação

- `scripts/tempo.mjs` — ano corrente único (`ANO_ATUAL`) e correção
  determinística de anos no texto (`normalizarAnos` para título/description/
  heading da lista; `normalizarAnosPreposicional` para o corpo).
- `scripts/editorial_shortlist.mjs` — shortlist de modelos citados em fontes
  editoriais, usada como query prioritária de busca de produto.
- `scripts/games_candidates.mjs` — candidatos de títulos para listas de games
  (Serper + reserva Tavily → LLM extrai `{titulo, mencoes, fontes}`); o gerador
  usa como "CANDIDATOS OBRIGATÓRIOS" e o `validate()` aplica o gate P2.
- `scripts/product_dedupe.mjs` — identidade semântica de produto
  (`compareProducts`, `dedupeProducts`) e sua reexportação em
  `scripts/gerar-artigo.mjs` (`similarity`, `nameSimilarity`) para os demais
  usos de correspondência de nome (jogos, imagens).
- `scripts/product_ranking.mjs` — sinais, `scoreProduct()`, `rankProducts()`,
  pesos (`RANKING_WEIGHTS`), piso de elegibilidade
  (`eligibilityCheck`/`filterEligible`).
- `scripts/product_naming.mjs` — categoria única, `detectBrand()`,
  `detectModel()`.
- `scripts/google_shopping.mjs` / `scripts/monitor_api.mjs` — captura e
  normalização de `rating`/`ratingCount` (sempre 0–5) e `offers`.
- `scripts/ml_affiliate.mjs` — geração do link de afiliado; falha sempre
  reportada (`{ short_url: null, error }`), nunca mascarada com a URL crua.
- `scripts/gerar-artigo.mjs` — orquestra o pipeline (`sanitizeProducts`,
  `resolverAfiliados`), deriva a nota exibida a partir do `rating` real,
  monta a coluna "Por que entrou" e injeta a seção "Como Escolhemos".
- `scripts/validar-artigo.mjs` — portão de qualidade: ano desatualizado,
  nota fora de escala, produtos duplicados na mesma lista e produto sem botão
  de afiliado reprovam o artigo.

> **Nota de transparência:** quando um sinal não existe (ex.: a loja não
> devolve avaliações), ele vale 0 no score e o produto depende dos demais
> critérios — mas ainda precisa passar no piso de elegibilidade para entrar na
> lista. Listas curtas e corretas são sempre preferidas a listas longas e
> erradas — se o filtro deixar a lista abaixo do mínimo, o gerador **falha e
> não publica** em vez de publicar errado.
>
> **Gate de lista plural (13/08/2026):** título/heading que prometem lista
> plural ("Melhores"/"Os N Melhores" com N≥2) com **menos de 2 produtos** viram
> erro **hard** no `validate()` e reprova no `validar-artigo.mjs` — um ranking
> nunca pode ter um único item (impede "Os 1 Melhores"). Esse gate nasceu do
> artigo reprovado *"Melhores smart tv gamer 4K"* (12/08/2026), que publicou
> com 1 produto absurdo ("Console Sony Fable Standard").
