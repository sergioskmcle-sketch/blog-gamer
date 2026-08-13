// Candidatos de titulos para listas de games ("melhores jogos para PC {ano}").
// Consulta o Google (Serper) com reserva da Tavily e extrai via LLM os titulos
// que o mercado aponta como melhores/destaque do ano. O gerador usa essa lista
// para OBRIGAR a LLM a escolher os itens entre titulos reais (grounding), em vez
// de listar classicos antigos como "melhores de 2026".
import { ANO_ATUAL } from "./tempo.mjs";

const FONTES_CONFIAVEIS = [
  "ign.com", "gamespot.com", "pcgamer.com", "pcgamesn.com", "rockpapershotgun.com",
  "eurogamer.net", "kotaku.com", "gamerant.com", "gamesradar.com", "gematsu.com",
  "techtudo.com.br", "adrenaline.com.br", "tecmundo.com.br", "olhardigital.com.br",
  "metacritic.com",
];

function log(level, msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [${level}] [CANDIDATOS] ${msg}`);
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

function pesoFonte(url) {
  const host = hostOf(url);
  return FONTES_CONFIAVEIS.some((f) => host === f || host.endsWith(`.${f}`) || host.includes(f)) ? 2 : 1;
}

function queriesPara(ano) {
  return [
    `melhores jogos de pc ${ano}`,
    `melhores jogos pc ${ano} para jogar`,
    `melhores jogos de computador ${ano}`,
    `best pc games ${ano}`,
    `melhores jogos pc lancamento ${ano}`,
  ];
}

async function serper(q, key) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 10 }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();
  return (data.organic || []).map((o) => ({ url: o.link || "", texto: [o.title, o.snippet].filter(Boolean).join(" — ") }));
}

async function tavily(q, key) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: q, search_depth: "advanced", max_results: 5, include_answer: false }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({ url: r.url || "", texto: [r.title, r.content?.slice(0, 300)].filter(Boolean).join(" — ") }));
}

async function coletarTrechos(queries, { serperKey, tavilyKey }) {
  const trechos = [];
  if (serperKey) {
    for (const q of queries) {
      try {
        const r = await serper(q, serperKey);
        trechos.push(...r.map((t) => ({ ...t, peso: pesoFonte(t.url) })));
      } catch (e) {
        log("WARN", `Serper "${q}": ${e.message}`);
      }
    }
  }
  if (tavilyKey) {
    for (const q of queries) {
      try {
        const r = await tavily(q, tavilyKey);
        trechos.push(...r.map((t) => ({ ...t, peso: pesoFonte(t.url) })));
      } catch (e) {
        log("WARN", `Tavily "${q}": ${e.message}`);
      }
    }
  }
  return trechos;
}

function parseCandidatos(raw) {
  try {
    const clean = String(raw || "").replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => String(it?.titulo || it?.jogo || "").trim())
      .filter((t) => t && t.length >= 3);
  } catch {
    return [];
  }
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extrairCandidatos(trechos, { fetchLLM }) {
  if (trechos.length === 0 || typeof fetchLLM !== "function") return [];
  const corpus = trechos
    .slice(0, 40)
    .map((t, i) => `[${i + 1}] (${hostOf(t.url) || "fonte"}) ${t.texto}`)
    .join("\n");
  const sys = "Voce extrai nomes de JOGOS DE PC citados em trechos de rankings/reviews recentes. Devolva APENAS um array JSON, sem texto ao redor, no formato [{\"titulo\":\"Baldur's Gate 3\"}]. Regras: so jogos ESPECIFICOS (nunca genero nem categoria generica como \"jogos de pc\" ou \"rpg\"); no maximo 20 itens, sem repetir; prefira titulos lancados ou em destaque no ano dos trechos.";
  const user = `Trechos:\n${corpus}`;
  try {
    const out = await fetchLLM(sys, user, 2, { maxTokens: 1000, temperature: 0.2 });
    const titulos = parseCandidatos(out);
    const vistos = new Map();
    for (const t of titulos) {
      const n = norm(t);
      if (!n || vistos.has(n)) continue;
      const chave = n.split(" ").slice(0, 3).join(" ");
      const mencoes = trechos.reduce((soma, tr) => (tr.texto.toLowerCase().includes(chave) ? soma + tr.peso : soma), 0) || 1;
      const fontes = [...new Set(trechos.filter((tr) => tr.texto.toLowerCase().includes(chave)).map((tr) => hostOf(tr.url)).filter(Boolean))].slice(0, 3);
      vistos.set(n, { titulo: t, mencoes, fontes });
    }
    return [...vistos.values()].sort((a, b) => b.mencoes - a.mencoes);
  } catch (e) {
    log("WARN", `Extracao de candidatos falhou: ${e.message}`);
    return [];
  }
}

// API principal: devolve [{ titulo, mencoes, fontes }] ordenados por mencoes.
// Nunca lanca: com falha total, devolve [] (o artigo segue sem grounding).
export async function buildGamesCandidateList({ ano = ANO_ATUAL, serperKey, tavilyKey, fetchLLM }) {
  const queries = queriesPara(ano);
  const trechos = await coletarTrechos(queries, { serperKey, tavilyKey });
  log("INFO", `${trechos.length} trecho(s) coletado(s) para candidatos de jogos ${ano}`);
  const candidatos = await extrairCandidatos(trechos, { fetchLLM });
  log("INFO", `${candidatos.length} candidato(s) extraido(s) para a lista`);
  return candidatos;
}

export const _internals = { queriesPara, parseCandidatos, norm };
