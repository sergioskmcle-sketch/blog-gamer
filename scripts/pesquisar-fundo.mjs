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
  // Serper é o primário (cota gratuita de ~2.500 buscas/mês e já está no projeto).
  // Tavily fica como reserva — durante o free tier (1.000 créditos) ele recarrega
  // a cada mês e cobre momentos de pico.
  try {
    const res = await serperSearch(query, opts);
    if (res && res.results?.length) {
      log("INFO", `Serper: ${res.results.length} resultados`);
      return res;
    }
    log("WARN", "Serper veio vazio — tentando Tavily como reserva...");
    return await tavilySearch(tavilyKey, query, opts);
  } catch (e) {
    log("WARN", `Serper falhou (${e.message}) — tentando Tavily como reserva...`);
    const res = await tavilySearch(tavilyKey, query, opts);
    if (res && res.results?.length) {
      log("INFO", `Tavily (reserva): ${res.results.length} resultados`);
      return res;
    }
    throw e;
  }
}

function fonteDeResultado(r, includeRaw = false) {
  let content = (includeRaw ? r.raw_content || r.content : r.content) || "";
  // Raw content da Tavily pode ser enorme; lima na origem para nao estourar o
  // orcamento de tokens das chamadas LLM (64000 TPM).
  if (content.length > 3000) content = content.slice(0, 3000);
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

// V13 — Hierarquia de fontes.
// Ate aqui todas as fontes valiam igual e eram ordenadas por criterio
// generico. A estrategia que funciona (e a mesma que um humano usa) e:
// fonte OFICIAL primeiro, imprensa especializada depois, resto por ultimo.
// Um preco ou uma data vindos da Nintendo valem mais que os mesmos dados
// citados de segunda mao.
const DOMINIOS_OFICIAIS = [
  "nintendo.com", "nintendo.com.br", "playstation.com", "xbox.com",
  "steampowered.com", "store.steampowered.com", "ea.com", "ubisoft.com",
  "rockstargames.com", "capcom.com", "square-enix.com", "bandainamco",
  "sega.com", "activision.com", "blizzard.com", "epicgames.com",
  "riotgames.com", "bethesda.net", "cdprojektred.com", "sonyinteractive",
  "razer.com", "logitechg.com", "corsair.com", "hyperx.com", "redragon",
  "steelseries.com", "asus.com", "msi.com", "nvidia.com", "amd.com",
];

const DOMINIOS_IMPRENSA = [
  "ign.com", "gamespot.com", "polygon.com", "eurogamer", "pcgamer.com",
  "gamesradar.com", "theverge.com", "kotaku.com", "gematsu.com",
  "pushsquare.com", "purexbox.com", "nintendolife.com", "vgc.com",
  "gameinformer.com", "destructoid.com", "rockpapershotgun.com",
  "adrenaline.com.br", "tecmundo.com.br", "theenemy.com.br",
  "gameblast.com.br", "flowgames.gg", "einerd.com.br", "voxel.com.br",
];

// 0 = oficial, 1 = imprensa especializada, 2 = demais.
export function nivelDaFonte(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return 2;
  if (DOMINIOS_OFICIAIS.some((d) => u.includes(d))) return 0;
  if (DOMINIOS_IMPRENSA.some((d) => u.includes(d))) return 1;
  return 2;
}

// Reordena mantendo a ordem relativa dentro de cada nivel.
export function ordenarPorHierarquia(fontes) {
  return [...(fontes || [])].sort((a, b) => nivelDaFonte(a?.url) - nivelDaFonte(b?.url));
}

async function planejarSubQueries({ query, fetchLLM }) {
  if (!fetchLLM) return [query];
  // V13: as sub-queries passam a mirar o que o leitor realmente pesquisa no
  // Google, nao angulos genericos. Um artigo sobre um jogo precisa cobrir
  // data, preco, plataforma, tamanho e o que mudou — sao essas buscas que
  // trazem trafego e sao esses os fatos que dao densidade ao texto.
  // A primeira query e sempre a fonte OFICIAL: fabricante ou publisher.
  const sys = [
    "Voce e o analista de pesquisa do blog gamer Promo Gamer.",
    "Dado um tema, gere de 4 a 6 queries de busca em portugues do Brasil que juntas sustentem um artigo completo.",
    "REGRAS:",
    "1. A PRIMEIRA query deve buscar a FONTE OFICIAL (site do fabricante, publisher ou desenvolvedora). Ex.: 'Nintendo site oficial Ocarina of Time remake'.",
    "2. As demais devem cobrir o que o leitor pesquisa no Google sobre o tema. Para jogo: data de lancamento, preco, plataformas, tamanho/requisitos, o que mudou, novidades de gameplay. Para hardware: preco, especificacoes, comparacao, vale a pena.",
    "3. Queries especificas e curtas. Nada de pergunta longa.",
    "Responda APENAS com um array JSON de strings, sem explicacao.",
  ].join(" ");
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
    .map((f, i) => `[Fonte ${i + 1}] ${f.title}\nURL: ${f.url}\n${f.content.slice(0, 2000)}`)
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


// V13 — Cruzamento: detecta fatos concorrentes e resolve pela hierarquia.
// Conflito e quando DUAS OU MAIS fontes afirmam valores diferentes para o
// mesmo dado (data, preco, plataforma...). A resolucao segue a hierarquia:
// oficial vence imprensa, imprensa vence o resto. Empate fica marcado como
// DISPUTADO para o texto nao afirmar nenhum dos dois sem atribuicao.
export async function cruzarFatos({ fatos = [], fetchLLM }) {
  const saida = { conflitos: [], notas: [] };
  if (!fetchLLM || fatos.length < 2) return saida;

  const corpo = fatos
    .map((f, i) => `[F${i + 1}] "${f.fato}" — fonte: ${f.fonte} (${f.url}) [confianca: ${f.confianca}]`)
    .join("\n");

  const sys = [
    "Voce e o verificador de fatos do blog gamer Promo Gamer.",
    "Receba uma lista de fatos extraidos de fontes distintas sobre o MESMO tema.",
    "Identifique PARES de fatos que afirmam valores DIFERENTES para o mesmo dado",
    "Referencie cada lado pelo INDICE entre colchetes ([F1], [F2]...) que precede o fato",
    "(data de lancamento, preco, plataforma, tamanho, numero de vendas...).",
    "Nao marque como conflito fatos que apenas se complementam.",
    "Responda APENAS com JSON:",
    '{"conflitos":[{"fatoA":"Fn do primeiro fato","fatoB":"Fn do segundo","dado":"data|preco|plataforma|outro"}}',
    "Se nao houver conflito, devolva {\"conflitos\":[]}.",
  ].join(" ");

  let bruto;
  try {
    bruto = await fetchLLM(sys, `Tema pesquisado: ${fatos[0]?.fato?.slice(0, 80) || ""}\n\n${corpo}`, 2, { maxTokens: 1200, temperature: 0.1 });
  } catch (e) {
    log("WARN", `Cruzamento de fontes falhou: ${e.message}`);
    return saida;
  }

  const j = extrairJson(bruto);
  if (!j || !Array.isArray(j.conflitos)) return saida;

  const indiceDe = (ref) => {
    const texto = String(ref || "");
    // Formato 1: referencia por indice ([F2] ou "F2").
    const m = texto.match(/F(\d+)/i);
    const porIndice = m ? parseInt(m[1], 10) - 1 : -1;
    if (porIndice >= 0 && porIndice < fatos.length) return porIndice;
    // Formato 2: a LLM devolveu o proprio texto do fato — casa pelo trecho.
    // Jaccard sobre tokens COM NUMEROS: em "chega em 5 de novembro" x
    // "chega em 6 de novembro" o discriminador e justamente o algarismo.
    // Filtrar palavra curta descartava o 5 e o 6 e empatava os dois fatos.
    const norm = (t) => new Set(String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 2 || /\d/.test(w)));
    const palavras = norm(texto);
    if (palavras.size === 0) return -1;
    let melhor = -1;
    let melhorScore = 0;
    for (let i = 0; i < fatos.length; i++) {
      const alvo = norm(fatos[i].fato);
      let inter = 0;
      for (const w of palavras) if (alvo.has(w)) inter++;
      const uniao = palavras.size + alvo.size - inter;
      const score = uniao > 0 ? inter / uniao : 0;
      if (score > melhorScore) { melhorScore = score; melhor = i; }
    }
    return melhorScore >= 0.5 ? melhor : -1;
  };

  for (const c of j.conflitos.slice(0, 5)) {
    if (!c || !c.fatoA || !c.fatoB) continue;
    const iA = indiceDe(c.fatoA);
    const iB = indiceDe(c.fatoB);
    if (iA === -1 || iB === -1) continue;
    const fa = fatos[iA];
    const fb = fatos[iB];
    const nivelA = nivelDaFonte(fa.url);
    const nivelB = nivelDaFonte(fb.url);
    let resolucao;
    if (nivelA < nivelB) resolucao = `prevalece: "${fa.fato}" (${fa.fonte} — fonte oficial/mais confiavel)`;
    else if (nivelB < nivelA) resolucao = `prevalece: "${fb.fato}" (${fb.fonte} — fonte oficial/mais confiavel)`;
    else resolucao = `DISPUTADO: "${fa.fato}" (${fa.fonte}) x "${fb.fato}" (${fb.fonte}) — atribua a cada fonte, nao afirme nenhum como definitivo`;
    saida.conflitos.push({
      dado: String(c.dado || "outro").slice(0, 40),
      fatoA: fa.fato.slice(0, 300),
      fatoB: fb.fato.slice(0, 300),
      resolucao,
    });
    log("WARN", `CONFLITO de ${c.dado || "dados"} [F${iA + 1}] x [F${iB + 1}] -> ${resolucao}`);
  }
  return saida;
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
  // V13: oficial primeiro. O que a fabricante publica tem precedencia sobre
  // o que a imprensa repercute, e ambos sobre o resto.
  const fontes = ordenarPorHierarquia(mergearFontes(listas, 6));
  const oficiais = fontes.filter((f) => nivelDaFonte(f?.url) === 0).length;
  const imprensa = fontes.filter((f) => nivelDaFonte(f?.url) === 1).length;
  log("INFO", `Fontes por nivel: ${oficiais} oficial(is), ${imprensa} de imprensa, ${fontes.length - oficiais - imprensa} outra(s)`);
  // V13: no MEDIO o cruzamento nao roda (so no profundo) — contexto sem a
  // IIFE de conflitos. A versao com conflitos vive no pesquisarProfundo.
  // V13: o medio TAMBEM extrai fatos verificados — o portao de fatos exige
  // pelo menos um para noticia.
  const verifiedFacts = await sintetizarFatos({ query, fontes, fetchLLM });
  return {
    researchContext: montarContexto(fontes, 1200),
    researchSources: fontes,
    verifiedFacts,
    cobertura: computarCobertura(fontes, verifiedFacts),
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
  const fontes = mergearFontes(listas, 6);
  const fontesFull = mergearFontes([listaRaw], 3).length > 0 ? mergearFontes([listaRaw], 3) : fontes;
  const verifiedFacts = await sintetizarFatos({ query, fontes: fontesFull, fetchLLM });

  // V13: cruzamento — so faz sentido com fatos suficientes para comparar.
  let cruzamento = { conflitos: [], notas: [] };
  try {
    cruzamento = await cruzarFatos({ fatos: verifiedFacts, fetchLLM });
  } catch (e) {
    log("WARN", `Cruzamento falhou: ${e.message}`);
  }

  return {
    researchContext: montarContexto(fontes, 1200),
    researchSources: fontes,
    verifiedFacts,
    conflitos: cruzamento.conflitos,
    cobertura: computarCobertura(fontes, verifiedFacts),
    nivel: "profundo",
    subQueries,
  };
}

// API principal. Nunca lanca: com falha, rebaixa ao nivel basico (ou vazio).

// V13 — Baixa o texto COMPLETO das materias das fontes mais confiaveis.
// Prioriza fonte oficial (nivel 0) e imprensa especializada (nivel 1).
// Devolve [{ url, titulo, veiculo, texto }], texto ja limitado por materia.
// Quantidade ajustavel sem codigo:
//   MATERIAS_COMPLETAS_MAX   — quantas materias ler por inteiro (padrao 5)
//   MATERIAS_COMPLETAS_CHARS — limite de texto por materia (padrao 6000)
// Custo: ~8-10k tokens de contexto a mais no redator. O Gemini (1a da fila)
// absorve sem problema; se o Groq (2a) rejeitar por tamanho, o retry dele
// encolhe o prompt e, persistindo, cai na OpenAI. Trade-off consciente:
// material completo na escrita vale mais que 1-2 chamadas de texto pagas.
const MATERIAS_MAX = Number(process.env.MATERIAS_COMPLETAS_MAX) || 5;
const MATERIAS_CHARS = Number(process.env.MATERIAS_COMPLETAS_CHARS) || 6000;

export async function extrairMateriasCompletas({ fontes = [], tavilyKey, maxMaterias = MATERIAS_MAX, charsPorMateria = MATERIAS_CHARS }) {
  if (!tavilyKey || fontes.length === 0) return [];
  const ordenadas = ordenarPorHierarquia(fontes)
    .filter((f) => f?.url && /^http/.test(f.url))
    .slice(0, 10);
  if (ordenadas.length === 0) return [];

  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: tavilyKey, urls: ordenadas.map((f) => f.url) }),
    });
    if (!res.ok) {
      log("WARN", `Extracao de materias falhou: HTTP ${res.status}`);
      return [];
    }
    const d = await res.json();
    const materias = (d.results || [])
      .map((r) => {
        const fonte = ordenadas.find((f) => f.url === r.url);
        return {
          url: r.url,
          titulo: fonte?.title || "(sem titulo)",
          veiculo: fonte?.url ? new URL(fonte.url).hostname.replace(/^www\./, "") : "",
          texto: String(r.raw_content || "").replace(/\s+\n/g, "\n").slice(0, charsPorMateria),
        };
      })
      .filter((m) => m.texto.length > 800)
      .slice(0, maxMaterias);
    log("INFO", `Materias completas extraidas: ${materias.length} (${materias.map((m) => m.veiculo).join(", ")})`);
    return materias;
  } catch (e) {
    log("WARN", `Extracao de materias falhou: ${e.message}`);
    return [];
  }
}
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
        return await anexarMaterias(await pesquisarProfundo({ query: q, tavilyKey, fetchLLM }), { tavilyKey });
      } catch (e) {
        log("WARN", `Pesquisa profunda falhou (${e.message}) — tentando medio`);
      }
    }
    if (nivel === "medio" || nivel === "profundo") {
      try {
        const res = await pesquisarMedio({ query: q, tavilyKey, fetchLLM });
        if (res.researchSources.length > 0) return await anexarMaterias(res, { tavilyKey });
      } catch (e) {
        log("WARN", `Pesquisa media falhou (${e.message}) — rebaixando para basico`);
      }
    }
    const res = await pesquisarBasico({ query: q, tavilyKey });
    if (res.researchSources.length === 0) return nulo;
    return await anexarMaterias(res, { tavilyKey });
  } catch (e) {
    log("WARN", `Pesquisa falhou (${e.message}) — artigo seguira sem fontes`);
    return nulo;
  }
}

// Anexa as materias completas ao contexto — em qualquer nivel de pesquisa.
async function anexarMaterias(res, { tavilyKey }) {
  try {
    const materias = await extrairMateriasCompletas({ fontes: res.researchSources || [], tavilyKey });
    if (materias.length > 0) {
      res.materiasCompletas = materias;
      const bloco = materias.map((m, i) =>
        `[MATERIA ${i + 1}] ${m.titulo} — ${m.veiculo}\n${m.texto}`
      ).join("\n\n---\n\n");
      res.researchContext = `${res.researchContext}\n\n## MATERIAS COMPLETAS DAS FONTES (sua base principal de escrita — leia e escreva a partir delas; sao o material APURADO, nao retalhos de busca):\n\n${bloco}`;
    }
  } catch (e) {
    log("WARN", `Anexar materias falhou (nao bloqueia): ${e.message}`);
  }
  return res;
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
