// Testes das funcoes puras do gerador de artigo: posicionamento de produtos,
// posicionamento de imagens, matching RAWG, gates de qualidade, portao de
// produtos sanitizados (Fase 1) e montagem segmentada (Fases 2/3).
// Rodar com: npm test
import assert from "assert";
import {
  injectProductCards, injectGameImages, extractImageMarkers, repositionImageMarkers,
  stripLeftoverMarkers, validate, checkTitle, capitalizeTitle, similarity, nameSimilarity,
  computeMaxTokens, buildProductButtonHtml, productButtonLabel, buildProductImageTag, injectHeadingAnchors, validateSourceCoverage,
  formatProductPriceForPrompt, findPricesInBody,
  sanitizeProducts, splitMainBody, parseBlurb, buildComparativoTable, buildItemSection, injectSegmentedItems,
  buildMetodologiaSection,
  extendDescription,
  buildOfferButtonsHtml,
} from "./gerar-artigo.mjs";
import { parsePriceBRL } from "./google_shopping.mjs";
import { normalizarProdutoRemoto } from "./monitor_api.mjs";
import { cleanProductTitle, detectCategory, productMatchesCategory, detectArticleCategory } from "./product_naming.mjs";
import { medianPrice, valueForMoneyScore, countEditorialMentions, scoreProduct, rankProducts, applyMinCriteria, RANKING_WEIGHTS, MIN_CRITERIA } from "./product_ranking.mjs";

let passou = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passou++;
}
function igual(a, b, msg) {
  assert.deepStrictEqual(a, b, msg);
  passou++;
}

const produtos = [
  { title: "Headset Gamer HyperX Cloud II", price: 349.9, thumbnail: "http://img/1.jpg", affiliate_link: "http://ml/1" },
  { title: "Mouse Logitech G Pro X", price: 89.9, thumbnail: "http://img/2.jpg", permalink: "http://ml/2" },
];

const corpo = `## Introducao

Texto de abertura sobre o tema com um fato concreto.

## Headset Gamer HyperX Cloud II lidera as vendas

Paragrafo falando do **Headset Gamer HyperX Cloud II** e do desempenho no PC.

[IMG:Headset Gamer HyperX Cloud II]

Mais um paragrafo sobre audio no headset, onde a qualidade sonora faz diferenca.

[PRODUTO:1]

## Mouses que ajudam na mira

Paragrafo sobre mouse e precisao.

[PRODUTO:2]

## Fontes
- [PSX](http://psx.com)`;

// --- marcadores de imagem ---
igual(extractImageMarkers(corpo), ["Headset Gamer HyperX Cloud II"], "extrai marcador IMG");

let out = injectGameImages(corpo, { "Headset Gamer HyperX Cloud II": "http://rawg/re.jpg" }, true);
ok(out.includes('<img src="http://rawg/re.jpg"'), "imagem injetada no marcador");
ok(!out.includes("[IMG:"), "marcador consumido");
ok(/desempenho no PC\.\n\n<img/.test(out), "imagem depois do paragrafo inteiro, sem cortar frase");

const semImg = injectGameImages(corpo, {}, true);
ok(!semImg.includes("[IMG:"), "marcador sem imagem no RAWG e removido");
ok(semImg.includes("Mais um paragrafo"), "texto ao redor preservado");

// --- produtos: botao no marcador e foto apos o heading do item ---
out = injectProductCards(out, produtos);
const posBtn1 = out.indexOf('href="http://ml/1"');
const posBtn2 = out.indexOf('href="http://ml/2"');
const posSecMira = out.indexOf("## Mouses que ajudam na mira");
const posImg1 = out.indexOf('<img src="http://img/1.jpg"');
ok(posBtn1 > 0 && posBtn2 > 0, "dois botoes injetados");
ok(posImg1 < out.indexOf("Paragrafo falando do **Headset"), "foto do item apos o heading da secao");
ok(posBtn1 < posSecMira, "botao 1 no trecho sobre audio");
ok(posBtn2 > posSecMira, "botao 2 no trecho sobre mira");
ok(!out.includes("[PRODUTO:"), "marcadores de produto consumidos");
ok(!out.includes("product-card") && !out.includes("product-price"), "sem card visual (item simples: foto + botao)");

// fallback: IA esqueceu os marcadores -> ninguem perde link de afiliado
const semMarcador = corpo.replace(/\[PRODUTO:\d\]\n\n/g, "");
const fb = injectProductCards(semMarcador, produtos);
ok(fb.includes('href="http://ml/1"') && fb.includes('href="http://ml/2"'), "fallback injeta os dois produtos");
ok(fb.indexOf('href="http://ml/1"') < fb.indexOf("## Headset Gamer HyperX Cloud II lidera"), "fallback posiciona antes do 2o heading");

// IA usou um marcador e omitiu o outro de proposito — sem fallback forcado
const parcial = corpo.replace("[PRODUTO:2]\n\n", "");
const injParcial = injectProductCards(parcial, produtos);
ok(injParcial.includes('href="http://ml/1"'), "produto com marcador injetado");
ok(!injParcial.includes('href="http://ml/2"'), "produto omitido pela IA nao e reinserido");

// --- item simples: botao + foto ---
igual(formatProductPriceForPrompt({ price: 349.9 }), "R$ 349.90", "preco formatado com R$");
igual(formatProductPriceForPrompt({}), "NAO DISPONIVEL", "sem preco nao emite R$ solto");
const btn = buildProductButtonHtml({ title: "Persona 5 Tactica", affiliate_link: "http://ml/x" });
ok(btn.includes("product-btn"), "gera botao de afiliado");
ok(btn.includes("http://ml/x"), "link de afiliado presente");
ok(!btn.includes("R$") && !btn.includes("product-card"), "botao simples nao carrega preco nem card");
ok(buildProductButtonHtml({ title: "X", permalink: "http://ml/y" }).includes("http://ml/y"), "usa permalink quando nao ha affiliate");
igual(buildProductButtonHtml({ title: "X" }), "", "sem link nao gera botao");

