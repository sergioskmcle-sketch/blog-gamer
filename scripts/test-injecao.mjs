// Testes das funcoes puras do gerador de artigo: posicionamento de produtos,
// posicionamento de imagens, matching RAWG, gates de qualidade, portao de
// produtos sanitizados (Fase 1) e montagem segmentada (Fases 2/3).
// Rodar com: npm test
import assert from "assert";
import fs from "fs";
import path from "path";
import {
  injectProductCards, injectGameImages, extractImageMarkers, repositionImageMarkers,
  stripLeftoverMarkers, validate, checkTitle, capitalizeTitle, similarity, nameSimilarity,
  computeMaxTokens, buildProductButtonHtml, productButtonLabel, buildProductImageTag, injectHeadingAnchors, validateSourceCoverage,
  formatProductPriceForPrompt, findPricesInBody, stripPricesFromBody, keywordTokensMatch, parseFrontmatter,
  sanitizeProducts, splitMainBody, buildListHeading, LISTA_MARKER, temFocoMisto, dominiosNoTexto, parseBlurb, buildComparativoTable, buildItemSection, injectSegmentedItems,
  buildMetodologiaSection,
  extendDescription,
  buildOfferButtonsHtml,
  sanitizeProductQuery,
  normalizarAnosBody,
  shouldAbortProductSourcing,
  resolverAfiliados,
  DEFAULT_COVER_BY_PRODUCT_CATEGORY,
  DEFAULT_COVER_GENERIC,
  corrigirPeloGate,
  montarMarkdown,
  removeEmptySections,
  ajustarDescription,
  ajustarTags,
  progressiveGameQueries,
  isFragileImageUrl,
  ensureListStructure,
  buildGamesListHeading,
  extractListItemTitles,
  extractSubsectionItemNames,
  tituloSemelhante,
  montarQueryPesquisa,
  classifyDomain,
} from "./gerar-artigo.mjs";
import { normalizarAnosPreposicional } from "./tempo.mjs";
import { parsePriceBRL } from "./google_shopping.mjs";
import { normalizarProdutoRemoto } from "./monitor_api.mjs";
import { extractMLProductData } from "./ml_affiliate.mjs";
import { cleanProductTitle, detectCategory, detectBrand, detectModel, productMatchesCategory, detectArticleCategory } from "./product_naming.mjs";
import { medianPrice, valueForMoneyScore, countEditorialMentions, scoreProduct, rankProducts, applyMinCriteria, eligibilityCheck, RANKING_WEIGHTS, MIN_CRITERIA } from "./product_ranking.mjs";
import { upgradeImageUrl, imageDimensions, isImageUsable, MIN_IMAGE_SIZE } from "./product_images.mjs";

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
igual(
  repositionImageMarkers(certo),
  `[IMG:Elden Ring]\n\nParagrafo sobre **Elden Ring** e sua dificuldade.\n\nOutro paragrafo qualquer.`,
  "marcador sem titulo vai para antes do paragrafo que cita o jogo (imagem acima do texto)"
);

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

// --- queda progressiva do nome para o RAWG ---
{
  const z = progressiveGameQueries("The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição");
  ok(z[0] === "The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição", "primeira variante e o nome completo");
  ok(z.includes("The Legend of Zelda: Ocarina of Time"), "corta o subtitulo marketing apos a travesao");
  ok(z.includes("The Legend of Zelda"), "corta o sufixo Remake");
  ok(z.some((v) => v.includes("Ocarina of Time")), "usa o subtitulo isolado");
}

{
  const g = progressiveGameQueries("Grounded 2 — Sobrevivência em Miniatura");
  ok(g.includes("Grounded 2"), "mantem o nome curto do jogo");
  ok(g.includes("Grounded"), "cai para o nome base");
}

{
  const w = progressiveGameQueries("The Witcher 3: Songs of the Past — A Última Aventura de Geralt");
  ok(w.includes("The Witcher 3"), "chega ao nucleo da franquia");
  ok(w.includes("The Witcher 3: Songs of the Past"), "mantem o subtitulo oficial");
}

{
  const x = progressiveGameQueries("Gears of War: E-Day");
  ok(x.includes("Gears of War"), "chega a franquia quando a edicao nao existe");
  ok(!x.includes("Gears of War: E"), "traco interno sem espaco nao corta o nome");
}

{
  const f = progressiveGameQueries("Final Fantasy 7: Revelation — Um Novo Capítulo na Saga");
  ok(f.includes("Final Fantasy 7"), "chega ao nucleo da franquia");
}

ok(progressiveGameQueries("").length === 0, "nome vazio nao gera variante");
ok(progressiveGameQueries("The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição").length ===
   [...new Set(progressiveGameQueries("The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição"))].length, "variantes sem duplicata");

// --- filtro de URLs frágeis para o fallback Tavily ---
ok(isFragileImageUrl("https://upload.wikimedia.org/wikipedia/en/5/57/capa.jpg"), "wikimedia barrado");
ok(isFragileImageUrl("https://instagram.com/p/abc"), "instagram barrado");
ok(isFragileImageUrl("https://www.facebook.com/photo.php?x=1"), "facebook barrado");
ok(isFragileImageUrl("https://external-preview.redd.it/x.jpg"), "reddit externo barrado");
ok(isFragileImageUrl("data:image/png;base64,AAAA"), "data URI barrado");
ok(!isFragileImageUrl("https://i.ytimg.com/vi/abc/maxresdefault.jpg"), "youtube thumb liberado");
ok(!isFragileImageUrl("https://media.rawg.io/media/games/abc.jpg"), "rawg liberado");
ok(!isFragileImageUrl("https://www.nintendo.com/eu/media/images/capa.jpg"), "site oficial liberado");
ok(!isFragileImageUrl("https://shared.akamai.steamstatic.com/store_item_assets/x.jpg"), "steam cdn liberado");


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
const corpoLongo = corpo + "\n\n" + "palavra ".repeat(1000);
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

