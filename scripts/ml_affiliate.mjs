import fs from "fs";
import { CookieJar } from "tough-cookie";
import { detectBrand } from "./product_naming.mjs";

const ML_BASE = "https://www.mercadolivre.com.br";
const API_BASE = "https://api.mercadolibre.com";
const CREATE_LINK = "/affiliate-program/api/v2/affiliates/createLink";
const STRIPE_LINK = "/affiliate-program/api/v2/stripe/user/links";
const AFFILIATE_TAG = process.env.ML_AFFILIATE_TAG || "sergioskm";
export const SESSION_HEADERS = {
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ML token: ${res.status} — ${body.slice(0, 200)}`);
  }
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

export function extractMLProductData(html, url) {
  const title = (html.match(/<title>([^<]+)/)?.[1] || "")
    .replace(/\s*\|\s*Mercado\s*Livre.*$/i, "")
    .replace(/\s*\|\s*Mercado\s*L(i|í)vre.*$/i, "")
    .replace(/\s*\|\s*Shopee\s*Brasil.*$/i, "")
    .replace(/\s*\|\s*Shopee.*$/i, "")
    .replace(/\s*\|\s*Amazon.*$/i, "")
    .replace(/\s*\|\s*Magazine\s*Luiza.*$/i, "")
    .replace(/\s*\|\s*Kabum!?.*$/i, "")
    .trim();

  const ogImg = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] || "";
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] || url;

  let price = 0;
  const priceMeta = html.match(/<meta[^>]+itemprop="price"[^>]+content="([^"]+)"/);
  if (priceMeta) price = parseFloat(priceMeta[1]) || 0;
  if (!price) {
    const jsonScript = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonScript) {
      try {
        const ld = JSON.parse(jsonScript[1]);
        const offers = ld.offers || ld.mainEntity?.offers || {};
        const p = offers.price || offers.lowPrice || ld.price;
        if (p) price = parseFloat(p) || 0;
      } catch {}
    }
  }
  if (!price) {
    const priceTag = html.match(/R\$\s*([\d.]+,\d{2})/);
    if (priceTag) price = parseFloat(priceTag[1].replace(".", "").replace(",", ".")) || 0;
  }

  let permalink = canonical;
  if (!permalink.startsWith("http")) permalink = ML_BASE + permalink;
  let pid = (permalink.match(/(MLB\d{8,})/) || [])[1] || "";

  // Paginas com URL SEO (sem id no path) carregam o id em og:url / JSON-LD.
  if (!pid) {
    const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/)?.[1] || "";
    pid = (ogUrl.match(/(MLB\d{8,})/) || [])[1] || "";
  }
  if (!pid) {
    const jsonScript = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonScript) {
      try {
        const ld = JSON.parse(jsonScript[1]);
        const ldUrl = String(ld.url || ld.mainEntity?.url || ld.itemListElement?.[0]?.url || "");
        pid = (ldUrl.match(/(MLB\d{8,})/) || [])[1] || "";
      } catch {}
    }
  }
  if (!pid) {
    const bodyPid = html.match(/(?:MLB-(\d{8,})|\/p\/(MLB\d{8,}))/);
    if (bodyPid) pid = bodyPid[1] || bodyPid[2] || "";
  }

  // --- Dados ricos (marca, descricao, specs) para o enriquecimento de detalhe.
  // Nunca lançam: ausencia vira campo vazio, e quem consome decide se usa.
  let ld = null;
  const jsonScript = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (jsonScript) {
    try {
      ld = JSON.parse(jsonScript[1]);
    } catch {}
  }
  const mainEntity = ld && ld.mainEntity && typeof ld.mainEntity === "object" ? ld.mainEntity : (ld || {});

  const brandMeta = html.match(/<meta[^>]+itemprop="brand"[^>]+content="([^"]+)"/)?.[1] || "";
  const brand = String(
    mainEntity.brand?.name || mainEntity.manufacturer?.name || brandMeta || detectBrand(title) || ""
  ).trim();

  const description = String(
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)?.[1]
    || html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1]
    || mainEntity.description || ""
  ).trim();

  const specs = [];
  if (Array.isArray(mainEntity.additionalProperty)) {
    for (const ap of mainEntity.additionalProperty) {
      if (!ap || typeof ap !== "object") continue;
      const key = String(ap.name || ap.propertyID || "").trim();
      const value = String(ap.value ?? "").trim();
      if (key && value) specs.push({ key, value });
    }
  }

  return { title, price, thumbnail: ogImg, permalink, id: pid, brand, description, specs };
}

// URLs que NAO sao paginas de produto real: blog, categoria, listagem,
// verificacao de conta, ofertas, variantes de vendedor (/up/).
function isProductPageUrl(url) {
  const u = String(url || "").toLowerCase();
  if (!u.includes("mercadolivre")) return false;
  if (/\/blog\//.test(u)) return false;
  if (u.includes("lista.mercadolivre")) return false;
  if (/\/c\/|\/gz\/|\/ofertas|\/publica|\/mais-vendidos|\/up\b\/?/.test(u)) return false;
  return true;
}

export async function searchMLviaGoogle(query, cookiePath, tavilyKey, limit = 4) {
  log("INFO", `Buscando produtos ML via Google para "${query}"`);

  if (!tavilyKey) {
    log("WARN", "TAVILY_API_KEY nao definida — pulando busca");
    return [];
  }

  const allResults = [];

  for (const tavilyQuery of [
    `${query} Mercado Livre preço`,
    `${query} site:mercadolivre.com.br`,
  ]) {
    if (allResults.length >= limit) break;
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: tavilyQuery,
          search_depth: "advanced",
          max_results: 6,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        log("WARN", `Tavily ${res.status} para "${tavilyQuery.slice(0, 50)}": ${errText.slice(0, 100)}`);
        continue;
      }
      const data = await res.json();
      for (const r of data.results || []) {
        if (!r.url.includes("mercadolivre.com.br")) continue;
        if (allResults.find((a) => a.url === r.url)) continue;
        allResults.push(r);
      }
    } catch (e) {
      log("WARN", `Tavily Google "${tavilyQuery.slice(0, 50)}": ${e.message}`);
    }
  }

  log("INFO", `ML via Google: ${allResults.length} URLs encontrados`);

  const products = [];
  const seen = new Set();

  for (const result of allResults) {
    if (products.length >= limit) break;
    if (seen.has(result.url)) continue;
    seen.add(result.url);

    // So pagina de produto real (blog/categoria/listagem/variante sao ignorados).
    if (!isProductPageUrl(result.url)) {
      log("INFO", `Ignorando URL nao-produto: ${result.url.slice(0, 70)}`);
      continue;
    }

    try {
      log("INFO", `Visitando: ${result.url.slice(0, 80)}`);
      const pageRes = await fetch(result.url, {
        headers: SESSION_HEADERS,
        redirect: "follow",
      });
      if (!pageRes.ok) continue;
      const html = await pageRes.text();

      const productData = extractMLProductData(html, result.url);
      if (!productData.title) continue;
      // Artigo de blog pode citar MLB ids de widget embutido; o id no canonical
      // ou na propria URL e o sinal confiavel de pagina de produto.
      if (!productData.id) {
        log("INFO", `Sem MLB id (provavel artigo/blog): ${result.url.slice(0, 70)}`);
        continue;
      }

      products.push({
        id: productData.id,
        title: productData.title,
        price: productData.price,
        thumbnail: productData.thumbnail,
        permalink: productData.permalink,
        original_price: 0,
        images: [productData.thumbnail],
      });

      log("INFO", `  → ${productData.title.slice(0, 50)} — R$ ${productData.price.toFixed(2)}`);
    } catch (e) {
      log("WARN", `Erro scraping ${result.url.slice(0, 60)}: ${e.message}`);
    }
  }

  log("INFO", `ML via Google: ${products.length} produtos extraídos`);
  return products;
}

export async function searchMLDirect(query, clientId, clientSecret, limit = 4) {
  log("INFO", `Buscando ML via API direta para "${query}"`);
  try {
    // Try with auth first if credentials available
    let token = null;
    if (clientId && clientSecret) {
      try { token = await getMLToken(clientId, clientSecret); }
      catch { log("WARN", "ML token invalido — tentando sem auth"); }
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const searchRes = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit * 3}`,
      { headers }
    );
    if (!searchRes.ok) {
      log("WARN", `ML search API: ${searchRes.status}`);
      return [];
    }
    const data = await searchRes.json();
    const products = [];
    for (const r of data.results || []) {
      if (products.length >= limit) break;
      const pid = r.id;
      if (!pid) continue;
      const title = r.title || "";
      if (!title) continue;
      const price = r.price || 0;
      if (!price) continue;
      products.push({
        id: pid, title, price,
        thumbnail: r.thumbnail || "",
        original_price: r.original_price || 0,
        permalink: r.permalink || "",
        images: [r.thumbnail || ""],
      });
      log("INFO", `  ML direct: ${title.slice(0, 50)} — R$ ${price.toFixed(2)}`);
    }
    log("INFO", `ML direct: ${products.length} produtos`);
    return products;
  } catch (e) {
    log("WARN", `ML direct search error: ${e.message}`);
    return [];
  }
}