// botao com nome da loja (Serper): source -> VER NA KABUM / VER NO MERCADO LIVRE
igual(productButtonLabel({ source: "Kabum" }), "VER NA KABUM", "label loja feminina: na");
igual(productButtonLabel({ source: "Amazon" }), "VER NA AMAZON", "label loja feminina: na amazon");
igual(productButtonLabel({ source: "Pichau" }), "VER NA PICHAU", "label pichau: na");
igual(productButtonLabel({ source: "Mercado Livre" }), "VER NO MERCADO LIVRE", "label mercado livre especial");
igual(productButtonLabel({ source: "magazineluiza.com.br" }), "VER NA MAGAZINELUIZA", "label normaliza .com.br");
igual(productButtonLabel({ source: "AliExpress" }), "VER NO ALIEXPRESS", "label sem source no mapa usa no");
igual(productButtonLabel({ source: "KaBuM!" }), "VER NA KABUM", "label real serper: kabum! com pontuacao");
igual(productButtonLabel({ source: "Amazon.com.br - Retail" }), "VER NA AMAZON", "label real serper: sufixo - retail");
igual(productButtonLabel({ source: "Magazine Luiza" }), "VER NA MAGAZINELUIZA", "label real serper: espaco no nome");
igual(productButtonLabel({}), "VER NO MERCADO LIVRE", "label fallback sem source");
ok(buildProductButtonHtml({ title: "X", permalink: "http://k/k", source: "Kabum" }).includes("VER NA KABUM"), "botao usa label da loja");

igual(parsePriceBRL("R$ 1.299,90"), 1299.9, "parsePriceBRL com R$ e milhar");
igual(parsePriceBRL("R$ 249"), 249, "parsePriceBRL inteiro");
igual(parsePriceBRL("1.234,56"), 1234.56, "parsePriceBRL sem R$");
igual(parsePriceBRL(null), 0, "parsePriceBRL null -> 0");
igual(parsePriceBRL(""), 0, "parsePriceBRL vazio -> 0");
const imgTag = buildProductImageTag({ title: "Persona 5 Tactica", thumbnail: "http://img/9.jpg" });
ok(imgTag.includes('class="article-game-img"') && imgTag.includes("http://img/9.jpg"), "foto do item usa article-game-img + thumbnail");
igual(buildProductImageTag({ title: "X", thumbnail: "" }), "", "sem imagem nao gera tag");

// extendDescription: garante description entre 120 e 160 caracteres
const extCurta = extendDescription("Placa de video gamer.", "placas de video", "placa de video");
ok(extCurta.length >= 120 && extCurta.length <= 160, "description curta estendida para 120-160 (" + extCurta.length + ")");
ok(!extCurta.includes("*"), "description sem markdown apos extensao");
igual(extendDescription(null, "placas de video", null).length >= 120, true, "description vazia ganha base a partir do hint");
igual(extendDescription(extCurta, "x", "y"), extCurta, "description ja valida nao muda");


// nao duplica foto quando a secao do item ja comeca com <img>
const comImgJa = `## Headset Gamer HyperX Cloud II lidera

<img src="http://x/existente.jpg">

Texto do item.

[PRODUTO:1]`;
const semDupProduto = injectProductCards(comImgJa, produtos.slice(0, 1));
ok(semDupProduto.includes("http://x/existente.jpg") && !semDupProduto.includes("http://img/1.jpg"), "nao insere foto duplicada em item com imagem");

// marcador fora da secao de Itens: foto nao entra em secao excluida
const foraSecao = `## Fontes

Fonte tal.

[PRODUTO:1]`;
const injFora = injectProductCards(foraSecao, produtos.slice(0, 1));
ok(!injFora.includes("http://img/1.jpg"), "foto nao entra em secao excluida (Fontes)");
ok(injFora.includes('href="http://ml/1"'), "botao ainda injetado no marcador");

// --- capa nao duplicada no corpo ---
const capaUrl = "http://rawg/cover.jpg";
const corpoImg = `Paragrafo sobre **Resident Evil Requiem**.

[IMG:Resident Evil Requiem]

Outro paragrafo.`;
const semDup = injectGameImages(corpoImg, { "Resident Evil Requiem": capaUrl }, true, capaUrl);
ok(!semDup.includes("<img"), "imagem de capa omitida do corpo quando URL coincide");

const precosEncontrados = findPricesInBody("Custa R$ 299,90 e sai por R$ 154,38", [299.9, 154.38, 999]);
igual(precosEncontrados, ["299.90", "154.38"], "findPricesInBody casa valores da lista");

// --- fallback de imagem por negrito ---
const comLista = `## Passos

1. **Instalacao rapida** faz o download em background.
2. Outro passo qualquer aqui.

Paragrafo normal citando **Elden Ring** e sua dificuldade.`;
const fbImg = injectGameImages(comLista, { "Instalacao rapida": "http://x/1.jpg", "Elden Ring": "http://x/2.jpg" }, false);
ok(!fbImg.includes("http://x/1.jpg"), "nao injeta imagem dentro de item de lista");
ok(fbImg.includes("http://x/2.jpg"), "injeta no paragrafo normal");
ok(/\n\n<img/.test(fbImg), "imagem antes do paragrafo (IMG antes de TEXTO)");

// --- reposicionamento de marcador mal colocado ---
const torto = `## Gameplay de Resident Evil

Paragrafo falando so de Resident Evil e do modo cooperativo.

[IMG:Pokemon Pokopia]

## Outros lancamentos

O semestre trouxe Pokemon Pokopia e Subnautica 2 para o Switch.`;
const corrigido = repositionImageMarkers(torto);
ok(corrigido.indexOf("[IMG:Pokemon Pokopia]") < corrigido.indexOf("O semestre trouxe"), "marcador movido para antes do paragrafo que cita o jogo");

const certo = `Paragrafo sobre **Elden Ring** e sua dificuldade.

[IMG:Elden Ring]

Outro paragrafo qualquer.`;
igual(repositionImageMarkers(certo), certo, "marcador ja correto nao e movido");

