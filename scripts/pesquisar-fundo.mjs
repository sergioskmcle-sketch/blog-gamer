// Pesquisa em profundidade (3 niveis) para o gerador de artigos.
//   basico   - 1 query Tavily, 5 fontes, snippet 450 chars (comportamento atual)
//   medio    - sub-queries via LLM + dedupe por dominio + mais contexto por fonte
//   profundo - medio + extracao de conteudo integral + sintese com modelo de razao
// Nunca lanca: qualquer falha rebaixa para o nivel basico.
import fs from "fs";
import path from "path";

const TAVILY_URL = "https://api.tavily.com/search";

const NIVEL_DEFAULT = "basico";

function nivelParaCategoria(categoria = "") {
  const c = String(categoria || "").toLowerCase();
  if (c === "guia" || c === "review") return "profundo";
  if (c === "noticia" || c === "lista" || c === "promocao") return "medio";
  return NIVEL_DEFAULT;
}

function log(level, msg) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${ts}] [${level}] ${msg}`);
}

function dominioDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extrairJson(texto) {
  const t = String(texto || "").trim();
  let m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const alvo = m ? m[1] : t;
  try {
    const val = JSON.parse(alvo);
    if (Array.isArray(val)) return val;
    return val;
  } catch {}
  const abertura = alvo.indexOf("[");
  const fim = alvo.lastIndexOf("]");
  if (abertura !== -1 && fim > abertura) {
    try {
      return JSON.parse(alvo.slice(abertura, fim + 1));
    } catch {}
  }
  return null;
}

function normalizarQuery(q) {
  return String(q || "").trim().replace(/\s+/g, " ");
}

async function tavilySearch(tavilyKey, query, { maxResults = 5, includeRaw = false } = {}) {
  if (!tavilyKey) return null;
  const body = {
    api_key: tavilyKey,
    query: normalizarQuery(query),
    search_depth: "advanced",
    max_results: maxResults,
    topic: "news",
    include_answer: true,
    time_range: "month",
  };
  if (includeRaw) body.include_raw_content = true;
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily ${res.status}: ${String(err).slice(0, 200)}`);
  }
  return res.json();
}

// Reserva da Tavily (plano D): se a Tavily cair ou estourar a cota, usa o Serper
// (Google) que ja existe no projeto. Devolve no mesmo formato { results: [...] }.
async function serperSearch(query, { maxResults = 5 } = {}) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify({ q: normalizarQuery(query), gl: "br", hl: "pt-br", num: maxResults }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();
  const organic = Array.isArray(data.organic) ? data.organic : [];
  return {
    results: organic.map((o) => ({
      title: String(o.title || "").trim(),
      url: String(o.link || "").trim(),
      content: String(o.snippet || "").trim(),
    })),
  };
}

async function buscarComReserva(tavilyKey, query, opts = {}) {
  try {
    return await tavilySearch(tavilyKey, query, opts);
  } catch (e) {
    log("WARN", `Tavily falhou (${e.message}) — tentando Serper como reserva...`);
    const res = await serperSearch(query, opts);
    if (res && res.results?.length) {
      log("INFO", `Serper (reserva): ${res.results.length} resultados`);
      return res;
    }
    throw e;
  }
}

function fonteDeResultado(r, includeRaw = false) {
  const content = (includeRaw ? r.raw_content || r.content : r.content) || "";
  return {
    title: String(r.title || "").trim(),
    url: String(r.url || "").trim(),
    domain: dominioDe(r.url || ""),
    content: String(content).trim(),
  };
}

function mergearFontes(listas, limite = 8) {
  const seen = new Set();
  const out = [];
  for (const fonte of listas.flat()) {
    if (!fonte.url || !fonte.title) continue;
    const chave = fonte.domain + "|" + fonte.title.toLowerCase().slice(0, 60);
    if (seen.has(chave)) continue;
    seen.add(chave);
    out.push(fonte);
    if (out.length >= limite) break;
  }
  return out;
}

