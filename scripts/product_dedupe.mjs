// Deduplicacao SEMANTICA de produtos.
//
// O pipeline antigo comparava so id/permalink. Resultado: "Mouse Razer
// Deathadder Essential" e "Mouse Razer 6400dpi Deathadder Essential" — o mesmo
// produto, com a mesma foto — ocupavam duas posicões do Top 5.
//
// Aqui a identidade e decidida por uma escada de sinais, do mais forte ao mais
// fraco: catalogo/SKU -> URL canonica -> imagem -> marca+modelo -> nome
// normalizado. Diferenca de spec so separa dois anuncios quando AMBOS declaram
// a mesma dimensao com valores diferentes ("TKL" vs "full", 27" vs 24"). Spec
// que aparece so num dos nomes ("6400 DPI") e ruido de anuncio, nao variante.

import { detectBrand, detectModel, detectCategory, PRODUCT_CATEGORIES } from "./product_naming.mjs";

const SIMILARIDADE_MINIMA = 0.82;

function ascii(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function tokens(s) {
  return ascii(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Sinais fortes de identidade
// ---------------------------------------------------------------------------

// Ids de catalogo/anuncio: MLB do Mercado Livre, productId do Google Shopping,
// item_id de cada oferta, gtin/ean/sku quando a fonte manda.
export function catalogIds(p) {
  const ids = new Set();
  const push = (v) => {
    const s = String(v || "").trim().toLowerCase();
    if (s.length >= 6) ids.add(s);
  };
  const url = String(p?.permalink || "");
  for (const m of url.matchAll(/MLB-?\d{8,}/gi)) push(m[0].replace("-", ""));
  const shopee = url.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/);
  if (shopee) push(`shopee_${shopee[1]}_${shopee[2]}`);
  if (/^MLB\d{8,}$/i.test(String(p?.id || ""))) push(p.id);
  push(p?.productId);
  push(p?.gtin);
  push(p?.ean);
  push(p?.sku);
  for (const o of Object.values(p?.offers || {})) push(o?.item_id);
  return [...ids];
}

// Host + path, sem query nem tracking. Duas ofertas do mesmo anuncio chegam com
// utm/afiliado diferentes e URL "diferente".
export function urlKey(p) {
  const raw = String(p?.permalink || "").trim();
  if (!raw.startsWith("http")) return "";
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    if (!path || path === "/") return "";
    return `${host}${path}`;
  } catch {
    return "";
  }
}

// Chave da imagem: nome do arquivo sem os sufixos de redimensionamento que cada
// CDN adiciona. E o sinal que pegou o caso DeathAdder — dois anuncios, uma foto.
export function imageKey(p) {
  const raw = String(p?.local_thumbnail || "").startsWith("http")
    ? p.local_thumbnail
    : String(p?.thumbnail || p?.images?.[0] || "");
  if (!raw.startsWith("http")) return "";
  let base;
  try {
    base = new URL(raw).pathname.split("/").pop() || "";
  } catch {
    return "";
  }
  base = base.toLowerCase()
    .replace(/\.(jpe?g|png|webp|gif|avif)$/i, "")
    .replace(/[-_](\d+x\d+|[fvbnso]|thumb|small|medium|large|big)$/i, "")
    .replace(/^d_nq_np_(2x_)?/i, "")
    .replace(/[-_]\d{2,4}x\d{2,4}$/i, "");
  // Nome curto demais ou generico nao identifica nada.
  if (base.length < 8 || /^(image|img|photo|produto|product|placeholder|default)$/.test(base)) return "";
  return base;
}

// ---------------------------------------------------------------------------
// Specs: dimensoes que, quando divergem, provam produtos diferentes
// ---------------------------------------------------------------------------

// Cada dimensao devolve um valor canonico ou undefined. Comparacao so acontece
// quando OS DOIS lados declaram a dimensao. DPI, peso e cor ficam de fora de
// proposito: sao ruido de titulo de anuncio, nao variante de produto.
const DIMENSOES = [
  ["conexao", (t) => {
    if (/\b(sem fio|wireless|wi-?fi|bluetooth|2\.?4\s?ghz)\b/.test(t)) return "sem-fio";
    if (/\b(com fio|cabo usb|com cabo|wired)\b/.test(t)) return "com-fio";
    return undefined;
  }],
  ["layout", (t) => {
    if (/\b(tkl|tenkeyless|87\s?teclas|80%)\b/.test(t)) return "tkl";
    if (/\b(60%|61\s?teclas|65%|68\s?teclas)\b/.test(t)) return "compacto";
    if (/\b(full[- ]?size|104\s?teclas|abnt2 completo)\b/.test(t)) return "full";
    return undefined;
  }],
  ["polegadas", (t) => (t.match(/\b(\d{2})\s?(?:"|pol\b|polegadas\b|inch\b)/) || [])[1]],
  ["taxa", (t) => (t.match(/\b(\d{2,3})\s?hz\b/) || [])[1]],
  ["armazenamento", (t) => {
    const m = t.match(/\b(\d+)\s?(gb|tb)\b/);
    return m ? `${m[1]}${m[2]}` : undefined;
  }],
  ["switch", (t) => (t.match(/\bswitch(?:es)?\s+(blue|red|brown|green|silver|outemu|gateron)\b/) || [])[1]],
  // Versao/geracao: "Superlight" e "Superlight 2" NAO sao o mesmo mouse. A
  // ausencia conta como versao 1 — por isso e a unica dimensao onde "faltou de
  // um lado" tambem separa.
  ["versao", (t) => {
    const m = t.match(/\b(?:v|mk|gen|ger)\s?([2-9])\b/) || t.match(/\s([2-9])\s*$/);
    return m ? m[1] : "1";
  }],
];

export function specDimensions(title) {
  const t = ` ${ascii(title).replace(/[^a-z0-9%".\s-]+/g, " ").replace(/\s+/g, " ")} `;
  const out = {};
  for (const [nome, fn] of DIMENSOES) {
    const v = fn(t);
    if (v !== undefined) out[nome] = String(v);
  }
  return out;
}

// true quando alguma dimensao declarada dos dois lados tem valor diferente.
export function specsConflitam(a, b) {
  for (const k of Object.keys(a)) {
    if (b[k] !== undefined && b[k] !== a[k]) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Nome normalizado para comparacao
// ---------------------------------------------------------------------------

const RUIDO = new RegExp(
  "\\b(" + [
    "gamer", "gaming", "para", "com", "sem", "de", "do", "da", "e", "o", "a", "em",
    "novo", "nova", "original", "lacrado", "nacional", "importado", "envio", "imediato",
    "frete", "gratis", "promocao", "oferta", "kit", "combo", "profissional",
    "alta", "precisao", "ergonomico", "ergonomica", "usb", "led", "rgb", "preto", "branco",
    "cinza", "azul", "vermelho", "verde", "rosa", "colorido", "botoes", "teclas", "cor",
    "modelo", "marca", "unidade", "un", "pcs", "top", "premium", "edicao", "edition",
  ].join("|") + ")\\b", "g"
);

// Numeros com unidade (6400dpi, 60g, 1000hz, 4000mah) sao descricao de anuncio.
const SPEC_NUM = /\b\d+\s?(dpi|hz|khz|g|gr|gramas?|mah|ms|mm|w|k)\b/g;
const ANO = /\b20\d{2}\b/g;

// "Mouse Gamer Razer 6400 DPI DeathAdder Essential" -> "razer deathadder essential"
export function nomeCanonico(title, categoriaKey) {
  let t = ascii(title).replace(/[^a-z0-9%\s]+/g, " ");
  t = t.replace(ANO, " ").replace(SPEC_NUM, " ").replace(RUIDO, " ");
  const cat = categoriaKey || detectCategory(title);
  const label = PRODUCT_CATEGORIES[cat]?.label;
  if (label) {
    const base = ascii(label).split(" ")[0];
    if (base) t = t.replace(new RegExp(`\\b${base}s?\\b`, "g"), " ");
  }
  return t.replace(/\s+/g, " ").trim();
}

// Dice sobre conjunto de tokens: robusto a ordem e a palavra extra, que e
// exatamente como titulos do mesmo produto variam entre anuncios.
export function tokenSimilarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// ---------------------------------------------------------------------------
// Identidade
// ---------------------------------------------------------------------------

export function productFingerprint(p) {
  const title = String(p?.raw_title || p?.title || "");
  const categoria = detectCategory(title);
  return {
    title,
    categoria,
    brand: ascii(detectBrand(title)),
    model: ascii(detectModel(title)),
    specs: specDimensions(title),
    canonico: nomeCanonico(title, categoria),
    catalogo: catalogIds(p),
    url: urlKey(p),
    img: imageKey(p),
  };
}

// Devolve { same: boolean, motivo: string }.
export function compareProducts(a, b) {
  const fa = a?.__fp || productFingerprint(a);
  const fb = b?.__fp || productFingerprint(b);

  if (fa.catalogo.some((id) => fb.catalogo.includes(id))) {
    return { same: true, motivo: "mesmo id de catalogo/anuncio" };
  }
  if (fa.url && fa.url === fb.url) {
    return { same: true, motivo: "mesma URL canonica" };
  }

  // Categoria diferente (mouse vs teclado) nunca e o mesmo produto, mesmo que
  // o nome compartilhe marca/modelo/tokens — "Logitech G Pro" existe como
  // mouse E como headset, sao produtos distintos.
  if (fa.categoria && fb.categoria && fa.categoria !== fb.categoria) {
    return { same: false, motivo: `categorias diferentes (${fa.categoria} vs ${fb.categoria})` };
  }

  const conflito = specsConflitam(fa.specs, fb.specs);

  if (fa.img && fa.img === fb.img) {
    // Imagem identica e sinal forte, mas nao vence spec divergente: loja
    // preguicosa reusa a foto do modelo base em variantes diferentes.
    if (!conflito) return { same: true, motivo: "mesma imagem de produto" };
  }

  if (conflito) return { same: false, motivo: "specs divergentes" };

  if (fa.brand && fa.brand === fb.brand && fa.model && fa.model === fb.model) {
    return { same: true, motivo: `mesma marca+modelo (${fa.brand} ${fa.model})` };
  }
  // Marcas conhecidas e diferentes -> produtos diferentes, sem discussao.
  if (fa.brand && fb.brand && fa.brand !== fb.brand) {
    return { same: false, motivo: "marcas diferentes" };
  }
  if (fa.model && fb.model && fa.model !== fb.model) {
    return { same: false, motivo: "modelos diferentes" };
  }

  const sim = tokenSimilarity(fa.canonico, fb.canonico);
  if (sim >= SIMILARIDADE_MINIMA) {
    return { same: true, motivo: `nome equivalente (${sim.toFixed(2)})` };
  }
  return { same: false, motivo: `nomes distintos (${sim.toFixed(2)})` };
}

export function isSameProduct(a, b) {
  return compareProducts(a, b).same;
}

// ---------------------------------------------------------------------------
// Agrupamento
// ---------------------------------------------------------------------------

function temAfiliado(p) {
  if (String(p?.affiliate_link || "").trim()) return true;
  return Object.values(p?.offers || {}).some((o) => String(o?.affiliate_link || "").trim());
}

// Quem representa o grupo: quem tem link de afiliado, depois quem tem mais
// avaliacoes, depois melhor nota, depois o mais barato.
function melhorQue(a, b) {
  const af = Number(temAfiliado(a)) - Number(temAfiliado(b));
  if (af !== 0) return af > 0;
  const rc = (Number(a?.ratingCount) || 0) - (Number(b?.ratingCount) || 0);
  if (rc !== 0) return rc > 0;
  const r = (Number(a?.rating) || 0) - (Number(b?.rating) || 0);
  if (r !== 0) return r > 0;
  const pa = Number(a?.price) || Infinity;
  const pb = Number(b?.price) || Infinity;
  return pa < pb;
}

// Funde o perdedor no vencedor: ofertas de outras lojas, imagens e metricas de
// avaliacao que so uma das fontes trouxe. Assim "o mesmo produto em duas lojas"
// vira UM item com dois botoes, em vez de duas posicões da lista.
function mesclar(alvo, extra) {
  alvo.offers = { ...(extra.offers || {}), ...(alvo.offers || {}) };
  if (!alvo.affiliate_link && extra.affiliate_link) alvo.affiliate_link = extra.affiliate_link;
  if (!alvo.thumbnail && extra.thumbnail) alvo.thumbnail = extra.thumbnail;
  const imgs = new Set([...(alvo.images || []), ...(extra.images || [])].filter(Boolean));
  if (imgs.size) alvo.images = [...imgs];
  if (!(Number(alvo.rating) > 0) && Number(extra.rating) > 0) {
    alvo.rating = extra.rating;
    alvo.ratingCount = extra.ratingCount;
  } else if (Number(extra.ratingCount) > (Number(alvo.ratingCount) || 0) && Number(extra.rating) > 0) {
    alvo.rating = extra.rating;
    alvo.ratingCount = extra.ratingCount;
  }
  if (!(Number(alvo.price) > 0) && Number(extra.price) > 0) alvo.price = extra.price;
  alvo.duplicatas = [...(alvo.duplicatas || []), String(extra.raw_title || extra.title || "")];
  return alvo;
}

// Agrupa e devolve { items, removidos: [{ mantido, descartado, motivo }] }.
export function dedupeProducts(products, { onDuplicate } = {}) {
  const lista = (Array.isArray(products) ? products : []).filter((p) => p && typeof p === "object");
  const grupos = [];
  const removidos = [];

  for (const p of lista) {
    p.__fp = productFingerprint(p);
    let alvo = null;
    let motivo = "";
    for (const g of grupos) {
      const r = compareProducts(g, p);
      if (r.same) { alvo = g; motivo = r.motivo; break; }
    }
    if (!alvo) { grupos.push(p); continue; }

    const idx = grupos.indexOf(alvo);
    const vencedor = melhorQue(p, alvo) ? p : alvo;
    const perdedor = vencedor === p ? alvo : p;
    mesclar(vencedor, perdedor);
    vencedor.__fp = productFingerprint(vencedor);
    grupos[idx] = vencedor;
    removidos.push({
      mantido: String(vencedor.raw_title || vencedor.title || ""),
      descartado: String(perdedor.raw_title || perdedor.title || ""),
      motivo,
    });
    if (typeof onDuplicate === "function") onDuplicate(removidos[removidos.length - 1]);
  }

  for (const g of grupos) delete g.__fp;
  return { items: grupos, removidos };
}

// Ja existe algum produto equivalente na lista? Usado no laco de coleta, antes
// de gastar chamada de imagem/afiliado com um item que seria descartado.
export function jaSelecionado(lista, candidato) {
  return (Array.isArray(lista) ? lista : []).some((p) => isSameProduct(p, candidato));
}
