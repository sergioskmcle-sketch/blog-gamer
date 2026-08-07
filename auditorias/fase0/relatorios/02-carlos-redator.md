# Auditoria — Carlos Redator
## Data: 2026-08-04

Analise de escrita, persona, qualidade e padroes de IA dos 17 artigos publicados em `src/content/artigos/`.

---

### 1. Analise por Artigo

| # | Artigo (slug resumido) | Cat. | Persona Esperada | Persona Detectada | Nota | Problemas Principais |
|---|------------------------|------|------------------|-------------------|------|----------------------|
| 1 | xbox-summer-sale-2026-bundles | promo | Mano Gamer | Mano Gamer | 7 | Sem tabela comparativa, sem pros/contras; artigo raso para sale com 2000+ jogos |
| 2 | xbox-game-pass-julho-2026 | promo | Mano Gamer | Mano Gamer | 7.5 | Frase repetida "nao tem desculpa pra ficar de fora" x2; sem pros/contras |
| 3 | switch-2-e-ps5-7-ofertas | lista | Mano Gamer | Mano Gamer | 6.5 | Titulo promete 7 ofertas mas conteudo mistura Switch 2, PS5 e PS Plus sem fio |
| 4 | playstation-julho-2026-guia | guia | Tecnico | Tecnico | 6.5 | Abertura sem H2; imagens no final em posicao errada; texto agri-docado |
| 5 | perifericos-gamer-teclados | lista | Mano Gamer | Mano Gamer | **8** | **MELHOR** — voz forte, dados tecnicos, FAQ organico |
| 6 | os-jogos-battle-royale | lista | Mano Gamer | NENHUMA | **2** | **PIOR** — zero personalidade, enciclopedia, abertura proibida, FAQ repetitivo |
| 7 | oferta-xbox-summer-sale-2026 | lista | Mano Gamer | Mano Gamer | 5.5 | Contem meli.la (links legados proibidos); product cards HTML manual |
| 8 | mouse-gamer-wireless | noticia | Mano Gamer | Mano Gamer | 7 | Categoria errada (deveria ser lista/guia); product card DELUX linka loja generica |
| 9 | monitores-gamer-guia | review | Tecnico | Tecnico | 7.5 | Celulas "Padrao da categoria" na tabela; boa estrutura e persona |
| 10 | fones-de-ouvido-gamer | guia | Tecnico | Tecnico | 7.5 | Abertura excelente; FAQ extenso (5 perguntas); intro redundante |
| 11 | cadeiras-gamer-2026 | guia | Tecnico | Tecnico | 6.5 | Titulos [PRODUTO:1] visiveis; FAQ generico; sem links internos |
| 12 | resident-evil-requiem-persona-5 | noticia | Mano Gamer | MISTA | 6 | Persona oscila Mano/Tecnico; titulo lowercase; meli.la; imagem duplicada |
| 13 | headset-gamer-5-melhores | review | Tecnico | Tecnico | **8** | **MELHOR** (empatado) — dados reais, FAQ organico, tabela solida |
| 14 | gta-6-jogos-2026-performance | lista | Mano Gamer | Mano Gamer | 6 | Texto vago; mistura GTA 6 com Minecraft; fontes vagas sem links |
| 15 | god-of-war-laufey-2027 | noticia | Mano Gamer | MISTA | **4** | IMAGENS BASE64; persona inconsistente; ML generico; FAQ truncado |
| 16 | desconto-gta-6-ps5 | noticia | Mano Gamer | Mano Gamer | 7.5 | Boa energia; dados de preco especificos (R$ 328, R$ 3.699,90) |
| 17 | aumento-placas-video-amd | guia | Tecnico | Tecnico | 7 | Conteudo denso; secao "placas de captura" injetada sem contexto |

**Media geral: 6.7/10**

---

### 2. Padroes de Persona

#### Mano Gamer (9 artigos: 1, 2, 3, 5, 6, 7, 8, 12, 14, 15, 16)