async function planejarSubQueries({ query, fetchLLM }) {
  if (!fetchLLM) return [query];
  const sys = "Voce e o analista de pesquisa do blog gamer Promo Gamer. Dado um tema, gere de 3 a 5 queries de busca especificas, em portugues do Brasil, que juntas cubram os angulos relevantes (noticias recentes, precos, reviews/opinioes, datas de lancamento). Responda APENAS com um array JSON de strings, sem explicacao.";
  const user = `Tema: ${query}`;
  try {
    const out = await fetchLLM(sys, user, 2, { maxTokens: 500, temperature: 0.3 });
    const arr = extrairJson(out);
    if (!Array.isArray(arr)) return [query];
    const queries = arr.map(normalizarQuery).filter((q) => q && q.length >= 5);
    return queries.length > 0 ? queries.slice(0, 5) : [query];
  } catch (e) {
    log("WARN", `Planejamento de sub-queries falhou: ${e.message}`);
    return [query];
  }
}

async function sintetizarFatos({ query, fontes, fetchLLM }) {
  if (!fetchLLM) return [];
  const corpo = fontes
    .slice(0, 6)
    .map((f, i) => `[Fonte ${i + 1}] ${f.title}\nURL: ${f.url}\n${f.content.slice(0, 3000)}`)
    .join("\n\n");
  const sys = "Voce e o pesquisador senior do blog gamer Promo Gamer. Abaixo estao fontes sobre o tema. Extraia de 3 a 10 fatos concretos e verificaveis (dados, datas, precos, specs, citacoes) que devam aparecer no artigo, cada um com a fonte que o sustenta. Responda APENAS com JSON: [{\"fato\":\"...\",\"fonte\":\"nome do site\",\"url\":\"...\",\"confianca\":\"alta|media|baixa\"}]. Nao invente fatos nem URLs que nao estejam nas fontes.";
  const user = `Tema: ${query}\n\n${corpo}`;
  try {
    const out = await fetchLLM(sys, user, 2, { maxTokens: 2000, temperature: 0.2 });
    const arr = extrairJson(out);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((f) => ({
        fato: String(f.fato || "").trim().slice(0, 400),
        fonte: String(f.fonte || "").trim().slice(0, 120),
        url: String(f.url || "").trim(),
        confianca: ["alta", "media", "baixa"].includes(String(f.confianca)) ? String(f.confianca) : "media",
      }))
      .filter((f) => f.fato && f.url);
  } catch (e) {
    log("WARN", `Sintese de fatos falhou: ${e.message}`);
    return [];
  }
}

function montarContexto(fontes, charsPorFonte) {
  return fontes
    .map((f, i) => `[Fonte ${i + 1}] ${f.title}\nURL: ${f.url}\n${f.content.slice(0, charsPorFonte)}`)
    .join("\n\n");
}

function computarCobertura(fontes, verifiedFacts) {
  const dominios = new Set(fontes.map((f) => f.domain).filter(Boolean));
  const dominiosReconhecidos = new Set([
    "ign.com", "rtings.com", "tecmundo.com.br", "gamespot.com", "purexbox.com",
    "pushsquare.com", "adrenaline.com.br", "gematsu.com", "games.gg", "trueachievements.com",
    "gamerant.com", "chipart.com.br", "olhardigital.com.br", "vzone.com.br", "exame.com",
    "tecnoblog.com.br", "gamersgate.com", "gamerant.com",
  ]);
  const reconhecidas = [...dominios].filter((d) => dominiosReconhecidos.has(d)).length;
  return {
    totalFontes: fontes.length,
    dominiosUnicos: dominios.size,
    dominiosReconhecidos: reconhecidas,
    fontesSemUrl: fontes.filter((f) => !f.url).length,
    claims: verifiedFacts.length,
    claimsSemFonte: verifiedFacts.filter((f) => !f.url).length,
    claimsBaixaConfianca: verifiedFacts.filter((f) => f.confianca === "baixa").length,
  };
}

async function pesquisarBasico({ query, tavilyKey }) {
  const sr = await buscarComReserva(tavilyKey, query, { maxResults: 5 });
  const fontes = (sr?.results || []).map((r) => fonteDeResultado(r));
  return {
    researchContext: montarContexto(fontes, 450),
    researchSources: fontes,
    verifiedFacts: [],
    cobertura: computarCobertura(fontes, []),
    nivel: "basico",
    subQueries: [query],
  };
}

