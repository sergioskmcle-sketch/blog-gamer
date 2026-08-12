// TAREFA 6 — ranking objetivo dos "melhores".
// Sinais sem custo adicional: nota media, volume de avaliacoes, preco, marca
// (detectBrand) e loja. Sinal editorial (mencões em reviews independentes) e
// coletado UMA vez por artigo e passado como rankingContext. Tudo normalizado
// em 0-1 e ponderado por RANKING_WEIGHTS; sinal ausente vale 0, nunca NaN.
import { detectBrand, detectModel, KNOWN_BRANDS, extractSpecs } from "./product_naming.mjs";

// Pesos recalibrados: consenso editorial (varios reviewers independentes
// concordando) e custo-beneficio pesam mais que so ter marca conhecida — marca
// sozinha nao faz um produto ser "o melhor". specFit e novo: produto com specs
// relevantes da categoria no nome (DPI, Hz, switch, wireless) tem mais chance
// de ser candidato real, nao so um resultado de busca qualquer.
export const RANKING_WEIGHTS = {
  rating: 0.20,             // nota media dos consumidores (0-5 normalizada)
  reviewVolume: 0.15,       // log10(ratingCount) normalizado — muitas avaliacoes = mais confiavel
  editorialMentions: 0.30,  // presenca em reviews/rankings independentes (marca+modelo pesa mais que so marca)
  brandReputation: 0.10,    // marca conhecida da categoria
  valueForMoney: 0.20,      // preco vs mediana da lista
  specFit: 0.05,            // specs relevantes da categoria presentes no nome
};

export const MIN_CRITERIA = 2;

