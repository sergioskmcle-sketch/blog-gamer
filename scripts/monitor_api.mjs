// Cliente HTTP da Frente 4 (blog-produtos-api, na VM do monitor).
//
// REGRA DE OURO: este modulo NUNCA lanca excecao. Toda falha vira lista vazia
// + log. Se a VM estiver fora do ar, o artigo tem que sair mesmo assim, usando
// o Google Shopping como antes.

const BASE = (process.env.MONITOR_API_URL || "").replace(/\/+$/, "");
const KEY = process.env.MONITOR_API_KEY || "";
const TIMEOUT_MS = 25000;

function log(nivel, msg) {
  console.log(`[${nivel}] monitor_api: ${msg}`);
}

// Erros que nao adianta repetir: a resposta seria a mesma.
const SEM_RETRY = new Set([400, 401, 503]);

async function chamar(rota, corpo, tentativa = 1) {
  if (!BASE || !KEY) {
    log("WARN", "MONITOR_API_URL/MONITOR_API_KEY ausentes — usando fallback");
    return null;
  }
  try {
    const r = await fetch(`${BASE}${rota}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": KEY },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (r.ok) return await r.json();

    if (SEM_RETRY.has(r.status)) {
      log("WARN", `HTTP ${r.status} em ${rota} — sem retry, indo para fallback`);
      return null;
    }
    if (tentativa < 3) {
      const espera = tentativa * 2000;
      log("WARN", `HTTP ${r.status} em ${rota} — tentativa ${tentativa}, aguardando ${espera}ms`);
      await new Promise((s) => setTimeout(s, espera));
      return chamar(rota, corpo, tentativa + 1);
    }
    log("WARN", `HTTP ${r.status} em ${rota} — desistindo`);
    return null;
  } catch (e) {
    if (tentativa < 3) {
      await new Promise((s) => setTimeout(s, tentativa * 1000));
      return chamar(rota, corpo, tentativa + 1);
    }
    log("WARN", `${e.message} — desistindo, indo para fallback`);
    return null;
  }
}

// Valida e limpa um produto vindo da API. Devolve null se for inutilizavel.
export function normalizarProdutoRemoto(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim();
  if (!title) return null;

  const offers = {};
  for (const [loja, o] of Object.entries(raw.offers || {})) {
    if (!o || typeof o !== "object") continue;
    const link = String(o.affiliate_link || o.permalink || "").trim();
    if (!link) continue;
    offers[loja] = {
      permalink: String(o.permalink || link),
      affiliate_link: String(o.affiliate_link || ""),
      price: Number(o.price) || 0,
      item_id: String(o.item_id || ""),
    };
  }
  if (Object.keys(offers).length === 0) return null;

  const thumb = String(raw.thumbnail || "");
  return {
    id: String(raw.id || ""),
    title,
    price: Number(raw.price) || 0,
    original_price: Number(raw.original_price) || 0,
    thumbnail: thumb,
    images: Array.isArray(raw.images) && raw.images.length ? raw.images : (thumb ? [thumb] : []),
    permalink: String(raw.permalink || ""),
    source: String(raw.source || ""),
    sources: Object.keys(offers),
    affiliate_link: String(raw.affiliate_link || ""),
    offers,
    preco_de: String(raw.preco_de || ""),
    origem: String(raw.origem || "remoto"),
  };
}

export async function buscarProdutosRemoto(query, { limit = 5 } = {}) {
  const d = await chamar("/api/produtos/buscar", { query, limit });
  if (!d || !d.ok) return [];
  const produtos = (d.produtos || []).map(normalizarProdutoRemoto).filter(Boolean);
  log("INFO", `"${query}" -> ${produtos.length} produtos`);
  return produtos;
}

export async function buscarProdutosLoteRemoto(queries, { limitPorQuery = 3 } = {}) {
  const lote = (queries || []).filter(Boolean).slice(0, 5);
  if (lote.length === 0) return [];
  const d = await chamar("/api/produtos/buscar-lote",
                         { queries: lote, limit_por_query: limitPorQuery });
  if (!d || !d.ok) return [];

  const todos = [];
  const vistos = new Set();
  for (const r of d.resultados || []) {
    for (const bruto of r.produtos || []) {
      const p = normalizarProdutoRemoto(bruto);
      if (!p) continue;
      const chave = `${p.sources[0]}:${p.id}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      todos.push(p);
    }
  }
  log("INFO", `lote de ${lote.length} consultas -> ${todos.length} produtos`);
  return todos;
}

export async function avisarFaltantes(faltantes) {
  if (!faltantes || faltantes.length === 0) return false;
  const d = await chamar("/api/faltantes", { faltantes });
  return Boolean(d && d.avisado);
}
