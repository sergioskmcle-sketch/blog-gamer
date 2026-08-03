// Fonte de produtos: Google Shopping via Serper.dev (geo Brasil).
// Retorna produtos no mesmo shape esperado pelo pipeline:
// { id, title, price, original_price, thumbnail, permalink, images, source }

const SERPER_SHOPPING_URL = "https://google.serper.dev/shopping";

function log(level, msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [${level}] [SHOPPING] ${msg}`);
}

// "R$ 1.299,90" | "R$ 1299" | "1.299,90" -> 1299.9
export function parsePriceBRL(str) {
  if (str == null) return 0;
  const cleaned = String(str)
    .replace(/[Rr]\$\s*/g, "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!cleaned) return 0;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);
  if (lastSep === -1) return parseFloat(cleaned) || 0;
  let numeric = cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + cleaned.slice(lastSep + 1);
  numeric = numeric.replace(/\./, ".").replace(/,/g, "");
  return parseFloat(numeric) || 0;
}

function itemId(title, index) {
  const slug = title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 80);
  return slug || `shopping-${index}`;
}

export async function searchGoogleShopping(query, apiKey, limit = 5) {
  if (!apiKey) {
    log("WARN", "SERPER_API_KEY nao definida — pulando busca de produtos");
    return [];
  }
  if (!query) return [];

  log("INFO", `Buscando Google Shopping BR para "${query}"`);

  let data;
  try {
    const res = await fetch(SERPER_SHOPPING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: Math.min(limit, 10) }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      log("WARN", `Serper shopping: ${res.status} — ${errText.slice(0, 120)}`);
      return [];
    }
    data = await res.json();
  } catch (e) {
    log("WARN", `Serper shopping erro: ${e.message}`);
    return [];
  }

  const items = data.shopping || [];
  const products = [];
  const seen = new Set();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const title = String(it.title || "").trim();
    const link = String(it.link || "").trim();
    if (!title || !link) continue;
    const dedupeKey = it.productId || link;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    products.push({
      id: it.productId || itemId(title, i),
      title,
      price: parsePriceBRL(it.price),
      original_price: parsePriceBRL(it.oldPrice),
      thumbnail: it.imageUrl || "",
      permalink: link,
      images: it.imageUrl ? [it.imageUrl] : [],
      source: String(it.source || "").trim(),
      rating: it.rating || null,
    });
  }

  log("INFO", `Google Shopping: ${products.length} produtos para "${query}"`);
  return products.slice(0, limit);
}