// Toda falha aqui devolve short_url: null + error, NUNCA o link cru do
// produto. Um link sem tag de afiliado silenciosamente vira R$0 de comissao,
// e antes disso passava despercebido porque o botao renderizava normal —
// quem chama esta funcao decide o que fazer com a falha (descartar o
// produto, tentar de novo, abortar o artigo), mas tem que SABER que falhou.
export async function generateAffiliateLink(productUrl, cookiePath) {
  if (!cookiePath || !fs.existsSync(cookiePath)) {
    log("ERROR", `generateAffiliateLink: cookiePath ausente/invalido para ${productUrl}`);
    return { short_url: null, error: "cookiePath ausente ou invalido" };
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
    log("ERROR", `CSRF token nao encontrado para ${productUrl} — link de afiliado NAO gerado`);
    return { short_url: null, error: "CSRF token nao encontrado" };
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
      body: JSON.stringify({ urls: [affiliateUrl], tag: AFFILIATE_TAG }),
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
      body: JSON.stringify({ url: affiliateUrl, tag: AFFILIATE_TAG }),
    });

    if (r3.ok) {
      const d = await r3.json();
      const shortUrl = d.data?.[0]?.short_url || d.short_url || d.shortcut || d.link || d.url || affiliateUrl;
      log("INFO", `Link afiliado criado (stripe): ${shortUrl}`);
      return { ...d, short_url: shortUrl };
    }

    log("ERROR", `Affiliate API falhou (${r2.status}) para ${productUrl} — link de afiliado NAO gerado`);
    return { short_url: null, error: `Affiliate API HTTP ${r2.status}` };
  } catch (e) {
    log("ERROR", `Affiliate error para ${productUrl}: ${e.message}`);
    return { short_url: null, error: e.message };
  }
}
