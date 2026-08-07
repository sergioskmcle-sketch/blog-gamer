# Auditoria — Felipe Otimizador
## Data: 2026-08-04

---

## 1. Análise de Frontmatter por Artigo

| # | Artigo (slug) | Título (chars) | Description (chars) | Tags | Category | Affiliate | Nota SEO |
|---|---------------|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | `god-of-war-laufey-chega-em-2027-tudo-que-voce-precisa-saber` | 59 | 152 | 5 | noticia | true | 7/10 |
| 2 | `desconto-em-gta-6-e-ps5-quebra-recorde-de-vendas-em-2026` | 58 | 149 | 5 | noticia | false | 7/10 |
| 3 | `aumento-em-placas-de-video-da-amd-guia-de-precos-em-2026` | 55 | 151 | 5 | guia | true | 8/10 |
| 4 | `gta-6-e-jogos-de-2026-performance-e-o-que-esperar-no-ps5` | 54 | 149 | 5 | lista | true | 6/10 |
| 5 | `lancamento-2026-resident-evil-requiem-e-persona-5-tactica` | 58 | 168 | 5 | noticia | true | 7/10 |
| 6 | `headset-gamer-os-5-melhores-modelos-para-imersao-em-2026` | 56 | 131 | 5 | review | false | 9/10 |
| 7 | `os-jogos-battle-royale-mais-jogados-em-2026-ranking-e-detalhes` | 64 | 195 | 6 | lista | false | 4/10 |
| 8 | `oferta-no-xbox-summer-sale-2026-5-jogos-impossiveis-de-ignorar` | 63 | 154 | 5 | lista | true | 8/10 |
| 9 | `mouse-gamer-qual-o-melhor-modelo-wireless-e-leve-em-2026` | 56 | 136 | 5 | noticia | true | 8/10 |
| 10 | `playstation-julho-2026-guia-de-jogos-ps-plus-e-acessorios` | 63 | 155 | 5 | guia | false | 8/10 |
| 11 | `perifericos-gamer-os-5-melhores-teclados-mecanicos-de-2026` | 60 | 139 | 5 | lista | false | 9/10 |
| 12 | `switch-2-e-ps5-7-ofertas-quentes-que-voce-nao-pode-perder-em-2026` | 67 | 145 | 5 | lista | false | 7/10 |
| 13 | `xbox-game-pass-julho-2026-10-jogos-forza-6-e-cloud-gaming` | 59 | 160 | 5 | promocao | false | 8/10 |
| 14 | `monitores-gamer-guia-completo-de-modelos-100hz-a-165hz-em-2026` | 65 | 159 | 5 | review | false | 9/10 |
| 15 | `melhores-fones-de-ouvido-gamer-custo-beneficio-2026` | 53 | 160 | 6 | guia | true | 9/10 |
| 16 | `melhores-cadeiras-gamer-de-2026` | 32 | 278 | 7 | guia | true | 7/10 |
| 17 | `xbox-summer-sale-2026-bundles-game-pass-e-lancamentos-top` | 58 | 153 | 5 | promocao | false | 7/10 |

### Resumo de Frontmatter

| Métrica | Ideal | Artigos ok | Artigos fora | % Adequado |
|---------|-------|-----------|-------------|-----------|
| Título 55-65 chars | 55-65 | 14 | 3 | 82% |
| Description 120-160 chars | 120-160 | 15 | 2 | 88% |
| Tags >= 3 | >=3 | 17 | 0 | 100% |
| Category válida | noticia/review/guia/lista/promocao | 17 | 0 | 100% |
| Affiliate boolean | true/false | 17 | 0 | 100% |
| Image presente | URL ou path | 17 | 0 | 100% |

---

## 2. Estrutura de Headings

### Padrão H1
- **Nenhum artigo** usa H1 explícito no body. O H1 é gerado automaticamente pelo template Astro a partir do `title` do frontmatter — isso é correto e padrão para blogs Astro.
- **Problema:** o `title` do frontmatter serve como H1, mas a IA não gera um H1 no markdown. Isso é OK, mas vale documentar.