// Volume de avaliacoes a partir do qual o sinal de reviews satura.
const REVIEW_VOLUME_CEILING = 4; // log10(10000) = 4
// Normalizacao do sinal editorial: 3 mencões ja pontuam o maximo.
const MENTIONS_CEILING = 3;

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function normalizeForMatch(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function countOccurrences(hay, needle) {
  if (!needle) return 0;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${esc}(?![a-z0-9])`, "g");
  let count = 0;
  while (re.exec(hay) !== null) count++;
  return count;
}

// Mediana dos precos da lista. 0 quando nao ha precos validos.
export function medianPrice(products) {
  const prices = (Array.isArray(products) ? products : [])
    .map((p) => Number(p?.price))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return 0;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

// Custo-beneficio: pontuacao maxima entre 0,6x e 1,2x a mediana; preco abaixo
// de 0,3x (proval produto falso/acessorio) ou acima de 2,5x zera o sinal.
export function valueForMoneyScore(price, median) {
  if (!(Number.isFinite(price) && price > 0) || !(Number.isFinite(median) && median > 0)) return 0;
  const ratio = price / median;
  if (ratio < 0.3 || ratio > 2.5) return 0;
  if (ratio >= 0.6 && ratio <= 1.2) return 1;
  if (ratio < 0.6) return (ratio - 0.3) / 0.3;
  return Math.max(0, 1 - (ratio - 1.2) / 1.3);
}

// Consenso editorial: marca+modelo juntos no texto pesa 3x mais que so a marca
// batendo sozinha — "Logitech" aparece em toda review de periferico, mas
// "Logitech G Pro X Superlight" so aparece quando o modelo especifico foi
// avaliado. Sem isso, todo produto de marca grande pontuava igual.
export function countEditorialMentions(product, context) {
  const raw = String(context || "");
  if (!raw) return 0;
  const title = String(product?.raw_title || product?.title || "");
  const brand = detectBrand(title);
  const ctx = normalizeForMatch(raw);
  if (!ctx) return 0;
  const brandNorm = normalizeForMatch(brand);
  if (!brandNorm) return 0;
  const brandHead = brandNorm.split(" ")[0];
  const brandHits = countOccurrences(ctx, brandHead);
  if (brandHits === 0) return 0;

  // detectModel as vezes funde a marca no inicio do modelo ("Redragon K552") —
  // pega o token distintivo (com digito, ex. "k552"), nunca a propria marca.
  const model = detectModel(title);
  const modelTokens = normalizeForMatch(model).split(" ").filter((w) => w.length >= 3 && w !== brandHead);
  const modelNorm = modelTokens.find((w) => /\d/.test(w)) || modelTokens[0] || "";
  if (!modelNorm) return brandHits * 0.5;
  const comboHits = countOccurrences(ctx, modelNorm);
  return comboHits > 0 ? comboHits * 3 : brandHits * 0.5;
}

// Specs relevantes da categoria presentes no nome (DPI, Hz, switch, wireless,
// TKL...). Produto sem nenhuma spec no titulo costuma ser um resultado de
// busca generico, nao um candidato real a "melhor".
export function specFitScore(product) {
  const title = String(product?.raw_title || product?.title || "");
  const specs = extractSpecs(title, 5) || [];
  return clamp01(specs.length / 3);
}

function formatCount(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return String(Math.round(n));
}

// Devolve { score (0-1), breakdown (0-1 por sinal), criteriosAtendidos }.
export function scoreProduct(p, ctx = {}) {
  const rating = Number(p?.rating);
  const ratingCount = Number(p?.ratingCount);
  const price = Number(p?.price);
  const median = Number.isFinite(Number(ctx.median))
    ? Number(ctx.median)
    : medianPrice(Array.isArray(ctx.products) ? ctx.products : [p]);
  const mentions = countEditorialMentions(p, ctx.rankingContext || "");
  const brand = detectBrand(String(p?.raw_title || p?.title || ""));
  const brandKnown = Boolean(brand) && Boolean(KNOWN_BRANDS[normalizeForMatch(brand)]);

  const specFit = specFitScore(p);

  const breakdown = {
    rating: clamp01(rating > 0 ? rating / 5 : 0),
    reviewVolume: clamp01(ratingCount > 0 ? Math.log10(ratingCount + 1) / REVIEW_VOLUME_CEILING : 0),
    editorialMentions: clamp01(mentions / MENTIONS_CEILING),
    brandReputation: brandKnown ? 1 : 0,
    valueForMoney: valueForMoneyScore(price, median),
    specFit,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(RANKING_WEIGHTS)) {
    score += (Number.isFinite(breakdown[key]) ? breakdown[key] : 0) * weight;
  }

  const mentionsInt = Math.round(mentions);
  const criteriosAtendidos = [];
  if (rating >= 4.0) criteriosAtendidos.push(`${rating.toFixed(1).replace(".", ",")}★ de nota media`);
  if (ratingCount >= 20) criteriosAtendidos.push(`${formatCount(ratingCount)} avaliacoes`);
  if (mentionsInt >= 1) criteriosAtendidos.push(`citado em ${mentionsInt} ${mentionsInt === 1 ? "review" : "reviews"}`);
  if (brandKnown) criteriosAtendidos.push(`marca ${brand}`);

  return { score: clamp01(score), breakdown, criteriosAtendidos };
}

// Aplica o requisito minimo: fica de fora quem nao atingir MIN_CRITERIA, a
// menos que isso deixe a lista abaixo de minProducts (ai mantem os melhores
// restantes e avisa via flag fallback).
export function applyMinCriteria(products, ctx = {}, minProducts = 3) {
  const list = Array.isArray(products) ? products : [];
  const passing = list.filter((p) => (p?.criteriosAtendidos?.length || 0) >= MIN_CRITERIA);
  const below = list.filter((p) => (p?.criteriosAtendidos?.length || 0) < MIN_CRITERIA);
  if (passing.length >= minProducts || below.length === 0) {
    return { items: passing, descartados: below.length, fallback: false };
  }
  return { items: list, descartados: below.length, fallback: true };
}

// ---------------------------------------------------------------------------
// TAREFA "Top N de verdade": piso de elegibilidade objetivo. Antes disso o
// gerador so filtrava por MIN_CRITERIA (2 de 4 sinais fracos) e aceitava
// qualquer coisa que a busca devolvesse — produto caro, sem avaliacao, sem
// nome reconhecivel entrava numa lista chamada "Os 5 Melhores". Aqui a barra
// e mais alta e objetiva: preco plausivel perto da mediana, prova de que
// gente de verdade comprou e avaliou, e identidade (marca/modelo) legivel.
// ---------------------------------------------------------------------------

const PRECO_MIN_RATIO = 0.35;
const PRECO_MAX_RATIO = 2.2;
const RATING_COUNT_MINIMO = 20;
const RATING_COUNT_MINIMO_RELAXADO = 10;

// { elegivel, motivos: string[] } — motivos e a lista de exigencias que
// FALHARAM, para log/auditoria.
export function eligibilityCheck(p, ctx = {}) {
  const price = Number(p?.price);
  const rating = Number(p?.rating);
  const ratingCount = Number(p?.ratingCount);
  const median = Number.isFinite(Number(ctx.median)) ? Number(ctx.median) : 0;
  const title = String(p?.raw_title || p?.title || "");
  const brand = detectBrand(title);
  const model = detectModel(title);
  const brandKnown = Boolean(brand) && Boolean(KNOWN_BRANDS[normalizeForMatch(brand)]);
  const ratingCountMinimo = ctx.relaxado ? RATING_COUNT_MINIMO_RELAXADO : RATING_COUNT_MINIMO;

  const motivos = [];
  if (!(price > 0)) {
    motivos.push("sem preco");
  } else if (median > 0) {
    const ratio = price / median;
    if (ratio < PRECO_MIN_RATIO) motivos.push(`preco muito abaixo da mediana (${ratio.toFixed(2)}x)`);
    if (ratio > PRECO_MAX_RATIO) motivos.push(`preco muito acima da mediana (${ratio.toFixed(2)}x)`);
  }
  const semDadosDeAvaliacao = !(rating > 0) && !(ratingCount > 0);
  if (!semDadosDeAvaliacao) {
    // Volume alto compensa nota mediana, nunca nota catastrophica: 100+ pessoas
    // avaliando 1-2 estrelas e prova de que o produto e ruim, nao consenso bom.
    if (!(rating >= 4.0) && !(ratingCount >= 100 && rating >= 3.5)) {
      motivos.push("sem nota >= 4.0 e sem volume de avaliacoes (>= 100) com nota >= 3.5 que compense");
    }
    if (!(ratingCount >= ratingCountMinimo)) {
      motivos.push(`menos de ${ratingCountMinimo} avaliacoes`);
    }
  }
  // Reputacao: marca conhecida OU mencao editorial OU modelo reconhecivel (o
  // proprio codigo/serie ja atesta identidade — "RTX 4060" diz tanto quanto
  // "NVIDIA" mesmo quando a palavra da marca nao aparece no titulo).
  if (!brandKnown && !model && !((Number(ctx.mentions) || 0) >= 1)) {
    motivos.push("marca desconhecida, sem modelo reconhecivel e sem mencao editorial");
  }
  if (!brand && !model) {
    motivos.push("nome sem marca nem modelo identificavel");
  }

  return { elegivel: motivos.length === 0, motivos };
}

// Filtra por eligibilityCheck. Se sobrar menos que minProducts, relaxa so o
// piso de volume de avaliacoes (RATING_COUNT_MINIMO_RELAXADO) — nunca relaxa
// preco, marca/modelo ou nota/volume combinados. Devolve
// { items, descartados: [{produto, motivos}], fallback }.
export function filterEligible(products, ctx = {}, minProducts = 3) {
  const list = Array.isArray(products) ? products : [];
  const avaliar = (relaxado) => {
    const ok = [];
    const fora = [];
    for (const p of list) {
      const r = eligibilityCheck(p, { ...ctx, relaxado });
      if (r.elegivel) ok.push(p);
      else fora.push({ produto: p, motivos: r.motivos });
    }
    return { ok, fora };
  };

  let { ok, fora } = avaliar(false);
  let fallback = false;
  if (ok.length < minProducts) {
    const relaxado = avaliar(true);
    if (relaxado.ok.length > ok.length) {
      ok = relaxado.ok;
      fora = relaxado.fora;
      fallback = true;
    }
  }
  return { items: ok, descartados: fora, fallback };
}

// Ordena por score decrescente. ctx.tieBreak desempata (ex.: relevancia por
// tokens do topico). Anexa score/breakdown/criteriosAtendidos em cada produto.
export function rankProducts(products, ctx = {}) {
  const list = Array.isArray(products) ? products : [];
  const median = Number.isFinite(Number(ctx.median)) ? Number(ctx.median) : medianPrice(list);
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const s = scoreProduct(p, { ...ctx, median });
    p.score = s.score;
    p.breakdown = s.breakdown;
    p.criteriosAtendidos = s.criteriosAtendidos;
  }
  const tieBreak = typeof ctx.tieBreak === "function" ? ctx.tieBreak : () => 0;
  return list.slice().sort((a, b) => (b.score - a.score) || tieBreak(a, b));
}