const orfao = `Paragrafo sobre outra coisa totalmente diferente.

[IMG:Jogo Que Ninguem Citou]

Fim do texto.`;
ok(repositionImageMarkers(orfao).includes("[IMG:"), "marcador sem mencao no texto e mantido (busca via Tavily)");

// --- limpeza de sobras ---
const sobra = stripLeftoverMarkers("Texto.\n\n[PRODUTO:9]\n\n[IMG:Jogo Inexistente]\n\nFim.");
ok(!sobra.includes("[PRODUTO:") && !sobra.includes("[IMG:"), "marcadores orfaos removidos");
ok(!/\n{3,}/.test(sobra), "sem buracos de linha apos limpeza");

// --- matching RAWG ---
ok(similarity("Resident Evil Requiem", "Resident Evil Requiem") === 1, "match exato");
ok(similarity("Resident Evil", "Resident Evil Requiem") > 0.55, "match parcial valido");
ok(similarity("Persona 5", "Persona 5 Royal") > 0.55, "match de edicao");
ok(similarity("Instalacao rapida", "Rapid Racer") < 0.55, "falso positivo barrado");
ok(similarity("Gerenciamento de recursos", "Resource Manager") < 0.55, "conceito barrado");
ok(similarity("GTA", "Gta V") > 0.55, "sigla curta ainda casa");

// siglas usadas no texto vs nome completo devolvido pela RAWG
const T = 0.55;
ok(nameSimilarity("GTA VI", "Grand Theft Auto VI") >= T, "GTA VI casa com Grand Theft Auto VI");
ok(nameSimilarity("GTA V", "Grand Theft Auto V") >= T, "GTA V casa com Grand Theft Auto V");
ok(nameSimilarity("Grand Theft Auto VI", "GTA VI") >= T, "matching e simetrico");
ok(nameSimilarity("GTA VI", "Grand Theft Auto V") < 1, "numeracao diferente nao e match perfeito");
ok(nameSimilarity("Instalacao rapida", "Rapid Racer") < T, "sigla nao cria falso positivo");

// o termo que distingue o titulo tem que existir no candidato
ok(nameSimilarity("Resident Evil Requiem", "Resident Evil Village") < T, "titulos irmaos nao se confundem");
ok(nameSimilarity("Persona 5 Tactica", "Persona 5 Royal") < T, "edicoes diferentes nao se confundem");
ok(nameSimilarity("Resident Evil Requiem", "Resident Evil Requiem") >= T, "o titulo certo continua casando");
ok(nameSimilarity("Persona 5", "Persona 5 Royal") >= T, "consulta generica casa com edicao especifica");

// nome curto porem distintivo dentro do titulo oficial completo
ok(nameSimilarity("Silksong", "Hollow Knight: Silksong") >= T, "subtitulo distintivo casa com nome completo");
ok(nameSimilarity("Requiem", "Resident Evil Requiem") >= T, "subtitulo isolado casa");
ok(nameSimilarity("Ring", "Elden Ring") < T, "palavra curta demais nao basta para casar");

// --- gate de titulo ---
igual(checkTitle("Resident Evil Requiem: 5 Novidades do Update 1.31 no PS5", "resident evil"), [], "titulo bom passa");
ok(checkTitle("Resident Evil e Persona: tudo que voce precisa saber", "resident evil").some((p) => /generica/.test(p)), "pega frase generica");
ok(checkTitle("As 7 novidades do PS5 que chegaram com Resident Evil Requiem", "resident evil requiem").some((p) => /tarde demais/.test(p)), "pega palavra-chave tardia");
igual(checkTitle("PS5: as novidades do Resident Evil Requiem em 2026 e mais", "resident evil requiem"), [], "palavra-chave dentro dos 40% passa");
ok(checkTitle("Guia rapido", "").some((p) => /curto demais/.test(p)), "pega titulo curto");
ok(checkTitle("lancamento 2026: Resident Evil Requiem", "resident evil").some((p) => /minuscula/.test(p)), "pega titulo com inicial minuscula");
igual(capitalizeTitle("lancamento 2026: Resident Evil"), "Lancamento 2026: Resident Evil", "capitaliza so a primeira letra");
ok(checkTitle("Lancamento 2026: novidades que vao mexer no setup", "lancamento").some((p) => /generica/.test(p)), "pega novidades que vao <verbo>");

// --- validate ---
const fm = {
  title: "Headset Gamer HyperX Cloud II: Analise Completa do Audio em 2026",
  description: "x".repeat(130), pubDate: "2026-07-23", category: "guia",
  tags: ["a", "b", "c"], affiliate: true,
};
const corpoLongo = corpo + "\n\n" + "palavra ".repeat(900);
let r = validate(fm, corpoLongo, { category: "guia", productCount: 2, primaryKeyword: "headset gamer" });
igual(r.hard, [], "artigo bom: sem bloqueantes");
igual(r.soft, [], "artigo bom: sem alertas");

r = validate(fm, corpoLongo + "\nO headset custa R$ 349,90 no varejo.", {
  category: "guia", productCount: 2, productPrices: [349.9], primaryKeyword: "headset gamer",
});
ok(r.soft.some((e) => /preco de produto em prosa/.test(e)), "detecta preco de produto repetido no texto");

const semMarcadores = corpoLongo.replace(/\[PRODUTO:\d\]/g, "").replace(/\[IMG:[^\]]+\]/g, "");
r = validate(fm, semMarcadores, { category: "guia", productCount: 2, primaryKeyword: "headset gamer" });
ok(r.soft.some((e) => /PRODUTO/.test(e)), "gate de produto dispara sem marcador");
ok(r.soft.some((e) => /IMG/.test(e)), "gate de imagem dispara sem marcador");
igual(r.hard, [], "falta de marcador nao bloqueia publicacao, so forca regeracao");