### Padrão H2 (##)
| Artigo | Qtd H2 | Tema dos H2 | Hierarquia OK? |
|--------|:------:|-------------|:--------------:|
| god-of-war-laufey | 5 | Seções temáticas + FAQ + Conclusão + Fontes | ✅ |
| desconto-gta-6 | 4 | Índice + Seções + FAQ + Conclusão + Fontes | ✅ |
| placas-de-video-amd | 5 | Índice + Produtos + Análise + FAQ + Fontes | ✅ |
| gta-6-performance | 4 | Índice + Seções + FAQ + Veredito + Fontes | ✅ |
| resident-evil-persona | 5 | Seções temáticas + FAQ + Conclusão + Fontes | ✅ |
| headset-gamer | 6 | Índice + Medição + 5 modelos + Tabela + FAQ + Veredito + Fontes | ✅ |
| battle-royale | 6 | Introdução + O que são + Jogos + Ranking + Características + FAQ + Conclusão + Fontes | ⚠️ Muitos H2 genéricos |
| xbox-summer-sale-5jogos | 6 | Índice + Seções + Comparativo + FAQ + Vale a pena + Fontes | ✅ |
| mouse-gamer | 4 | Índice + Elite + Custo-benefício + Tabela + FAQ + Conclusão + Fontes | ✅ |
| playstation-julho | 5 | PS Plus Essential + Extra/Premium + Setup + PS5 vs Steam + FAQ + Conclusão + Fontes | ✅ |
| teclados-mecanicos | 7 | Índice + 5 modelos + Comparativo + Qual escolher + FAQ + Fontes | ✅ |
| switch-2-ps5-ofertas | 5 | Switch 2 + PS5 Sale + PS Plus + Essential + FAQ + Conclusão + Fontes | ⚠️ H2s inconsistentes |
| xbox-game-pass-julho | 4 | Game Pass + Gears + Forza + Cloud Gaming + Consoles + FAQ + Conclusão + Fontes | ✅ |
| monitores-gamer | 4 | Índice + 3 modelos + Tabela + FAQ + Veredito + Fontes | ✅ |
| fones-de-ouvido | 6 | Introdução + 5 modelos + Tabela + Pros/Contras + FAQ + Conclusão + Fontes | ✅ |
| cadeiras-gamer | 7 | Introdução + Por que + 6 produtos + Tabela + Como escolher + FAQ + Conclusão | ⚠️ Sem Fontes |
| xbox-summer-sale-bundles | 4 | Índice + 3 seções + Indie Picks + FAQ + Conclusão + Fontes | ✅ |

### Uso de H3 (###)
- **Artigos com H3 corretos:** headset-gamer (sub-modelos), mouse-gamer (Pros/Contras por modelo), teclados-mecanicos (comparativo), fones-de-ouvido (Pros/Contras por modelo), cadeiras-gamer (como escolher), playstation-julho (análise rápida), monitores-gamer (FAQ), desconto-gta-6 (FAQ).
- **Artigos sem H3 quando deveriam ter:** god-of-war-laufey (FAQ sem H3), gta-6-performance (FAQ sem H3), battle-royale (FAQ sem H3), switch-2-ps5 (FAQ sem H3), xbox-game-pass (FAQ sem H3).
- **Problema recorrente:** FAQs usam formato `**1. Pergunta**` ou texto corrido em vez de `### Pergunta`. Isso prejudica SEO porque Google usa H3 para featured snippets.

