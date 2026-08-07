// Shortlist editorial: antes de buscar produto, descobre QUAIS modelos o
// mercado realmente recomenda. Sem isto o gerador buscava por palavra-chave
// generica ("mouse gamer") e aceitava os 5 primeiros resultados — nao importa
// se eram os modelos que reviews independentes de verdade indicam.
//
// Fluxo: consulta fontes confiaveis (Serper Search + Tavily) por "melhores
// {categoria} gamer {ano}", extrai os modelos citados via LLM, e devolve uma
// lista ordenada por confianca das fontes. O gerador usa esses nomes como
// query de produto — a busca passa a mirar modelo especifico, nao categoria
// generica.

const FONTES_CONFIAVEIS = [
  "techtudo.com.br", "adrenaline.com.br", "techinter.com.br", "tecnoblog.net",
  "canaltech.com.br", "olhardigital.com.br", "meupc.net", "oficinadanet.com.br",
  "rtings.com", "tomshardware.com", "pcgamer.com", "ign.com", "kabum.com.br/blog",
];

function log(level, msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [${level}] [SHORTLIST] ${msg}`);
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

function pesoFonte(url) {
  const host = hostOf(url);
  return FONTES_CONFIAVEIS.some((f) => host === f || host.endsWith(`.${f}`) || host.includes(f)) ? 2 : 1;
}

// Coleta trechos de review com a fonte (host) anexada — o LLM extrator precisa
// saber DE ONDE cada trecho vem para atribuir mencao por fonte.
async function coletarFontes(queries, { serperKey, tavilyKey }) {
  const trechos = [];

  if (serperKey) {
    for (const q of queries) {
      try {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
          body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: 10 }),
        });
        if (!res.ok) { log("WARN", `Serper "${q}": HTTP ${res.status}`); continue; }
        const data = await res.json();
        for (const o of data.organic || []) {
          const texto = [o.title, o.snippet].filter(Boolean).join(" — ");
          if (texto) trechos.push({ url: o.link || "", texto, peso: pesoFonte(o.link || "") });
        }
      } catch (e) {
        log("WARN", `Serper "${q}": ${e.message}`);
      }
    }
  }

  if (tavilyKey) {
    for (const q of queries) {
      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: tavilyKey, query: q, search_depth: "advanced", max_results: 5, include_answer: false }),
        });
        if (!res.ok) { log("WARN", `Tavily "${q}": HTTP ${res.status}`); continue; }
        const data = await res.json();
        for (const r of data.results || []) {
          const texto = [r.title, r.content?.slice(0, 300)].filter(Boolean).join(" — ");
          if (texto) trechos.push({ url: r.url || "", texto, peso: pesoFonte(r.url || "") });
        }
      } catch (e) {
        log("WARN", `Tavily "${q}": ${e.message}`);
      }
    }
  }

  return trechos;
}

function parseModelosLLM(raw) {
  try {
    const clean = String(raw || "").replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => ({
        marca: String(it?.marca || "").trim(),
        modelo: String(it?.modelo || "").trim(),
      }))
      .filter((it) => it.marca && it.modelo);
  } catch {
    return [];
  }
}

// Extrai { marca, modelo, mencoes } dos trechos coletados, via 1 chamada LLM.
// fetchLLM e injetado (evita import circular com gerar-artigo.mjs).
async function extrairModelos(trechos, { categoria, fetchLLM }) {
  if (trechos.length === 0 || typeof fetchLLM !== "function") return [];

  const corpus = trechos
    .slice(0, 40)
    .map((t, i) => `[${i + 1}] (${hostOf(t.url) || "fonte desconhecida"}) ${t.texto}`)
    .join("\n");

  const sys = `Voce extrai nomes de produtos citados em trechos de reviews e rankings sobre "${categoria}". Devolva APENAS um array JSON, sem texto ao redor, no formato:\n[{"marca":"Logitech","modelo":"G Pro X Superlight 2"},{"marca":"Razer","modelo":"DeathAdder V3 Pro"}]\nRegras: so modelos ESPECIFICOS (marca+modelo/geracao), nunca categoria generica ("mouse gamer" nao e um modelo). Maximo 15 itens, sem repetir o mesmo modelo.`;
  const user = `Trechos:\n${corpus}`;

  try {
    const out = await fetchLLM(sys, user, 2, { maxTokens: 800, temperature: 0.2 });
    const modelos = parseModelosLLM(out);
    // Conta mencoes ponderadas por confiabilidade da fonte.
    for (const m of modelos) {
      const alvo = `${m.marca} ${m.modelo}`.toLowerCase();
      m.mencoes = trechos.reduce((soma, t) => {
        const modeloNorm = m.modelo.toLowerCase();
        if (t.texto.toLowerCase().includes(modeloNorm)) return soma + t.peso;
        return soma;
      }, 0) || 1;
      m.fontes = [...new Set(trechos.filter((t) => t.texto.toLowerCase().includes(m.modelo.toLowerCase())).map((t) => hostOf(t.url)).filter(Boolean))];
    }
    return modelos.sort((a, b) => b.mencoes - a.mencoes);
  } catch (e) {
    log("WARN", `Extracao de modelos falhou: ${e.message}`);
    return [];
  }
}

// API principal: devolve { modelos: [{marca, modelo, mencoes, fontes}], queries: string[] }.
// queries ja vem pronta para uso direto na busca de produto ("Logitech G Pro X Superlight 2").
export async function buildEditorialShortlist({ categoriaLabel, ano, serperKey, tavilyKey, fetchLLM }) {
  if (!categoriaLabel) return { modelos: [], queries: [] };
  const queries = [
    `melhores ${categoriaLabel} gamer ${ano}`,
    `${categoriaLabel} gamer custo beneficio ${ano}`,
    `review ${categoriaLabel} gamer ${ano}`,
  ];
  const trechos = await coletarFontes(queries, { serperKey, tavilyKey });
  log("INFO", `${trechos.length} trecho(s) coletado(s) para "${categoriaLabel}"`);
  const modelos = await extrairModelos(trechos, { categoria: categoriaLabel, fetchLLM });
  log("INFO", `${modelos.length} modelo(s) extraido(s) da shortlist editorial`);
  return {
    modelos,
    queries: modelos.slice(0, 8).map((m) => `${m.marca} ${m.modelo}`),
  };
}