// piso de palavras por categoria
r = validate(fm, corpo, { category: "guia", productCount: 0 });
ok(r.hard.some((e) => /muito curto/.test(e)), "guia curto bloqueia");
const corpoMedio = corpo + "\n\n" + "palavra ".repeat(650);
r = validate(fm, corpoMedio, { category: "guia", productCount: 0 });
ok(r.hard.some((e) => /muito curto/.test(e)), "abaixo do minimo bloqueia e forca regeracao");
r = validate(fm, corpoMedio, { category: "guia", productCount: 0, lastAttempt: true });
igual(r.hard, [], "ultima tentativa publica acima do piso absoluto");
ok(r.soft.some((e) => /abaixo do alvo/.test(e)), "mas registra o alerta");
r = validate(fm, corpo, { category: "guia", productCount: 0, lastAttempt: true });
ok(r.hard.some((e) => /muito curto/.test(e)), "piso absoluto bloqueia sempre");

// --- orcamento de tokens ---
// Garante que prompt + saida cabem no budget e que o teto de saida e respeitado.
const tokens = (t) => Math.ceil(t.length / 3.3);
for (const chars of [1000, 10000, 20000]) {
  const p = "x".repeat(chars);
  ok(tokens(p) + computeMaxTokens(p, "") <= 64000, `prompt de ${chars} chars cabe no budget`);
}
ok(computeMaxTokens("oi", "oi") <= 8192, "max_tokens respeita o teto de saida");
ok(computeMaxTokens("x".repeat(210000), "") < 0, "prompt absurdo resulta em orcamento negativo (falha explicita)");

// --- bloco simples do item (v1.2) ---
const btnVisual = buildProductButtonHtml({ title: "Headset Gamer HyperX Cloud II", affiliate_link: "http://ml/1" });
ok(btnVisual.includes("product-btn"), "botao do item presente");
ok(btnVisual.includes("VER NO MERCADO LIVRE"), "botao mantem CTA");
ok(!btnVisual.includes("product-card") && !btnVisual.includes("product-price"), "item simples nao usa card com preco");
const imgVisual = buildProductImageTag({ title: "Headset Gamer HyperX Cloud II", thumbnail: "http://img/1.jpg" });
ok(imgVisual.includes("article-game-img") && imgVisual.includes("http://img/1.jpg"), "foto do item com thumbnail");