### Keyword nos Headings
| Artigo | Keyword principal no H2? | Observação |
|--------|:------------------------:|------------|
| god-of-war-laufey | ✅ "Laufey chega com data fixa..." | Boa |
| desconto-gta-6 | ✅ "Pré-venda de GTA 6..." | Boa |
| placas-de-video-amd | ✅ "Placas de vídeo mais vendidos..." | H2 genérico demais |
| gta-6-performance | ✅ "O Que Esperar de GTA 6..." | Boa |
| resident-evil-persona | ✅ "Resident Evil Requiem..." | Boa |
| headset-gamer | ✅ "Como Medir a Imersão Sonora..." | Boa |
| battle-royale | ⚠️ "O Que São Jogos Battle Royale?" | Genérico, não otimizado |
| xbox-summer-sale-5jogos | ✅ "A Avalanche de Ofertas no Xbox Summer Sale 2026" | Boa |
| mouse-gamer | ✅ "Mouses Wireless de Elite..." | Boa |
| playstation-julho | ✅ "PS Plus Essential de Julho 2026..." | Boa |
| teclados-mecanicos | ✅ "Wooting 80HE — Precisão Magnética..." | Boa |
| switch-2-ps5 | ⚠️ "Switch 2: Por que a galera tá pirando?" | Informal demais |
| xbox-game-pass-julho | ✅ "Game Pass Julho 2026 traz 10 jogos..." | Boa |
| monitores-gamer | ✅ "Samsung Odyssey G5: Desempenho Competitivo..." | Boa |
| fones-de-ouvido | ✅ "HyperX Cloud Stinger 2 Core — O Melhor..." | Boa |
| cadeiras-gamer | ⚠️ "[PRODUTO:1] — A Melhor Cadeira..." | Placeholder visível! Bug grave |
| xbox-summer-sale-bundles | ✅ "Xbox Summer Sale 2026: Descontos..." | Boa |

---

## 3. Links Internos e Externos

### Links Internos por Artigo

| Artigo | Qtd Links Internos | Destinos | Posicionamento | Avaliação |
|--------|:------------------:|----------|----------------|-----------|
| god-of-war-laufey | 2 | guia-laufey, resident-evil-persona | Final (seção Links internos) | ⚠️ Ruim — devia estar no corpo |
| desconto-gta-6 | 3 | switch-2-ps5, ps-julho, xbox-summer-sale | Meio do texto | ✅ Bom |
| placas-de-video-amd | 3 | monitores, mouse-gamer, headset-gamer | Seção "Continue Explorando" | ✅ Bom |
| gta-6-performance | 3 | resident-evil-persona, desconto-gta-6, xbox-game-pass | Meio do texto | ✅ Bom |
| resident-evil-persona | 1 | top-rpgs-2026 | Final | ⚠️ Pouco — meta era 2-3 |
| headset-gamer | 3 | mouse-gamer, cadeiras-gamer, monitores-gamer | Meio do texto (natural) | ✅ Excelente |
| battle-royale | 0 | — | — | ❌ ZERO links internos |
| xbox-summer-sale-5jogos | 3 | xbox-summer-sale-bundles, desconto-gta-6, xbox-game-pass | Meio do texto | ✅ Bom |
| mouse-gamer | 3 | cadeiras-gamer, fones-gamer, monitores-gamer | Conclusão (natural) | ✅ Bom |
| playstation-julho | 2 | novidades-ps5, resident-evil-ps5 | Conclusão | ✅ Bom |
| teclados-mecanicos | 3 | mouse-gamer, headset-gamer, monitores-gamer | Seção "Continue Explorando" | ✅ Bom |
| switch-2-ps5 | 2 | ps-julho, novidades-ps5 | Final (fora de seção) | ⚠️ Mal formatado |
| xbox-game-pass-julho | 3 | ps-julho, novidades-ps5 | Meio do texto | ✅ Bom |
| monitores-gamer | 2 | cadeiras-gamer, fones-gamer | Meio do texto | ✅ Bom |
| fones-de-ouvido | 2 | setup-gamer, monitores-gamer | Seção "Continue Explorando" | ✅ Bom |
| cadeiras-gamer | 0 | — | — | ❌ ZERO links internos |
| xbox-summer-sale-bundles | 0 | — | — | ❌ ZERO links internos |

