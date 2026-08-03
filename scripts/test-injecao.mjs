// Testes das funcoes puras do gerador de artigo: posicionamento de produtos,
// posicionamento de imagens, matching RAWG e gates de qualidade.
// Rodar com: npm test
import assert from "assert";
import {
  injectProductCards, injectGameImages, extractImageMarkers, repositionImageMarkers,
  stripLeftoverMarkers, validate, checkTitle, capitalizeTitle, similarity, nameSimilarity,
  computeMaxTokens, buildProductButtonHtml, buildProductImageTag, injectTableOfContents, validateSourceCoverage,
  formatProductPriceForPrompt, findPricesInBody,
} from "./gerar-artigo.mjs";

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
const imgTag = buildProductImageTag({ title: "Persona 5 Tactica", thumbnail: "http://img/9.jpg" });
ok(imgTag.includes('class="article-game-img"') && imgTag.includes("http://img/9.jpg"), "foto do item usa article-game-img + thumbnail");
igual(buildProductImageTag({ title: "X", thumbnail: "" }), "", "sem imagem nao gera tag");

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
const comIndice = injectTableOfContents(corpoComHeadings);
ok(comIndice.includes("## Índice"), "gera secao de Indice");
ok(comIndice.includes("[God of War Ragnarok](#god-of-war-ragnarok)"), "indice linka para heading");
ok(comIndice.includes('<a id="god-of-war-ragnarok"></a>'), "insere ancora no heading");
ok(!comIndice.includes("[Conclusao]"), "nao inclui Conclusao no indice");
ok(!comIndice.includes("[Fontes]"), "nao inclui Fontes no indice");

// indice nao e gerado quando ha poucos headings
const corpoCurto = `## Unica Secao\n\nTexto.`;
igual(injectTableOfContents(corpoCurto), corpoCurto, "nao gera indice com menos de 3 headings");

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

console.log(`${passou} asserts OK`);
