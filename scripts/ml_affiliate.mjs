import fs from "fs";
import { CookieJar } from "tough-cookie";

const ML_BASE = "https://www.mercadolivre.com.br";
const API_BASE = "https://api.mercadolibre.com";
const CREATE_LINK = "/affiliate-program/api/v2/affiliates/createLink";
const STRIPE_LINK = "/affiliate-program/api/v2/stripe/user/links";
const SESSION_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

function log(level, msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [${level}] [ML] ${msg}`);
}

function extractCSRF(html) {
  let m = html.match(/"csrf_token":"([^"]+)"/);
  if (m) return m[1];
  m = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/);
  return m?.[1] || null;
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  return m?.[1] || null;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 120);
}

// Creates a CookieJar from a cookies.json file (browser export format)
function loadJar(cookiePath) {
  const raw = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
  const jar = new CookieJar();
  for (const c of raw) {
    if (!c.name || !c.value) continue;
    try {
      const domain = c.domain?.startsWith(".") ? c.domain.slice(1) : (c.domain || "www.mercadolivre.com.br");
      let cookieStr = `${c.name}=${c.value}`;
      if (c.domain?.startsWith(".")) cookieStr += `; Domain=${c.domain}`;
      jar.setCookieSync(cookieStr, `https://${domain}${c.path || "/"}`, {
        http: c.httpOnly || false,
        secure: c.secure || false,
      });
    } catch {}
  }
  return jar;
}

// fetch with session cookies: sends cookies from jar, captures Set-Cookie responses
async function fetchWithSession(url, jar, opts = {}) {
  const cookieStr = await jar.getCookieString(url);
  const headers = { ...SESSION_HEADERS, ...(opts.headers || {}), Cookie: cookieStr };

  const res = await fetch(url, { ...opts, headers });

  // Capture Set-Cookie headers from response
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    try {
      await jar.setCookie(sc, res.url);
    } catch {}
  }

  return res;
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
        : `${ML_BASE}/${slugify(title || pid)}/p/${pid}`;

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
    return { short_url: productUrl };
  }

  // 1. Create a persistent session (CookieJar) — like Python requests.Session()
  const jar = loadJar(cookiePath);
  let csrf = "";
  let canonicalUrl = "";

  // 2. Visit product URL first to get fresh CSRF + session cookies + canonical URL
  try {
    const prodRes = await fetchWithSession(productUrl, jar);
    const html = await prodRes.text();
    csrf = extractCSRF(html);

    // Extract canonical URL (full SEO-friendly URL) for affiliate API
    canonicalUrl = extractCanonical(html) || productUrl;

    log("INFO", `Produto visitado, CSRF: ${csrf ? "ok" : "nao encontrado"}, canonical: ${!!canonicalUrl}`);
  } catch (e) {
    log("WARN", `Erro ao visitar produto: ${e.message}`);
  }

  // Fallback: fetch ML homepage if product page didn't yield CSRF
  if (!csrf) {
    try {
      const homeRes = await fetchWithSession(ML_BASE, jar);
      const html = await homeRes.text();
      csrf = extractCSRF(html);
      log("INFO", `Homepage fallback, CSRF: ${csrf ? "ok" : "nao encontrado"}`);
    } catch (e) {
      log("WARN", `Erro ao buscar homepage: ${e.message}`);
    }
  }

  // 3. Fallback: CSRF from the original cookies
  if (!csrf) {
    try {
      const raw = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
      for (const c of raw) {
        if ((c.name === "_csrf" || c.name === "csrf_token") && c.value) {
          csrf = c.value;
          break;
        }
      }
    } catch {}
  }

  if (!csrf) {
    log("WARN", "CSRF token nao encontrado — usando link direto");
    return { short_url: productUrl };
  }

  // 4. Call affiliate API with the SAME session (shares cookies from jar)
  // Use canonical URL (full SEO-friendly) for affiliate API — /p/MLB... is rejected
  const affiliateUrl = canonicalUrl || productUrl;

  const apiHeaders = {
    "User-Agent": SESSION_HEADERS["User-Agent"],
    "Accept-Language": SESSION_HEADERS["Accept-Language"],
    "Content-Type": "application/json",
    "x-csrf-token": csrf,
    Origin: ML_BASE,
    Referer: productUrl,
    Accept: "application/json",
  };

  try {
    // Try createLink first
    const r2 = await fetchWithSession(ML_BASE + CREATE_LINK, jar, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ urls: [affiliateUrl], tag: "sergioskm" }),
    });

    if (r2.ok) {
      const d = await r2.json();
      const shortUrl = d.urls?.[0]?.short_url || d.short_url || d.shortcut || d.link || d.url || affiliateUrl;
      log("INFO", `Link afiliado criado: ${shortUrl}`);
      return { ...d, short_url: shortUrl };
    }

    // Fallback to stripe/user/links
    const r3 = await fetchWithSession(ML_BASE + STRIPE_LINK, jar, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ url: affiliateUrl, tag: "sergioskm" }),
    });

    if (r3.ok) {
      const d = await r3.json();
      const shortUrl = d.data?.[0]?.short_url || d.short_url || d.shortcut || d.link || d.url || affiliateUrl;
      log("INFO", `Link afiliado criado (stripe): ${shortUrl}`);
      return { ...d, short_url: shortUrl };
    }

    log("WARN", `Affiliate API: ${r2.status}`);
    return { short_url: productUrl };
  } catch (e) {
    log("WARN", `Affiliate error: ${e.message}`);
    return { short_url: productUrl };
  }
}