### Resumo de Links Internos
- **Média:** 1.9 links internos por artigo
- **Meta do README:** 2-3 links internos
- **Artigos com 0 links internos:** 3 (battle-royale, cadeiras-gamer, xbox-summer-sale-bundles) — **CRÍTICO**
- **Artigos com apenas 1 link:** 1 (resident-evil-persona) — **Insuficiente**
- **Artigos com 3+ links:** 8 — **Bom**
- **Posicionamento:** A maioria insere links no meio do texto (ideal). Alguns colocam no final em seção dedicada (menos ideal para SEO).

### Links Externos (Fontes) por Artigo

| Artigo | Fontes externas | Domínios de autoridade |
|--------|:--------------:|----------------------|
| god-of-war-laufey | 3 | insider-gaming.com, tecmundo.com.br, games.gg ✅ |
| desconto-gta-6 | 0 URLs formais | Menção informal (NC News, TecMundo) ⚠️ |
| placas-de-video-amd | 5 | accio.com, viciados.net, tudocelular.com, amambainoticias ✅ |
| gta-6-performance | 0 URLs formais | Menção informal (Oficina da Net) ⚠️ |
| resident-evil-persona | 4 | npr.org, kbbi.org, qoo10.co.id, gamespot.com ✅ |
| headset-gamer | 4 | ositensdecasa.com.br, ign.com, rtings.com, games.gg ✅ |
| battle-royale | 6 | yadavgames.com, sunstrikestudios.com, juegostudio.com, games.gg, gamesight.io, lootbar.com ⚠️ Domínios fracos |
| xbox-summer-sale-5jogos | 4 | purexbox.com, trueachievements.com, gematsu.com, news.xbox.com ✅ |
| mouse-gamer | 1 | rtings.com ✅ |
| playstation-julho | 4 | pushsquare.com, playstationlifestyle.net, sea.ign.com ✅ |
| teclados-mecanicos | 3 | rtings.com, instagram.com, tecmundo.com.br ✅ |
| switch-2-ps5 | 5 | pushsquare.com, playstationlifestyle.net, ign.com, gamesindustry.biz ✅ |
| xbox-game-pass-julho | 4 | games.gg, VZone, Exame, Adrenaline ✅ |
| monitores-gamer | 0 URLs formais | Menção informal (Instagram Reels) ⚠️ |
| fones-de-ouvido | 5 | techreviews.com.br, pandalargo.com.br, seuguiadetecnologia.com, weebsites.com.br ✅ |
| cadeiras-gamer | 0 | — ❌ ZERO fontes |
| xbox-summer-sale-bundles | 5 | trueachievements.com, purexbox.com, gamerant.com, news.xbox.com, gamespot.com ✅ |

### Resumo de Links Externos
- **Artigos sem fontes formais:** 4 (desconto-gta-6, gta-6-performance, monitores-gamer, cadeiras-gamer)
- **Artigo com ZERO fontes:** 1 (cadeiras-gamer) — **CRÍTICO para E-E-A-T**
- **Artigos com fontes de baixa autoridade:** 1 (battle-royale — domínios como yadavgames.com, sunstrikestudios.com)

---

## 4. SEO de Imagens

### Análise por Tipo de Imagem

| Tipo | Quantidade total | Com alt text? | Arquivo otimizado? | Problemas |
|------|:---------------:|:------------:|:------------------:|-----------|
| RAWG (jogos) | ~30 | ✅ Sim (nome do jogo) | ⚠️ URLs longas com query params | OK para SEO |
| Capa IA (local) | 10 | ✅ Via frontmatter `image` | ✅ WebP/PNG em `/images/capas/` | OK |
| Produtos ML (locais) | ~15 | ✅ Nome do produto | ✅ Slug em `/images/produtos/` | OK |
| Externas (genéricas) | ~25 | ⚠️ Variável | ❌ URLs de terceiros | Problema |
| Base64 embutidas | 2 | ❌ Sem alt | ❌ Imenso (peso) | **CRÍTICO** |

### Problemas Específicos de Imagem