// --- Gate: lista plural ("Melhores"/"Os N Melhores") exige 2+ produtos ---
const fmMelhores = { title: "Os Melhores Headsets Gamer em 2026", description: "x".repeat(140), pubDate: "2026-08-12", tags: ["a", "b", "c"], category: "lista", affiliate: true };
const corpoComHeadingLista = corpoLongo.replace(/^## Introducao/m, "## Os 5 Melhores Headsets Gamer em 2026\n\ntexto\n");
r = validate(fmMelhores, corpoComHeadingLista, { category: "lista", productCount: 1, lastAttempt: true });
ok(r.hard.some((e) => /promete lista plural/.test(e)), "lista plural com 1 produto bloqueia (heading)");
r = validate(fmMelhores, corpoLongo, { category: "lista", productCount: 1, lastAttempt: true });
ok(r.hard.some((e) => /promete lista plural/.test(e)), "lista plural com 1 produto bloqueia (titulo)");
r = validate(fmMelhores, corpoComHeadingLista, { category: "lista", productCount: 3, lastAttempt: true });
igual(r.hard, [], "lista plural com 3 produtos nao bloqueia");
const fmMelhores1 = { title: "Melhores Smart TVs Gamer em 2026", description: "x".repeat(140), pubDate: "2026-08-12", tags: ["a", "b", "c"], category: "noticia", affiliate: true };
r = validate(fmMelhores1, corpoLongo, { category: "noticia", productCount: 1, lastAttempt: true });
ok(r.hard.some((e) => /promete lista plural/.test(e)), "noticia 'Melhores' com 1 produto bloqueia (caso smart tv)");
r = validate(fmMelhores1, corpoLongo, { category: "noticia", productCount: 0, lastAttempt: true });
ok(r.soft.some((e) => /Melhores.*sem produtos/.test(e)), "noticia 'Melhores' sem produtos vira alerta soft");

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

const corpoComTabela = `## Introducao

O teclado A e o mais recomendado para competitivo.

## Comparativo

| Produto | Preco |
|---|---|
| Teclado A | R$ 299,00 |
| Teclado B | R$ 348,00 |

## Fontes

- [Review Tech](http://tech.com)`;
warnings = validateSourceCoverage(corpoComTabela, fontes);
ok(!warnings.some((w) => /Precos em prosa/.test(w)), "precos dentro da tabela comparativa nao geram warning de preco em prosa");

const corpoComPrecoProsa = `## Introducao

Este teclado custa R$ 299,00 e entrega 8 KHz.

## Fontes

- [Review Tech](http://tech.com)`;
warnings = validateSourceCoverage(corpoComPrecoProsa, fontes);
ok(warnings.some((w) => /Precos em prosa/.test(w)), "preco em prosa fora da tabela gera warning");

const corpoComLinksInternos = `## Introducao

O teclado chegou ao Brasil em 2026.

## Fontes

- [Review Tech](http://tech.com)

## Continue Explorando

- [Melhores teclados de 2025](/blog/teclados-de-2025/)
- [Mouse gamer de 2024](/blog/mouse-2024/)`;
warnings = validateSourceCoverage(corpoComLinksInternos, fontes);
ok(!warnings.some((w) => /Anos mencionados/.test(w)), "anos em links internos do rodape nao geram warning");

const corpoAnoLancamento = `## Introducao

O jogo foi lancado em 2021 e segue vivo no PC.

## Fontes

- [Review Tech](http://tech.com)`;
warnings = validateSourceCoverage(corpoAnoLancamento, fontes);
ok(!warnings.some((w) => /Anos mencionados/.test(w)), "ano de lancamento antigo (2021) nao gera warning de claim");

// --- Fase 1: portao sanitizeProducts ---
const topicProd = { hint: "placas de video amd 2026", ml_query: "placa de video gamer", trending_keywords: ["rx 580"] };
const candidatos = [
  { id: "MLB1", title: "Placa de Video RTX 4060 8GB", price: 1800, rating: 4.7, ratingCount: 120, permalink: "https://www.mercadolivre.com.br/rtx/p/MLB12345678" },
  { id: "MLB2", title: "Os mais vendidos de 2024", price: 10, permalink: "https://www.mercadolivre.com.br/blog/mais-vendidos/placas-video" },
  { id: "MLB3", title: "Listagem de categoria", price: 5, permalink: "https://lista.mercadolivre.com.br/placas-video" },
  { id: "MLB4", title: "Placa de Video RX 580 8GB", price: 900, rating: 4.5, ratingCount: 80, permalink: "https://www.mercadolivre.com.br/rx580/p/MLB87654321" },
  { id: "MLB5", title: "Variante de vendedor", price: 50, permalink: "https://www.mercadolivre.com.br/vende/MLB99999/up" },
  { id: "MLB6", title: "Sem preco", price: 0, permalink: "https://www.mercadolivre.com.br/np/p/MLB11111" },
  { id: "MLB1", title: "Duplicado", price: 1, permalink: "https://www.mercadolivre.com.br/dup/p/MLB12345678" },
  { id: "GB1", title: "Placa de Video RTX 5060 Kabum", price: 2500, rating: 4.8, ratingCount: 200, permalink: "https://www.kabum.com.br/rtx5060", source: "Kabum" },
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

// --- Fase 2: marcador [LISTA] (montagem a prova de IA) ---
const comMarcador = splitMainBody("Fala! Bora ver as placas.\n\n[LISTA]\n\n## Veredito\n\nVale.");
igual(comMarcador.listHeading, null, "marcador: heading NAO vem da LLM (null = gerado em codigo)");
ok(comMarcador.intro.startsWith("Fala!") && !/[LISTA]/.test(comMarcador.intro), "marcador: intro sem marcador");
ok(comMarcador.rest.startsWith("## Veredito"), "marcador: resto comeca apos a linha [LISTA]");
igual(splitMainBody("[LISTA]\n\n## Veredito").intro, "", "marcador: intro vazia e aceita");
igual(splitMainBody("## Veredito antes do marcador\n\n[LISTA]"), null, "marcador: H2 antes de [LISTA] e estrutura invalida");

// --- Fase 2: buildListHeading (heading deterministico em codigo) ---
igual(buildListHeading([{ title: "A" }, { title: "B" }], "headset gamer som espacial"), "Os 2 Melhores Headset Gamer Som Espacial em 2026", "heading: keyword vira titulo da secao");
igual(buildListHeading([{ title: "A" }], "", {}), "Os 1 Melhores Itens em 2026", "heading: sem keyword usa 'Itens'");
ok(buildListHeading([{ title: "A" }, { title: "B" }], "melhores teclados gamer em 2024").endsWith("2026"), "heading: ano normalizado para o ano corrente");

// --- Fase 2: foco misto (falso positivo nao conta como misto) ---
ok(!temFocoMisto("Teclado Redragon com switches brown. Mouse gamer leve. Monitor 165Hz."), "foco: artigo de hardware nao e misto");
ok(!temFocoMisto("Teclado gamer ideal para Valorant e Counter-Strike 2."), "foco: mencao de jogo como contexto NAO e misto");
ok(!temFocoMisto("Headset com som espacial para partidas de CS2."), "foco: citacao unica de jogo nao e misto");
// Consoles sao plataforma/produto de hardware ("Consoles vs Placas de Video" e
// um comparativo de HARDWARE, nao um artigo de games). Misto exige um titulo de
// jogo real com peso equivalente ao hardware no corpo.
ok(!temFocoMisto("Consoles vs Placas de Video: o PS5 e a RTX 4060 disputam. Xbox e GeForce."), "foco: comparativo de hardware (consoles vs placa) NAO e misto");
ok(temFocoMisto("O GTA 6 e o GTA 5 no PS5 com a RTX 4060. Valorant e Cyberpunk no GeForce. Mouse gamer e teclado Redragon."), "foco: titulos de jogo reais + hardware com pesos equivalentes e misto");
ok(temFocoMisto("O GTA 6 no PS5. Headset gamer. Mouse gamer. Valorant. Teclado gamer. Monitor gamer."), "foco: pesos equivalentes dos dois dominios");
ok(dominiosNoTexto("").games === 0 && dominiosNoTexto("").hardware === 0, "foco: texto vazio zerado");

// --- Fase 2: dominio volante/plataforma (console como plataforma, nao assunto) ---
igual(classifyDomain("volante gamer ps5"), "hardware", "dominio: volante para PS5 e hardware (console e plataforma)");
igual(classifyDomain("melhores volantes de corrida para xbox"), "hardware", "dominio: volante para Xbox e hardware");
igual(classifyDomain("gta 6 no ps5 e headset gamer"), "mixed", "dominio: titulo de jogo + hardware e misto");
igual(classifyDomain("volante gamer"), "hardware", "dominio: volante sozinho e hardware");
igual(classifyDomain("fortnite e valorant no pc"), "games", "dominio: jogos seguem games");
igual(classifyDomain("novidades do ps5 e game pass"), "games", "dominio: console sem hardware e games");
ok(!temFocoMisto("Volante gamer para PS5 e PC. Moza R12 para simuladores de corrida."), "foco: volante citando plataformas NAO e misto");
igual(extractSubsectionItemNames("## Itens\n\n### Moza R12 Direct Drive V1 — A Forca\n\n### Thrustmaster T128\n\n## Comparativo\n\n### Pergunta do FAQ").join(","), "Moza R12 Direct Drive V1,Thrustmaster T128", "subsecoes: extrai itens ### e para no Comparativo");

// --- Fase 2: parseBlurb ---
const blurbOk = parseBlurb("TAGLINE: melhor custo-beneficio\n\nCORPO:\nParagrafo um.\n\nParagrafo dois.\n\nNOTA: 4.5\nDESTAQUE: 60fps estaveis");
igual(blurbOk.tagline, "melhor custo-beneficio", "blurb: tagline extraida");
ok(blurbOk.text.includes("Paragrafo dois."), "blurb: corpo preserva os dois paragrafos");
igual(blurbOk.nota, 4.5, "blurb: nota decimal (escala 0-5)");
igual(blurbOk.destaque, "60fps estaveis", "blurb: destaque extraido");
igual(parseBlurb("CORPO:\ntexto sem nota").nota, null, "blurb sem nota");
igual(parseBlurb("texto avulso").text, "texto avulso", "blurb fora do formato cai no fallback");
igual(parseBlurb("NOTA: 8.5\nCORPO:\nx").nota, null, "blurb: nota fora da escala 0-5 vira null");

// --- Fase 2: buildComparativoTable ---
const tab = buildComparativoTable([
  { title: "P1", price: 1234.5, rating: 4.8, ratingCount: 120, destaque: "legal" },
  { title: "P2", price: 0, rating: null, ratingCount: null, destaque: "" },
]);
ok(tab.startsWith("## Comparativo"), "tabela tem heading");
ok(tab.includes("| P1 | R$ 1.234,50 | legal | 4,8/5 | 120 |"), "tabela: preco pt-BR e nota 0-5");
ok(tab.includes("| P2 | Ver no ML | — | — | — |"), "tabela: sem preco/nota usa placeholder");
ok(!/\/10/.test(tab), "tabela: nunca escala 0-10");

// --- Fase 2: buildItemSection (montagem deterministica) ---
const sec = buildItemSection({ title: "Placa de Video RTX 4060", tagline: "60fps", blurbText: "Texto do item.", rating: 4.5, local_thumbnail: "/images/produtos/_placeholder.webp", affiliate_link: "http://ml/x" });
ok(sec.startsWith("### Placa de Video RTX 4060 — 60fps"), "item: heading com tagline");
ok(sec.includes('src="/images/produtos/_placeholder.webp"'), "item: foto local do produto (arquivo existente)");
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

// --- Fase 3: pipeline segmentado ponta a ponta (mesmo caminho do main()) ---
{
  const corpo = "Fala! Bora ver os produtos.\n\nCriterio: entrega por real.\n\n[LISTA]\n\n## Veredito\n\nVale.\n\n## FAQ\n\nP1";
  const p = splitMainBody(corpo);
  p.listHeading = buildListHeading(prodsSeg, "produtos gamer", {});
  const body = [p.intro, `## ${p.listHeading}`, p.rest].filter(Boolean).join("\n\n");
  const final = injectSegmentedItems(body, p.listHeading, prodsSeg, true);
  ok(final.includes(`## ${p.listHeading}`), "e2e: heading deterministico presente no corpo");
  ok(final.indexOf("### Produto A") > final.indexOf(`## ${p.listHeading}`), "e2e: itens apos o heading da lista");
  ok(final.indexOf("## Veredito") > final.indexOf("## Comparativo"), "e2e: veredito depois da tabela");
  ok(!final.includes("[LISTA]"), "e2e: marcador [LISTA] consumido na montagem");
  const rv = validate(fmSeg, final, { category: "lista", segmented: true, listHeading: p.listHeading, products: prodsSeg, productCount: 2, relaxedWordCount: true, lastAttempt: true });
  igual(rv.hard, [], "e2e: artigo montado passa sem bloqueantes");
}

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

// Categoria tv (smart TV) reconhecida: impediria o artigo de smart TV de buscar
// console como produto (caso real do artigo reprovado em 12/08/2026).
igual(detectCategory("Smart TV 4K 55 Polegadas"), "tv", "smart tv detectada como tv");
igual(detectCategory("SmartTV 50 Samsung"), "tv", "smartv (sem espaco) detectada");
igual(detectCategory("Televisao OLED 65 LG"), "tv", "televisao detectada");
igual(detectCategory("TV 4K QLED Gamer"), "tv", "tv com spec de imagem detectada");
igual(detectCategory("Suporte de TV para Parede"), null, "suporte de tv nao e produto tv (exclude)");
igual(detectCategory("TV Box Android"), null, "tv box nao e smart tv (exclude)");
ok(productMatchesCategory("Smart TV 4K 55 Polegadas", "tv"), "smart tv casa com categoria tv");
ok(!productMatchesCategory("Console Sony Fable Standard", "tv"), "console NAO casa com categoria tv (caso do artigo reprovado)");
ok(!productMatchesCategory("Suporte de TV para Parede", "tv"), "suporte de tv descartado");
igual(detectArticleCategory({ hint: "melhores smart tvs 4k para gamers" }), "tv", "categoria do artigo smart tv detectada");

// Filtro dentro de sanitizeProducts: artigo de teclado descarta mouse/headset.
const topicTeclado = { hint: "melhores teclados gamer 2026", ml_query: "teclado gamer", trending_keywords: ["teclado"] };
const misto = [
  { id: "T1", title: "Teclado Redragon Kumara K552", price: 200, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/t/p/MLB1" },
  { id: "T2", title: "Teclado Logitech G Pro X", price: 700, rating: 4.7, ratingCount: 300, permalink: "https://www.mercadolivre.com.br/t/p/MLB2" },
  { id: "T3", title: "Teclado Mecanico Razer", price: 400, rating: 4.3, ratingCount: 90, permalink: "https://www.mercadolivre.com.br/t/p/MLB3" },
  { id: "M1", title: "Mouse Gamer Logitech G Pro", price: 500, rating: 4.6, ratingCount: 200, permalink: "https://www.mercadolivre.com.br/m/p/MLB4" },
  { id: "H1", title: "Headset Gamer HyperX", price: 300, rating: 4.4, ratingCount: 150, permalink: "https://www.mercadolivre.com.br/h/p/MLB5" },
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
igual(countEditorialMentions({ title: "Teclado Redragon K552" }, "Redragon e citado no ranking e em outra review Redragon"), 1, "marca citada 2x mas sem o modelo (K552) pesa metade (2 * 0.5)");
igual(countEditorialMentions({ title: "Teclado Redragon K552" }, "O Redragon K552 e citado no ranking e em outra review do K552"), 6, "marca+modelo juntos pesam 3x por mencao (2 ocorrencias de K552)");
igual(countEditorialMentions({ title: "Teclado X" }, "nenhuma marca"), 0, "marca desconhecida nao conta");

const pOK = { title: "Mouse Logitech G Pro", rating: 4.6, ratingCount: 1200, price: 300 };
const sc = scoreProduct(pOK, { products: [{ price: 100 }, { price: 300 }, { price: 500 }] });
ok(sc.score >= 0.55, "produto com rating, volume, marca e preco na faixa pontua alto");
ok(sc.breakdown.rating >= 0.9, "rating 4.6/5 normaliza acima de 0.9");
ok(sc.criteriosAtendidos.some((c) => c.includes("4,6")), "criterio nota media 4,6");
ok(sc.criteriosAtendidos.some((c) => /1,2k avaliacoes/.test(c)), "criterio volume 1,2k avaliacoes");
ok(sc.criteriosAtendidos.some((c) => c.includes("Logitech")), "criterio marca conhecida");

const pRuim = { title: "Teclado Sem Marca XYZ", rating: 2, price: 20 };
const sc2 = scoreProduct(pRuim, { products: [{ price: 100 }, { price: 300 }, { price: 500 }] });
ok(sc2.score < 0.3, "produto fraco pontua baixo");
igual(sc2.criteriosAtendidos.length, 0, "produto fraco nao atinge nenhum criterio");

igual(MIN_CRITERIA, 2, "requisito minimo e 2 criterios");
igual(
  Math.round(Object.values(RANKING_WEIGHTS).reduce((s, w) => s + w, 0) * 100) / 100,
  1,
  "pesos somam 1"
);

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
  { id: "R1", title: "Teclado Redragon Kumara K552", price: 250, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/r/p/MLBR1" },
  { id: "L1", title: "Teclado Logitech G Pro X", price: 700, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/l/p/MLBL1" },
  { id: "Z1", title: "Teclado Razer BlackWidow V4", price: 900, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/z/p/MLBZ1" },
  { id: "P1", title: "Teclado Rapoo V500", price: 150, permalink: "https://www.mercadolivre.com.br/p/p/MLBP1" },
], ctxTeclado2, { rankingContext: "Redragon Logitech Razer aparecem em reviews de melhores teclados gamer" });
igual(comConsenso.length, 3, "com consenso editorial, marcas citadas sobem e quem nao tem criterio (nota/reviews/preco) sai");
ok(!comConsenso.some((p) => /Rapoo/.test(p.title)), "produto sem nota/avaliacoes e fora do piso de preco e descartado");
ok(comConsenso.every((p) => p.criteriosAtendidos.some((c) => /citado em 1 review/.test(c))), "mencão editorial vira criterio auditavel em todos");
const semConsenso = sanitizeProducts([
  { id: "R1", title: "Teclado Redragon Kumara K552", price: 250, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/r/p/MLBR1" },
  { id: "L1", title: "Teclado Logitech G Pro X", price: 700, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/l/p/MLBL1" },
  { id: "Z1", title: "Teclado Razer BlackWidow V4", price: 900, rating: 4.5, ratingCount: 60, permalink: "https://www.mercadolivre.com.br/z/p/MLBZ1" },
], ctxTeclado2);
igual(semConsenso.length, 3, "sem consenso, nada e descartado a ponto de deixar a lista curta");

// Metodologia + tabela auditavel.
const met = buildMetodologiaSection();
ok(met.startsWith("## Como Escolhemos"), "metodologia tem heading proprio");
ok(met.includes("piso de elegibilidade") || met.includes("piso minimo"), "metodologia cita o piso de elegibilidade");
const tab6 = buildComparativoTable([{ title: "P1", price: 100, rating: 4.8, ratingCount: 1234, destaque: "legal", criteriosAtendidos: ["marca A", "1,2k avaliacoes"] }]);
ok(tab6.includes("| Produto | Preco | Destaque | Nota | Avaliacoes | Por que entrou |"), "tabela ganhou a coluna Por que entrou e Avaliacoes");
ok(tab6.includes("| P1 | R$ 100,00 | legal | 4,8/5 | 1234 | marca A · 1,2k avaliacoes |"), "tabela mostra nota do consumidor (0-5) e motivos");
ok(!tab6.includes("/10"), "tabela nunca usa escala 0-10");
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

// Piso de elegibilidade: Frente 4 nao fornece rating/ratingCount (catalogo so
// guarda titulo/preco/afiliado), entao o piso de avaliacoes so vale quando o
// produto CHEGA com nota/volume. Identidade e preco continuam obrigatorios.
const remotoOk = eligibilityCheck(
  { title: "Teclado Redragon Kumara K552", price: 250, origem: "remoto" },
  { median: 260 },
);
ok(remotoOk.elegivel, "produto remoto sem rating passa com marca/modelo e preco na faixa");
ok(remotoOk.motivos.length === 0, "nenhum motivo de reprova para remoto valido");
ok(!eligibilityCheck({ title: "Teclado Gamer", price: 250, origem: "remoto" }, { median: 260 }).elegivel, "remoto sem marca nem modelo continua reprovado");
ok(!eligibilityCheck(
  { title: "Teclado Redragon Kumara K552", price: 250, rating: 3.2, ratingCount: 5, origem: "remoto" },
  { median: 260 },
).elegivel, "produto COM nota continua sujeito ao piso de avaliacoes");
ok(eligibilityCheck(
  { title: "Teclado Redragon Kumara K552", price: 250, rating: 4.5, ratingCount: 60, origem: "remoto" },
  { median: 260 },
).elegivel, "produto remoto com nota real valida passa normalmente");

// P12 (desarme): "blue" como cor nao vira marca; Blue so conta em microfone
// com modelo conhecido (Yeti, Snowball, ...).
igual(detectBrand("Mousepad Gamer Light Blue"), "", "cor azul em ingles nao vira marca Blue");
igual(detectBrand("Teclado Mecanico Switch Blue"), "", "switch blue (spec de switch) nao vira marca");
igual(detectBrand("Microfone Blue Yeti X"), "Blue", "Blue Yeti continua sendo marca de microfone");
igual(detectBrand("Microfone Condensador Blue Snowball"), "Blue", "Blue Snowball continua sendo marca de microfone");

// P12 (desarme): resolucao e taxa de quadros nao sao modelo (davam falso
// positivo no gate de identidade via detectModel).
igual(detectModel("Webcam Full HD 1080P"), "", "1080P e resolucao, nao modelo");
igual(detectModel("Monitor Gamer 1440P 165Hz"), "", "1440P e resolucao, nao modelo");
igual(detectModel("Mouse Gamer 120FPS"), "", "FPS e taxa de quadros, nao modelo");
igual(detectModel("Placa de Video RTX 4060 8GB"), "RTX 4060", "serie real de GPU continua sendo modelo");

// P12 (desarme): volume >= 100 compensa nota mediana, nunca nota catastrophica.
ok(!eligibilityCheck(
  { title: "Teclado Logitech G", rating: 3.0, ratingCount: 500, price: 250 },
  { median: 260 },
).elegivel, "volume >= 100 nao compensa nota 3.0 no piso");
ok(eligibilityCheck(
  { title: "Teclado Logitech G", rating: 3.8, ratingCount: 500, price: 250 },
  { median: 260 },
).elegivel, "volume >= 100 compensa nota mediana (3.8) no piso");

// V7: produto COM nota mas SEM ratingCount (comum na Frente 4) nao reprova
// por volume — o piso de volume so vale quando o dado chega.
ok(eligibilityCheck(
  { title: "Cadeira Gamer ThunderX3", rating: 4.5, price: 1100 },
  { median: 1000 },
).elegivel, "nota sem volume passa (volume nao chega da Frente 4)");
ok(!eligibilityCheck(
  { title: "Cadeira Gamer ThunderX3", rating: 3.2, price: 1100 },
  { median: 1000 },
).elegivel, "nota baixa sem volume continua reprovada");

// V8: marcas de cadeira agora sao conhecidas (antes passavam o gate so com
// modelo, que raramente existe em cadeira).
igual(detectBrand("Cadeira Gamer ThunderX3 TC3"), "ThunderX3", "ThunderX3 reconhecida");
igual(detectBrand("Cadeira Gamer LuvinCo Confort"), "LuvinCo", "LuvinCo reconhecida");
igual(detectBrand("Cadeira Gamer MyMax K3"), "MyMax", "MyMax reconhecida");

// Query de produto: tira a frase editorial do topico e fica so com o
// vocabulario que existe no catalogo (substantivos de hardware / jogos).
igual(sanitizeProductQuery("melhores periféricos gamer sustentáveis de 2024", "hardware"), "perifericos gamer", "query editorial de perifericos vira termo de produto");
igual(sanitizeProductQuery("melhor mouse gamer wireless 2026", "hardware"), "mouse gamer", "query com substantivo de hardware mantem categoria + gamer");
igual(sanitizeProductQuery("melhor headset gamer custo benefício", "hardware"), "headset gamer", "palavra editorial (custo beneficio) sai da query");
igual(sanitizeProductQuery("melhor setup gamer", "hardware"), "", "sem substantivo de hardware reconhecivel retorna vazio");
const qGta = sanitizeProductQuery("gta 6 novidades ps5", "games");
ok(qGta.includes("gta 6") && qGta.includes("ps5"), "query de games mantem nome do jogo e console");
const qJogo = sanitizeProductQuery("lançamentos de jogos para ps5", "games");
ok(qJogo.includes("ps5") && qJogo.includes("jogo"), "query de games mantem console e termo jogo");

// Ano unico tambem no corpo e nas tags: corrige a prosa mas protege URLs.
const corpoComAno = "Os melhores mouses de 2024 para PC gamer. Veja o [mouse ergonomico de 2024](/blog/top-5-mouse-gamer-ergonomico-de-2024-para-conforto-duradouro/) em 2024.";
const corpoCorrigido = normalizarAnosBody(corpoComAno);
ok(!corpoCorrigido.includes("mouses de 2024") && !corpoCorrigido.includes("mouse ergonomico de 2024") && !corpoCorrigido.includes(") em 2024."), "ano velho vira o corrente na prosa do corpo");
ok(corpoCorrigido.includes("/blog/top-5-mouse-gamer-ergonomico-de-2024-para-conforto-duradouro/"), "URL do link interno com 2024 continua intacta");
igual(normalizarAnosBody(null), null, "body nulo volta nulo");

// ---- TAREFA 4: upgrade de URL, dimensoes reais e validacao ----
igual(upgradeImageUrl(""), "", "url vazia volta vazia");
igual(upgradeImageUrl(null), "", "url nula volta vazia");
const mlUrl = "http://mlstatic.com/D_NQ_NP_734715-MLB51234567890-O.webp";
const mlUp = upgradeImageUrl(mlUrl);
ok(mlUp.includes("D_NQ_NP_2X_"), "ML: forca a variante 2X");
ok(/-F\.webp$/.test(mlUp), "ML: sufixo -O vira -F (alta resolucao)");
ok(!mlUp.includes("-O.webp"), "ML: variante pequena nao sobrevive");
igual(upgradeImageUrl("http://img/D_NQ_NP_2X_123-O.jpg"), "http://img/D_NQ_NP_2X_123-F.jpg", "ML: 2X existente nao e duplicado e -O vira -F");
igual(upgradeImageUrl("http://shopee.com/x_tn.jpg"), "http://shopee.com/x.jpg", "Shopee: sufixo _tn e removido");
igual(upgradeImageUrl("http://gstatic.com/img?w=100&q=80"), "http://gstatic.com/img?w=1200&q=80", "Serper/Google: largura sobe para 1200");

// PNG: assinatura + IHDR (largura no offset 16, altura no 20).
const png = Buffer.alloc(24);
png.writeUInt32BE(0x89504e47, 0);
png.writeUInt32BE(13, 8); // tamanho do IHDR
png.write("IHDR", 12);
png.writeUInt32BE(1920, 16);
png.writeUInt32BE(1080, 20);
igual(imageDimensions(png), { width: 1920, height: 1080 }, "PNG: le dimensoes do IHDR");

// JPEG: FFD8 + SOF0 com altura/largura.
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x00, 0x04, 0x00, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00]);
igual(imageDimensions(jpg), { width: 1024, height: 512 }, "JPEG: le dimensoes do SOF0");

// WebP VP8X: canvas (largura-1, altura-1) em 24 bits LE a partir do offset 24.
const webp = Buffer.alloc(32);
webp.write("RIFF", 0);
webp.write("WEBP", 8);
webp.write("VP8X", 12);
webp[24] = 0x9f; webp[25] = 0x04; webp[26] = 0x00; // 1183 -> 1184
webp[27] = 0xef; webp[28] = 0x01; webp[29] = 0x00; // 495 -> 496
igual(imageDimensions(webp), { width: 1184, height: 496 }, "WebP VP8X: le canvas size");
igual(imageDimensions(Buffer.from("isso nao e imagem")), null, "formato desconhecido retorna null");

igual(MIN_IMAGE_SIZE, 500, "lado minimo da imagem e 500px");
ok(!isImageUsable(Buffer.alloc(10)), "buffer minusculo e reprovado");
ok(!isImageUsable(png), "PNG pequeno (nao tem bytes minimos) e reprovado");
const pngGrande = Buffer.concat([png, Buffer.alloc(9000)]);
ok(isImageUsable(pngGrande), "PNG grande e aprovado");
ok(isImageUsable(Buffer.alloc(12000)), "formato desconhecido com bytes suficientes e aceito (nao descarta por limite do parser)");

// buildProductImageTag respeita a ordem e passa dimensoes quando conhecidas.
const imgTag4 = buildProductImageTag({ title: "Produto X", local_thumbnail: "/images/produtos/_placeholder.webp", image_width: 1200, image_height: 630 });
ok(imgTag4.includes('width="1200"') && imgTag4.includes('height="630"'), "tag de imagem carrega largura/altura reais");
const imgTag4Sem = buildProductImageTag({ title: "Produto X", local_thumbnail: "/images/produtos/_placeholder.webp" });
ok(!imgTag4Sem.includes("width="), "sem dimensao conhecida a tag nao inventa largura");

// ---- Dados ricos: marca, descricao e specs do produto ----
const htmlRico = `<!doctype html><html><head>
<title>Mouse Gamer Redragon Cobra 6400DPI — Preco no Mercado Livre | Mercado Livre</title>
<meta name="description" content="Mouse gamer Redragon Cobra com sensor 6400 DPI e 6 botoes programaveis.">
<script type="application/ld+json">{"@type":"Product","name":"Mouse Gamer Redragon Cobra","brand":{"name":"Redragon"},"description":"Mouse com sensor 6400 DPI.","additionalProperty":[{"name":"DPI","value":"6400"},{"name":"Botoes","value":"6 programaveis"},{"name":"Conexao","value":"USB"}]}</script>
</head><body></body></html>`;
const ricos = extractMLProductData(htmlRico, "https://www.mercadolivre.com.br/p/MLB12345678");
igual(ricos.brand, "Redragon", "marca vem do JSON-LD brand.name");
ok(String(ricos.description).includes("sensor 6400 DPI"), "descricao vem da meta description/JSON-LD");
igual(ricos.specs.length, 3, "specs vem de additionalProperty");
igual(ricos.specs[0], { key: "DPI", value: "6400" }, "spec vira {key, value}");
igual(ricos.id, "MLB12345678", "shape anterior preservado (id)");

const htmlSimples = `<!doctype html><html><head><title>Mouse Gamer Logitech G203 | Mercado Livre</title></head><body></body></html>`;
const simples = extractMLProductData(htmlSimples, "https://www.mercadolivre.com.br/p/MLB99999999");
igual(simples.brand, "Logitech", "sem JSON-LD, marca detectada do titulo via KNOWN_BRANDS");
igual(simples.description, "", "sem meta description, descricao vazia");
igual(simples.specs, [], "sem JSON-LD, specs vazia");
igual(simples.title, "Mouse Gamer Logitech G203", "titulo limpo preservado");

// ---- Gate de sourcing: noticia nunca aborta, lista/hardware aborta so sem produtos ----
igual(shouldAbortProductSourcing({ count: 0, articleCat: "console", isNoticia: true }), false, "noticia com 0 produtos NAO aborta (publica informativo)");
igual(shouldAbortProductSourcing({ count: 2, articleCat: "mouse", isNoticia: true }), false, "noticia com poucos produtos NAO aborta");
igual(shouldAbortProductSourcing({ count: 0, articleCat: null, isNoticia: false }), false, "sem categoria de produto detectada NAO aborta");
igual(shouldAbortProductSourcing({ count: 3, articleCat: "mouse" }), false, "MIN_PRODUCTS atingido NAO aborta");
igual(shouldAbortProductSourcing({ count: 2, articleCat: "mouse" }), true, "lista/hardware com menos de MIN_PRODUCTS e categoria detectada ABORTA (nunca artigo errado)");
igual(shouldAbortProductSourcing({ count: 0, articleCat: "monitor" }), true, "lista sem nenhum produto e categoria detectada ABORTA");

// ---- resolverAfiliados: produto sem link NAO e mais descartado, vira pendente ----
(async () => {
  const comLink = { title: "Mouse Redragon Cobra", permalink: "http://ml/1", affiliate_link: "http://ml/aff/1" };
  const comOffers = { title: "Headset HyperX", permalink: "http://ml/2", offers: { shopee: { affiliate_link: "http://s/aff" } } };
  const semLink = { title: "Console PS5 Slim", permalink: "http://ml/3", source: "Mercado Livre" };
  const resultado = await resolverAfiliados([comLink, comOffers, semLink]);
  igual(resultado.length, 3, "resolverAfiliados mantem todos os produtos (nenhum descartado)");
  igual(resultado[0].affiliate_pending, false, "produto com affiliate_link fica sem flag");
  igual(resultado[1].affiliate_pending, false, "produto com offer de afiliado fica sem flag");
  igual(resultado[2].affiliate_pending, true, "produto sem link de afiliado vira affiliate_pending");
  const pendHtml = buildProductButtonHtml(resultado[2]);
  ok(pendHtml.includes("product-btn--pending"), "botao do produto pendente leva a classe product-btn--pending");
  ok(pendHtml.includes('href="http://ml/3"'), "botao pendente publica com o permalink");
  const normalHtml = buildProductButtonHtml(resultado[0]);
  ok(!normalHtml.includes("product-btn--pending"), "botao normal nao tem a classe pendente");
  ok(buildProductButtonHtml(semLink).includes("product-btn--pending"), "diretamente: produto sem link vira botao pendente");

  // ---- Etapa 7.1: keyword tolerante a plural/posicao no titulo ----
  igual(
    keywordTokensMatch("5 Melhores Headsets Gamer Com Som Espacial Em 2026", "headset gamer"),
    { ok: true, idx: 11 },
    "plural real: headsets casa com a keyword headset"
  );
  igual(keywordTokensMatch("Headset com microfone embutido em 2026", "headset gamer").ok, false, "token ausente (gamer) reprova");
  igual(keywordTokensMatch("Headset", "").ok, true, "keyword vazia nao reprova");
  igual(
    checkTitle("5 Melhores Headsets Gamer Com Som Espacial Em 2026", "headset gamer"),
    [],
    "titulo com headsets (plural) e keyword headset gamer passa no gate"
  );
  ok(
    checkTitle("Headset com microfone embutido em 2026", "headset gamer").some((p) => p.includes("nao contem a palavra-chave")),
    "keyword sem token presente continua reprovando"
  );
  ok(
    checkTitle("O que voce precisa saber sobre headset gamer em 2026", "headset gamer").some((p) => p.includes("tarde demais")),
    "keyword nos 40%+ continua reprovando"
  );

  // ---- Etapa 7.2: strip de precos em prosa (so artigos com produtos) ----
  const bodyPrecos = [
    "## Introducao",
    "",
    "Este headset custa R$ 349,90 na promocao e o mouse sai por R$ 89,90.",
    "",
    "### Headset Gamer HyperX Cloud II",
    "",
    "Som limpo por R$ 349,90 neste modelo.",
    "",
    "## Comparativo",
    "",
    "| Produto | Preco | Destaque |",
    "|---|---|---|",
    "| Headset Gamer HyperX Cloud II | R$ 349,90 | som |",
    "| Mouse Logitech G Pro X | R$ 89,90 | precisao |",
  ].join("\n");
  const bodyStripped = stripPricesFromBody(bodyPrecos, [349.9, 89.9]);
  ok(!bodyStripped.includes("custa R$"), "preco em prosa removido do texto corrido");
  ok(bodyStripped.includes("custa na promocao"), "espacos duplos colapsados apos remocao");
  ok(bodyStripped.includes("Som limpo por R$ 349,90"), "preco dentro da secao ### do produto preservado");
  ok(bodyStripped.includes("| Headset Gamer HyperX Cloud II | R$ 349,90 |"), "preco na tabela Comparativo preservado");
  igual(
    stripPricesFromBody("preco R$ 1.299 em prosa", []),
    "preco R$ 1.299 em prosa",
    "sem precos de produto, corpo intacto"
  );

  // ---- Etapa 7.3: frontmatter com CRLF nao corrompe pubDate (keepPubDate) ----
  const fmCrlf = [
    `---`,
    `title: "Headset X"`,
    `description: "Descricao longa o suficiente para o frontmatter."`,
    `pubDate: 2024-05-01`,
    `category: "review"`,
    `affiliate: true`,
    `---`,
    ``,
    `## Introducao`,
    ``,
    `Texto.`,
  ].join("\r\n");
  const parsedCrlf = parseFrontmatter(fmCrlf);
  igual(parsedCrlf.frontmatter.pubDate, "2024-05-01", "pubDate limpa (sem \\r) em frontmatter CRLF");
  igual(parsedCrlf.frontmatter.category, "review", "category limpa (sem \\r) em frontmatter CRLF");

  // ---- Etapa 8.1: imagem local inexistente nunca vai para o markup ----
  const imgMissing = { title: "Fake", local_thumbnail: "/images/produtos/nao-existe-999.png", thumbnail: "http://img/1.jpg" };
  ok(buildProductImageTag(imgMissing).includes('src="http://img/1.jpg"'), "local inexistente cai para a thumbnail web");
  const imgPlaceholder = { title: "Fake", local_thumbnail: "/images/produtos/_placeholder.webp" };
  ok(buildProductImageTag(imgPlaceholder).includes('src="/images/produtos/_placeholder.webp"'), "arquivo local existente mantido no markup");
  igual(
    buildProductImageTag({ title: "Fake", local_thumbnail: "/images/produtos/nao-existe-999.png" }),
    "",
    "sem thumbnail web e local inexistente: <img> omitido"
  );

  // ---- Etapa 8.2: capas default por categoria referenciam arquivos reais ----
  for (const [cat, cover] of Object.entries(DEFAULT_COVER_BY_PRODUCT_CATEGORY)) {
    ok(fs.existsSync(path.resolve("public", cover.replace(/^\//, ""))), `capa default da categoria "${cat}" existe (${cover})`);
  }
  ok(fs.existsSync(path.resolve("public", DEFAULT_COVER_GENERIC.replace(/^\//, ""))), "capa default generica existe");

  // ---- Tarefa E: inspecao com correcao (gate que corrige antes de abortar) ----
  const corpoComSecaoVazia = "## Intro\n\nTexto bom.\n\n## Secao Vazia\n\n\n## Conclusao\n\nFim.";
  const semVazia = removeEmptySections(corpoComSecaoVazia, "");
  ok(!semVazia.includes("Secao Vazia"), "secao ## vazia removida");
  ok(semVazia.includes("## Intro") && semVazia.includes("## Conclusao"), "secoes com conteudo preservadas");
  igual(removeEmptySections("## A\n\ntexto", "A"), "## A\n\ntexto", "secao-pai (listHeading) nao e removida mesmo sem conteudo");

  const corpoBase64 = "Antes.\n\n![foto](data:image/png;base64,AAAA)\n\nDepois.";
  ok(removeEmptySections(corpoBase64, "").includes("data:image"), "removeEmptySections nao quebra imagem base64");
  const semBase64 = corrigirPeloGate({
    body: corpoBase64,
    fm: { title: "Teste", description: "x".repeat(130), tags: ["a", "b", "c"], category: "noticia" },
    gateReprovados: [{ etapa: "design", problemas: [{ severidade: "P0", mensagem: "1 imagem(ns) data:URI no markdown" }] }],
  });
  ok(!semBase64.body.includes("data:image"), "corrigirPeloGate remove imagem base64 (P0)");
  ok(semBase64.mudancas.includes("base64-removido"), "mudanca base64 registrada");

  const corpoAberturaVirgula = "Neste artigo, vamos analisar o jogo novo.\n\nO resto do texto segue normal.";
  const semAbertura = corrigirPeloGate({
    body: corpoAberturaVirgula,
    fm: { title: "Teste", description: "x".repeat(130), tags: ["a", "b", "c"], category: "review" },
    gateReprovados: [{ etapa: "redacao", problemas: [{ severidade: "P0", mensagem: "Abertura proibida detectada" }] }],
  });
  ok(!/neste artigo/i.test(semAbertura.body), "abertura proibida com virgula e removida");
  ok(semAbertura.mudancas.includes("abertura-proibida-removida"), "mudanca de abertura registrada");

  const corpoPrecoProsa = "O headset custa R$ 499,90 e vale a pena.\n\n| Produto | Preco |\n| X | R$ 499,90 |";
  const semPreco = corrigirPeloGate({
    body: corpoPrecoProsa,
    fm: { title: "Teste", description: "x".repeat(130), tags: ["a", "b", "c"], category: "guia" },
    gateReprovados: [{ etapa: "revisao", problemas: [{ severidade: "P1", mensagem: "Precos em prosa detectados (1x)" }] }],
  });
  ok(!semPreco.body.split("\n").filter((l) => !l.trim().startsWith("|")).join("\n").includes("R$"), "preco em prosa removido fora da tabela");
  ok(semPreco.body.includes("| X | R$ 499,90 |"), "preco da tabela comparativa preservado");
  ok(semPreco.mudancas.includes("precos-em-prosa-removidos"), "mudanca de preco em prosa registrada");

  const corpoMarcadores = "Texto.\n\n[PRODUTO:9]\n\n[IMG:Fantasma]\n\nFim.";
  const semMarcador = corrigirPeloGate({
    body: corpoMarcadores,
    fm: { title: "Teste", description: "x".repeat(130), tags: ["a", "b", "c"], category: "noticia" },
    gateReprovados: [{ etapa: "publicacao", problemas: [{ severidade: "P0", mensagem: "2 marcador(es) [PRODUTO:] publicados" }] }],
  });
  ok(!semMarcador.body.includes("[PRODUTO:") && !semMarcador.body.includes("[IMG:"), "marcadores restantes removidos (P0)");
  ok(semMarcador.mudancas.includes("marcadores-restantes-removidos"), "mudanca de marcador registrada");

  const fmCurto = { title: "Teste", description: "curto", tags: ["a"], category: "guia", affiliate: true };
  const corpoFm = "Guia sobre teclados mecanicos para jogadores exigentes que buscam qualidade e durabilidade no setup gamer. Um bom teclado melhora a precisao, o conforto em horas de jogo e a experiencia competitiva.";
  const corrFm = corrigirPeloGate({
    body: corpoFm,
    fm: fmCurto,
    gateReprovados: [
      { etapa: "revisao", problemas: [{ severidade: "P0", mensagem: "description: muito curto (min 120)" }] },
      { etapa: "revisao", problemas: [{ severidade: "P0", mensagem: "tags: minimo 3" }] },
    ],
    categoria: "guia",
    topicHint: "melhores teclados mecanicos",
  });
  ok(corrFm.fm.description.length >= 120, "description completada para o minimo de 120 chars");
  ok(corrFm.fm.tags.length >= 3, "tags completadas para o minimo de 3");
  ok(corrFm.mudancas.includes("description-ajustada") && corrFm.mudancas.includes("tags-completadas"), "ajustes de frontmatter registrados");

  igual(ajustarDescription({ title: "T", description: "x".repeat(160) }, "corpo").description, "x".repeat(160), "description ja >= 120 nao e alterada");
  igual(ajustarTags({ title: "T", tags: ["a", "b", "c"] }, "guia", "topico").tags.length, 3, "tags ja >= 3 nao sao alteradas");
  const md = montarMarkdown({
    fm: { title: 'Titulo "com aspas"', description: "descricao", tags: ["gamer", "teclado"], category: "guia", affiliate: true },
    body: "## Corpo",
    pubDate: "2026-08-12",
    cover: "/images/capa.jpg",
    mlProducts: [],
  });
  ok(md.includes('title: "Titulo \\"com aspas\\""'), "titulo com aspas escapado no markdown");
  ok(md.includes("## Corpo"), "corpo presente no markdown");
  ok(md.includes("affiliate: true"), "affiliate refletido no markdown");

  // --- P4: normalizarAnosPreposicional protege nome de jogo/modelo ---
  igual(
    normalizarAnosPreposicional("os melhores jogos de 2024 para pc"),
    "os melhores jogos de 2026 para pc",
    "ano apos 'de' e reescrito (P4)"
  );
  ok(normalizarAnosPreposicional("Cyberpunk 2077 e o melhor RPG").includes("Cyberpunk 2077"), "ano no nome do jogo preservado (P4)");
  ok(normalizarAnosPreposicional("com uma RTX 2060 no setup").includes("RTX 2060"), "numero de modelo preservado (P4)");
  ok(normalizarAnosPreposicional("lancado em 2020, voltou em alta") !== "lancado em 2020, voltou em alta", "ano apos 'em' reescrito (P4)");

  // --- P2: repositionImageMarkers coloca a imagem DENTRO da secao (apos o titulo) ---
  const corpoImg = [
    "## Baldur's Gate 3 — O RPG",
    "",
    "A Larian Studios lancou o jogo.",
    "",
    "[IMG:Cyberpunk 2026 Phantom Liberty]",
    "",
    "## Cyberpunk 2026 — A Redencao",
    "",
    "A jornada do jogo.",
  ].join("\n");
  const repos = repositionImageMarkers(corpoImg);
  const idxHeading = repos.indexOf("## Cyberpunk 2026 — A Redencao");
  const idxImg = repos.indexOf("[IMG:Cyberpunk 2026 Phantom Liberty]");
  const idxTexto = repos.indexOf("A jornada do jogo.");
  ok(idxHeading < idxImg && idxImg < idxTexto, "marcador movido para apos o titulo e antes do texto (P2)");

  // --- P1: ensureListStructure cria heading-pai e rebaixa itens para ### ---
  const corpoGames = [
    "Fala gamer. Muita coisa para escolher.",
    "",
    "Nossa lista tem criterios claros.",
    "",
    "## Baldur's Gate 3 — O RPG",
    "",
    "Texto do jogo 1.",
    "",
    "## Cyberpunk 2077 — Redencao",
    "",
    "Texto do jogo 2.",
    "",
    "## Comparativo de Jogos",
    "",
    "| A | B |",
    "",
    "## FAQ",
    "",
    "### Pergunta?",
  ].join("\n");
  const est = ensureListStructure(corpoGames, {
    categoria: "lista", domain: "games", productCount: 0, ano: 2026,
    topic: { hint: "melhores jogos para pc, jogos gratis" }, title: "Melhores Jogos para PC em 2026",
  });
  ok(est.includes("## Os 2 Melhores Jogos para PC em 2026"), "heading-pai inserido (P1)");
  ok(est.includes("### Baldur's Gate 3"), "item 1 rebaixado para ### (P1)");
  ok(est.includes("### Cyberpunk 2077"), "item 2 rebaixado para ### (P1)");
  ok(/^## Comparativo/m.test(est), "comparativo continua ## (P1)");
  ok(est.indexOf("## Os 2 Melhores") < est.indexOf("### Baldur"), "pai antes do primeiro item (P1)");
  igual(
    ensureListStructure(corpoGames, { categoria: "lista", domain: "games", productCount: 3, ano: 2026, topic: {}, title: "x" }),
    corpoGames,
    "com produtos a estrutura nao muda (P1)"
  );
  igual(
    ensureListStructure(corpoGames, { categoria: "lista", domain: "hardware", productCount: 0, ano: 2026, topic: {}, title: "x" }),
    corpoGames,
    "hardware nao reestrutura (P1)"
  );
  igual(
    buildGamesListHeading(5, { hint: "melhores jogos para pc" }, "Melhores Jogos para PC em 2026"),
    "Os 5 Melhores Jogos para PC em 2026",
    "heading de games montado (P1)"
  );
  igual(
    buildGamesListHeading(5, { hint: "x" }, "Jogos PC em 2026: 5 Títulos Indispensáveis para Jogar"),
    "Os 5 Melhores Jogos PC em 2026",
    "heading sem preposicao duplicada (P1)"
  );

  // --- P3: gate de candidatos (grounding por Google) ---
  igual(
    extractListItemTitles(corpoGames),
    ["Baldur's Gate 3", "Cyberpunk 2077"],
    "itens extraidos sem subtitulo (P3)"
  );
  igual(
    extractListItemTitles("## Os 2 Melhores em 2026\n\n## Jogo A\n\n## Comparativo\n\n## Jogo B"),
    ["Jogo A"],
    "para no comparativo e ignora heading-pai (P3)"
  );
  ok(tituloSemelhante("Baldur's Gate 3", "Baldur's Gate 3"), "titulos iguais casam (P3)");
  ok(tituloSemelhante("Resident Evil 4 Remake", "Resident Evil 4 Remake"), "titulos iguais casam 2 (P3)");
  ok(!tituloSemelhante("Baldur's Gate 3", "Lost Ark"), "titulos diferentes nao casam (P3)");
  igual(
    montarQueryPesquisa({ category: "lista", hint: "melhores jogos para PC, jogos gratis, jogos multiplayer" }, 2026),
    "jogos para PC Brasil 2026",
    "query de pesquisa limpa (P3)"
  );
  igual(
    montarQueryPesquisa({ category: "noticia", hint: "gamescom 2026 anuncios" }, 2026),
    "gamescom 2026 anuncios Brasil 2026",
    "noticia mantem o hint (P3)"
  );

  const fmLista = {
    title: "Melhores Jogos para PC em 2026: 5 Titulos",
    description: "x".repeat(130),
    pubDate: "2026-08-13",
    tags: ["jogos pc", "rpg", "steam", "multiplayer", "gratis"],
    category: "lista",
    affiliate: false,
  };
  const candidatos = [{ titulo: "A Investigacao Postuma" }, { titulo: "007 First Light" }, { titulo: "Forza Horizon 6" }];
  const corpoAntigo = "Intro sobre a lista.\n\n## Baldur's Gate 3 — O RPG\n\nTexto.\n\n## Lost Ark — MMORPG\n\nTexto.\n\n## Comparativo\n\n| a |\n\n## FAQ\n\n### P?";
  const vFora = validate(fmLista, corpoAntigo, { category: "lista", productCount: 0, gamesCandidates: candidatos });
  ok(vFora.soft.some((s) => s.includes("fora dos titulos apontados pelo Google")), "itens fora dos candidatos viram P2 (P3)");
  const corpoDentro = "Intro.\n\n## Forza Horizon 6 — Corrida\n\nTexto.\n\n## 007 First Light — Espiao\n\nTexto.\n\n## Comparativo\n\n| a |";
  const vDentro = validate(fmLista, corpoDentro, { category: "lista", productCount: 0, gamesCandidates: candidatos });
  ok(!vDentro.soft.some((s) => s.includes("fora dos titulos apontados pelo Google")), "itens dentro dos candidatos passam (P3)");

  console.log(`${passou} asserts OK`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});