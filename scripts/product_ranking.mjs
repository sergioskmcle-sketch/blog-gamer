// TAREFA 6 — ranking objetivo dos "melhores".
// Sinais sem custo adicional: nota media, volume de avaliacoes, preco, marca
// (detectBrand) e loja. Sinal editorial (mencões em reviews independentes) e
// coletado UMA vez por artigo e passado como rankingContext. Tudo normalizado
// em 0-1 e ponderado por RANKING_WEIGHTS; sinal ausente vale 0, nunca NaN.
import { detectBrand, KNOWN_BRANDS } from "./product_naming.mjs";

export const RANKING_WEIGHTS = {
  rating: 0.25,            // nota media dos consumidores (0-5 normalizada)
  reviewVolume: 0.2,       // log10(ratingCount) normalizado — muitas avaliacoes = mais confiavel
  editorialMentions: 0.25, // presenca em reviews/rankings independentes
  brandReputation: 0.15,   // marca conhecida da categoria
  valueForMoney: 0.15,     // preco vs mediana da lista
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

// Quantas vezes a marca do produto aparece no consenso editorial. Usa a
// primeira palavra da marca ("Logitech G" casa "Logitech" nas reviews).
export function countEditorialMentions(product, context) {
  const raw = String(context || "");
  if (!raw) return 0;
  const title = String(product?.raw_title || product?.title || "");
  const brand = detectBrand(title);
  const ctx = normalizeForMatch(raw);
  if (!ctx) return 0;
  const brandNorm = normalizeForMatch(brand);
  if (!brandNorm) return 0;
  return countOccurrences(ctx, brandNorm.split(" ")[0]);
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

  const breakdown = {
    rating: clamp01(rating > 0 ? rating / 5 : 0),
    reviewVolume: clamp01(ratingCount > 0 ? Math.log10(ratingCount + 1) / REVIEW_VOLUME_CEILING : 0),
    editorialMentions: clamp01(mentions / MENTIONS_CEILING),
    brandReputation: brandKnown ? 1 : 0,
    valueForMoney: valueForMoneyScore(price, median),
  };

  let score = 0;
  for (const [key, weight] of Object.entries(RANKING_WEIGHTS)) {
    score += (Number.isFinite(breakdown[key]) ? breakdown[key] : 0) * weight;
  }

  const criteriosAtendidos = [];
  if (rating >= 4.0) criteriosAtendidos.push(`${rating.toFixed(1).replace(".", ",")}★ de nota media`);
  if (ratingCount >= 20) criteriosAtendidos.push(`${formatCount(ratingCount)} avaliacoes`);
  if (mentions >= 1) criteriosAtendidos.push(`citado em ${mentions} ${mentions === 1 ? "review" : "reviews"}`);
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