1. **god-of-war-laufey (artigo 1):** 2 imagens em Base64 (data:image/jpeg;base64,...). São ~50KB cada de texto inline. **Impacto:** aumenta drasticamente o tamanho do markdown, dificulta manutenção, e o alt text é apenas o nome do arquivo (`1c305096502c475c00276c827f0fd697` e `God-of-War-Laufey-03.06.26`). **Severidade: CRÍTICA** — imagens devem ser externas ou locais, nunca base64.

2. **gta-6-performance (artigo 4):** Usa imagens externas de TikTok (`tiktok.com/api/img`), Instagram, Veja, etc. URLs frágeis que podem quebrar. Alt texts genéricos ("Performance nos Consoles em 2026").

3. **playstation-julho (artigo 10):** 2 imagens no final do artigo, após as fontes, sem contexto. Uma delas é de um blog genérico.

4. **Melhores práticas observadas nos artigos bons:**
   - Artigos 6 (headset), 9 (mouse), 11 (teclados), 14 (monitores), 15 (fones) usam imagens RAWG ou de produto com alt text descritivo e `loading="lazy"`.

### Cobertura de `loading="lazy"` e `decoding="async"`
- Artigos gerados via pipeline automático: ✅ Presente na maioria
- Artigos manuais/antigos: ⚠️ Pode estar ausente

---

## 5. Problemas de SEO Encontrados

### Severidade CRÍTICA (afeta ranking diretamente)

| # | Problema | Artigos afetados | Impacto |
|---|---------|-----------------|---------|
| C1 | **Imagens Base64 no markdown** | god-of-war-laufey | Peso desnecessário, sem SEO de imagem, alt text inútil |
| C2 | **ZERO links internos** | battle-royale, cadeiras-gamer, xbox-summer-sale-bundles | Isolamento de páginas, PageRank não flui |
| C3 | **ZERO fontes externas (E-E-A-T)** | cadeiras-gamer | Google desconfia de artigo sem referências |
| C4 | **Description > 160 chars** | resident-evil-persona (168), battle-royale (195), cadeiras-gamer (278) | Truncamento no SERP, CTR reduzido |
| C5 | **Placeholder `[PRODUTO:1]` visível no H2** | cadeiras-gamer | Conteúdo quebrado publicado, péssima experiência |

### Severidade ALTA (prejudica performance)

