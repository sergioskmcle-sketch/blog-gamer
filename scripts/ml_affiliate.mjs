import fs from "fs";

const ML_BASE = "https://www.mercadolivre.com.br";
const API_BASE = "https://api.mercadolibre.com";
const CREATE_LINK = "/affiliate-program/api/v2/affiliates/createLink";
const STRIPE_LINK = "/affiliate-program/api/v2/stripe/user/links";

function loadCookies(cookiePath) {
  const raw = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
  const map = {};
  for (const c of raw) {
    if (typeof c === "object" && c.name && c.domain?.includes("mercadolivre")) {
      map[c.name] = c.value;
    }
  }
  return map;
}

function makeCookieStr(cookieMap) {
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
}

function extractCSRF(html) {
  let m = html.match(/"csrf_token":"([^"]+)"/);
  if (m) return m[1];
  m = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/);
  return m?.[1] || null;
}

function log(level, msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [${level}] [ML] ${msg}`);
}

export async function getMLToken(clientId, clientSecret) {
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });
  if (!res.ok) throw new Error(`ML token: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function searchML(query, clientId, clientSecret, tavilyKey, cookiePath, limit = 4) {
  log("INFO", `Buscando produtos ML para "${query}"`);

  const token = await getMLToken(clientId, clientSecret);

  if (!tavilyKey) {
    log("WARN", "TAVILY_API_KEY nao definida — pulando busca de produtos ML");
    return [];
  }

  const searchRes = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `${query} site:mercadolivre.com.br`,
      search_depth: "basic",
      max_results: Math.min(limit, 10),
    }),
  });
  if (!searchRes.ok) {
    log("WARN", `Tavily ML search: ${searchRes.status}`);
    return [];
  }
  const searchData = await searchRes.json();
  log("INFO", `Tavily ML: ${searchData.results?.length || 0} resultados`);

  const products = [];
  const seen = new Set();

  for (const result of searchData.results || []) {
    if (products.length >= limit) break;

    const m = result.url.match(/\/p\/(MLB\d+)/);
    if (!m) continue;
    const pid = m[1];
    if (seen.has(pid)) continue;
    seen.add(pid);

    try {
      const r = await fetch(`${API_BASE}/products/${pid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        log("WARN", `Products API ${pid}: ${r.status}`);
        continue;
      }
      const data = await r.json();

      const title = data.name || data.title || "";
      const image = data.pictures?.[0]?.url || data.pictures?.[0]?.secure_url || "";
      const permalink = data.permalink
        ? `${ML_BASE}${data.permalink}`
        : `${ML_BASE}/p/${pid}`;

      let price = 0;
      try {
        const itemsR = await fetch(`${API_BASE}/products/${pid}/items`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (itemsR.ok) {
          const itemsData = await itemsR.json();
          const first = itemsData.results?.[0];
          if (first) {
            price = first.price || first.sale_price?.value || first.base_price || 0;
          }
        }
      } catch {
        log("WARN", `Items API ${pid}: erro`);
      }

      if (!title) continue;

      products.push({
        id: pid, title, price, thumbnail: image,
        original_price: 0, permalink, images: [image],
      });
    } catch (e) {
      log("WARN", `Erro ao buscar ${pid}: ${e.message}`);
    }
  }

  log("INFO", `ML search: ${products.length} produtos encontrados`);

  if (products.length === 0) {
    log("WARN", "Nenhum produto encontrado no ML — artigo seguira sem produtos");
    return [];
  }

  return products.slice(0, limit);
}

export async function generateAffiliateLink(productUrl, cookiePath) {
  if (!cookiePath || !fs.existsSync(cookiePath)) {
    return { shortcut: productUrl };
  }

  const cookieMap = loadCookies(cookiePath);
  const cookieStr = makeCookieStr(cookieMap);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    Cookie: cookieStr,
  };

  const res = await fetch(productUrl, { headers });
  let csrf = extractCSRF(await res.text());
  if (!csrf) {
    const r2 = await fetch(ML_BASE, { headers });
    csrf = extractCSRF(await r2.text());
  }
  if (!csrf) csrf = cookieMap._csrf || "";
  if (!csrf) {
    log("WARN", "CSRF token nao encontrado — usando link direto");
    return { short_url: productUrl };
  }

  const apiHeaders = {
    ...headers,
    "Content-Type": "application/json",
    "x-csrf-token": csrf,
    Origin: ML_BASE, Referer: productUrl, Accept: "application/json",
  };

  try {
    const r2 = await fetch(ML_BASE + CREATE_LINK, {
      method: "POST", headers: apiHeaders,
      body: JSON.stringify({ urls: [productUrl], tag: "sergioskm" }),
    });
    if (r2.ok) {
      const d = await r2.json();
      return { ...d, short_url: d.short_url || d.shortcut || d.link || productUrl };
    }

    const r3 = await fetch(ML_BASE + STRIPE_LINK, {
      method: "POST", headers: apiHeaders,
      body: JSON.stringify({ url: productUrl, tag: "sergioskm" }),
    });
    if (r3.ok) {
      const d = await r3.json();
      return { ...d, short_url: d.short_url || d.shortcut || d.link || d.url || productUrl };
    }

    log("WARN", `Affiliate API: ${r2.status}`);

    return { short_url: productUrl };
  } catch (e) {
    log("WARN", `Affiliate error: ${e.message}`);
    return { short_url: productUrl };
  }
}
