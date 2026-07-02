const API_BASE = "https://api.mercadolibre.com";
const ML_BASE = "https://www.mercadolivre.com.br";

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

export async function searchML(query, clientId, clientSecret, tavilyKey, limit = 4) {
  log("INFO", `Buscando produtos ML para "${query}"`);

  if (!tavilyKey) {
    log("WARN", "TAVILY_API_KEY nao definida — pulando busca de produtos ML");
    return [];
  }

  // Try to get ML token, but don't fail if blocked
  let token = null;
  try {
    token = await getMLToken(clientId, clientSecret);
    log("INFO", "ML token obtido com sucesso");
  } catch (e) {
    log("WARN", `ML token indisponivel (API bloqueada?): ${e.message}. Usando fallback via Tavily.`);
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

    const productUrl = result.url.startsWith("http")
      ? result.url
      : `${ML_BASE}${result.url}`;

    // Try ML API for details; fallback to basic info from Tavily
    if (token) {
      try {
        const r = await fetch(`${API_BASE}/products/${pid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          log("WARN", `Products API ${pid}: ${r.status}`);
          token = null; // Token expired, skip API calls for rest
        } else {
          const data = await r.json();

          const title = data.name || data.title || result.title || "";
          const image = data.pictures?.[0]?.url || data.pictures?.[0]?.secure_url || "";
          const permalink = data.permalink
            ? `${ML_BASE}${data.permalink}`
            : productUrl;

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
          continue;
        }
      } catch (e) {
        log("WARN", `Erro ao buscar ${pid}: ${e.message}`);
        token = null;
      }
    }

    // Fallback: use Tavily result data directly
    const title = result.title || `Produto MLB${pid}`;
    products.push({
      id: pid,
      title,
      price: 0,
      thumbnail: "",
      original_price: 0,
      permalink: productUrl,
      images: [],
    });
  }

  log("INFO", `ML search: ${products.length} produtos encontrados`);

  if (products.length === 0) {
    log("WARN", "Nenhum produto encontrado no ML — artigo seguira sem produtos");
    return [];
  }

  return products.slice(0, limit);
}