| # | Problema | Artigos afetados | Impacto |
|---|---------|-----------------|---------|
| A1 | **Título < 55 chars (curto)** | gta-6-performance (54), fones-de-ouvido (53), cadeiras-gamer (32) | Espaço desperdiçado no SERP |
| A2 | **Título > 65 chars (longo)** | battle-royale (64 ok mas slug longo), switch-2-ps5 (67) | Truncamento no Google |
| A3 | **FAQ sem H3 (###)** | god-of-war-laufey, gta-6-performance, battle-royale, switch-2-ps5, xbox-game-pass | Perde chance de featured snippet |
| A4 | **Headlines de fontes sem URLs** | desconto-gta-6, gta-6-performance, monitores-gamer | E-E-A-T fraco, impossível verificar |
| A5 | **Word count abaixo do ideal** | god-of-war-laufey (~500), battle-royale (~700) | Artigos rasos, baixa autoridade |

### Severidade MÉDIA (oportunidades perdidas)

| # | Problema | Artigos afetados | Impacto |
|---|---------|-----------------|---------|
| M1 | **Keywords genéricas nas tags** | Todos (tags como "jogos", "consoles", "ofertas") | Baixa especificidade para long-tail |
| M2 | **Categoria incorreta** | mouse-gamer (noticia em vez de guia/review) | Metadata inconsistente |
| M3 | **Imagens externas de URLs frágeis** | gta-6-performance, desconto-gta-6, playstation-julho | Links quebrados futuros |
| M4 | **Internos no final em vez de no corpo** | god-of-war-laufey, resident-evil-persona | Menos crawl weight |
| M5 | **Slug do cadeiras-gamer muito curto** | cadeiras-gamer (32 chars) | Keyword "melhores" ausente no slug |
| M6 | **Tags com hífen inconsistente** | xbox-game-pass (tag "cloudgaming" sem espaço) | Parsing pode falhar |

### Severidade BAixa (melhorias pontuais)

| # | Problema | Artigos afetados | Impacto |
|---|---------|-----------------|---------|
| B1 | **Title case inconsistente** | god-of-war-laufey ("God of war" minúsculo) | Profissionalismo visual |
| B2 | **Description sem palavra-chave principal** | headset-gamer (131 chars, sem "headset gamer" no início) | SEO on-page fraco |
| B3 | **Imagens duplicadas** | resident-evil-persona (mesma imagem RAWG 2x) | Experiência ruim |
| M4 | **H2 com ankors `<a id="">` manuais** | placas-de-video-amd, headset-gamer, mouse-gamer, etc. | OK mas redundante com TOC automático |

---

## 6. Recomendações para a Squad

### Regras Obrigatórias para o Agente "Felipe Otimizador"

#### R1: Título (title)
```
- Comprimento: 55-65 caracteres (contar com precisão)
- Keyword principal: nos primeiros 40% do título
- Evitar: títulos genéricos como "tudo que você precisa saber"
- Formato recomendado: [Keyword] + [Benefício/Detalhe] + [Ano]
  ✅ "Headset Gamer: Os 5 Melhores Modelos para Imersão em 2026" (56 chars)
  ❌ "Melhores Cadeiras Gamer de 2026: Guia Completo com os Modelos Top do Mercado" (73 chars)
```

#### R2: Description (meta)
```
- Comprimento: 120-160 caracteres (MÁXIMO 160)
- Keyword principal: nos primeiros 80 caracteres
- Incluir call-to-action ou gancho de curiosidade
- NUNCA repetir o título literalmente
  ✅ "Confira as melhores ofertas do Xbox Summer Sale 2026, com ate 90% de desconto em grandes jogos." (154 chars)
  ❌ "Comparativo completo das melhores cadeiras gamers de 2026: DT3 Rhino, ThunderX3 Yama..." (278 chars — TRUNCADO)
```

#### R3: Estrutura de Headings
```
- H1: gerado pelo template (não duplicar no body)
- H2: cada seção principal com keyword ou variação
- H3: OBRIGATÓRIO para cada pergunta do FAQ (formato ### Pergunta)
- FAQ: usar ### para cada pergunta, NUNCA **negrito** ou número solto
  ✅ ### Qual a diferença real entre 100Hz e 165Hz?
  ❌ **1. Qual a diferença real entre 100Hz e 165Hz?**
```

#### R4: Links Internos
```
- Mínimo: 2 por artigo
- Ideal: 3 por artigo
- Posicionamento: NO CORPO do texto, contextualizados
- Anchor text: descrição natural do destino
- NUNCA colocar links internos apenas no final
  ✅ "Para montar um ecossistema equilibrado ao lado do seu [mouse gamer wireless](/blog-gamer/blog/mouse-gamer...)..."
  ❌ (links apenas na seção "Links internos" no final)
```

#### R5: Links Externos (Fontes)
```
- Mínimo: 2 por artigo (ideal: 3-5)
- SEMPRE com URL completa e clicável
- Domínios de autoridade: ign.com, rtings.com, pushsquare.com, tecmundo.com.br, gamespot.com
- NUNCA: menção informal "Peguei as infos do fulano" sem URL
  ✅ - Push Square: https://www.pushsquare.com/news/2026/07/ps-plus-essential-games-for-july-2026-announced
  ❌ - Peguei as infos do NC News e do Voxel/TecMundo — os caras manjam do assunto.
```

#### R6: Imagens
```
- NUNCA usar imagens Base64 no markdown
- Preferir: imagens locais (/images/produtos/) ou RAWG
- Alt text: descrição concisa da imagem com keyword quando relevante
- loading="lazy" e decoding="async": OBRIGATÓRIO em todo <img>
- Imagens externas: apenas de domínios estáveis (RAWG, Amazon, fabricantes)
  ✅ <img src="/blog-gamer/images/produtos/hyperx-cloud-stinger.png" alt="HyperX Cloud Stinger 2 Core" class="article-game-img" loading="lazy" decoding="async">
  ❌ ![1c305096502c475c00276c827f0fd697](data:image/jpeg;base64,/9j/4AAQ...)
```

#### R7: Frontmatter
```
- title: 55-65 chars, keyword nos primeiros 40%
- description: 120-160 chars, keyword + gancho
- tags: 3-6 tags específicas (evitar genéricas como "jogos", "consoles")
- category: guia | review | lista | noticia | promocao (correspondência exata)
- affiliate: true se artigo tem produtos com link de afiliado
- image: SEMPRE presente, formato WebP/PNG local ou URL RAWG
- NUNCA: placeholders como [PRODUTO:1] no conteúdo publicado
```

#### R8: FAQ (Featured Snippets)
```
- Mínimo: 3 perguntas por artigo
- Formato: ### Pergunta completa com keyword
- Resposta: 2-3 frases diretas (Google copia para featured snippet)
- Perguntas devem usar linguagem natural de busca
  ✅ ### Qual o melhor headset gamer custo-benefício de 2026?
  ❌ **1. Qual a melhor opção?**
```

#### R9: Slug (URL)
```
- Formato: keyword-principal-detalhe-ano
- Separador: hífen
- Sem acentos, sem caracteres especiais
- Máximo: 75 caracteres
- Evitar: slugs muito curtos (cadeiras-gamer-de-2026) ou muito longos
  ✅ headset-gamer-os-5-melhores-modelos-para-imersao-em-2026
  ❌ switch-2-e-ps5-7-ofertas-quentes-que-voce-nao-pode-perder-em-2026 (67 chars no título)
```

#### R10: Word Count por Categoria
```
| Categoria | Mínimo | Ideal |
|-----------|--------|-------|
| noticia   | 600    | 800-1200 |
| review    | 800    | 1200-2000 |
| guia      | 1000   | 1500-3000 |
| lista     | 800    | 1200-2000 |
| promocao  | 600    | 800-1200 |
```

### Checklist de Validação (para scripts)

O agente Felipe Otimizador deve validar antes de cada artigo ser publicado:

```markdown
### Checklist Pré-Publicação

- [ ] title: 55-65 chars, keyword nos primeiros 40%
- [ ] description: 120-160 chars, keyword + CTA
- [ ] tags: 3-6 tags específicas (sem genéricas)
- [ ] category: valor válido
- [ ] affiliate: boolean
- [ ] image: URL/path presente
- [ ] H2s: keyword presente em pelo menos 50%
- [ ] H3s: FAQ usa ### (nem ** nem número)
- [ ] Links internos: >= 2, no corpo do texto
- [ ] Fontes: >= 2 com URLs completas
- [ ] Imagens: NENHUMA em Base64
- [ ] Word count: acima do mínimo da categoria
- [ ] Placeholders: NENHUM ([PRODUTO:1], [IMG:xxx])
- [ ] Slug: SEO-friendly, < 75 chars
```

### Prioridades de Correção (Roadmap)

| Prioridade | Ação | Artigos | Esforço |
|:----------:|------|---------|:-------:|
| 🔴 P0 | Corrigir placeholders [PRODUTO:1] visíveis | cadeiras-gamer | Baixo |
| 🔴 P0 | Remover imagens Base64, substituir por externas/locais | god-of-war-laufey | Médio |
| 🔴 P0 | Adicionar links internos (mín. 2) | battle-royale, cadeiras-gamer, xbox-summer-sale-bundles | Baixo |
| 🟠 P1 | Truncar descriptions > 160 chars | resident-evil-persona, battle-royale, cadeiras-gamer | Baixo |
| 🟠 P1 | Adicionar URLs nas fontes | desconto-gta-6, gta-6-performance, monitores-gamer, cadeiras-gamer | Baixo |
| 🟠 P1 | Converter FAQ para H3 | 5 artigos | Baixo |
| 🟡 P2 | Ajustar títulos fora do range 55-65 | gta-6-performance, fones-de-ouvido, cadeiras-gamer, switch-2-ps5 | Médio |
| 🟡 P2 | Corrigir categoria incorreta | mouse-gamer (noticia → guia) | Baixo |
| 🟡 P2 | Melhorar tags genéricas | Todos | Médio |
| 🟢 P3 | Adicionar word count mínimo | god-of-war-laufey, battle-royale | Alto (regeração) |
| 🟢 P3 | Substituir imagens externas frágeis | gta-6-performance, playstation-julho | Médio |

---

## 7. Análise por Artigo — Notas Individuais

| # | Artigo | Nota | Pontos Fortes | Pontos Fracos |
|---|--------|:----:|---------------|---------------|
| 1 | god-of-war-laufey | 5/10 | Boa keyword no título, FAQ com 4 perguntas | Base64 images, links internos só no final, sem H3 no FAQ |
| 2 | desconto-gta-6 | 7/10 | Links internos no corpo, boa description | Fontes sem URLs formais |
| 3 | placas-de-video-amd | 8/10 | Boa estrutura, links internos, fontes | H2s com nomes de produtos genéricos |
| 4 | gta-6-performance | 5/10 | Links internos no texto | Título curto, FAQ sem H3, imagens externas frágeis, fontes sem URLs |
| 5 | resident-evil-persona | 7/10 | Boa estrutura, H2s com keywords | Description longa (168), apenas 1 link interno |
| 6 | headset-gamer | 9/10 | Estrutura impecável, H3s, links internos, fontes | Description curta (131), sem produtos com afiliado |
| 7 | battle-royale | 3/10 | Boa tabela comparativa | ZERO links internos, description gigante (195), FAQ sem H3, imagens inline, word count baixo |
| 8 | xbox-summer-sale-5jogos | 8/10 | Boa estrutura, links internos, fontes | — |
| 9 | mouse-gamer | 8/10 | Links internos naturais, boa estrutura | Categoria "noticia" deveria ser "guia" ou "review" |
| 10 | playstation-julho | 8/10 | Boa estrutura, fontes formais | Imagens no final sem contexto |
| 11 | teclados-mecanicos | 9/10 | Estrutura perfeita, H3s, links, fontes | — |
| 12 | switch-2-ps5 | 7/10 | Boa conteúdo, links internos | Título longo (67), FAQ sem H3, slug longo |
| 13 | xbox-game-pass-julho | 8/10 | Boa estrutura, links internos, fontes | FAQ sem H3 |
| 14 | monitores-gamer | 9/10 | Estrutura perfeita, H3s, links internos | Fontes sem URLs formais |
| 15 | fones-de-ouvido | 9/10 | Estrutura completa, 5 FAQs, links internos | Título curto (53) |
| 16 | cadeiras-gamer | 4/10 | Boa quantidade de produtos | Placeholder [PRODUTO:1] visível, description gigante (278), ZERO links internos, ZERO fontes |
| 17 | xbox-summer-sale-bundles | 6/10 | Boas fontes | ZERO links internos |

---

## 8. Métricas Consolidadas

| Métrica | Valor |
|---------|-------|
| Total de artigos analisados | 17 |
| Nota média de SEO | 7.1/10 |
| Artigos nota >= 8 | 8 (47%) |
| Artigos nota <= 5 | 3 (18%) |
| Média de links internos/artigo | 1.9 |
| Artigos com 0 links internos | 3 (18%) |
| Artigos com description > 160 chars | 3 (18%) |
| Artigos com FAQ sem H3 | 5 (29%) |
| Artigos com fontes sem URLs | 4 (24%) |
| Artigos com imagens Base64 | 1 (6%) |
| Artigos com placeholders visíveis | 1 (6%) |

---

*Relatório gerado por Felipe Otimizador — Auditoria de SEO Fase 0*
*Data: 2026-08-04 | Blog Gamer | 17 artigos em src/content/artigos/*