// --- sumario/indice (v1.1) ---
const corpoComHeadings = `## Introducao

Texto introdutorio.

## God of War Ragnarok

Texto sobre o jogo.

## Gameplay e Mecanicas

Texto sobre gameplay.

## Conclusao

Texto final.

## Fontes

- [Site](http://site.com)`;
const comAncora = injectHeadingAnchors(corpoComHeadings);
ok(!comAncora.includes("## Índice"), "nao gera mais o bloco Indice duplicado");
ok(/^## /.test(comAncora) && !comAncora.startsWith("## Índice"), "markdown comeca direto pelo primeiro heading");
ok(comAncora.includes('<a id="god-of-war-ragnarok"></a>'), "insere ancora no heading");
ok(comAncora.indexOf('<a id="introducao"></a>') < comAncora.indexOf('<a id="god-of-war-ragnarok"></a>'), "ancoras unicas preservam a ordem");
ok(comAncora.indexOf('<a id="gameplay-e-mecanicas"></a>') < comAncora.indexOf("## Conclusao"), "secoes excluidas nao ganham ancora antes delas");
ok(!/<a id="[^"]+"><\/a>conclusao/i.test(comAncora), "Conclusao segue sem ancora");

// indice de ancora nao e gerado quando ha poucos headings
const corpoCurto = `## Unica Secao\n\nTexto.`;
igual(injectHeadingAnchors(corpoCurto), corpoCurto, "nao gera ancoras com menos de 3 headings");

// TAREFA 3: produtos (H3) tambem ganham ancora para entrar como sub-topicos do indice.
const corpoComH3 = `## Lista\n\n### Produto A\n\n### Produto B\n\n## Dicas\n\n## Conclusao\n\nfim`;
const comH3 = injectHeadingAnchors(corpoComH3);
ok(comH3.includes('## <a id="lista"></a>Lista'), "H2 topico recebe ancora");
ok(comH3.includes('### <a id="produto-a"></a>Produto A'), "produto H3 recebe ancora");
ok(comH3.includes('### <a id="produto-b"></a>Produto B'), "segundo produto H3 recebe ancora");
ok(!comH3.includes('<a id="conclusao"></a>'), "H3/H2 excluidos seguem sem ancora");

// --- validacao de cobertura de fontes (v1.1) ---
const fontes = [
  { title: "Review Tech", content: "O jogo chega em 19 de novembro de 2026. Nota 9/10.", url: "http://tech.com" },
];
const corpoComFontes = `## Introducao

O jogo chega em 19 de novembro de 2026.

## Nota

Recebeu nota 9/10.

## Fontes

- [Review Tech](http://tech.com)`;
let warnings = validateSourceCoverage(corpoComFontes, fontes);
ok(warnings.length === 0 || warnings.every((w) => !/Fontes ausente|suporte nas fontes/.test(w)), "dados suportados nao geram warnings criticos");

const corpoSemFontes = `## Introducao

O jogo chega em 2027 e tem nota 15/10.

## Outro topico

Mais texto.`;
warnings = validateSourceCoverage(corpoSemFontes, fontes);
ok(warnings.some((w) => /2027/.test(w)), "detecta ano nao suportado pelas fontes");
ok(warnings.some((w) => /15\/10/.test(w)), "detecta nota nao suportada pelas fontes");
ok(warnings.some((w) => /Secao ## Fontes ausente/.test(w)), "detecta secao Fontes ausente");

// --- Fase 1: portao sanitizeProducts ---
const topicProd = { hint: "placas de video amd 2026", ml_query: "placa de video gamer", trending_keywords: ["rx 580"] };
const candidatos = [
  { id: "MLB1", title: "Placa de Video RTX 4060 8GB", price: 1800, permalink: "https://www.mercadolivre.com.br/rtx/p/MLB12345678" },
  { id: "MLB2", title: "Os mais vendidos de 2024", price: 10, permalink: "https://www.mercadolivre.com.br/blog/mais-vendidos/placas-video" },
  { id: "MLB3", title: "Listagem de categoria", price: 5, permalink: "https://lista.mercadolivre.com.br/placas-video" },
  { id: "MLB4", title: "Placa de Video RX 580 8GB", price: 900, permalink: "https://www.mercadolivre.com.br/rx580/p/MLB87654321" },
  { id: "MLB5", title: "Variante de vendedor", price: 50, permalink: "https://www.mercadolivre.com.br/vende/MLB99999/up" },
  { id: "MLB6", title: "Sem preco", price: 0, permalink: "https://www.mercadolivre.com.br/np/p/MLB11111" },
  { id: "MLB1", title: "Duplicado", price: 1, permalink: "https://www.mercadolivre.com.br/dup/p/MLB12345678" },
  { id: "GB1", title: "Placa de Video RTX 5060 Kabum", price: 2500, permalink: "https://www.kabum.com.br/rtx5060", source: "Kabum" },
  { id: "", title: "Placa sem id mas com permalink", price: 3000, permalink: "https://www.amazon.com.br/rtx", source: "Amazon" },
];
const limpos = sanitizeProducts(candidatos, topicProd);
igual(limpos.map((p) => p.title), ["Placa de Vídeo Kabum RTX 5060", "Placa de Vídeo RTX 4060 8GB", "Placa de Vídeo RX 580 8GB"], "sanitize tira blog/lista/up, deduplica, ordena por score objetivo (marca + custo-beneficio), limpa o nome e filtra pela categoria do artigo");
ok(limpos[0].raw_title === "Placa de Video RTX 5060 Kabum", "sanitize preserva o titulo bruto em raw_title");
ok(Number.isFinite(limpos[0].score) && limpos[0].score > 0, "sanitize anexa score objetivo ao produto");
igual(sanitizeProducts([], topicProd), [], "sanitize lista vazia");
igual(sanitizeProducts(null, topicProd), [], "sanitize null");
igual(sanitizeProducts([{ title: "X", price: 1, permalink: "" }], topicProd), [], "sanitize rejeita produto sem id e sem permalink");

// --- Fase 2: splitMainBody ---
const corpoEx = "Fala! Bora ver as placas.\n\nCriterio: entrega por real.\n\n## Os 2 Melhores Placas de Video em 2026\n\n## Veredito\n\nVale.\n\n## FAQ\n\nP1";
const partes = splitMainBody(corpoEx);
igual(partes.listHeading, "Os 2 Melhores Placas de Video em 2026", "split: heading da lista");
ok(partes.intro.startsWith("Fala!") && !/^##/m.test(partes.intro), "split: intro sem H2");
ok(partes.rest.startsWith("## Veredito"), "split: resto comeca na primeira secao final");
igual(splitMainBody("## Veredito\n\nx"), null, "split rejeita heading final como 1a linha");
igual(splitMainBody("so texto"), null, "split rejeita texto sem heading");
igual(splitMainBody(null), null, "split rejeita null");

// --- Fase 2: parseBlurb ---
const blurbOk = parseBlurb("TAGLINE: melhor custo-beneficio\n\nCORPO:\nParagrafo um.\n\nParagrafo dois.\n\nNOTA: 8.5\nDESTAQUE: 60fps estaveis");
igual(blurbOk.tagline, "melhor custo-beneficio", "blurb: tagline extraida");
ok(blurbOk.text.includes("Paragrafo dois."), "blurb: corpo preserva os dois paragrafos");
igual(blurbOk.nota, 8.5, "blurb: nota decimal");
igual(blurbOk.destaque, "60fps estaveis", "blurb: destaque extraido");
igual(parseBlurb("CORPO:\ntexto sem nota").nota, null, "blurb sem nota");
igual(parseBlurb("texto avulso").text, "texto avulso", "blurb fora do formato cai no fallback");

// --- Fase 2: buildComparativoTable ---
const tab = buildComparativoTable([
  { title: "P1", price: 1234.5, nota: 8, destaque: "legal" },
  { title: "P2", price: 0, nota: null, destaque: "" },
]);
ok(tab.startsWith("## Comparativo"), "tabela tem heading");
ok(tab.includes("| P1 | R$ 1.234,50 | legal | 8/10 |"), "tabela: preco pt-BR e nota");
ok(tab.includes("| P2 | Ver no ML | — | — |"), "tabela: sem preco/nota usa placeholder");

// --- Fase 2: buildItemSection (montagem deterministica) ---
const sec = buildItemSection({ title: "Placa de Video RTX 4060", tagline: "60fps", blurbText: "Texto do item.", nota: 8, local_thumbnail: "/images/produtos/x.png", affiliate_link: "http://ml/x" });
ok(sec.startsWith("### Placa de Video RTX 4060 — 60fps"), "item: heading com tagline");
ok(sec.includes('src="/images/produtos/x.png"'), "item: foto local do produto");
ok(sec.includes("VER NO MERCADO LIVRE") && sec.includes("http://ml/x"), "item: botao aponta para o produto real");
ok(!sec.includes("R$"), "item: sem preco no texto");

// --- Fase 2: injectSegmentedItems ---
const prodsSeg = [
  { title: "Produto A", price: 10, blurbText: "texto A", nota: 8, destaque: "dA", local_thumbnail: "/x/a.png", affiliate_link: "http://ml/a" },
  { title: "Produto B", price: 20, blurbText: "texto B", nota: 7, destaque: "dB", local_thumbnail: "/x/b.png", affiliate_link: "http://ml/b" },
];
const injSeg = injectSegmentedItems("Intro.\n\n## Lista Principal\n\n## Veredito\n\nVale.", "Lista Principal", prodsSeg);
ok(injSeg.indexOf("## Lista Principal") < injSeg.indexOf("### Produto A"), "inject: itens apos o heading da lista");
ok(injSeg.indexOf("### Produto A") < injSeg.indexOf("### Produto B"), "inject: ordem dos itens preservada");
ok(injSeg.indexOf("### Produto B") < injSeg.indexOf("## Comparativo"), "inject: tabela depois dos itens");
ok(injSeg.indexOf("## Comparativo") < injSeg.indexOf("## Veredito"), "inject: veredito depois da tabela");

// --- Fase 3: validate endurecido (modo segmentado) ---
const fmSeg = { title: "Os 2 Melhores Produtos em 2026", description: "x".repeat(130), pubDate: "2026-08-03", tags: ["a", "b", "c", "d", "e"], category: "lista", affiliate: true };
r = validate(fmSeg, injSeg, { category: "lista", segmented: true, listHeading: "Lista Principal", products: prodsSeg, productCount: 2, relaxedWordCount: true, lastAttempt: true });
igual(r.hard, [], "segmentado: artigo montado passa sem bloqueantes");
const quebrado = validate(fmSeg, "Intro.\n\n## Lista Principal\n\n## Veredito\n\nVale.", { category: "lista", segmented: true, listHeading: "Lista Principal", products: prodsSeg, productCount: 2, relaxedWordCount: true, lastAttempt: true });
ok(quebrado.hard.some((e) => /secao propria/.test(e)), "segmentado: item sem heading bloqueia");
const secVazia = validate(fmSeg, "Intro.\n\n## Secao Vazia\n\n## Outra\n\ntexto.", { category: "lista", segmented: true, listHeading: "Lista Principal", products: prodsSeg, productCount: 2, relaxedWordCount: true, lastAttempt: true });
ok(secVazia.hard.some((e) => /vazia/.test(e)), "segmentado: secao ## vazia bloqueia");
const refCard = validate(fmSeg, "Intro.\n\n## X\n\nconfira o preco atual no card", { category: "lista", segmented: true, listHeading: "Lista Principal", products: prodsSeg, productCount: 2, relaxedWordCount: true, lastAttempt: true });
ok(refCard.hard.some((e) => /card/.test(e)), "segmentado: vocabulario antigo 'card' bloqueia");

// ---- Frente 4: botao duplo ----
const produtoDuasLojas = {
  offers: {
    mercadolivre: { affiliate_link: "https://meli.la/abc", permalink: "https://ml.com/x", price: 100 },
    shopee: { affiliate_link: "https://s.shopee.com.br/xyz", permalink: "https://shopee.com.br/y", price: 90 },
  },
};
const htmlDuplo = buildOfferButtonsHtml(produtoDuasLojas);
igual((htmlDuplo.match(/<a /g) || []).length, 2, "duas lojas geram dois botoes");
ok(htmlDuplo.includes("product-btns"), "duas lojas usam o wrapper");
ok(htmlDuplo.includes("product-btn--ml"), "botao do ML tem a classe certa");
ok(htmlDuplo.includes("product-btn--shopee"), "botao da Shopee tem a classe certa");
ok(htmlDuplo.includes('rel="nofollow sponsored"'), "link de afiliado marcado como sponsored");

const htmlUma = buildOfferButtonsHtml({
  offers: { shopee: { affiliate_link: "https://s.shopee.com.br/z", price: 50 } },
});
igual((htmlUma.match(/<a /g) || []).length, 1, "uma loja gera um botao");
ok(!htmlUma.includes("product-btns"), "uma loja nao usa wrapper");

igual(buildOfferButtonsHtml({}), "", "sem offers cai no caminho antigo");
igual(buildOfferButtonsHtml({ offers: { amazon: { affiliate_link: "x" } } }), "",
      "loja desconhecida e ignorada");

// ---- TAREFA 1: cleanProductTitle ----
igual(cleanProductTitle("Monitor Gamer AOC Agon 27 Pol 165Hz 1ms 2026"), "Monitor AOC 27 Pol 165Hz", "tira ano e 'gamer', remonta Monitor + Marca + specs da prioridade do plano");
igual(cleanProductTitle("Teclado Mecanico Gamer Redragon Kumara K552 Switch Blue"), "Teclado Redragon Kumara K552 Switch Blue", "Teclado + Marca + Modelo com codigo + specs");
igual(cleanProductTitle("Headset Gamer Bluetooth 2026"), "Headset Bluetooth", "remove ano do fim e o adjetivo gamer");
igual(cleanProductTitle("1pcsk1 Teclado Gamer Redragon Kumara K552"), "Teclado Redragon Kumara K552", "descarta token lixo no inicio");
igual(cleanProductTitle("Produto X | Enviado por Fulano"), "Produto X", "corta cauda de vendedor apos separador");
igual(cleanProductTitle("Teclado Gamer Redragon Kumara K552 Switch Blue - 12x de R$ 49,90"), "Teclado Redragon Kumara K552 Switch Blue", "remove preco e parcela do titulo");
igual(cleanProductTitle(""), "", "titulo vazio vira vazio");
igual(cleanProductTitle("   "), "", "so espacos vira vazio");
igual(cleanProductTitle(null), "", "null vira vazio");
igual(cleanProductTitle("Placa de Video RTX 4070 12GB"), "Placa de Vídeo RTX 4070 12GB", "serie de GPU reconhecida e vira modelo, acentos preservados");
igual(cleanProductTitle("123"), "123", "titulo que so sobra em lixo cai no fallback colapsado");
igual(cleanProductTitle("Teclado Redragon Kumara K552 Switch Blue | Loja Oficial 2026"), "Teclado Redragon Kumara K552 Switch Blue", "loja oficial e ano removidos");
igual(cleanProductTitle("Mouse Gamer Sem Fio 2026"), "Mouse Sem Fio", "sem fio vira spec e mouse mantem categoria");

// ---- TAREFA 5: categoria do produto vs categoria do artigo ----
igual(detectCategory("Teclado Gamer Redragon K552"), "teclado", "detecta teclado");
igual(detectCategory("Mouse Gamer Logitech G Pro"), "mouse", "detecta mouse");
igual(detectCategory("Placa de Video RTX 4060 8GB"), "placa_video", "detecta placa de video pelo include rtx");
igual(detectCategory("Kit Teclado e Mouse Gamer"), "teclado", "desempate de includes vai para a 1a categoria na tabela");
igual(detectCategory("Fone de Ouvido Bluetooth"), "headset", "fone de ouvido vira headset");
igual(detectCategory("Caixa de Papelao"), null, "sem categoria conhecida retorna null");
igual(detectCategory(""), null, "titulo vazio nao tem categoria");

ok(productMatchesCategory("Teclado Gamer Redragon K552", "teclado"), "teclado casa com teclado");
ok(!productMatchesCategory("Mouse Gamer", "teclado"), "mouse nao casa com teclado (exclude)");
ok(!productMatchesCategory("Suporte para Teclado", "teclado"), "acessorio suporte e descartado (ACCESSORY_NOISE)");
ok(!productMatchesCategory("Kit Teclado e Mouse", "teclado"), "kit teclado+mouse nao casa (exclude kit)");
ok(!productMatchesCategory("Teclado", "mouse"), "teclado nao casa com mouse (include nao bate)");
ok(!productMatchesCategory("X", "monitor"), "categoria inexistente no titulo retorna false");

igual(detectArticleCategory({ hint: "melhores mouses gamer 2026" }), "mouse", "categoria do artigo vem do hint");
igual(detectArticleCategory({ hint: "gta 6", ml_query: "monitor 144hz" }), "monitor", "ml_query entra na deteccao");
igual(detectArticleCategory({ hint: "novidades", ml_query: "placa de video", trending_keywords: ["rx 580", "rtx 4070"] }), "placa_video", "trending keywords entram na deteccao");
igual(detectArticleCategory({ hint: "noticias do dia" }), null, "sem palavra de categoria retorna null");
igual(detectArticleCategory(null), null, "topic null nao quebra");
igual(detectArticleCategory({}), null, "topic vazio nao quebra");

// Filtro dentro de sanitizeProducts: artigo de teclado descarta mouse/headset.
const topicTeclado = { hint: "melhores teclados gamer 2026", ml_query: "teclado gamer", trending_keywords: ["teclado"] };
const misto = [
  { id: "T1", title: "Teclado Redragon Kumara K552", price: 200, permalink: "https://www.mercadolivre.com.br/t/p/MLB1" },
  { id: "T2", title: "Teclado Logitech G Pro X", price: 700, permalink: "https://www.mercadolivre.com.br/t/p/MLB2" },
  { id: "T3", title: "Teclado Mecanico Razer", price: 400, permalink: "https://www.mercadolivre.com.br/t/p/MLB3" },
  { id: "M1", title: "Mouse Gamer Logitech G Pro", price: 500, permalink: "https://www.mercadolivre.com.br/m/p/MLB4" },
  { id: "H1", title: "Headset Gamer HyperX", price: 300, permalink: "https://www.mercadolivre.com.br/h/p/MLB5" },
];
const teclados = sanitizeProducts(misto, topicTeclado);
igual(teclados.length, 3, "filtro de categoria manteve so os teclados (>= MIN_PRODUCTS)");
ok(teclados.every((p) => productMatchesCategory(p.raw_title, "teclado")), "todos os itens restantes sao teclados");
ok(!teclados.some((p) => /mouse|headset/i.test(p.raw_title)), "mouse e headset descartados do artigo de teclado");
const soUm = sanitizeProducts(misto.slice(0, 1), topicTeclado);
igual(soUm.length, 1, "com menos de MIN_PRODUCTS mantem os que casam (lista curta e correta)");
ok(soUm.every((p) => productMatchesCategory(p.raw_title, "teclado")), "mesmo com lista curta, nada fora da categoria sobrevive");
const semCategoria = sanitizeProducts(misto, { hint: "novidades da semana" });
igual(semCategoria.length, 5, "sem categoria detectada o filtro nao roda e nada e descartado");

// ---- TAREFA 6: ranking objetivo dos "melhores" ----
igual(medianPrice([]), 0, "mediana de lista vazia e 0");
igual(medianPrice([{ price: 10 }, { price: 20 }]), 15, "mediana par e a media dos dois do meio");
igual(medianPrice([{ price: 10 }, { price: 20 }, { price: 30 }]), 20, "mediana impar");
igual(medianPrice([{ price: 0 }, { price: "abc" }]), 0, "precos invalidos nao entram na mediana");

igual(valueForMoneyScore(100, 100), 1, "preco na mediana pontua o maximo");
igual(valueForMoneyScore(80, 100), 1, "preco a 0,8x a mediana pontua o maximo");
igual(valueForMoneyScore(110, 100), 1, "preco a 1,1x a mediana pontua o maximo");
igual(valueForMoneyScore(20, 100), 0, "preco abaixo de 0,3x a mediana zera (proval falso/acessorio)");
igual(valueForMoneyScore(300, 100), 0, "preco acima de 2,5x a mediana zera");
igual(valueForMoneyScore(0, 100), 0, "sem preco zera");
igual(valueForMoneyScore(100, 0), 0, "sem mediana zera");

igual(countEditorialMentions({ title: "Teclado Redragon K552" }, ""), 0, "sem contexto editorial nao ha mencões");
igual(countEditorialMentions({ title: "Teclado Redragon K552" }, "Redragon e citado no ranking e em outra review Redragon"), 2, "marca citada 2x no consenso editorial");
igual(countEditorialMentions({ title: "Teclado X" }, "nenhuma marca"), 0, "marca desconhecida nao conta");

const pOK = { title: "Mouse Logitech G Pro", rating: 4.6, ratingCount: 1200, price: 300 };
const sc = scoreProduct(pOK, { products: [{ price: 100 }, { price: 300 }, { price: 500 }] });
ok(sc.score >= 0.65, "produto com rating, volume, marca e preco na faixa pontua alto");
ok(sc.breakdown.rating >= 0.9, "rating 4.6/5 normaliza acima de 0.9");
ok(sc.criteriosAtendidos.some((c) => c.includes("4,6")), "criterio nota media 4,6");
ok(sc.criteriosAtendidos.some((c) => /1,2k avaliacoes/.test(c)), "criterio volume 1,2k avaliacoes");
ok(sc.criteriosAtendidos.some((c) => c.includes("Logitech")), "criterio marca conhecida");

const pRuim = { title: "Teclado Sem Marca XYZ", rating: 2, price: 20 };
const sc2 = scoreProduct(pRuim, { products: [{ price: 100 }, { price: 300 }, { price: 500 }] });
ok(sc2.score < 0.3, "produto fraco pontua baixo");
igual(sc2.criteriosAtendidos.length, 0, "produto fraco nao atinge nenhum criterio");

igual(MIN_CRITERIA, 2, "requisito minimo e 2 criterios");
igual(RANKING_WEIGHTS.rating + RANKING_WEIGHTS.reviewVolume + RANKING_WEIGHTS.editorialMentions + RANKING_WEIGHTS.brandReputation + RANKING_WEIGHTS.valueForMoney, 1, "pesos somam 1");

const ranked = rankProducts([pRuim, pOK], { products: [{ price: 100 }, { price: 300 }, { price: 500 }] });
igual(ranked[0].title, "Mouse Logitech G Pro", "rankProducts coloca o melhor na frente");
ok(ranked.every((p) => Number.isFinite(p.score)), "todo produto rankeado tem score finito");

const a1 = applyMinCriteria([{ criteriosAtendidos: ["a", "b"] }, { criteriosAtendidos: ["a"] }, { criteriosAtendidos: [] }], {}, 1);
igual(a1.items.length, 1, "descarta quem nao atinge o minimo quando sobra lista cheia");
igual(a1.descartados, 2, "conta os descartados");
ok(!a1.fallback, "nao usou fallback quando sobra lista cheia");
const a2 = applyMinCriteria([{ criteriosAtendidos: ["a"] }], {}, 3);
igual(a2.items.length, 1, "com lista abaixo do minimo mantem o melhor restante");
ok(a2.fallback, "flag de fallback ligada quando a lista ficaria curta");

// Consenso editorial dentro do sanitize: marca citada vira criterio e sobe.
const ctxTeclado2 = { hint: "melhores teclados gamer 2026", ml_query: "teclado gamer", trending_keywords: ["teclado"] };
const comConsenso = sanitizeProducts([
  { id: "R1", title: "Teclado Redragon Kumara K552", price: 250, permalink: "https://www.mercadolivre.com.br/r/p/MLBR1" },
  { id: "L1", title: "Teclado Logitech G Pro X", price: 700, permalink: "https://www.mercadolivre.com.br/l/p/MLBL1" },
  { id: "Z1", title: "Teclado Razer BlackWidow V4", price: 900, permalink: "https://www.mercadolivre.com.br/z/p/MLBZ1" },
  { id: "P1", title: "Teclado Rapoo V500", price: 150, permalink: "https://www.mercadolivre.com.br/p/p/MLBP1" },
], ctxTeclado2, { rankingContext: "Redragon Logitech Razer aparecem em reviews de melhores teclados gamer" });
igual(comConsenso.length, 3, "com consenso editorial, marcas citadas sobem e quem nao tem criterio sai");
ok(!comConsenso.some((p) => /Rapoo/.test(p.title)), "produto sem nenhum criterio e descartado quando ha lista cheia");
ok(comConsenso[0].criteriosAtendidos.some((c) => /citado em 1 review/.test(c)), "mencão editorial vira criterio auditavel");
const semConsenso = sanitizeProducts([
  { id: "R1", title: "Teclado Redragon Kumara K552", price: 250, permalink: "https://www.mercadolivre.com.br/r/p/MLBR1" },
  { id: "L1", title: "Teclado Logitech G Pro X", price: 700, permalink: "https://www.mercadolivre.com.br/l/p/MLBL1" },
  { id: "Z1", title: "Teclado Razer BlackWidow V4", price: 900, permalink: "https://www.mercadolivre.com.br/z/p/MLBZ1" },
], ctxTeclado2);
igual(semConsenso.length, 3, "sem consenso, nada e descartado a ponto de deixar a lista curta");

// Metodologia + tabela auditavel.
const met = buildMetodologiaSection();
ok(met.startsWith("## Como Escolhemos"), "metodologia tem heading proprio");
ok(met.includes(`${MIN_CRITERIA} desses criterios`), "metodologia cita o requisito minimo");
const tab6 = buildComparativoTable([{ title: "P1", price: 100, nota: 8.5, destaque: "legal", criteriosAtendidos: ["marca A", "1,2k avaliacoes"] }]);
ok(tab6.includes("| Produto | Preco | Destaque | Nota | Por que entrou |"), "tabela ganhou a coluna Por que entrou");
ok(tab6.includes("| P1 | R$ 100,00 | legal | 8.5/10 | marca A · 1,2k avaliacoes |"), "tabela mostra nota objetiva e motivos");
const injMet = injectSegmentedItems("Intro.\n\n## Lista Principal\n\n## Veredito\n\nVale.", "Lista Principal", prodsSeg, true);
ok(injMet.indexOf("## Como Escolhemos") > -1, "metodologia injetada quando a flag esta ligada");
ok(injMet.indexOf("## Como Escolhemos") < injMet.indexOf("## Lista Principal"), "metodologia antes do heading da lista");
ok(injMet.indexOf("Intro.") < injMet.indexOf("## Como Escolhemos"), "metodologia apos a introducao");

// ---- Frente 4: cliente remoto ----
const bruto = {
  id: "MLB1", title: "Headset Gamer", price: 181, thumbnail: "http://img/x.jpg",
  offers: { mercadolivre: { affiliate_link: "https://meli.la/a", permalink: "http://ml/x", price: 181 } },
};
const norm = normalizarProdutoRemoto(bruto);
ok(norm !== null, "produto valido e aceito");
igual(norm.sources.length, 1, "sources vem de offers");
igual(normalizarProdutoRemoto({ title: "" }), null, "produto sem titulo e descartado");
igual(normalizarProdutoRemoto({ title: "X", offers: {} }), null, "produto sem oferta e descartado");

console.log(`${passou} asserts OK`);