A persona mais usada do blog. Quando funciona, e engajadora — os artigos de teclado (#5), Game Pass (#2) e desconto GTA 6 (#16) provam que a voz "mano do Discord" e viavel.

**Onde funciona bem:**
- Hardware/perifericos com opiniao forte (#5 — "Mano, se existe um nome que virou religiao entre os tryhards...")
- Noticias com dados concretos (#16 — precos especificos: R$ 328, R$ 3.699,90)
- Promocoes com energia (#1 — "o bagulho aqui e quente")

**Onde falha:**
- Artigo #6 (Battle Royale): persona some completamente — vira texto de Wikipedia
- Artigo #12 (RE Requiem): oscila entre Mano e Tecnico dentro do mesmo artigo
- Artigo #15 (God of War): abre Mano mas conteudo e generico demais pra sustentar

**Problemas recorrentes da voz:**
- "nao tem desculpa pra ficar de fora" — aparece em 3+ artigos diferentes
- "o bagulho e quente" — usada em 4+ artigos
- "Fala, gamer!" — TODAS as aberturas usam a mesma frase (padrao aceitavel mas monotono)
- "Curtiu? Entao vai la e garante o teu" — mesma CTA em 5+ artigos

#### Tecnico (6 artigos: 4, 9, 10, 11, 13, 17)

Funciona melhor em artigos de hardware (#9 monitores, #13 headsets, #17 GPUs). A voz e consistente e os dados tecnicos sao bem apresentados.

**Onde funciona bem:**
- Artigos com tabelas comparativas reais (#9 monitores, #13 headsets)
- Guias de compra com especificacoes (#17 GPUs com dados de mercado reais)

**Onde falha:**
- Artigo #4 (PlayStation Julho): texto agri-docado — mistura dados com opiniao sem personalidade
- Artigo #11 (Cadeiras): titulos [PRODUTO:1] expostos quebram completamente a experiencia

**Problemas recorrentes da voz:**
- Secoes introdutorias longas demais antes do conteudo (#10 — fones tem 2 paragrafos intro antes do primeiro produto)
- FAQ com linguagem excessivamente formal
- Ausencia total de humor ou personalidade — some qualquer traco de "gamer"

---

### 3. Problemas de Escrita Encontrados

#### 3.1 Abertura Proibida

| Artigo | Linha | Trecho |
|--------|-------|--------|
| Battle Royale (#6) | 20 | "Neste artigo, vamos explorar os jogos battle royale mais jogados em 2026" |

Violacao direta das Orientacoes Editoriais (secao Introducao, linha 189). Esta e a unica abertura explicitamente proibida encontrada.

#### 3.2 Imagens Base64 no Markdown

| Artigo | Linhas | Problema |
|--------|--------|----------|
| God of War Laufey (#15) | 28, 38 | Imagens inteiras em base64 (data:image/jpeg) — dezenas de KB de lixo no markdown |

Impacto: essas imagens nao renderizam corretamente no Astro, poluem o arquivo e tornam o artigo ilegivel em alguns contextos. Bug de geracao/injecao.

#### 3.3 Links Legados (meli.la)

| Artigo | Linhas | Links encontrados |
|--------|--------|-------------------|
| Xbox Summer Sale (#7) | 41, 53, 65, 77 | meli.la/27u3kzy, meli.la/1grsfwV, meli.la/1bJRsPn, meli.la/1icxjyJ |
| RE Requiem (#12) | 24, 47, 60, 73 | meli.la/1be8mCU, meli.la/1ZvWw9c, meli.la/1GmuhbW |

Impacto: links meli.la sao da API do Mercado Livre com cookies — explicitamente aposentados no README ("nao reativar cookies de sessao do ML — o uso deles causou bloqueio global"). Esses links podem estar quebrados.

#### 3.4 Links Internos Quebrados

| Artigo | Linha | Link |
|--------|-------|------|
| Switch/PS5 (#3) | 69 | `/blog-gamer/blog/playstation-julho-2026...` — truncado (falta fechar parenteses no link) |
| God of War (#15) | 75-76 | Links apontam para `sergioskmcle-sketch.github.io/blog-gamer/blog/god-of-war-laufey-2027-data-trama...` — slug possivelmente inexistente |

#### 3.5 Texto Vago / Sem Dados Especificos

| Artigo | Linha | Trecho |
|--------|-------|--------|
| Battle Royale (#6) | 30-34 | "Com mais de 250 milhoes de jogadores registrados" — dados sem fonte datada |
| Battle Royale (#6) | 50-56 | Caracteristicas identicas para todos os jogos ("Jogabilidade colorida, estilo de arte unico, tamanho de mapa amplo" repetido 3x) |
| GTA 6 (#14) | 92 | "Peguei as infos do Oficina da Net e do portal da conexao gamer — os caras manjam do assunto" — fonte vaga, sem links |
| Cadeiras (#11) | 206 | "A ThunderX3 Yama oferece o melhor equilibrio entre preco e qualidade" — afirmacao sem dados |

#### 3.6 CTA Forcada / Repetitiva

A mesma CTA aparece word-for-word em 5+ artigos:

| Artigo | Linha | Trecho |
|--------|-------|--------|
| Xbox Summer Sale (#1) | 66 | "Curtiu? Entao vai la e garante o teu antes que os descontos evaporem" |
| Switch/PS5 (#3) | 67 | "Curtiu? Entao vai la garantir o teu PS5 na sale" |
| RE Requiem (#12) | 158 | "Curtiu? Entao vai la e garante o teu" |
| God of War (#15) | 61 | "Curtiu? Entao vai la e garante o teu" |
| Game Pass (#2) | 65 | Variacao da mesma estrutura |

Viola a regra "Proibido Repetir" das Orientacoes Editoriais.

#### 3.7 FAQ Truncado

| Artigo | Linha | Problema |
|--------|-------|----------|
| God of War (#15) | 49 | "Quando exatamente sai God of War Laufey?Laufey tem lancamento..." — pergunta e resposta coladas sem quebra de linha |

#### 3.8 Imagens em Posicao Errada

| Artigo | Linhas | Problema |
|--------|--------|----------|
| PlayStation Julho (#4) | 110-112 | Duas imagens <img> no final do arquivo, depois de todas as secoes — deveriam estar no corpo |
| Fones (#10) | 205 | Imagem no final apos a secao "Continue Explorando" |
| Headsets (#13) | 103, 108 | Imagens no final do arquivo em posicoes incorretas |

#### 3.9 Titulos de Secao em Inglês

| Artigo | Linha | Trecho |
|--------|-------|--------|
| Mouse (#8) | 91 | "Conclusao: Qual Modelo Encaixa no Seu Bolso?" |
| GTA 6 (#14) | 80 | "Veredito Gamer" |
| Monitores (#9) | 80 | "Veredito: Qual Monitor Vale o Seu Investimento?" |
| Headsets (#13) | 93 | "Veredito: Qual Headset Gamer Escolher?" |

O termo "Veredito" soa estranho em portugues. Preferivel: "Veredicto" ou "Conclusao".

#### 3.10 Titulos [PRODUTO:X] Visiveis

| Artigo | Linhas | Problema |
|--------|--------|----------|
| Cadeiras (#11) | 32, 55, 77, 99, 121, 143 | Titulos como "## [PRODUTO:1] — A Melhor Cadeira Gamer Premium" — placeholder nao substituido pelo nome real |

---

### 4. Melhor vs Pior Artigo

#### MELHOR: perifericos-gamer-os-5-melhores-teclados-mecanicos-de-2026 (#5)
**Nota: 8/10**

**Por que funciona:**

**Abertura engajadora e especifica:**
> "Se a tua digitacao ta travando na hora do combate ou tua tecla ta dando double click no meio do clutch, para tudo porque o problema ta na tua mesa."

Fala com o leitor, mostra um problema concreto, usa linguagem gamer natural. E o tipo de frase que faz o leitor se identificar e continuar lendo.

**Persona Mano Gamer sustentada do inicio ao fim:**
> "Mano, se existe um nome que virou religiao entre os tryhards de perifericos gamer, esse nome e Wooting."

Tem voz, tem opiniao, tem dados. nao e so "giria por giria" — e personalidade real conectada com informacao util.

**Dados tecnicos reais:**
> "Polling Rate bruto de 8.000Hz com uma latencia ridicula de apenas 0,08ms. Isso e mais rapido do que a sua retina consegue processar."

Numeros especificos, comparacao visual, impacto no gameplay. E o tipo de conteudo que um leitor nao encontra em qualquer blog generico.

**FAQ organico:**
Perguntas que um leitor real faria: "O que e um teclado magnetico com Hall Effect?", "O que e a funcao Rapid Trigger?" — nao sao perguntas inventadas pra preencher espaco.

**Secao pratica de decisao:**
> "Na duvida de qual vai casar perfeitamente no teu setup? Se liga no resumo direto ao ponto:"

Direta, sem enrolacao, agrupada por perfil de usuario.

**Onde poderia melhorar:**
- Tabela comparativa poderia ter mais colunas de dados (preco, peso)
- Falta um "Veredicto" ou sintese final antes do CTA

---

#### PIOR: os-jogos-battle-royale-mais-jogados-em-2026-ranking-e-detalhes (#6)
**Nota: 2/10**

**Por que falha completamente:**

**Abertura proibida (violacao direta das Orientacoes Editoriais):**
> "Neste artigo, vamos explorar os jogos battle royale mais jogados em 2026, incluindo Fortnite, Free Fire, PUBG, Apex Legends e Warzone."

A secao "Introducao" das Orientacoes Editoriais e explicita: "Nunca iniciar com: Neste artigo... Hoje vamos falar... Neste conteudo..."

**Linguagem de enciclopedia:**
> "Os jogos battle royale sao um tipo de jogo de video em que um grande numero de jogadores e lancado em um mapa e deve lutar para ser o ultimo sobrevivente."

Qualquer gamer que le esse blog ja sabe o que e um battle royale. Esse paragrafo nao entrega nada.

**Dados repetitivos e genericos:**
A secao "Caracteristicas dos Jogos Battle Royale Mais Jogados" repete a mesma estrutura 5 vezes:
- "Jogabilidade colorida, estilo de arte unico, tamanho de mapa amplo." (Fortnite)
- "Jogabilidade rapida, tamanho de mapa compacto, graficos coloridos." (Free Fire)
- "Jogabilidade realista, tamanho de mapa amplo, graficos detalhados." (PUBG)
- "Jogabilidade rapida, personagens unicos com habilidades especiais, tamanho de mapa amplo." (Apex)
- "Jogabilidade realista, integracao com o jogo Call of Duty, tamanho de mapa amplo." (Warzone)

Tudo genericissimo. Nenhuma informacao que diferencie esses jogos de forma util.

**FAQ inutil — a pergunta e a resposta sao a mesma coisa:**
> "Quais sao os jogos battle royale mais jogados em 2026?: Os jogos battle royale mais jogados em 2026 sao Fortnite, Free Fire, PUBG, Apex Legends e Warzone."

**Persona inexistente:**
Categoria "lista" deveria usar Mano Gamer. O texto nao tem uma unica giria, opinao ou personalidade. E 100% texto de Wikipedia traduzido.

**Imagens inline quebradas:**
Tags `<img>` coladas no meio de itens numerados (linhas 30-34) — formato que nao renderiza corretamente.

**Fontes questionaveis:**
Links para yadavgames.com, sunstrikestudios.com, juegostudio.com — sites sem credibilidade jornalistica.

**Comparacao direta:**

| Criterio | Teclados (#5) | Battle Royale (#6) |
|----------|---------------|---------------------|
| Abertura | Engajadora, especifica | Generica, proibida |
| Persona | Mano Gamer sustentada | Nenhuma |
| Dados | Especificos (8000Hz, 0.08ms) | Genericos ("250 milhoes de jogadores") |
| FAQ | Organico, util | Repetitivo, inutil |
| Engajamento | Alta — faz o leitor querer continuar | Zero — faz o leitor fechar a pagina |
| Fontes | RTINGS, TecMundo, KODA | Sites genericos sem credibilidade |
| Estrutura | Secao de decisao clara | Lista sem hierarquia |

---

### 5. Padroes de IA Detectados

#### 5.1 Frases Copiadas entre Artigos

A mesma frase ou estrutura aparece em multiplos artigos — sinal claro de que o prompt de geracao reutiliza blocos:

**"nao tem desculpa pra ficar de fora"** — aparece em:
- Xbox Summer Sale (#1) linha 36
- Game Pass (#2) linha 15
- Game Pass (#2) linha 35

**"o bagulho e quente/quente"** — aparece em:
- Xbox Summer Sale (#1) linha 18
- Game Pass (#2) linha 11
- RE Requiem (#12) linha 13
- Desconto GTA 6 (#16) linha 20

**"Curtiu? Entao vai la e garante o teu"** — aparece em 5+ artigos (ver secao 3.6)

**"os caras manjam do assunto"** — aparece em:
- Teclados (#5) linha 110
- Mouse (#8) linha 103
- GTA 6 (#14) linha 92
- Desconto GTA 6 (#16) linha 77
- Placas de video (#17) — nao usa mas estrutura similar

#### 5.2 Estruturas de FAQ Identicas

Todos os FAQs seguem o mesmo padrao mecanico:
1. Numeracao bold ("**1.**", "**2.**", "**3.**")
2. Pergunta em negrito seguida de dois-pontos
3. Resposta de 1-2 frases diretas

Nao ha variedade. Artigos como #5 (teclados) e #13 (headsets) fogem desse padrao usando ### (H3) para cada pergunta — e funciona muito melhor.

#### 5.3 Aberturas com Padrao Identico

Todas as aberturas Mano Gamer seguem a formula:
```
Fala, gamer! [Frase de impacto com giria] [Contexto rapido] [Convite pra continuar]
```

Exemplos:
- "Fala, gamer! A Xbox Summer Sale 2026 acabou de abrir a porta e ja ta tirando o folego da galera."
- "Fala, gamer! Julho chegou com a enxurrada de novidades que a Microsoft prometeu."
- "Fala, gamer! Se a tua digitacao ta travando na hora do combate..."

E aceitavel como padrao, mas Monotono quando 100% das aberturas sao identicas.

#### 5.4 Listas com Estrutura Mecanica

A secao "Caracteristicas" do artigo Battle Royale (#6) e o pior exemplo:
- Cada item segue a formula: "Jogabilidade [X], [Y], tamanho de mapa [Z]"
- Nenhuma variacao de estrutura
- Zero personalidade

Outros artigos tem o mesmo problema em menor escala — as listas de "Destaques" nas cadeiras (#11) seguem o formato:
```
- [Feature 1]
- [Feature 2]
- [Feature 3]
- [Feature 4]
- [Feature 5]
```
Sem contexto, sem por que aquilo importa, sem conexao com o leitor.

#### 5.5 Texto Generico que Poderia Ser Qualquer Blog

Trechos como este do Battle Royale (#6) nao contem nada que identifique o Blog Gamer:
> "Desde o lancamento de Fortnite em 2017, o genero battle royale explodiu em popularidade, com muitos outros jogos seguindo seus passos."

Isso poderia estar em qualquer site de tecnologia do mundo. Nao tem voz, nao tem opiniao, nao tem dados especificos.

#### 5.6 Dados Sem Fonte ou com Fonte Vaga

| Artigo | Trecho | Problema |
|--------|--------|----------|
| Battle Royale (#6) | "Com mais de 250 milhoes de jogadores registrados" | Sem ano de referencia, sem fonte |
| GTA 6 (#14) | "Peguei as infos do Oficina da Net e do portal da conexao gamer" | Fonte vaga sem links |
| Cadeiras (#11) | "A ThunderX3 Yama oferece o melhor equilibrio" | Afirmação sem benchmark ou preco |

Compare com artigos bons que citam fontes especificas:
- Teclados (#5): RTINGS.com, KODA, TecMundo — com links
- Headsets (#13): IGN, RTINGS, GAMES.GG — com links
- GPUs (#17): Accio Business, Portal Viciados, TudoCelular — com links

---

### 6. Recomendacoes para a Squad

#### 6.1 Regras de Persona (Obrigatorias)

**Para Mano Gamer:**
- NUNCA usar "Neste artigo vamos..." ou "Hoje vamos falar..." na abertura
- Variar as aberturas: usar dados, curiosidade, pergunta retorica, cena de gameplay — nao so "Fala, gamer!"
- Manter girs e vocabulario gamer consistente NAO e so na abertura — o texto todo precisa manter a voz
- CTA variadas: nunca repetir "Curtiu? Entao vai la e garante o teu" em artigos diferentes
- Usar comparacoes do mundo gamer com moderacao (nao abusar de "mais dificil que matar Malenia")

**Para Tecnico:**
- Comecar direto ao conteudo — nao ter 2+ paragrafos de introducao antes do primeiro H2
- Dados tecnicos devem ter contexto: nao basta dizer "165Hz" — explicar POR QUE importa
- FAQ com linguagem acessivel: explicar tecnicismos sem ser didatico demais
- Manter pelo menos algum traco de personalidade "gamer" — nao virar manual tecnico

#### 6.2 Regras de Estrutura (Obrigatorias)

- Todo artigo precisa de: Intro > Secoes H2 > Tabela Comparativa > Pros/Contras > FAQ > Conclusao/Veredicto > CTA Telegram > Fontes
- FAQ: usar H3 (###) para cada pergunta, NAO numeracao bold
- Imagens: nunca no final do arquivo; sempre no contexto da secao relevante
- Links internos: SEMPRE incluir 2-3 links para outros artigos do blog
- NUNCA usar placeholders como [PRODUTO:1] — substituir pelo nome real do produto
- NUNCA usar imagens base64 no markdown
- NUNCA usar links meli.la (legados e proibidos)

#### 6.3 Regras de Conteudo (Obrigatorias)

- Cada paragrafo deve acrescentar informacao NOVA — nao repetir a mesma ideia com palavras diferentes
- Dados e estatisticas devem ter fonte datada e link quando possivel
- FAQ deve ter perguntas que um leitor REAL faria — nao perguntas que repetem o titulo
- Cada produto/item deve ter dados ESPECIFICOS: preco, especificacao, comparacao — nao so adjjetivos
- Evitar adjetivos genericos: "incrivel", "imperdivel", "massimo" — substituir por dados concretos

#### 6.4 Anti-Padroes de IA (Proibidos)

- NUNCA repetir a mesma frase em artigos diferentes (revisar historico antes de gerar)
- NUNCA usar a mesma CTA word-for-word em artigos diferentes
- NUNCA criar listas com estrutura identica para cada item (variar sintaxe)
- NUNCA escrever FAQ onde a pergunta e a resposta sao a mesma coisa
- NUNCA usar "Confira", "Descubra", "Saiba mais" como palavras de ligacao
- NUNCA criar secoes "Introducao ao Mundo dos [Tema]" — o leitor ja sabe o que e um fone gamer
- NUNCA escrever "Aqui estao alguns..." ou "Aqui esta um ranking..." — ir direto ao conteudo

#### 6.5 Regras de Fontes

- TODOS os artigos devem ter links clicaveis para as fontes (nao so nomes genericos)
- Fontes devem ser de sites reconhecidos: RTINGS, IGN, TecMundo, Adrenaline, Pure Xbox, Push Square, etc.
- NUNCA usar "Peguei as infos do [site] — os caras manjam do assunto" como modelo de creditacao — usar formato padrao: "- Fonte: [Nome do Artigo] — [Site] (URL)"

#### 6.6 Acoes Imediatas

1. **REESCREVER** o artigo Battle Royale (#6) — nota 2/10, inaceitavel
2. **LIMPAR** imagens base64 do God of War (#15) — substituir por URLs RAWG
3. **REMOVER** todos os links meli.la dos artigos #7 e #12 — substituir por links reais do Google Shopping/Serper
4. **CORRIGIR** titulos [PRODUTO:1] nas cadeiras (#11) — substituir por nomes reais
5. **CORRIGIR** FAQ truncado do God of War (#15) — adicionar quebra de linha
6. **REMOVER** imagens no final dos artigos #4, #10, #13 — mover para posicoes corretas no corpo
7. **DIVERSIFICAR** CTAs — criar 5-6 variantes e rotacionar entre artigos