async function pesquisarMedio({ query, tavilyKey, fetchLLM }) {
  const subQueries = await planejarSubQueries({ query, fetchLLM });
  const listas = [];
  for (const sq of subQueries.slice(0, 5)) {
    try {
      const sr = await buscarComReserva(tavilyKey, sq, { maxResults: 4 });
      const fontes = (sr?.results || []).map((r) => fonteDeResultado(r, false));
      if (fontes.length > 0) listas.push(fontes);
      log("INFO", `Sub-query "${sq.slice(0, 45)}": ${fontes.length} fontes`);
    } catch (e) {
      log("WARN", `Sub-query "${sq.slice(0, 45)}" falhou: ${e.message}`);
    }
  }
  const fontes = mergearFontes(listas, 8);
  return {
    researchContext: montarContexto(fontes, 1200),
    researchSources: fontes,
    verifiedFacts: [],
    cobertura: computarCobertura(fontes, []),
    nivel: "medio",
    subQueries,
  };
}

async function pesquisarProfundo({ query, tavilyKey, fetchLLM }) {
  const subQueries = await planejarSubQueries({ query, fetchLLM });
  const listas = [];
  const listaRaw = [];
  for (const sq of subQueries.slice(0, 5)) {
    try {
      const incluirRaw = listaRaw.length < 3;
      const sr = await buscarComReserva(tavilyKey, sq, { maxResults: 4, includeRaw: incluirRaw });
      const fontes = (sr?.results || []).map((r) => fonteDeResultado(r, incluirRaw));
      if (fontes.length > 0) listas.push(fontes);
      if (incluirRaw) listaRaw.push(...fontes.filter((f) => f.content.length > 600));
      log("INFO", `Sub-query "${sq.slice(0, 45)}": ${fontes.length} fontes (raw ${incluirRaw})`);
    } catch (e) {
      log("WARN", `Sub-query "${sq.slice(0, 45)}" falhou: ${e.message}`);
    }
  }
  const fontes = mergearFontes(listas, 8);
  const fontesFull = mergearFontes([listaRaw], 3).length > 0 ? mergearFontes([listaRaw], 3) : fontes;
  const verifiedFacts = await sintetizarFatos({ query, fontes: fontesFull, fetchLLM });
  return {
    researchContext: montarContexto(fontes, 1200),
    researchSources: fontes,
    verifiedFacts,
    cobertura: computarCobertura(fontes, verifiedFacts),
    nivel: "profundo",
    subQueries,
  };
}

// API principal. Nunca lanca: com falha, rebaixa ao nivel basico (ou vazio).
export async function pesquisarFundo({ topic, query, categoria, tavilyKey, fetchLLM }) {
  const q = normalizarQuery(query || topic?.hint || "");
  const nivel = nivelParaCategoria(categoria);
  const nulo = {
    researchContext: "",
    researchSources: [],
    verifiedFacts: [],
    cobertura: computarCobertura([], []),
    nivel: "basico",
    subQueries: [q],
  };
  if (!q || !tavilyKey) return nulo;
  if (!nivelParaCategoria) {}
  log("INFO", `Pesquisa em profundidade (nivel ${nivel}) para: ${q.slice(0, 60)}`);
  try {
    if (nivel === "profundo") {
      try {
        return await pesquisarProfundo({ query: q, tavilyKey, fetchLLM });
      } catch (e) {
        log("WARN", `Pesquisa profunda falhou (${e.message}) — tentando medio`);
      }
    }
    if (nivel === "medio" || nivel === "profundo") {
      try {
        const res = await pesquisarMedio({ query: q, tavilyKey, fetchLLM });
        if (res.researchSources.length > 0) return res;
      } catch (e) {
        log("WARN", `Pesquisa media falhou (${e.message}) — rebaixando para basico`);
      }
    }
    const res = await pesquisarBasico({ query: q, tavilyKey });
    if (res.researchSources.length === 0) return nulo;
    return res;
  } catch (e) {
    log("WARN", `Pesquisa falhou (${e.message}) — artigo seguira sem fontes`);
    return nulo;
  }
}

// Leitor usado pelo medidor de cobertura e pela auto-melhoria.
export function lerCobertura(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf-8"));
  } catch {
    return null;
  }
}

// Caminho padrao do relatorio de cobertura de um artigo.
export function caminhoCobertura(slug) {
  const squadDir = path.resolve(
    "squads", "marketing", "conteudo-digital", "blog-gamer", "output", "cobertura"
  );
  return path.join(squadDir, `${slug}.json`);
}

export function gravarCobertura(slug, cobertura) {
  if (!cobertura) return;
  const fp = caminhoCobertura(slug);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(cobertura, null, 2), "utf-8");
}

export const NIVELES = { basico: "basico", medio: "medio", profundo: "profundo" };
export const _internals = { nivelParaCategoria, extrairJson, dominioDe, mergearFontes };
