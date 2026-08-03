import "dotenv/config";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import Parser from "rss-parser";
import { searchGoogleShopping } from "./google_shopping.mjs";
import { gerarCapaStability } from "./stability-cover.mjs";
import { gerarCapaOpenAI, downloadImage, searchTavilyImage } from "./openai-cover.mjs";

const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogGamer/1.0)" },
});

const ARTIGOS_DIR = path.resolve("src/content/artigos");
const STATE_FILE = path.resolve("state.json");
const PROD_IMAGES_DIR = path.resolve("public/images/produtos");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { last_success: null, last_error: null, last_error_date: null, consecutive_failures: 0, total_articles: 0, last_category: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

const CATEGORIES = [
  { slug: "noticia", name: "Notícia" },
  { slug: "review", name: "Review" },
  { slug: "guia", name: "Guia de Compra" },
  { slug: "lista", name: "Lista" },
];

const CATEGORY_ROTATION = ["noticia", "review", "guia", "lista"];

function nextCategory(lastCategory) {
  const idx = CATEGORY_ROTATION.indexOf(lastCategory);
  return CATEGORY_ROTATION[(idx + 1) % CATEGORY_ROTATION.length];
}

const TOPIC_SEEDS = [
  { category: "noticia", hint: "lancamento de game, evento de games, anuncio de console", ml_query: "lancamento jogo ps5 xbox 2026" },
  { category: "review", hint: "review de jogo popular de 2026, performance nos consoles, o que esperar do jogo", ml_query: "jogo popular ps5 xbox switch 2026" },
  { category: "guia", hint: "melhores headsets gamers, teclado mecanico, mouse gamer, monitor, cadeira", ml_query: "headset gamer teclado mecanico mouse gamer monitor" },
  { category: "lista", hint: "melhores jogos para PC, jogos gratis, jogos multiplayer, jogos estilo", ml_query: "jogo pc mais vendido 2026" },
];

// Temas proibidos: apostas, cassino, caça-níqueis e afins. Nunca podem virar artigo.
const FORBIDDEN_PATTERNS = [
  /\bca[çc]a[- ]?n[ií]queis?\b/,
  /\bn[ií]queis?\b/,
  /\bcassinos?\b/,
  /\bcasinos?\b/,
  /\broletas?\b/,
  /\bapost[aeiou]\w*\b/,
  /\btigrinho\b/,
  /\bfortune tiger\b/,
  /\bjackpots?\b/,
  /\bpoker\b/,
  /\bbingo\b/,
  /\bjogos? de azar\b/,
  /\bcasas? de apostas\b/,
  /\bbet365\b/,
  /\bbetano\b/,
  /\besportes? da sorte\b/,
  /\bblaze\b/,
  /\bgambling\b/,
  /\bslots? online\b/,
  /\bslot machines?\b/,
  /\bjogo do tigrinho\b/,
];

function hasForbiddenTerm(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const lower = String(text).toLowerCase();
    if (FORBIDDEN_PATTERNS.some((re) => re.test(lower))) return true;
  }
  return false;
}

const RSS_FEEDS = [
  { name: "MeuPlayStation", url: "https://meups.com.br/feed/" },
  { name: "GameVicio", url: "https://www.gamevicio.com/feed/" },
  { name: "IGN Brasil", url: "https://br.ign.com/feed.xml" },
  { name: "TecMundo Games", url: "https://rss.tecmundo.com.br/games" },
];

const REDDIT_SUBS = [
  { name: "r/gaming", url: "https://old.reddit.com/r/gaming/hot.json?limit=15" },
  { name: "r/gamesEcultura", url: "https://old.reddit.com/r/gamesEcultura/hot.json?limit=10" },
];

const GAME_KEYWORDS = [
  "gta", "gta 6", "gta vi", "fortnite", "minecraft", "roblox", "valorant",
  "league of legends", "counter strike", "call of duty", "fifa", "ea fc",
  "elden ring", "zelda", "god of war", "resident evil", "final fantasy",
  "assassin's creed", "cyberpunk", "pokemon", "mario", "the last of us",
  "spider man", "baldur's gate", "diablo", "starfield", "hades",
  "hollow knight", "silksong", "red dead", "overwatch", "apex legends",
  "rocket league", "destiny", "warzone", "battlefield", "street fighter",
  "mortal kombat", "tekken", "persona", "metroid", "doom", "fallout",
  "the witcher", "skyrim", "dark souls", "bloodborne", "ghost of",
  "horizon zero", "horizon forbidden", "uncharted", "god of war",
  "death stranding", "kingdom hearts", "monster hunter",
];

const CONSOLE_KEYWORDS = [
  "playstation", "playstation 5", "xbox", "xbox series", "nintendo switch",
  "switch 2", "steam deck", "pc gamer", "ps5", "ps4",
];

const HARDWARE_KEYWORDS = [
  "monitor", "headset", "teclado", "mouse", "cadeira", "placa de video",
  "processador", "ssd", "memoria", "rtx", "nvidia", "geforce", "radeon",
  "amd", "intel",   "fonte de alimentação", "water cooler", "gabinete",
];

const EVENT_KEYWORDS = ["e3", "game awards", "gamescom", "brasil game show", "bgs", "lançamento", "lancamento"];

const KEYWORD_CATEGORY_MAP = {};

function initKeywordMap() {
  for (const kw of HARDWARE_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "guia";
  for (const kw of EVENT_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "noticia";
}

initKeywordMap();

// Classifica um texto como "games" (jogos/consoles/software) ou "hardware" (periféricos/PC)
// Retorna tambem "promo" (termos genericos de promocao), "mixed" (ambos) ou "unknown".
function classifyDomain(text) {
  // Ignora a secao de Fontes, que e obrigatoria em todo artigo e pode conter termos ambiguos
  const cleaned = String(text || "").replace(/##?\s*Fontes[\s\S]*$/im, "");
  const lower = cleaned.toLowerCase();
  const hasGame = GAME_KEYWORDS.some((k) => lower.includes(k)) ||
                  CONSOLE_KEYWORDS.some((k) => lower.includes(k)) ||
                  EVENT_KEYWORDS.some((k) => lower.includes(k) && k !== "lancamento" && k !== "lançamento");
  const hasHardware = HARDWARE_KEYWORDS.some((k) => lower.includes(k));

  if (hasGame && hasHardware) return "mixed";
  if (hasHardware) return "hardware";
  if (hasGame) return "games";
  return "unknown";
}

function isMixedDomain(text) {
  return classifyDomain(text) === "mixed";
}

function explainMixedDomain(text) {
  const lower = String(text || "").toLowerCase();
  const gameMatches = [...GAME_KEYWORDS, ...CONSOLE_KEYWORDS, ...EVENT_KEYWORDS.filter(k => k !== "lancamento" && k !== "lançamento")]
    .filter((k) => lower.includes(k));
  const hardwareMatches = HARDWARE_KEYWORDS.filter((k) => lower.includes(k));
  return { gameMatches: gameMatches.slice(0, 10), hardwareMatches: hardwareMatches.slice(0, 10) };
}

// Filtra palavras-chave mantendo apenas as do mesmo dominio da palavra principal.
function filterSameDomain(keywords, targetDomain) {
  if (!targetDomain || targetDomain === "unknown" || targetDomain === "promo") return keywords;
  return keywords.filter((k) => {
    const d = classifyDomain(k);
    return d === targetDomain || d === "promo" || d === "unknown";
  });
}

function domainLabel(domain) {
  if (domain === "hardware") return "periféricos e hardware gamer";
  if (domain === "games") return "games, consoles e software";
  return "games e hardware gamer";
}

function extractTrendingTopics(headlines) {
  const allKeywords = [...GAME_KEYWORDS, ...CONSOLE_KEYWORDS, ...HARDWARE_KEYWORDS, ...EVENT_KEYWORDS];
  const scores = {};
  for (const text of headlines) {
    const lower = text.toLowerCase();
    for (const kw of allKeywords) {
      if (lower.includes(kw)) {
        scores[kw] = (scores[kw] || 0) + 1;
      }
    }
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1]);
}

function isTopicDuplicate(keyword, existingTopics, recentKeywords = []) {
  const kw = keyword.toLowerCase();

  for (const rk of recentKeywords) {
    if (kw === rk.toLowerCase()) return true;
    const kwWords = kw.split(/\s+/).filter((w) => w.length > 3);
    const rkWords = rk.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let matches = 0;
    for (const w of kwWords) {
      if (rkWords.includes(w)) matches++;
    }
    if (matches >= 2) return true;
  }

  if (existingTopics && existingTopics.length > 0) {
    const kwWords = kw.split(/\s+/).filter((w) => w.length > 3);
    for (const topic of existingTopics) {
      const topicLower = topic.toLowerCase();
      let matches = 0;
      for (const word of kwWords) {
        if (topicLower.includes(word)) matches++;
      }
      if (matches >= 2) return true;
    }
  }

  return false;
}

function buildTopicFromKeyword(topKeyword, topKeywords, existingTopics = [], recentKeywords = []) {
  const kw = topKeyword.toLowerCase();

  if (hasForbiddenTerm(kw)) {
    log("WARN", `Keyword proibida (apostas/cassino): "${topKeyword}" — descartando`);
    return null;
  }

  const domain = classifyDomain(kw);

  // Filtra contexto para manter apenas palavras do mesmo dominio
  let top3 = topKeywords.map(([k]) => k).filter(k =>
    k.toLowerCase() !== kw && !isTopicDuplicate(k, existingTopics, recentKeywords)
  );
  top3 = filterSameDomain(top3, domain);
  if (top3.length === 0) top3.push(kw);
  const ctx = top3.slice(0, 3).join(", ");
  const top2names = top3.slice(0, 2).join(" ");

  let category = KEYWORD_CATEGORY_MAP[kw] || "noticia";
  let hint = "";
  let ml_query = "";

  if (GAME_KEYWORDS.some((g) => kw.includes(g) || g.includes(kw))) {
    category = "noticia";
    hint = `lancamentos, novidades e guia sobre ${kw} — topicos em alta: ${ctx}`;
    ml_query = `${top2names} jogo ps5 xbox pc`;
  } else if (CONSOLE_KEYWORDS.some((c) => kw.includes(c) || c.includes(kw))) {
    category = "noticia";
    hint = `novidades, jogos e acessorios para ${kw} — topicos em alta: ${ctx}`;
    ml_query = `${kw} ${top3.filter(k => k !== kw).slice(0, 2).join(" ")} jogo`;
  } else if (HARDWARE_KEYWORDS.some((h) => kw.includes(h) || h.includes(kw))) {
    category = "guia";
    hint = `melhores ${kw}s gamer em 2026 — topicos em alta: ${ctx}`;
    ml_query = `${kw} gamer ${top3.filter(k => k !== kw).slice(0, 1).join(" ")} 2026`;
  } else if (EVENT_KEYWORDS.some((e) => kw.includes(e) || e.includes(kw))) {
    category = "noticia";
    hint = `${kw}: anuncios, novidades e expectativas — topicos em alta: ${ctx}`;
    ml_query = `${top2names} jogo ps5 pc`;
  } else {
    category = "noticia";
    hint = `novidades sobre ${kw} no mundo gamer — topicos em alta: ${ctx}`;
    ml_query = `${top2names} gamer 2026`;
  }

  // Guard: se por algum motivo o hint ficou misto, descarta
  if (isMixedDomain(hint) || isMixedDomain(ml_query)) {
    log("WARN", `buildTopicFromKeyword gerou tema misto para "${kw}": ${hint}`);
    return null;
  }

  return { category, hint, ml_query, trending_score: topKeywords[0]?.[1] || 0, trending_keywords: top3 };
}

async function analyzeTrendsWithAI(headlines, trending, existingTopics, recentKeywords) {
  const topHeadlines = headlines.slice(0, 15).map((h, i) => `${i + 1}. ${h}`).join("\n");
  const topTrending = trending.slice(0, 6).map(([k, v]) => `- "${k}" (${v}x mencoes)`).join("\n");
  const covered = [...new Set([...recentKeywords, ...existingTopics.map(t => t.slice(0, 60))])].slice(0, 15);
  const coveredList = covered.length > 0 ? covered.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(nenhum)";

  const systemPrompt = `Você é um editor de blog de games do Brasil. Analisa trending topics e decide qual assunto NOVO e INÉDITO escrever sobre.

REGRAS:
- O artigo NÃO pode ser sobre o mesmo jogo/assunto dos artigos já escritos (mesmo que seja um ângulo diferente)
- Priorize assuntos que NÃO estão na lista de "Já cobertos"
- FOCO UNICO: o artigo deve tratar APENAS de um dos dois domínios — JOGOS/SOFTWARE/CONSOLES ou PERIFERICOS/HARDWARE GAMER. Nunca misture os dois domínios no mesmo artigo.
  - Se escolher um jogo/console/evento: o hint, o ml_query e o conteudo devem ser sobre games (ex: "jogo ps5 xbox pc", "lancamentos de games", "ofertas de jogos").
  - Se escolher hardware/periférico: o hint, o ml_query e o conteudo devem ser sobre perifericos gamer (ex: "mouse gamer", "headset gamer", "monitor gamer 2026").
  - NUNCA escreva algo como "games e perifericos" no mesmo tema.
- PROIBIDO escolher temas de apostas, cassino, slots, caça-níqueis, roleta, jogos de azar ou qualquer conteúdo de jogo de dinheiro real. O blog não cobre esse tipo de assunto.
- Se TODOS os trending são sobre assuntos já cobertos, sugira um assunto diferente que esteja em alta mas não está nos trending principais
- Responda APENAS com JSON válido, sem markdown, sem explicação extra

CATEGORIAS VÁLIDAS: noticia, review, guia, lista (qualquer outra é rejeitada)

Formato da resposta JSON:
{
  "topic": "palavra-chave principal do assunto escolhido",
  "category": "categoria do artigo",
  "hint": "descrição curta do artigo (max 100 chars) em português",
  "ml_query": "query para buscar produtos no Mercado Livre (3-5 palavras, MESMO dominio do topic)",
  "reasoning": "por que este assunto é novo e relevante (1 frase)"
}`;

  const userPrompt = `HEADLINES DOS FEEDS (RSS + Reddit):
${topHeadlines}

TOP TRENDING (por frequência):
${topTrending}

ARTIGOS JÁ ESCritos NO BLOG:
${coveredList}

Analise as headlines e os trending topics. Escolha um assunto que seja NOVO e INÉDITO no blog. Se todos os trending são repetidos, invente um assunto relevante que esteja em alta.`;

  const response = await fetchLLM(systemPrompt, userPrompt, 3, { temperature: 0.5, maxTokens: 500 });
  if (!response) return null;

  let parsed;
  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    log("WARN", `IA retornou JSON invalido: ${typeof response === "string" ? response.slice(0, 200) : String(response).slice(0, 200)}`);
    return null;
  }

  if (!parsed.topic || !parsed.category || !parsed.hint) {
    log("WARN", `IA retornou JSON incompleto: ${JSON.stringify(parsed)}`);
    return null;
  }

  if (hasForbiddenTerm(parsed.topic, parsed.hint, parsed.ml_query)) {
    log("WARN", `IA sugeriu tema proibido (apostas/cassino): ${parsed.hint}`);
    return null;
  }

  if (!["noticia", "review", "guia", "lista"].includes(parsed.category)) {
    log("WARN", `IA retornou categoria invalida "${parsed.category}", rejeitando: ${parsed.hint}`);
    return null;
  }

  // Rejeita sugestoes que misturam games e hardware
  const domain = classifyDomain(parsed.topic);
  if (isMixedDomain(parsed.hint) || isMixedDomain(parsed.ml_query) ||
      (domain !== "unknown" && domain !== "promo" && isMixedDomain(parsed.topic))) {
    log("WARN", `IA sugeriu tema misto (games + hardware): ${parsed.hint}`);
    return null;
  }

  log("INFO", `IA escolheu: "${parsed.topic}" [${parsed.category}] — ${parsed.reasoning || "sem reasoning"}`);

  // Mantem palavras-chave trending apenas do mesmo dominio escolhido
  const trendingKws = [parsed.topic, ...trending.slice(0, 4).map(([k]) => k)];
  const sameDomainKws = filterSameDomain(trendingKws, domain).slice(0, 3);

  return {
    category: parsed.category,
    hint: parsed.hint,
    ml_query: parsed.ml_query || `${parsed.topic} gamer 2026`,
    trending_score: trending[0]?.[1] || 1,
    trending_keywords: sameDomainKws.length > 0 ? sameDomainKws : [parsed.topic],
  };
}

async function discoverTrendingTopic(existingTopics = [], recentKeywords = []) {
  log("INFO", "Buscando topicos trending (RSS + Reddit)...");

  const headlines = [];

  for (const feed of RSS_FEEDS) {
    try {
      const data = await rssParser.parseURL(feed.url);
      const items = (data.items || []).slice(0, 15);
      for (const item of items) {
        if (item.title) headlines.push(item.title);
      }
      log("INFO", `RSS ${feed.name}: ${items.length} headlines`);
    } catch (e) {
      log("WARN", `RSS ${feed.name}: ${e.message}`);
    }
  }

  for (const sub of REDDIT_SUBS) {
    try {
      const res = await fetch(sub.url, {
        headers: { "User-Agent": "BlogGamer/1.0 (trending-discovery)" },
        timeout: 15000,
      });
      if (!res.ok) { log("WARN", `Reddit ${sub.name}: ${res.status}`); continue; }
      const data = await res.json();
      const posts = (data.data?.children || []).slice(0, 15);
      for (const post of posts) {
        if (post.data?.title) headlines.push(post.data.title);
      }
      log("INFO", `Reddit ${sub.name}: ${posts.length} posts`);
    } catch (e) {
      log("WARN", `Reddit ${sub.name}: ${e.message}`);
    }
  }

  const antes = headlines.length;
  const filteredHeadlines = headlines.filter((h) => !hasForbiddenTerm(h));
  if (filteredHeadlines.length !== antes) {
    log("INFO", `Filtrados ${antes - filteredHeadlines.length} headlines de temas proibidos (apostas/cassino)`);
  }

  if (filteredHeadlines.length < 5) {
    log("INFO", `Poucas headlines (${filteredHeadlines.length}), usando fallback estatico`);
    return null;
  }

  log("INFO", `Total headlines: ${filteredHeadlines.length}`);

  const trending = extractTrendingTopics(filteredHeadlines);
  if (trending.length === 0) {
    log("INFO", "Nenhum topico identificado, usando fallback estatico");
    return null;
  }

  log("INFO", `Top trending: ${trending.slice(0, 8).map(([k, v]) => `${k} (${v}x)`).join(", ")}`);

  if (GROQ_API_KEY) {
    try {
      const aiResult = await analyzeTrendsWithAI(filteredHeadlines, trending, existingTopics, recentKeywords);
      if (aiResult) {
        log("INFO", `IA escolheu topico novo: [${aiResult.category}] ${aiResult.hint}`);
        return aiResult;
      }
    } catch (e) {
      log("WARN", `Analise IA falhou, usando fallback por keyword: ${e.message}`);
    }
  }

  for (const [kw, score] of trending) {
    if (isTopicDuplicate(kw, existingTopics, recentKeywords)) {
      log("INFO", `Topico "${kw}" ja usado recentemente, tentando proximo...`);
      continue;
    }
    const topic = buildTopicFromKeyword(kw, trending.slice(0, 3), existingTopics, recentKeywords);
    if (!topic) {
      log("INFO", `Keyword "${kw}" nao gerou tema valido, tentando proxima...`);
      continue;
    }
    log("INFO", `Tema escolhido (keyword): [${topic.category}] ${topic.hint}`);
    return topic;
  }

  log("INFO", "Todos trending topics ja foram cobertos, usando fallback estatico");
  return null;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const MAX_PRODUCTS = 5;

const GAME_IMAGE_CACHE = {};

function log(level, msg) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${ts}] [${level}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// 0 a 1. Combina distancia de edicao com contencao ("resident evil" dentro de
// "Resident Evil Requiem" e match; "gta" dentro de um nome longo nao e).
function similarity(a, b) {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const lev = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (longer.includes(shorter)) {
    const proporcional = (shorter.length / longer.length) * 0.9 + 0.1;
    // "Silksong" dentro de "Hollow Knight: Silksong" e match forte mesmo sendo
    // curto, desde que apareca como palavra inteira e seja distintivo.
    const palavraInteira = new RegExp(`(^| )${shorter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(longer);
    const distintivo = palavraInteira && shorter.length >= 5 ? 0.75 : 0;
    return Math.max(lev, proporcional, distintivo);
  }
  return lev;
}

// "Grand Theft Auto VI" -> "gta vi". Sem isso, sigla usada no texto nunca casa
// com o nome completo que a RAWG devolve.
function acronymAlias(name) {
  const words = normalizeForMatch(name).split(" ").filter(Boolean);
  const head = [];
  const tail = [];
  for (const w of words) {
    if (tail.length === 0 && /^[a-z]+$/.test(w) && w.length > 2) head.push(w);
    else tail.push(w);
  }
  if (head.length < 2) return null;
  return [head.map((w) => w[0]).join(""), ...tail].join(" ").trim();
}

// Melhor score entre os nomes e suas versoes em sigla, com uma trava: o termo
// que distingue o titulo (ultima palavra) precisa existir no candidato — senao
// "Resident Evil Requiem" casaria com "Resident Evil Village".
function nameSimilarity(a, b) {
  const variantsA = [a, acronymAlias(a)].filter(Boolean);
  const variantsB = [b, acronymAlias(b)].filter(Boolean);
  let best = 0;
  for (const va of variantsA) {
    for (const vb of variantsB) best = Math.max(best, similarity(va, vb));
  }

  const tokensA = normalizeForMatch(a).split(" ").filter(Boolean);
  const distintivo = tokensA[tokensA.length - 1];
  if (tokensA.length > 1 && distintivo && distintivo.length > 2) {
    const todosB = variantsB.map(normalizeForMatch).join(" ");
    if (!todosB.includes(distintivo)) best = Math.min(best, RAWG_MATCH_THRESHOLD - 0.05);
  }

  return best;
}

const RAWG_MATCH_THRESHOLD = 0.55;

async function fetchRAWGImage(gameName) {
  if (!RAWG_API_KEY) return null;
  if (GAME_IMAGE_CACHE[gameName] !== undefined) return GAME_IMAGE_CACHE[gameName];

  const clean = gameName
    .replace(/[^a-zA-Z0-9 àáâãéêíóôõúç:]/g, "")
    .replace(/\b(ps4|ps5|xbox|nintendo|switch|pc|midia fisica|edicao|edition|standard)\b/gi, "")
    .replace(/\s+/g, " ").trim();

  if (!clean || clean.length < 3) return null;

  try {
    const r = await fetch(
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(clean)}&page_size=5&page=1`,
      { timeout: 10000 }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const candidates = (data.results || []).filter((g) => g.background_image);
    if (candidates.length === 0) return null;

    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      const score = nameSimilarity(clean, c.name || "");
      if (score > bestScore) { bestScore = score; best = c; }
    }

    if (!best || bestScore < RAWG_MATCH_THRESHOLD) {
      log("WARN", `RAWG descartado "${gameName.slice(0, 40)}": melhor match "${best?.name || "-"}" (score ${bestScore.toFixed(2)} < ${RAWG_MATCH_THRESHOLD})`);
      GAME_IMAGE_CACHE[gameName] = null;
      return null;
    }

    const hqUrl = best.background_image.replace("/media/", "/media/crop/600/400/") + "?auto=format&fit=crop&w=800&h=450";
    GAME_IMAGE_CACHE[gameName] = hqUrl;
    log("INFO", `RAWG imagem "${gameName.slice(0, 40)}" -> "${best.name}" (score ${bestScore.toFixed(2)})`);
    return hqUrl;
  } catch (e) {
    log("WARN", `RAWG erro "${gameName.slice(0, 40)}": ${e.message}`);
  }
  return null;
}

function extractGameNames(body) {
  const nonGameTerms = new Set([
    "instalação rápida", "instalacao rapida", "ajuste de dificuldade", "ajuste de dificuldade",
    "gerenciamento de recursos", "exploração de dlcs", "exploracao de dlcs",
    "download", "update", "patch", "modo", "sobrevivência", "sobrevivencia",
    "progresso compartilhado", "progresso", "sistema", "opção", "opcao",
    "resolução 4k", "resolucao 4k", "4k", "60fps", "120fps", "hdr",
    "ray tracing", "dlss", "fsr", "vrr", "ssd", "hdd", "fps",
    "prós", "pros", "contras", "contrás",
    "versão digital", "versao digital", "mídia física", "midia fisica",
    "excelente", "recondicionado", "recondicionada",
    "acessórios", "acessorios", "periféricos", "perifericos",
    "o que é?", "o que é", "por que vale a pena?", "por que vale a pena",
    "expectativa da comunidade:", "expectativa da comunidade",
    "diferenciais:", "diferenciais", "polêmica:", "polemica:",
    "impacto no mercado:", "impacto no mercado",
    "cultura gamer:", "cultura gamer",
    "controle preciso:", "controle preciso",
    "proteção total:", "protecao total:",
    "case resistente:", "case resistente",
    "passos pra montar", "passos para montar",
    "instala o controle", "protege o console", "organiza o espaço",
    "instale o jogo", "ajuste as configurações",
    "explore o modo", "aproveite o dualsense",
    "gerencie o tempo", "modo performance", "modo gráfico",
  ]);
  const found = body.match(/\*\*([^*]+)\*\*/g);
  if (!found) return [];
  const seen = new Set();
  const result = [];
  for (const match of found) {
    const name = match.replace(/^\*\*|\*\*$/g, "").trim();
    if (name && name.length > 3 && !name.startsWith("http") && !name.startsWith("R$")) {
      const lower = name.toLowerCase();
      if (name.length > 60) continue;
      if (nonGameTerms.has(lower)) continue;
      if (/(mídia física|midia fisica|recondicionado|recondicionada|excelente.*recondicionado)/i.test(name)) continue;
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result;
}

const IMG_MARKER_REGEX = /^[ \t]*\[IMG:\s*([^\]\n]+?)\s*\][ \t]*$/gm;
const PRODUCT_MARKER_REGEX = /^[ \t]*\[PRODUTO:\s*(\d+)\s*\][ \t]*$/gm;

// Nomes de jogos que a IA marcou para receber imagem, na ordem em que aparecem.
function extractImageMarkers(body) {
  const names = [];
  const seen = new Set();
  for (const m of body.matchAll(IMG_MARKER_REGEX)) {
    const name = m[1].trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

// A IA as vezes marca a imagem numa posicao errada.
// Aqui o marcador e movido para logo ANTES do titulo ## que ele descreve;
// se nenhum titulo ou paragrafo cita, o marcado e mantido (Tavily vai tentar achar imagem).
function repositionImageMarkers(body) {
  const blocks = body.split(/\n{2,}/);
  const isMarker = (b) => /^\[IMG:\s*[^\]\n]+\]$/.test(b.trim());
  const markerName = (b) => b.trim().replace(/^\[IMG:\s*|\s*\]$/g, "");
  const isHeading = (b) => /^#{1,6}\s/.test(b.trim());
  const mentions = (block, name) => normalizeForMatch(block).includes(normalizeForMatch(name));

  const kept = [];
  const pending = [];

  for (const block of blocks) {
    if (!isMarker(block)) { kept.push(block); continue; }
    const name = markerName(block);
    const prev = [...kept].reverse().find((b) => b.trim() && !isMarker(b));
    if (prev && (isHeading(prev) || mentions(prev, name))) {
      kept.push(block);
    } else {
      pending.push({ name, block });
    }
  }

  for (const { name, block } of pending) {
    const headingTarget = kept.findIndex((b) => isHeading(b) && mentions(b, name));
    if (headingTarget !== -1) {
      kept.splice(headingTarget, 0, block);
      log("INFO", `Marcador [IMG:${name}] movido para antes do titulo que menciona o topico`);
      continue;
    }
    const paraTarget = kept.findIndex((b) => !isHeading(b) && !isMarker(b) && b.trim() && mentions(b, name));
    if (paraTarget !== -1) {
      let insertAt = paraTarget;
      while (insertAt < kept.length && isMarker(kept[insertAt])) insertAt++;
      kept.splice(insertAt, 0, block);
      log("INFO", `Marcador [IMG:${name}] movido para antes do paragrafo que cita o topico`);
      continue;
    }
    kept.push(block);
    log("INFO", `Marcador [IMG:${name}] mantido (busca via Tavily)`);
  }

  return kept.join("\n\n");
}

function buildImageTag(name, imgUrl) {
  return `<img src="${imgUrl}" alt="${name.replace(/"/g, "&quot;")}" class="article-game-img" loading="lazy" decoding="async">`;
}

// Substitui [IMG:Nome] pela tag. Marcadores sem imagem correspondente somem.
// skipCoverUrl evita repetir a mesma arte da capa no corpo.
// Fallback (IA nao usou marcador): injeta apos o paragrafo do **negrito**.
function injectGameImages(body, gameImages, hasMarkers, skipCoverUrl = null) {
  if (hasMarkers) {
    let coverSkipped = false;
    return body.replace(IMG_MARKER_REGEX, (full, rawName) => {
      const name = rawName.trim();
      const key = Object.keys(gameImages).find((k) => k.toLowerCase() === name.toLowerCase());
      const url = key ? gameImages[key] : null;
      if (!url) return "";
      if (skipCoverUrl && url === skipCoverUrl && !coverSkipped) {
        coverSkipped = true;
        return "";
      }
      return buildImageTag(name, url);
    });
  }

  // Calcula todos os pontos de insercao ANTES de mexer no texto, e aplica de
  // tras pra frente — senao cada insercao desloca os indices seguintes.
  const insertions = [];
  for (const [name, imgUrl] of Object.entries(gameImages)) {
    if (!imgUrl) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`\\*\\*${escaped}\\*\\*`).exec(body);
    if (!match) continue;

    const lineStart = body.lastIndexOf("\n", match.index) + 1;
    const nextBreak = body.indexOf("\n", match.index);
    const lineText = body.slice(lineStart, nextBreak === -1 ? body.length : nextBreak);
    // Nao quebra listas, tabelas nem headings ao meio.
    if (/^\s*(?:[-*+]|\d+\.|#|\|)/.test(lineText)) continue;

    if (skipCoverUrl && imgUrl === skipCoverUrl) continue;

    let paraStart = body.lastIndexOf("\n", match.index - 1) + 1;
    insertions.push({ pos: paraStart, html: `${buildImageTag(name, imgUrl)}\n` });
  }

  let result = body;
  for (const ins of insertions.sort((a, b) => b.pos - a.pos)) {
    result = result.slice(0, ins.pos) + ins.html + result.slice(ins.pos);
  }
  return result;
}

// Remove marcadores que sobraram (IA inventou numero de produto inexistente,
// jogo sem imagem no RAWG, marcador duplicado).
function stripLeftoverMarkers(body) {
  return body
    .replace(/\[(?:IMG|PRODUTO):[^\]\n]*\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function isGamerProduct(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  const nonGamer = [
    "whey", "protein", "suplemento", "parafusadeira", "furadeira",
    "relogio", "relógio", "roupa", "camiseta", "camisa", "bermuda",
    "cosmetico", "cosmético", "cozinha", "decoracao", "decoração",
    "perfume", "maquiagem", "bicicleta", "livro didatico", "livro escolar",
    "sapato", "tenis", "tênis", "chinelo", "bolsa", "mochila escolar",
    "fone de ouvido infantil", "brinquedo bebe", "brinquedo bebê",
    "panelas", "frigideira", "aspirador", "liquidificador", "ventilador",
    "cafeteira", "sanduicheira", "varal", "tapete", "cortina",
    "produto de limpeza", "detergente", "shampoo", "condicionador",
    "suporte para celular carro", "cabo usb generico",
  ];
  for (const kw of nonGamer) {
    if (lower.includes(kw)) return false;
  }
  return true;
}

// URLs que so podem ter sido confundidas com produto (blog, categoria, listagem,
// verificacao, ofertas, variante de vendedor).
const ML_NON_PRODUCT_URL = /(\/blog\/|lista\.mercadolivre|\/c\/|\/gz\/|\/ofertas|\/publica|\/mais-vendidos|\/up\b\/?)/i;
// Titulos que parecem artigo em vez de produto.
const ML_ARTICLE_TITLE = /(mais\s+vendidos(\s+de)?\s*\d{4}|mais\s+vendidos|^\s*guia\s+(de|do|dos|das)|melhores\s+[\wà-ÿ-]+\s+de\s+\d{4})/i;

const ML_STOPWORDS = new Set([
  "que", "para", "com", "uma", "uma", "sobre", "entre", "nas", "nos", "dos", "das", "num", "numa",
  "mais", "melhor", "melhores", "muito", "ser", "sao", "voce", "tudo", "todos", "todas", "outro",
  "antes", "depois", "nesta", "neste", "esta", "este", "aos", "nao", "sem", "ate", "cada",
]);

function mlTopicTokens(topic) {
  const src = [topic?.hint, topic?.ml_query, ...(topic?.trending_keywords || [])]
    .filter(Boolean).join(" ").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = new Set();
  for (const w of src.match(/[a-z0-9]+/g) || []) {
    if (w.length >= 3 && !ML_STOPWORDS.has(w)) tokens.add(w);
  }
  return [...tokens];
}

function mlProductRelevanceScore(p, tokens) {
  const title = normalizeForMatch(p.title || "");
  let score = 0;
  for (const t of tokens) {
    if (title.includes(t)) score += 1;
  }
  return score;
}

// Portao de sanidade aplicado a TODA fonte de produtos: blog/categoria/listagem
// nunca viram item; exige id ou permalink real e preco; prefere itens relevantes ao topico.
function sanitizeProducts(products, topic) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const seen = new Set();
  const candidates = [];
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const url = String(p.permalink || "");
    const title = String(p.title || "");
    if (ML_NON_PRODUCT_URL.test(url)) continue;
    if (ML_ARTICLE_TITLE.test(title)) continue;
    const id = p.id || (url.match(/MLB\d{8,}/) || [])[0] || "";
    if (!id && !url.startsWith("http")) continue;
    const dedupeKey = id || url;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    candidates.push(p);
  }

  const priced = candidates.filter((p) => p.price > 0);
  let out = priced.length > 0 ? priced : candidates;
  if (out !== candidates && out.length < candidates.length) {
    log("WARN", `${candidates.length - out.length} produto(s) sem preco descartados — tabela comparativa exige preco`);
  }

  const tokens = mlTopicTokens(topic);
  if (out.length > 1 && tokens.length > 0) {
    out = out.slice().sort((a, b) => mlProductRelevanceScore(b, tokens) - mlProductRelevanceScore(a, tokens));
  }
  return out;
}

// Detecta a extensao real pelo magic bytes do buffer baixado.
function imageExtension(buf) {
  if (!buf || buf.length < 4) return ".jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return ".webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return ".gif";
  return ".jpg";
}

function buildProductImageTag(p) {
  const url = p.local_thumbnail || (p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "");
  if (!url) return "";
  const title = p.title || "Produto no Mercado Livre";
  return `<img src="${url}" alt="${title}" class="article-game-img" loading="lazy" decoding="async">`;
}

// Lojas cujo nome pede "NA" (feminino) em portugues. Padrao: "NO".
// Chaves normalizadas (sem pontuacao/espaços).
const NA_STORES = new Set([
  "kabum", "amazon", "magalu", "magazineluiza", "shopee", "pichau", "terabyte", "americanas",
  "fastshop", "mercadolivre", "mercadolibre", "submarino", "casasbahia", "extra", "wish",
  "netshoes", "centauro", "kalunga",
]);

function normalizeStoreName(s) {
  let v = String(s || "").toLowerCase().trim();
  v = v.replace(/\s*-\s*.+$/, "");
  v = v.replace(/\.(com\.br|com|br)$/, "");
  v = v.replace(/[^\p{L}\p{N}]+/gu, "");
  return v.trim();
}

function productButtonLabel(p) {
  const src = normalizeStoreName(p?.source);
  if (!src) return "VER NO MERCADO LIVRE";
  if (src === "mercadolivre" || src === "mercadolibre") return "VER NO MERCADO LIVRE";
  const store = src.toUpperCase();
  return NA_STORES.has(src) ? `VER NA ${store}` : `VER NO ${store}`;
}

function buildProductButtonHtml(p) {
  const link = p.affiliate_link || p.permalink || "";
  if (!link) return "";
  const label = productButtonLabel(p);
  return `<a href="${link}" class="product-btn" target="_blank" rel="nofollow">${label}</a>`;
}

// Ultimo recurso de imagem do item: gera uma foto de catalogo via OpenAI.
async function gerarImagemItemIA(title, slug) {
  if (!OPENAI_API_KEY || !title) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: `Foto de catalogo profissional de produto gamer: ${title}. Produto grande e nítido sobre mesa de madeira com luz ambiente de setup RGB, fundo levemente desfocado com bokeh. Fotorrealista, alta qualidade, sem texto, sem marca d'agua.`,
        n: 1,
        size: "1024x1024",
      }),
    });
    if (!res.ok) {
      log("WARN", `IA imagem item ${res.status} para "${title.slice(0, 40)}"`);
      return null;
    }
    const data = await res.json();
    const url = data?.data?.[0]?.url;
    if (!url) return null;
    const buf = await downloadImage(url);
    if (buf) {
      log("INFO", `IA imagem item gerada para "${title.slice(0, 40)}" (${(buf.length / 1024).toFixed(1)} KB)`);
      return buf;
    }
  } catch (e) {
    log("WARN", `IA imagem item erro: ${e.message}`);
  }
  return null;
}

// Baixa e salva a foto de cada item em public/images/produtos/.
// Cadeia de prioridade: thumbnail do ML -> busca web (Tavily) -> IA (ultimo recurso).
async function ensureProductImages(mlProducts) {
  if (!mlProducts || mlProducts.length === 0) return;
  if (!fs.existsSync(PROD_IMAGES_DIR)) fs.mkdirSync(PROD_IMAGES_DIR, { recursive: true });

  for (const p of mlProducts) {
    const slug = slugify(p.title || `produto-${mlProducts.indexOf(p) + 1}`);

    if (fs.existsSync(path.join(PROD_IMAGES_DIR, `${slug}.png`))) {
      p.local_thumbnail = `/blog-gamer/images/produtos/${slug}.png`;
      continue;
    }
    if (fs.existsSync(path.join(PROD_IMAGES_DIR, `${slug}.jpg`))) {
      p.local_thumbnail = `/blog-gamer/images/produtos/${slug}.jpg`;
      continue;
    }
    if (fs.existsSync(path.join(PROD_IMAGES_DIR, `${slug}.webp`))) {
      p.local_thumbnail = `/blog-gamer/images/produtos/${slug}.webp`;
      continue;
    }

    let buf = null;
    const directUrl = p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "";
    if (directUrl) {
      try {
        const b = await downloadImage(directUrl);
        if (b && b.length > 2048) buf = b;
      } catch {}
    }
    if (buf) {
      log("INFO", `Thumbnail ML OK para "${p.title?.slice(0, 40)}"`);
    } else {
      log("WARN", `Sem imagem valida do ML para "${p.title?.slice(0, 40)}" — buscando na web...`);
      try {
        buf = await searchTavilyImage(p.title || "");
      } catch {}
    }
    if (!buf) {
      buf = await gerarImagemItemIA(p.title, slug);
    }

    if (buf) {
      const ext = imageExtension(buf);
      fs.writeFileSync(path.join(PROD_IMAGES_DIR, `${slug}${ext}`), buf);
      p.local_thumbnail = `/blog-gamer/images/produtos/${slug}${ext}`;
      log("INFO", `Imagem do item salva: ${p.local_thumbnail} (${(buf.length / 1024).toFixed(1)} KB)`);
    } else {
      log("WARN", `Nenhuma imagem obtida para "${p.title?.slice(0, 40)}" — item sem foto`);
    }
  }
}

// Gera um sumário/índice com links âncora a partir dos headings ## do artigo
function injectTableOfContents(body) {
  if (!body || typeof body !== "string") return body;

  const headings = [...body.matchAll(/^(## )([^\n]+)$/gm)];
  if (headings.length < 3) return body;

  const excluded = /^(fontes|conclus[aã]o|quer mais ofertas\?|faq|perguntas frequentes|resumo r[áa]pido|veredito|continue explorando)/i;

  const items = headings
    .filter((m) => !excluded.test(m[2].trim()))
    .map((m) => {
      const title = m[2].trim();
      const baseAnchor = title.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      return { title, baseAnchor };
    });

  if (items.length < 3) return body;

  // Gera âncoras únicas
  const usedAnchors = new Set();
  const tocItems = items.map((item, idx) => {
    let anchor = item.baseAnchor;
    let suffix = 1;
    while (usedAnchors.has(anchor)) {
      anchor = `${item.baseAnchor}-${suffix}`;
      suffix++;
    }
    usedAnchors.add(anchor);
    return { title: item.title, anchor };
  });

  const tocLines = tocItems.map((item, idx) => `${idx + 1}. [${item.title}](#${item.anchor})`);
  const toc = `## Índice\n\n${tocLines.join("\n")}\n`;

  // Cria mapa título -> âncora final para inserir nos headings
  const anchorMap = new Map(tocItems.map((item) => [item.title, item.anchor]));

  // Insere âncoras nos headings originais
  const result = body.replace(/^(## )([^\n]+)$/gm, (match, hashes, title) => {
    const trimmedTitle = title.trim();
    if (excluded.test(trimmedTitle)) return match;
    const anchor = anchorMap.get(trimmedTitle);
    if (!anchor) return match;
    return `${hashes}<a id="${anchor}"></a>${trimmedTitle}`;
  });

  return `${toc}\n${result}`;
}

// Substitui [PRODUTO:N] pelo botao e injeta a foto do produto logo apos o
// heading ## da secao do item. Fallback posicional so quando a IA ignorou
// o mecanismo inteiro (nenhum marcador); se usou algum, omissao e editorial.
function injectProductCards(body, mlProducts) {
  if (!mlProducts || mlProducts.length === 0) return body;

  const excludedHeading = /(?:fontes|conclus[aã]o|quer mais ofertas\?|faq|perguntas frequentes|veredito|continue explorando|índice|indice|resumo r[áa]pido)/i;

  // 1. Foto do produto: insere logo apos o heading ## mais proximo que antecede
  //    o marcador (a secao do item), sem duplicar quando ja existe um <img>.
  let result = body;
  mlProducts.forEach((p, i) => {
    const imgTag = buildProductImageTag(p);
    if (!imgTag) return;
    const marker = new RegExp(`^[ \\t]*\\[PRODUTO:\\s*${i + 1}\\s*\\][ \\t]*$`, "m");
    if (!marker.test(result)) return;

    const markerIndex = result.search(marker);
    const headingMatch = [...result.slice(0, markerIndex).matchAll(/^##\s+([^\n]+)$/gm)]
      .reverse()
      .find((m) => !excludedHeading.test(m[1].trim()));
    if (!headingMatch) return;

    const afterHeading = result.slice(headingMatch.index + headingMatch[0].length);
    const nextContent = afterHeading.match(/^\s*\n{0,}(<img[^>]*>|\S)/);
    if (nextContent && nextContent[1].startsWith("<img")) return;

    const insertAt = headingMatch.index + headingMatch[0].length;
    result = result.slice(0, insertAt) + `\n\n${imgTag}\n` + result.slice(insertAt);
  });

  // 2. Botao no lugar do marcador.
  const orphans = [];
  let markersUsed = 0;
  mlProducts.forEach((p, i) => {
    const btn = buildProductButtonHtml(p);
    if (!btn) return;
    const marker = new RegExp(`^[ \\t]*\\[PRODUTO:\\s*${i + 1}\\s*\\][ \\t]*$`, "m");
    if (marker.test(result)) {
      result = result.replace(marker, () => `\n${btn}\n`);
      markersUsed++;
    } else {
      orphans.push(p);
    }
  });

  if (orphans.length > 0) {
    if (markersUsed === 0) {
      log("WARN", `${orphans.length}/${mlProducts.length} produtos sem marcador — usando posicionamento automatico`);
      const block = "\n\n" + orphans
        .map((p) => [buildProductImageTag(p), buildProductButtonHtml(p)].filter(Boolean).join("\n\n"))
        .join("\n\n") + "\n";
      const headings = [...result.matchAll(/## (?!Fontes|Quer mais ofertas\?|Conclus[aã]o\b|Continue Explorando|Índice|Indice)[^\n]+/gi)];
      if (headings.length >= 2) {
        result = result.slice(0, headings[1].index) + block + "\n" + result.slice(headings[1].index);
      } else {
        result = result + block;
      }
    } else {
      log("INFO", `${orphans.length}/${mlProducts.length} produtos omitidos pela IA (sem marcador) — respeitando decisao editorial`);
    }
  }

  return result;
}

function formatProductPriceForPrompt(p) {
  return p.price ? `R$ ${p.price.toFixed(2)}` : "NAO DISPONIVEL";
}

function cleanFakeImages(body) {
  return body
    .replace(/<img[^>]*src="https?:\/\/upload\.wikimedia\.org[^"]*"[^>]*>/gi, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n");
}

// Prioriza o jogo que a IA marcou no corpo — e o que o artigo realmente fala.
// Keyword trending e thumbnail de produto sao fallback.
async function getBestCoverImage(products, articleBody, trendingKeyword, markedGames = []) {
  for (const name of markedGames.slice(0, 3)) {
    const img = await fetchRAWGImage(name);
    if (img) return img;
  }
  if (trendingKeyword) {
    const img = await fetchRAWGImage(trendingKeyword);
    if (img) return img;
  }
  const gameNames = extractGameNames(articleBody);
  if (gameNames.length > 0) {
    const img = await fetchRAWGImage(gameNames[0]);
    if (img) return img;
  }
  for (const p of products) {
    if (p.thumbnail && p.thumbnail.startsWith("http")) return p.thumbnail;
  }
  return "";
}

async function fetchTavily(query) {
  if (!TAVILY_API_KEY) { log("WARN", "TAVILY_API_KEY nao definida — pulando pesquisa de fontes"); return null; }
  log("INFO", `Tavily: buscando "${query}"`);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY, query,
      search_depth: "advanced", max_results: 5,
      topic: "news", include_answer: true, time_range: "month",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    const errText = typeof err === "string" ? err : String(err);
    throw new Error(`Tavily ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  log("INFO", `Tavily: ${data.results?.length || 0} resultados`);
  return data;
}

const TAVILY_IMAGE_CACHE = {};

async function fetchTavilyImage(query) {
  if (!TAVILY_API_KEY) return null;
  const cacheKey = query.toLowerCase().trim();
  if (TAVILY_IMAGE_CACHE[cacheKey] !== undefined) return TAVILY_IMAGE_CACHE[cacheKey];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query + " gaming",
        search_depth: "basic",
        max_results: 3,
        include_images: true,
      }),
      timeout: 10000,
    });
    if (!res.ok) {
      log("WARN", `Tavily image search falhou: ${res.status}`);
      TAVILY_IMAGE_CACHE[cacheKey] = null;
      return null;
    }
    const data = await res.json();
    if (data.images && data.images.length > 0) {
      const imgUrl = typeof data.images[0] === "string" ? data.images[0] : data.images[0].url;
      if (imgUrl && imgUrl.startsWith("http")) {
        TAVILY_IMAGE_CACHE[cacheKey] = imgUrl;
        log("INFO", `Tavily imagem "${query.slice(0, 30)}" -> ${imgUrl.slice(0, 60)}`);
        return imgUrl;
      }
    }
    log("WARN", `Tavily: nenhuma imagem encontrada para "${query.slice(0, 30)}"`);
    TAVILY_IMAGE_CACHE[cacheKey] = null;
    return null;
  } catch (e) {
    log("WARN", `Tavily image erro: ${e.message}`);
    TAVILY_IMAGE_CACHE[cacheKey] = null;
    return null;
  }
}

// Budget generoso para caber Gemini (ate 8192 tokens de saida) e Groq (ate 32768
// de entrada). A conta Groq free limita a 8000 TPM, mas o erro 429 e tratado com
// retry. O importante e nao truncar a resposta.
const TOKEN_BUDGET = 64000;
const TOKEN_SAFETY_MARGIN = 500;
const MIN_OUTPUT = 3000;
const MAX_OUTPUT = 8192;

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 3.3);
}

// Sobra de tokens para a resposta depois de descontar o prompt.
function computeMaxTokens(systemPrompt, userPrompt) {
  const promptTokens = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
  const available = TOKEN_BUDGET - promptTokens - TOKEN_SAFETY_MARGIN;
  return Math.min(MAX_OUTPUT, available);
}

async function fetchGroq(systemPrompt, userPrompt, maxAttempts = 5, opts = {}) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? computeMaxTokens(systemPrompt, userPrompt),
  };

  if (body.max_tokens < 1000) {
    throw new Error(`Groq: prompt grande demais — sobram so ${body.max_tokens} tokens de saida no limite de ${TOKEN_BUDGET} TPM`);
  }
  const startTime = Date.now();
  const MAX_TOTAL_WAIT = 5 * 60 * 1000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log("INFO", `Groq: tentativa ${attempt}/${maxAttempts}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 503 || res.status === 502) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOTAL_WAIT) {
          log("ERROR", `Groq: timeout total de ${MAX_TOTAL_WAIT / 1000}s atingido, desistindo`);
          throw new Error(`Groq: timeout total apos ${attempt} tentativas`);
        }
        const wait = Math.min(15 * Math.pow(2, attempt - 1), 120);
        log("WARN", `Groq: ${res.status}, aguardando ${wait}s (tentativa ${attempt}/${maxAttempts})...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        const errText = typeof err === "string" ? err : String(err);
        const msg = `Groq ${res.status}: ${errText.slice(0, 300)}`;
        if (res.status === 401) {
          log("ERROR", `Groq: API key invalida! Atualize GROQ_API_KEY no GitHub Secrets.`);
        }
        // 413 e deterministico (tamanho da requisicao): retentar so perde tempo.
        if (res.status === 413) {
          log("ERROR", `Groq: requisicao maior que o limite de ${TOKEN_BUDGET} TPM (prompt + max_tokens=${body.max_tokens}). Reduza o prompt.`);
          const fatal = new Error(msg);
          fatal.fatal = true;
          throw fatal;
        }
        throw new Error(msg);
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice?.message?.content)
        throw new Error(`Groq: resposta vazia: ${JSON.stringify(data).slice(0, 200)}`);
      if (choice.finish_reason === "length")
        throw new Error(`Groq: resposta truncada (max_tokens=${body.max_tokens})`);
      return choice.message.content;
    } catch (err) {
      if (err.fatal || attempt === maxAttempts) throw err;
      const wait = Math.min(10 * Math.pow(2, attempt - 1), 60);
      const errMsg = err?.message || String(err);
      log("WARN", `Groq: erro "${errMsg.slice(0,80)}", retentando em ${wait}s...`);
      await sleep(wait * 1000);
    }
  }
  throw new Error(`Groq: todas as ${maxAttempts} tentativas falharam`);
}

async function fetchOpenAI(systemPrompt, userPrompt, opts = {}) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI: OPENAI_API_KEY nao configurada");
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
  };
  const startTime = Date.now();
  const MAX_TOTAL_WAIT = 3 * 60 * 1000;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      log("INFO", `OpenAI: tentativa ${attempt}/3...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 503 || res.status === 502) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOTAL_WAIT) {
          log("ERROR", `OpenAI: timeout total de ${MAX_TOTAL_WAIT / 1000}s atingido`);
          throw new Error(`OpenAI: timeout total apos ${attempt} tentativas`);
        }
        const errBody = await res.text().catch(() => "(sem body)");
        const wait = Math.min(15 * Math.pow(2, attempt - 1), 60);
        const rl = {
          remaining: res.headers.get("x-ratelimit-remaining"),
          limit: res.headers.get("x-ratelimit-limit"),
          reset: res.headers.get("x-ratelimit-reset"),
          retryAfter: res.headers.get("retry-after"),
        };
        log("WARN", `OpenAI: ${res.status}, rate-limit: ${JSON.stringify(rl)}, body: ${errBody.slice(0, 200)}, aguardando ${wait}s (tentativa ${attempt}/3)...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        const errText = typeof err === "string" ? err : String(err);
        const msg = `OpenAI ${res.status}: ${errText.slice(0, 300)}`;
        if (res.status === 401) {
          log("ERROR", `OpenAI: API key invalida! Atualize OPENAI_API_KEY no GitHub Secrets.`);
        }
        throw new Error(msg);
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice?.message?.content)
        throw new Error(`OpenAI: resposta vazia: ${JSON.stringify(data).slice(0, 200)}`);
      if (choice.finish_reason === "length")
        throw new Error(`OpenAI: resposta truncada (max_tokens=${body.max_tokens})`);
      return choice.message.content;
    } catch (err) {
      if (attempt === 3) throw err;
      const wait = Math.min(10 * Math.pow(2, attempt - 1), 60);
      const errMsg = err?.message || String(err);
      log("WARN", `OpenAI: erro "${errMsg.slice(0, 80)}", retentando em ${wait}s...`);
      await sleep(wait * 1000);
    }
  }
  throw new Error(`OpenAI: todas as 3 tentativas falharam`);
}

async function fetchGemini(systemPrompt, userPrompt, maxAttempts = 5, opts = {}) {
  if (!GEMINI_API_KEY) throw new Error("Gemini: GEMINI_API_KEY nao configurada");
  const model = opts.model || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? computeMaxTokens(systemPrompt, userPrompt),
    },
  };

  if (body.generationConfig.maxOutputTokens < 1000) {
    throw new Error(`Gemini: prompt grande demais — sobram so ${body.generationConfig.maxOutputTokens} tokens de saida no limite de ${TOKEN_BUDGET} TPM`);
  }

  const startTime = Date.now();
  const MAX_TOTAL_WAIT = 5 * 60 * 1000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log("INFO", `Gemini: tentativa ${attempt}/${maxAttempts}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 503 || res.status === 502) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_TOTAL_WAIT) {
          log("ERROR", `Gemini: timeout total de ${MAX_TOTAL_WAIT / 1000}s atingido, desistindo`);
          throw new Error(`Gemini: timeout total apos ${attempt} tentativas`);
        }
        const wait = Math.min(15 * Math.pow(2, attempt - 1), 120);
        log("WARN", `Gemini: ${res.status}, aguardando ${wait}s (tentativa ${attempt}/${maxAttempts})...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        const errText = typeof err === "string" ? err : String(err);
        const msg = `Gemini ${res.status}: ${errText.slice(0, 300)}`;
        if (res.status === 401 || res.status === 400) {
          log("ERROR", `Gemini: API key invalida ou requisicao rejeitada! Verifique GEMINI_API_KEY.`);
          const fatal = new Error(msg);
          fatal.fatal = true;
          throw fatal;
        }
        throw new Error(msg);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Gemini: resposta vazia: ${JSON.stringify(data).slice(0, 200)}`);
      if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        throw new Error(`Gemini: resposta truncada (maxOutputTokens=${body.generationConfig.maxOutputTokens})`);
      }
      return text;
    } catch (err) {
      if (err.fatal || attempt === maxAttempts) throw err;
      const wait = Math.min(10 * Math.pow(2, attempt - 1), 60);
      const errMsg = err?.message || String(err);
      log("WARN", `Gemini: erro "${errMsg.slice(0, 80)}", retentando em ${wait}s...`);
      await sleep(wait * 1000);
    }
  }
  throw new Error(`Gemini: todas as ${maxAttempts} tentativas falharam`);
}

async function fetchLLM(systemPrompt, userPrompt, maxAttempts = 3, opts = {}) {
  try {
    return await fetchGemini(systemPrompt, userPrompt, maxAttempts, opts);
  } catch (geminiErr) {
    const errMsg = geminiErr?.message || String(geminiErr);
    log("WARN", `Gemini falhou: ${errMsg.slice(0, 120)} — tentando Groq...`);
    try {
      return await fetchGroq(systemPrompt, userPrompt, maxAttempts, opts);
    } catch (groqErr) {
      const groqErrMsg = groqErr?.message || String(groqErr);
      log("WARN", `Groq falhou: ${groqErrMsg.slice(0, 120)} — tentando OpenAI...`);
      return await fetchOpenAI(systemPrompt, userPrompt, opts);
    }
  }
}

// Gate de qualidade barato: uma chamada curta so pra consertar o titulo,
// em vez de descartar um artigo bom por causa de uma linha.
async function regenerateTitle(currentTitle, topicHint, primaryKeyword, categoria) {
  const sys = `Voce e editor de SEO de um blog gamer brasileiro. Responda APENAS com o titulo novo, em uma linha, sem aspas e sem explicacao.`;
  const user = `Reescreva este titulo de artigo (categoria ${categoria}) sobre "${topicHint}":

"${currentTitle}"

Regras:
- 55 a 65 caracteres.
${primaryKeyword ? `- A palavra-chave "${primaryKeyword}" nos primeiros 40% do titulo.` : "- Palavra-chave principal no comeco."}
- Use numero, data ou beneficio concreto.
- Proibido: "Tudo que voce precisa saber", "Novidades que vao bombar", "Fique por dentro", "Imperdivel", "Revolucionario", "O que esperar".
- Sem clickbait vazio, sem emoji, sem markdown.`;

  try {
    const out = await fetchLLM(sys, user, 2, { maxTokens: 512, temperature: 0.6 });
    return out.trim().split("\n").filter(Boolean).pop()?.replace(/^["']|["']$/g, "").trim() || null;
  } catch (e) {
    log("WARN", `Reescrita de titulo falhou: ${e.message}`);
    return null;
  }
}

function parseFrontmatter(text) {
  let match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    match = text.match(/^---\n([\s\S]*?)\n+## /);
    if (match) {
      const raw = match[1];
      const body = text.slice(text.indexOf("## "));
      return { frontmatter: parseRaw(raw), body: body.trim() };
    }
    throw new Error("Frontmatter nao encontrado");
  }
  const raw = match[1];
  const body = match[2].trim();
  return { frontmatter: parseRaw(raw), body };
}

function parseRaw(raw) {
  const fm = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 2).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    }
    if (val === "true") val = true;
    if (val === "false") val = false;
    fm[key] = val;
  }
  return fm;
}

// Alinhado ao orcamento de saida da Groq (8000 TPM): pedir mais que isso faz
// o artigo ser truncado no meio.
const MIN_WORDS = { guia: 800, review: 800, noticia: 650, lista: 650 };
const ABSOLUTE_MIN_WORDS = 500;

const GENERIC_TITLE_PATTERNS = [
  /tudo (o )?que voc[êe] precisa saber/i,
  /novidades que v[ãa]o \w+/i,
  /voc[êe] n[ãa]o vai acreditar/i,
  /fique por dentro/i,
  /confira( agora)?[!?]*$/i,
  /imperd[íi]vel/i,
  /surpreendente/i,
  /revolucion[áa]ri[oa]/i,
  /o que esperar\s*[?!]*$/i,
];

function capitalizeTitle(title) {
  const t = String(title || "").trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Regras de SERP/CTR. Retorna lista de problemas (vazia = titulo aprovado).
function checkTitle(title, primaryKeyword) {
  const problems = [];
  const t = String(title || "");
  if (t.length > 0) {
    const first = t.charAt(0);
    if (first === first.toLowerCase() && first !== first.toUpperCase()) {
      problems.push("title: comeca com letra minuscula");
    }
  }
  if (t.length < 40) problems.push(`title: curto demais (${t.length} chars — ideal 55-65)`);
  if (t.length > 70) problems.push(`title: longo demais (${t.length} chars — ideal 55-65)`);
  for (const re of GENERIC_TITLE_PATTERNS) {
    const m = t.match(re);
    if (m) problems.push(`title: expressao generica/clickbait "${m[0]}"`);
  }
  if (primaryKeyword) {
    const nt = normalizeForMatch(t);
    const idx = nt.indexOf(normalizeForMatch(primaryKeyword));
    if (idx === -1) problems.push(`title: nao contem a palavra-chave "${primaryKeyword}"`);
    else if (nt.length > 0 && idx / nt.length > 0.4) problems.push(`title: palavra-chave "${primaryKeyword}" aparece tarde demais (${Math.round((idx / nt.length) * 100)}% do titulo)`);
  }
  return problems;
}

// hard = nao publica de jeito nenhum. soft = vale regerar, mas nao derruba a
// execucao na ultima tentativa (o cron diario nao pode ficar sem artigo).
function findPricesInBody(body, prices) {
  const matches = [];
  const seen = new Set();
  for (const m of body.matchAll(/R\$\s*([\d.,]+)/g)) {
    const raw = m[1].replace(/\./g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (Number.isNaN(val)) continue;
    const rounded = Math.round(val * 100) / 100;
    if (prices.some((p) => Math.abs(p - rounded) < 0.01) && !seen.has(rounded)) {
      seen.add(rounded);
      matches.push(rounded.toFixed(2));
    }
  }
  return matches;
}

function validate(fm, body, ctx = {}) {
  const hard = [];
  const soft = [];

  if (!fm.title || String(fm.title).length < 10) hard.push("title: muito curto");
  if (!fm.description || String(fm.description).length < 120) hard.push("description: muito curto (min 120)");
  if (!fm.pubDate) hard.push("pubDate: ausente");
  if (!fm.category) hard.push("category: ausente");
  else if (!["noticia", "review", "guia", "lista"].includes(fm.category)) hard.push(`category: invalida (${fm.category})`);
  if (!fm.tags || !Array.isArray(fm.tags) || fm.tags.length < 3) hard.push("tags: minimo 3");
  if (fm.affiliate === undefined) hard.push("affiliate: ausente");

  if (hasForbiddenTerm(fm.title, fm.description, fm.category, (fm.tags || []).join(" "), body)) {
    hard.push("Tema proibido detectado (apostas, cassino, caça-níqueis, jogos de azar)");
  }

  const wc = body.split(/\s+/).filter(Boolean).length;
  const min = MIN_WORDS[ctx.category] || 650;
  const floor = ctx.lastAttempt ? ABSOLUTE_MIN_WORDS : min;
  if (wc < floor && !ctx.relaxedWordCount) hard.push(`Conteudo muito curto: ${wc} palavras (minimo ${min})`);
  else if (wc < min) soft.push(`Conteudo abaixo do alvo: ${wc} palavras (minimo ${min})`);

  if (!/^##\s+/m.test(body)) hard.push("Artigo sem headings ##");

  // Verifica se o artigo mistura games e hardware no mesmo texto
  // Nas primeiras tentativas e um alerta (soft) para dar feedback a IA; na ultima e bloqueante (hard)
  const domainBlocking = ctx.lastAttempt && !ctx.softMixedDomain;
  if (isMixedDomain(fm.title)) {
    const { gameMatches, hardwareMatches } = explainMixedDomain(fm.title);
    const msg = `Titulo mistura dominios: games=[${gameMatches.join(", ")}], hardware=[${hardwareMatches.join(", ")}]`;
    domainBlocking ? hard.push(msg) : soft.push(msg);
  }
  if (isMixedDomain(body)) {
    const { gameMatches, hardwareMatches } = explainMixedDomain(body);
    const msg = `Corpo mistura dominios: games=[${gameMatches.join(", ")}], hardware=[${hardwareMatches.join(", ")}]`;
    domainBlocking ? hard.push(msg) : soft.push(msg);
  }

  if (ctx.productCount > 0 && !ctx.segmented) {
    const used = new Set([...body.matchAll(PRODUCT_MARKER_REGEX)].map((m) => Number(m[1])));
    const valid = [...used].filter((n) => n >= 1 && n <= ctx.productCount);
    if (valid.length === 0) {
      soft.push(`Nenhum marcador [PRODUTO:N] usado (havia ${ctx.productCount} produtos disponiveis)`);
    } else if (valid.length < Math.min(2, ctx.productCount)) {
      soft.push(`So ${valid.length} de ${ctx.productCount} produtos posicionados com [PRODUTO:N]`);
    }
    if (valid.length > 0) {
      const excluded = /(?:fontes|conclus[aã]o|quer mais ofertas\?|faq|perguntas frequentes|veredito|continue explorando|índice|indice)/i;
      const markers = [...body.matchAll(PRODUCT_MARKER_REGEX)];
      const fora = markers.filter((m) => {
        const before = body.slice(0, m.index);
        const lastHeading = [...before.matchAll(/^##\s+([^\n]+)$/gm)].pop();
        if (!lastHeading) return true;
        return excluded.test(lastHeading[1].trim());
      });
      if (fora.length > 0) {
        soft.push(`${fora.length} marcador(es) [PRODUTO:N] fora da secao de Itens (introducao ou secoes finais) — todos devem ficar na lista logo apos a intro`);
      }
    }
  }

  // Fluxo segmentado: cada produto DEVE virar um item "## Nome" e aparecer na
  // tabela comparativa. Se a montagem quebrou, o artigo nao pode publicar.
  if (ctx.segmented && ctx.productCount > 0) {
    const headings = [...body.matchAll(/^##\s+([^\n]+)$/gm)].map((m) => m[1].trim());
    const tableRows = body.split("\n").filter((l) => /^\|.*\|$/.test(l)).join("\n");
    const missingAsHeading = [];
    const missingInTable = [];
    for (const p of ctx.products || []) {
      if (!p?.title) continue;
      if (!headings.some((h) => h === p.title || h.startsWith(`${p.title} — `))) {
        missingAsHeading.push(p.title.slice(0, 60));
      }
      if (!tableRows.includes(p.title)) missingInTable.push(p.title.slice(0, 60));
    }
    if (missingAsHeading.length > 0) hard.push(`Itens sem secao ## propria (montagem quebrou): ${missingAsHeading.join(" | ")}`);
    if (missingInTable.length > 0) hard.push(`Produtos ausentes da tabela comparativa: ${missingInTable.join(" | ")}`);
  }

  // Secao ## sem conteudo abaixo dela (heading "guarda-chuva" vazio).
  const h2s = [...body.matchAll(/^##\s+([^\n]+)$/gm)];
  for (let i = 0; i < h2s.length; i++) {
    const title = h2s[i][1].trim();
    // No fluxo segmentado o heading da lista e secao-pai dos itens: seu
    // "conteudo" sao os proprio sub-headings ## (validados separadamente).
    if (ctx.segmented && ctx.listHeading && title === ctx.listHeading) continue;
    const start = h2s[i].index + h2s[i][0].length;
    const end = h2s[i + 1] ? h2s[i + 1].index : body.length;
    const content = body.slice(start, end).replace(/^\s*\n*/, "").trim();
    if (!content) hard.push(`Secao ## vazia: "${title.slice(0, 60)}"`);
  }

  // Vocabulario da estrutura antiga ("card") nao existe mais.
  if (/(confira o preco atual no card|no card do produto|no card de produto|veja o card|preco no card)/i.test(body)) {
    hard.push('Texto menciona "card" — a estrutura nova usa botao "VER NO MERCADO LIVRE" e tabela comparativa');
  }

  if (extractImageMarkers(body).length === 0) {
    soft.push("Nenhum marcador [IMG:Nome do Jogo] usado — artigo ficara sem imagens no corpo");
  }

  soft.push(...checkTitle(fm.title, ctx.primaryKeyword));

  if (ctx.productPrices?.length) {
    const prosePrices = findPricesInBody(body, ctx.productPrices);
    if (prosePrices.length > 0) {
      soft.push(`Corpo contem preco de produto em prosa (R$ ${prosePrices.join(", R$ ")}) — preco fica so na tabela comparativa, nunca no texto`);
    }
  }

  return { hard, soft };
}

function countArticlesInDir() {
  if (!fs.existsSync(ARTIGOS_DIR)) return 0;
  return fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).length;
}

function getExistingSlugs() {
  if (!fs.existsSync(ARTIGOS_DIR)) return [];
  return fs.readdirSync(ARTIGOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function getRecentArticlesForPrompt(limit = 12) {
  if (!fs.existsSync(ARTIGOS_DIR)) return [];
  const articles = fs.readdirSync(ARTIGOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
      const titleMatch = content.match(/^title:\s*"?([^"\n]+)"?/m);
      const pubMatch = content.match(/^pubDate:\s*(\S+)/m);
      return {
        slug: f.replace(/\.md$/, ""),
        title: (titleMatch?.[1] || f).slice(0, 55),
        pubDate: pubMatch?.[1] || "",
      };
    });
  return articles.sort((a, b) => b.pubDate.localeCompare(a.pubDate)).slice(0, limit);
}

function buildInternalLinksBlock() {
  const articles = getRecentArticlesForPrompt(12);
  if (articles.length === 0) return "";
  const lines = articles.map((a) => `- ${a.title} -> /blog-gamer/blog/${a.slug}/`);
  return `\nARTIGOS EXISTENTES (links internos SO desta lista — proibido inventar slug):\n${lines.join("\n")}\n`;
}

function validateSourceCoverage(body, sources = []) {
  const warnings = [];
  if (!body || typeof body !== "string") return warnings;

  // Seção Fontes
  const fontesSection = /##\s+Fontes[\s\S]*$/i.test(body);
  if (!fontesSection) {
    warnings.push("Secao ## Fontes ausente — artigo sem citacao de fontes");
  }

  if (sources.length === 0) {
    warnings.push("Nenhuma fonte de pesquisa disponivel para validacao de dados");
    return warnings;
  }

  const sourceText = sources.map((s) => String(s.title || "") + " " + String(s.content || "") + " " + String(s.url || "")).join("\n");
  const sourceTextLower = sourceText.toLowerCase();

  // Extrai anos (ex: 2026, 2027) e verifica se estão nas fontes
  const years = [...new Set([...(body.match(/\b20[2-9]\d\b/g) || [])])];
  const missingYears = years.filter((y) => !sourceTextLower.includes(y));
  if (missingYears.length > 0) {
    warnings.push(`Anos mencionados sem suporte nas fontes: ${missingYears.join(", ")}`);
  }

  // Extrai notas de review (ex: 8/10, 9.5, Metacritic 85)
  const scores = [...new Set([
    ...(body.match(/\b\d{1,2}(?:[.,]\d+)?\s*\/\s*10\b/gi) || []),
    ...(body.match(/\bMetacritic\s*[:\-]?\s*\d{1,3}\b/gi) || []),
    ...(body.match(/\bnota\s*[:\-]?\s*\d{1,2}(?:[.,]\d+)?\b/gi) || []),
  ])];
  const missingScores = scores.filter((s) => !sourceTextLower.includes(s.toLowerCase()));
  if (missingScores.length > 0) {
    warnings.push(`Notas/reviews mencionadas sem suporte nas fontes: ${missingScores.join(", ")}`);
  }

  // Verifica se há preços em prosa (preços de produtos devem ficar nos cards)
  const prosePrices = [...body.matchAll(/R\$\s*([\d.,]+)/g)].map((m) => m[0]);
  if (prosePrices.length > 0) {
    warnings.push(`Precos em prosa detectados (${prosePrices.length}x) — preco deve ficar apenas no card do produto`);
  }

  return warnings;
}

function validateInternalLinks(body) {
  const existingSlugs = getExistingSlugs();
  const linkRegex = /\[([^\]]+)\]\(\/blog-gamer\/blog\/([^)]+?)\/?\)/g;
  let match;
  let fixed = body;
  while ((match = linkRegex.exec(fixed)) !== null) {
    const slug = match[2];
    if (!existingSlugs.includes(slug)) {
      log("WARN", `Link interno invalido removido: /blog-gamer/blog/${slug}/`);
      fixed = fixed.replace(match[0], "");
    }
  }
  return fixed.replace(/\n{3,}/g, "\n\n");
}

function getCategoryCounts() {
  const counts = {};
  if (!fs.existsSync(ARTIGOS_DIR)) return counts;
  for (const f of fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"))) {
    const c = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
    const m = c.match(/category:\s*(.+)/);
    if (m) {
      const cat = m[1].replace(/["']/g, "").trim();
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return counts;
}

function pickTopic(counts) {
  const sorted = [...CATEGORIES].sort((a, b) => (counts[a.slug] || 0) - (counts[b.slug] || 0));
  return TOPIC_SEEDS.find((s) => s.category === sorted[0].slug) || TOPIC_SEEDS[0];
}

async function main() {
  log("INFO", "=== INICIANDO GERACAO (Groq) ===");
  log("INFO", `GEMINI_API_KEY definida: ${!!GEMINI_API_KEY}`);
  log("INFO", `GROQ_API_KEY definida: ${!!GROQ_API_KEY}`);
  log("INFO", `TAVILY_API_KEY definida: ${!!TAVILY_API_KEY}`);
  log("INFO", `SERPER_API_KEY definida: ${!!SERPER_API_KEY}`);

  if (!GEMINI_API_KEY && !GROQ_API_KEY) { log("ERROR", "Nenhuma chave de IA configurada (GEMINI_API_KEY ou GROQ_API_KEY)"); process.exit(1); }
  if (!TAVILY_API_KEY) log("WARN", "TAVILY_API_KEY nao definida — artigo seguira sem fontes pesquisadas");

  const state = loadState();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const totalArticles = countArticlesInDir();
  log("INFO", `Total artigos: ${totalArticles}`);

  if (state.last_success && !process.env.FORCE_GENERATE) {
    const lastDate = new Date(state.last_success + "T00:00:00Z");
    const hoursSinceLast = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < 20) {
      log("INFO", `Artigo gerado ha ${hoursSinceLast.toFixed(1)}h, cooldown de 20h nao atingido — pulando`);
      process.exit(0);
    }
  }

  if (state.consecutive_failures > 0) {
    log("INFO", `${state.consecutive_failures} falhas consecutivas anteriores, tentando novamente`);
  }

  let topic = null;
  let trendingSource = "estatico";
  const existingTopics = state.recent_topics || [];
  const recentKeywords = state.recent_keywords || [];

  try {
    const trending = await discoverTrendingTopic(existingTopics, recentKeywords);
    if (trending && trending.trending_score >= 1) {
      topic = trending;
      trendingSource = "trending";
    }
  } catch (e) {
    log("WARN", `Trending discovery falhou, usando fallback: ${e.message}`);
  }

  if (!topic) {
    topic = pickTopic(getCategoryCounts());
    log("INFO", `Tema estatico: ${topic.category} - ${topic.hint}`);
  } else {
    log("INFO", `Tema trending (${trendingSource}): [${topic.category}] ${topic.hint}`);
  }

  const assignedCategory = nextCategory(state.last_category || "");
  topic.category = assignedCategory;
  log("INFO", `Categoria esteira: ${topic.category} (anterior: ${state.last_category || "nenhuma"})`);

  // Determina o dominio do tema para manter foco unico (games OU hardware)
  const topicDomain = classifyDomain(topic.hint);
  if (topicDomain === "mixed") {
    log("WARN", `Tema com dominio misto detectado: ${topic.hint}. Pulando geracao.`);
    state.last_error = "Tema misto (games + hardware) — pulando";
    state.last_error_date = today;
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
    saveState(state);
    generateStatusFile(state);
    process.exit(1);
  }
  const effectiveDomain = topicDomain === "hardware" ? "hardware" : "games";
  log("INFO", `Dominio do artigo: ${effectiveDomain}`);

  let researchContext = "";
  let researchSources = [];
  try {
    const query = topic.category === "noticia"
      ? `${topic.hint} Brasil 2026`
      : `melhores ${topic.hint} Brasil 2026`;
    const sr = await fetchTavily(query);
    researchSources = sr?.results || [];
    // 450 chars por fonte: o limite de 8000 TPM da Groq divide o orcamento
    // entre pesquisa e tamanho do artigo.
    researchContext = researchSources
      .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 450)}`)
      .join("\n\n");
  } catch (err) {
    log("WARN", `Tavily: ${err.message}`);
  }

  let mlProducts = [];
  if (SERPER_API_KEY) {
    try {
      const trendingKws = topic.trending_keywords || [];
      // Queries seguem o dominio do artigo: games -> jogos; hardware -> perifericos
      const searchQueries = [
        ...trendingKws.slice(0, 2).flatMap((kw) =>
          effectiveDomain === "hardware"
            ? [`${kw} gamer 2026`, `${kw} 2026`]
            : [`${kw} jogo ps5`, `${kw} jogo xbox`]
        ),
        topic.ml_query,
      ].slice(0, MAX_PRODUCTS);

      const seen = new Set();
      for (const query of searchQueries) {
        try {
          const results = await searchGoogleShopping(query, SERPER_API_KEY, MAX_PRODUCTS);
          for (const p of results) {
            if (!seen.has(p.permalink)) {
              seen.add(p.permalink);
              mlProducts.push(p);
            }
          }
        } catch (e) {
          log("WARN", `Shopping search "${query}": ${e.message}`);
        }
        if (mlProducts.length >= MAX_PRODUCTS) break;
      }

      if (mlProducts.length === 0 && effectiveDomain === "games") {
        log("INFO", "Fallback final: produtos fixos gaming");
        const gamingProducts = [
          { title: "Console Sony PlayStation 5 Slim 1TB + GTA 6", price: 4499, thumbnail: "https://store.sony.com.au/dw/image/v2/ABBC_PRD/on/demandware.static/-/Sites-sony-master-catalog/default/dwf11f74b4/images/PLAYSTATION5WSLIM/PLAYSTATION5WSLIM.png", permalink: "https://www.mercadolivre.com.br/console-sony-playstation-5-edico-slim-disk-1tb-branco-controle-sem-fio-dualsense-ps5-branco/p/MLB52897777", source: "Mercado Livre" },
          { title: "Console Xbox Series X 1TB", price: 4399, thumbnail: "https://cdn-dynmedia-1.microsoft.com/is/image/microsoftcorp/6048892_Image-Buy-Box-0_2000x2000-1?wid=1253&hei=705&fmt=jpg", permalink: "https://www.mercadolivre.com.br/console-xbox-series-x-1tb-standard-cor-preto/p/MLB37335939", source: "Mercado Livre" },
          { title: "Console Nintendo Switch 2", price: 3299, thumbnail: "https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto:best/f_auto/dpr_2.0/ncom/My%20Nintendo%20Store/EN-US/Nintendo%20Switch%202/Hardware/123669-nintendo-switch-2-package-front-2000x2000", permalink: "https://www.mercadolivre.com.br/nintendo-switch-2/p/MLB41884906", source: "Mercado Livre" },
          { title: "Controle Sem Fio DualSense PS5", price: 429, thumbnail: "https://gmedia.playstation.com/is/image/SIEPDC/dualsense-controller-product-thumbnail-01-en-14sep21", permalink: "https://www.mercadolivre.com.br/controle-sem-fio-sony-dualsense-ps5-com-cabo-de-carregamento-usb-cor-branco/p/MLB26725576", source: "Mercado Livre" },
          { title: "Headset Gamer Astro A50 Wireless PS5/PC", price: 1799, thumbnail: "https://http2.mlstatic.com/D_NQ_NP_2X_697790-MLB75680571995_052024-F.webp", permalink: "https://www.mercadolivre.com.br/headset-gamer-astro-a50-wireless-base-station-ps5-pc/p/MLB29785062", source: "Mercado Livre" },
          { title: "Controle Xbox Series Wireless", price: 449, thumbnail: "https://http2.mlstatic.com/D_NQ_NP_2X_823063-MLB73535292701_122023-F.webp", permalink: "https://www.mercadolivre.com.br/controle-sem-fio-microsoft-xbox-series-carbon-black/p/MLB26813017", source: "Mercado Livre" },
        ];
        for (const gp of gamingProducts.slice(0, MAX_PRODUCTS)) {
          if (!seen.has(gp.permalink)) {
            seen.add(gp.permalink);
            mlProducts.push(gp);
          }
        }
      }

      for (const p of mlProducts) {
        p.affiliate_link = p.permalink;
      }
    } catch (err) {
      log("WARN", `Shopping Search: ${err.message}`);
    }
  } else {
    log("WARN", "SERPER_API_KEY nao configurada — pulando busca de produtos");
  }

  mlProducts = sanitizeProducts(mlProducts.filter((p) => isGamerProduct(p.title)), topic);

  const productBlock = mlProducts.length > 0
    ? `\nPRODUTOS DISPONIVEIS (cada um vira um item da secao de Itens):\n${mlProducts.map((p, i) =>
        `Marcador: [PRODUTO:${i + 1}]\n` +
        `Nome: ${p.title}\n` +
        `Preco: ${formatProductPriceForPrompt(p)}\n`
      ).join("\n")}\nO sistema monta a foto e o botao de compra do item no lugar do marcador. Voce NAO escreve preco, link nem imagem desses produtos — so decide ONDE cada item entra. O nome do item vira o heading "## Nome do Produto — Subtitulo". NUNCA escreva "R$ X" no texto para produtos listados — o preco fica so na tabela comparativa.\nREGRA DE PRECO AUSENTE: se o produto estiver marcado como "Preco: NAO DISPONIVEL", voce NAO escreve preco, NUNCA diz gratis, gratuito, preco zero ou de graca, e orienta o leitor a conferir o preco atual na tabela.`
    : "";

  const internalLinksBlock = buildInternalLinksBlock();

  const trendingNote = topic.trending_keywords
    ? `\nCONTEXTO: Este topico esta em alta agora em sites de games e redes sociais. Palavras-chave trending: ${topic.trending_keywords.join(", ")}. Escreva um artigo relevante e atual conectando esses temas.`
    : "";

  const categoria = topic.category;
  const estiloOpinativo = categoria === "noticia" || categoria === "lista";
  const estiloFactual = categoria === "guia" || categoria === "review";

  const personaManoGamer = `PERSONA: Voce e o "Mano Gamer", narrador raiz do Blog Gamer — um gamer brasileiro que escreve como se estivesse trocando ideia com os amigos no Discord.

REGRAS DE ESTILO:
- ABERTURA: Todo artigo comeca com gancho direto: "Fala, gamer!", "Segura essa, galera!", "O, presta atencao nisso!", "Mermao, olha o que saiu!"
- OPINIAO FORTE: Tome lado. Critique empresas quando erram, elogie quando acertam. Ex: "A Capcom lancou mais um remake. Surpresa: zero." ou "Esse jogo ta lindo. Ponto. Nao tem discussao."
- HUMOR E SARCASMO: Use metaforas do mundo gamer. Ex: "Isso e mais dificil que matar Malenia no level 1", "O preco ta salgado, mas pelo menos nao e preco de scalper", "Grafico no ultra, mas a historia... modo easy"
- GIRIAS NATURAIS: "ta on", "brabo", "tankar", "farmar", "rushar", "tryhard", "o bagulho", "mermao", "ta ligado", "e de cair o cu da bunda", "nao tankei", "rage quit"
- FALE COM O LEITOR: Use "voce", "teu setup", "tua jogatina", "bora ver?", "vai encarar?". Faca perguntas retoricas no meio do texto: "E ai, vai tankar esse boss?", "Vale ou nao vale a grana?"
- PARAGRAFOS VIVOS: Cada paragrafo conta uma mini-historia com comeco, meio e punchline. NUNCA escreva "Alem disso, vale ressaltar que..." ou "E importante notar que..."
- FECHAMENTO: Termine secoes com conexao direta: "Bora ver se vale a grana?", "Curtiu? Entao vai la e garante o teu."
- FONTES: Cite no final com naturalidade: "Peguei as infos do [site] e do [outro] — os caras manjam do assunto."
- JAMAIS: voz passiva, emojis, mencionar que e IA, termos corporativos ("desta forma", "contudo", "outrossim")`;

  const personaFactual = `PERSONA: Voce e um redator tecnico especializado em {{DOMINIO}} do Blog Gamer. Escreve reviews e guias com precisao e profundidade.

REGRAS DE ESTILO:
- ABERTURA: Va direto ao ponto. Contextualize o topico em 1-2 frases. Ex: "Escolher o monitor certo para games em 2026 exige atencao a 3 especificacoes-chave: taxa de atualizacao, tempo de resposta e tipo de painel."
- OBJETIVIDADE: Seja direto e informativo. Compare especificacoes, mostre dados, explique decisoes tecnicas.
- PROFUNDIDADE: Guias e reviews precisam de detalhes. Explique o "por que" por tras de cada recomendacao.
- ESTRUTURA: Use tabelas comparativas, pros/contras, listas numeradas de passos.
- TOM: Profissional mas acessivel. Nem robotico, nem informal demais. Ex: "A RTX 4060 entrega 60 fps estaveis em 1080p." (e nao: "A placa apresenta desempenho satisfatorio no que tange a...")
- HUMOR CONTROLADO (hibrido): no maximo 1 comparacao leve ou observacao ironica a cada 3 paragrafos (ex: "mais exigente que boss de soulslike", "preco de scalper"). Humor e tempero, nunca estrutura — a precisao tecnica vem primeiro.
- FALE COM O LEITOR: Use "voce" e "seu setup", mas sem girias pesadas.
- JAMAIS: girias de boteco ("mermao", "ta ligado"), humor forcado em todo paragrafo, sarcasmo constante`;

  const domain = effectiveDomain || "games";
  const personaPrompt = estiloOpinativo
    ? personaManoGamer
    : personaFactual.replace("{{DOMINIO}}", domainLabel(domain));
  const minWords = MIN_WORDS[categoria] || 650;
  const alvoWords = estiloFactual ? "900-1100" : "700-900";
  const primaryKeyword = topic.trending_keywords?.[0] || "";

  const systemPrompt = `Voce e redator senior de um blog gamer brasileiro de alto trafego. Seu artigo e publicado como esta, sem revisao humana: generalidade, cliche e dado inventado custam trafego e credibilidade.

## REGRA DE OURO Nº 1 — DOMINIO UNICO (LEIA PRIMEIRO)
Este artigo e APENAS sobre ${domainLabel(domain)}. Nunca misture os dois dominios.
${domain === "hardware"
  ? `PERMITIDO: mouse, teclado, headset, monitor, placa de video, processador, cadeira, SSD, fonte, gabinete, water cooler.
PROIBIDO: jogos especificos (Resident Evil, GTA, Fortnite, Zelda, etc.), lancamentos de jogos, eventos de games (Game Awards, E3, Gamescom), gameplay, historia de jogo.`
  : `PERMITIDO: jogos, consoles, software, lancamentos, eventos de games, noticias da industria.
PROIBIDO: mouse, teclado, headset, monitor, placa de video, processador, cadeira, SSD, fonte, gabinete, water cooler, setup gamer.`}
Se voce quebrar essa regra, o artigo sera descartado.

${personaPrompt}${trendingNote}

## MARCADORES DE POSICIONAMENTO (OBRIGATORIO)
Voce nao renderiza imagens nem cards de produto — voce decide ONDE eles entram, com marcadores que o sistema substitui depois.
- [IMG:Nome] — OBRIGATORIO em cada secao ## EXCETO nos itens da secao de lista de produtos (nesses itens a foto do produto e injetada automaticamente). Coloque em uma linha sozinha, logo ANTES do titulo ##. Para secoes sobre um jogo, use o nome do jogo (ex: [IMG:God of War Laufey]). Para secoes gerais (setup, comparativos, FAQ, lancamentos), use uma descricao curta do topico (ex: [IMG:Setup Gamer], [IMG:Comparativo de Consoles], [IMG:Perguntas Frequentes]). O sistema busca imagens automaticamente via web. SEMPRE use um marcador — nao existe secao sem imagem.
- ${mlProducts.length > 0 ? `[PRODUTO:N] — um marcador por item, na secao de Itens (a primeira secao ## do artigo, logo apos a introducao), cada um na linha sozinha e logo APOS o texto que descreve aquele item. NAO empilhe todos no comeco. Use o numero exato indicado na lista de produtos.` : "Nao ha produtos nesta rodada — nao use [PRODUTO:N]."}
- Nunca coloque dois marcadores seguidos sem texto entre eles. Se um jogo ou produto nao tem relevancia real em nenhum trecho, omita o marcador — melhor faltar do que forcar.
- Se o sistema nao achar imagem para um [IMG:...], ele remove o marcador. Entao o paragrafo tem que fazer sentido sozinho, sem depender da imagem.

## REGRAS DE TITULO
- 55 a 65 caracteres.
- ${primaryKeyword ? `A palavra-chave "${primaryKeyword}" DEVE aparecer nos primeiros 40% do titulo.` : "A palavra-chave principal (jogo, produto ou evento) deve aparecer nos primeiros 40% do titulo."}
- PROIBIDO: "Tudo que voce precisa saber", "Novidades que vao bombar/mexer/transformar", "Fique por dentro", "Imperdivel", "Revolucionario", "O que esperar".
- Use numero, data ou beneficio concreto: "10 Melhores X em 2026", "X vs Y: Qual Vale a Pena", "X Chega em Marco: O Que Muda".
- Nada de clickbait vazio: o titulo tem que ser 100% sustentado pelo conteudo.

## REGRAS DE CONTEUDO
1. GROUNDING: todo dado concreto (preco, spec, data, numero de vendas, nota) vem das fontes de pesquisa fornecidas. Se nao esta la, nao afirme como fato — use "segundo rumores", "ainda sem confirmacao".
2. ESPECIFICIDADE: proibido "incrivel", "revolucionario", "surpreendente" sem uma frase logo depois explicando o motivo concreto.
3. TESE POR SECAO: cada secao defende um ponto, nao lista fatos soltos. Nao "as specs do monitor X", e sim "o monitor X vale o preco por causa de Y, apesar de Z".
4. COMPARACAO REAL: em tabela comparativa, os numeros precisam diferenciar os itens. Nada de todo mundo com nota 9/10.
  5. EXTENSAO: minimo ${minWords} palavras, alvo ${alvoWords}, maximo 1200 palavras. Extensao e consequencia de profundidade — nao encha linguica pra bater numero.
6. E permitido (e recomendado) discordar do hype de marketing quando os dados sustentarem. Isso gera credibilidade.
7. Frases curtas alternadas com uma ou duas mais longas. Paragrafos com frases todas do mesmo tamanho denunciam texto de IA.
${estiloOpinativo ? "8. Giria e humor sao tempero, nao estrutura: no maximo 1 giria marcante a cada 2-3 paragrafos, nunca empilhadas." : "8. Tom tecnico com humor seco dosado: no maximo 1 toque ironico a cada 3 paragrafos, sem giria de boteco."}

## ESTRUTURA (ordem obrigatoria — adapte so o conteudo de cada bloco)
- INTRODUCAO SEM H2: 1-2 paragrafos diretos com gancho concreto. Nos primeiros 2-3 paragrafos, resuma os criterios/requisitos que definem os itens da lista (o que diferencia um bom item, em 2 frases no maximo) — NAO crie secao ## separada para esse contexto.
- PRIMEIRA SECAO ## (a principal): a lista de Itens. ${mlProducts.length > 0 ? `Titulo tipo: "## Os ${mlProducts.length} Melhores {Itens} em 2026". Um bloco por item, nesta ordem: "## Nome do Produto — Subtitulo" (SEM [IMG:] — a foto e injetada automaticamente), 2-3 paragrafos com os principais detalhes do item, e [PRODUTO:N] numa linha sozinha logo apos o texto.` : `Titulo tipo: "## Os Melhores {Jogos/Itens} em 2026". Um bloco por item: "## Nome — Subtitulo" com [IMG:Nome] na linha imediatamente anterior, 2-3 paragrafos de detalhes, sem botao de compra.`}
- Depois da lista, secoes curtas nesta ordem (omita o que nao se aplica):
  - ${mlProducts.length > 0 ? "Tabela comparativa dos produtos (Produto | Preco | Destaque | Nota 1-10) com notas que realmente diferenciam." : "Tabela quando houver o que comparar (jogos, specs, edicoes)."}
  - "## Veredito" (ou "## Qual X Escolher?") com bullets por perfil de usuario — nunca "depende do orcamento".
  - "## FAQ" com 3-4 perguntas que as pessoas realmente pesquisam no Google sobre o tema.
  - "## Quer mais ofertas?" com: Entre para o nosso [grupo VIP no Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) e receba ofertas diarias de ${domain === "hardware" ? "perifericos e hardware gamer" : "games e consoles"}!
  - "## Fontes" com os links da pesquisa.
- LINKS INTERNOS: 2 a 3, SOMENTE na ultima secao "## Continue Explorando" (formato [texto](/blog-gamer/blog/slug-do-artigo/), usando SOMENTE slugs da lista de artigos existentes fornecida). NUNCA coloque links internos no meio do artigo.
- Headings ## em toda secao principal (### para subsecoes). Subtitulos que dizem algo, nao "Analise" ou "Detalhes".
- Jogos citados pela PRIMEIRA vez em **negrito**: "**EA Sports FC 26** chegou..."
- Bullets ou passos numerados nas secoes onde ajudam a leitura (nao em todas a forca).

## PROIBIDO
- Inventar URL de imagem (wikipedia, google, unsplash) ou link de compra.
- Temas de cassino, slots, caça-níqueis, roleta, apostas, poker, bingo ou qualquer jogo de dinheiro real. O blog não cobre isso.
- Escrever preco, imagem ou botao dos produtos listados — isso e do card. NUNCA escreva "R$" seguido de valor que coincida com produto da lista.
- Produto sem preco na lista (Preco: NAO DISPONIVEL): nunca afirme preco, nunca diga que e gratis, gratuito, preco zero ou de graca; refira-se a ele como "confira o preco atual no Mercado Livre".
- Emojis, voz passiva, mencionar que e IA, termos corporativos ("desta forma", "outrossim", "vale ressaltar que").
- Markdown (** ou *) dentro do title e da description do frontmatter.
- REGRA DA CAPA: a imagem de capa (campo "image" do frontmatter) deve ser EXCLUSIVA — NUNCA repita a mesma imagem da capa dentro do corpo do artigo. Se uma secao usa o mesmo jogo da capa, use uma imagem diferente desse jogo (outra screenshot, outra arte). A capa e unica.

## SAIDA
Frontmatter YAML entre "---" e "---", depois o markdown do artigo com os marcadores no corpo. Nada alem disso — sem comentarios sobre o processo.

title: "Titulo SEO (55-65 caracteres)"
description: "Descricao persuasiva (120-160 caracteres, sem markdown)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: ${mlProducts.length > 0}

category DEVE ser: noticia, review, guia ou lista`;

  const buildUserPrompt = (research) => `Escreva um artigo de categoria "${categoria}" sobre: ${topic.hint}

DOMINIO OBRIGATORIO: este artigo é APENAS sobre ${domainLabel(domain)}. Nao misture games e hardware no mesmo texto.
${domain === "hardware"
  ? `Foque em perifericos e hardware gamer. Exemplos validos: "Melhores Mouses Wireless 2026", "Headset Gamer Custo-Beneficio", "Monitor 144Hz vs 240Hz".
PROIBIDO NO TEXTO: GTA, Resident Evil, Fortnite, Zelda, Game Awards, E3, Gamescom, lancamentos de jogos, gameplay, historia de jogo.`
  : `Foque em jogos, consoles, software ou eventos de games. Exemplos validos: "GTA 6: data de lancamento", "Melhores Jogos de Corrida 2026", "Resident Evil Requiem no PS5", "Game Awards 2026".
PROIBIDO NO TEXTO: mouse, teclado, headset, monitor, placa de video, RTX, processador, SSD, fonte, gabinete, water cooler, setup gamer.`}

${research ? `PESQUISA (use estes fatos — nao invente dados fora daqui):\n${research}\n` : "SEM PESQUISA DISPONIVEL: escreva so o que e conhecimento consolidado, sem inventar numeros, datas ou precos.\n"}
${productBlock}${internalLinksBlock}

Checklist antes de responder:
1. Titulo com 55-65 chars${primaryKeyword ? `, com "${primaryKeyword}" no comeco` : ""}, sem frase generica.
2. Description 120-160 chars, sem ** e sem exagero promocional.
3. Minimo ${minWords} palavras de conteudo real (alvo ${alvoWords}).
4. ${mlProducts.length > 0 ? `Marcadores [PRODUTO:1]..[PRODUTO:${mlProducts.length}] TODOS dentro da secao de Itens (a primeira secao ## apos a introducao), um por item, cada um em linha sozinha logo apos o texto do item.` : "Sem produtos nesta rodada — os itens sao jogos e usam [IMG:]."}
5. 2 a 4 marcadores [IMG:Nome], um antes de cada secao ## que NAO seja item de produto (itens com produto NAO usam [IMG:] — a foto e injetada automaticamente).
6. Cada dado concreto rastreavel ate a pesquisa acima.
7. 5 tags relevantes.
8. ${estiloOpinativo ? "Voz Mano Gamer: opiniao com lado tomado, giria dosada, sem enrolacao." : "Voz tecnica hibrida: precisao, comparacao de specs, humor seco dosado (max 1 a cada 3 paragrafos)."}
9. 2 a 3 links internos usando SOMENTE slugs da lista ARTIGOS EXISTENTES acima, colocados SOMENTE na secao final "## Continue Explorando".`;

  // Encolhe a pesquisa ate sobrar espaco de saida suficiente dentro do TPM.
  // So para o fluxo de chamada unica (sem produtos): no segmentado a pesquisa
  // vai inteira para a chamada do corpo principal.
  let userPrompt = buildUserPrompt(researchContext);
  while (mlProducts.length === 0 && computeMaxTokens(systemPrompt, userPrompt) < MIN_OUTPUT && researchContext.length > 800) {
    researchContext = researchContext.slice(0, Math.floor(researchContext.length * 0.75));
    userPrompt = buildUserPrompt(researchContext);
    log("WARN", `Pesquisa reduzida para caber no limite de ${TOKEN_BUDGET} TPM`);
  }
  log("INFO", `Orcamento Groq: prompt ~${estimateTokens(systemPrompt) + estimateTokens(userPrompt)} tokens, saida ~${computeMaxTokens(systemPrompt, userPrompt)} tokens`);

  const MAX_GEN_ATTEMPTS = 3;
  const validationCtx = {
    category: categoria,
    productCount: mlProducts.length,
    productPrices: mlProducts.filter((p) => p.price).map((p) => p.price),
    primaryKeyword,
  };

  let fm = null;
  let body = null;
  let parts = null;
  let feedback = "";

  if (mlProducts.length > 0) {
    // FLUXO SEGMENTADO: a LLM escreve frontmatter, blurbs e corpo em chamadas
    // separadas; itens, tabela e ordem sao decididos em codigo (assembleArticle).
    log("INFO", `Geracao SEGMENTADA: ${mlProducts.length} produtos (blurb por item + corpo) + montagem deterministica em codigo`);
    try {
      const seg = await generateSegmentedArticle({
        mlProducts, topic, domain, categoria, primaryKeyword,
        researchContext, internalLinksBlock, today, minWords,
      });
      fm = seg.fm;
      parts = seg.parts;
      body = [parts.intro, `## ${parts.listHeading}`, parts.rest].filter(Boolean).join("\n\n");
      log("INFO", "Corpo segmentado montado — itens e tabela serao injetados apos baixar as fotos");
    } catch (err) {
      log("ERROR", `Falha na geracao segmentada: ${err?.message || String(err)}`);
      log("DEBUG", (err?.stack || String(err)).slice(0, 500));
      state.last_error = (err?.message || String(err)).slice(0, 200);
      state.last_error_date = today;
      state.consecutive_failures = (state.consecutive_failures || 0) + 1;
      saveState(state);
      generateStatusFile(state);
      process.exit(1);
    }
  } else {
  for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
    const lastAttempt = attempt === MAX_GEN_ATTEMPTS;
    log("INFO", `Gerando artigo com LLM (tentativa ${attempt}/${MAX_GEN_ATTEMPTS})...`);

    let article;
    try {
      article = await fetchLLM(systemPrompt, userPrompt + feedback);
    } catch (err) {
      const errorMsg = (err?.stack || err?.message || String(err)).slice(0, 500);
      log("ERROR", `Falha na geracao (Groq + OpenAI): ${err?.message || String(err)}`);
      log("DEBUG", `Stack trace: ${errorMsg}`);
      state.last_error = (err?.message || String(err)).slice(0, 200);
      state.last_error_date = today;
      state.consecutive_failures = (state.consecutive_failures || 0) + 1;
      saveState(state);
      generateStatusFile(state);
      process.exit(1);
    }

    let parsed;
    try {
      parsed = parseFrontmatter(article);
    } catch (err) {
      log("WARN", `Erro frontmatter: ${err.message}`);
      log("DEBUG", typeof article === "string" ? article.slice(0, 600) : `article nao e string: ${typeof article} — ${String(article).slice(0, 200)}`);
      if (lastAttempt) { log("ERROR", "Frontmatter invalido apos todas as tentativas"); process.exit(1); }
      feedback = "\n\nA resposta anterior nao tinha frontmatter YAML valido. Comece a resposta com --- e feche com --- antes do markdown.";
      continue;
    }

    const { hard, soft } = validate(parsed.frontmatter, parsed.body, { ...validationCtx, lastAttempt });

    // Validação adicional: cobertura de fontes para dados concretos
    const sourceWarnings = validateSourceCoverage(parsed.body, researchSources);
    soft.push(...sourceWarnings);

    if (hard.length === 0 && soft.length === 0) {
      fm = parsed.frontmatter;
      body = parsed.body;
      log("INFO", "Validacoes OK");
      break;
    }

    if (hard.length > 0) log("WARN", `Bloqueantes:\n  - ${hard.join("\n  - ")}`);
    if (soft.length > 0) log("WARN", `Qualidade:\n  - ${soft.join("\n  - ")}`);

    if (lastAttempt) {
      if (hard.length > 0) {
        log("ERROR", `Validacao falhou apos ${MAX_GEN_ATTEMPTS} tentativas:\n${hard.join("\n")}`);
        log("DEBUG", JSON.stringify(parsed.frontmatter, null, 2));
        process.exit(1);
      }
      log("WARN", "Publicando com ressalvas de qualidade (ultima tentativa)");
      fm = parsed.frontmatter;
      body = parsed.body;
      break;
    }

    const domainFeedback = (isMixedDomain(parsed.frontmatter.title) || isMixedDomain(parsed.body))
      ? `\n\nREGRA DE DOMINIO VIOLADA: voce misturou games e hardware no mesmo texto. Escolha APENAS UM dos lados e remova TODO o outro. Se o artigo for sobre jogos/consoles, remova qualquer mencao a mouse, teclado, headset, monitor, placa de video, processador, fonte, SSD, gabinete, cadeira, setup gamer. Se for sobre hardware, remova qualquer mencao a jogos especificos, lancamentos de jogos, eventos de games, gameplay.`
      : "";
    feedback = `\n\nA versao anterior foi rejeitada. Corrija TUDO isto e reescreva o artigo inteiro:\n- ${[...hard, ...soft].join("\n- ")}${domainFeedback}`;
  }
  }

  // Ultimo recurso pro titulo: uma chamada curta so pra reescrever o titulo.
  const titleProblems = checkTitle(fm.title, primaryKeyword);
  if (titleProblems.length > 0) {
    log("WARN", `Titulo ainda com problemas: ${titleProblems.join("; ")} — tentando reescrever`);
    const better = await regenerateTitle(fm.title, topic.hint, primaryKeyword, categoria);
    if (better && checkTitle(better, primaryKeyword).length === 0) {
      log("INFO", `Titulo reescrito: "${better}"`);
      fm.title = better;
    } else {
      log("WARN", "Reescrita do titulo nao passou no gate — mantendo o original");
    }
  }

  fm.title = capitalizeTitle(String(fm.title).replace(/\*/g, "").trim());
  fm.description = String(fm.description).replace(/\*/g, "").trim();

  log("INFO", "Validando links internos...");
  body = validateInternalLinks(body);
  log("INFO", "Links internos validados");

  log("INFO", "Buscando imagens de jogos via RAWG...");
  body = cleanFakeImages(body);

  if (extractImageMarkers(body).length > 0) body = repositionImageMarkers(body);

  const trendingKeywordForCover = topic.trending_keywords?.[0] || "";
  const markerNames = extractImageMarkers(body);
  const hasImageMarkers = markerNames.length > 0;
  const gameNames = hasImageMarkers ? markerNames : extractGameNames(body);
  const gameImages = {};
  let coverImage = "";

  if (gameNames.length > 0) {
    log("INFO", `${gameNames.length} jogos ${hasImageMarkers ? "marcados com [IMG:]" : "detectados por negrito (fallback)"}: ${gameNames.slice(0, 8).join(", ")}`);
    for (const name of gameNames.slice(0, 8)) {
      const img = await fetchRAWGImage(name);
      if (img) gameImages[name] = img;
    }

    for (const name of markerNames) {
      if (!gameImages[name]) {
        log("INFO", `Fallback Tavily para imagem: "${name.slice(0, 30)}"`);
        const tavilyImg = await fetchTavilyImage(name);
        if (tavilyImg) gameImages[name] = tavilyImg;
      }
    }
  } else {
    log("WARN", "Nenhum jogo marcado nem detectado no artigo");
  }

  // CAPA IA CONTEXTUAL: tentada SEMPRE, para qualquer tipo de artigo.
  // Produtos (ou arte de jogo, na ausencia deles) sao inseridos na cena pela IA.
  const capaSlug = slugify(fm.title);
  const coverContext = topic.hint || fm.title || "";
  const gameRefs = Object.values(gameImages);
  const hasProducts = mlProducts.length > 0;

  log("INFO", `Gerando capa IA contextual (categoria: ${categoria}, ${hasProducts ? mlProducts.length + " produtos" : "sem produtos"}, ${gameRefs.length} imagens de jogo)...`);
  if (hasProducts) {
    coverImage = await gerarCapaOpenAI({ mlProducts, category: categoria, slug: capaSlug, context: coverContext }) || "";
  } else {
    coverImage = await gerarCapaOpenAI({ mlProducts: [], category: categoria, slug: capaSlug, contentType: "game", context: coverContext, gameRefs }) || "";
  }
  if (!coverImage) {
    coverImage = await gerarCapaStability({ mlProducts, category: categoria, slug: capaSlug, context: coverContext, gameRefs }) || "";
  }

  // Fallbacks sem IA (mantidos como rede de seguranca)
  if (!coverImage) {
    coverImage = await getBestCoverImage(mlProducts, body, trendingKeywordForCover, markerNames) || "";
  }
  if (!coverImage && gameRefs.length > 0) {
    coverImage = gameRefs[0];
  }

  if (gameNames.length > 0) {
    body = injectGameImages(body, gameImages, hasImageMarkers, coverImage || null);
    log("INFO", `${Object.keys(gameImages).length}/${gameNames.length} imagens RAWG injetadas${coverImage ? " (capa omitida do corpo)" : ""}`);
  }

  log("INFO", "Injetando produtos do Mercado Livre no artigo...");
  if (mlProducts.length > 0) {
    log("INFO", `Baixando imagens dos ${mlProducts.length} itens (ML -> web -> IA)...`);
    await ensureProductImages(mlProducts);
  }
  if (parts) {
    body = injectSegmentedItems(body, parts.listHeading, mlProducts);
    log("INFO", `${mlProducts.length} itens segmentados (foto local + blurb + botao) e tabela comparativa injetados`);
    const { hard: segHard, soft: segSoft } = validate(fm, body, {
      ...validationCtx,
      segmented: true,
      listHeading: parts.listHeading,
      products: mlProducts,
      productCount: mlProducts.length,
      productPrices: [],
      relaxedWordCount: true,
      softMixedDomain: true,
      lastAttempt: true,
    });
    if (segHard.length > 0) {
      log("ERROR", `Corpo segmentado reprovado:\n- ${segHard.join("\n- ")}`);
      process.exit(1);
    }
    if (segSoft.length > 0) log("WARN", `Ressalvas de qualidade:\n  - ${segSoft.join("\n  - ")}`);
  } else {
    body = injectProductCards(body, mlProducts);
    log("INFO", `${mlProducts.length} produtos injetados no corpo do artigo`);
  }

  body = stripLeftoverMarkers(body);

  // Gera sumário/índice com links âncora para melhor navegação e SEO
  body = injectTableOfContents(body);

  if (!coverImage) {
    const fallbackKw = trendingKeywordForCover || (topic.ml_query ? topic.ml_query.split(" ").slice(0, 2).join(" ") : "") || "";
    if (fallbackKw) coverImage = await fetchRAWGImage(fallbackKw) || "";
  }
  if (coverImage) {
    if (coverImage.startsWith("/") && !coverImage.startsWith("/blog-gamer") && !coverImage.startsWith("http") && !coverImage.startsWith("data:")) {
      coverImage = "/blog-gamer" + coverImage;
    }
    fm.image = coverImage;
    log("INFO", `Imagem de capa: ${coverImage.slice(0, 80)}`);
  } else {
    log("WARN", "Nenhuma imagem de capa encontrada — artigo ficara sem imagem principal");
  }

  const slug = slugify(fm.title);
  const published = fs.existsSync(ARTIGOS_DIR)
    ? fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
    : [];

  if (published.includes(slug)) {
    log("ERROR", `Slug duplicado: ${slug}`);
    state.last_error = `Slug duplicado: ${slug}`;
    state.last_error_date = today;
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
    saveState(state);
    generateStatusFile(state);
    process.exit(1);
  }

  const cover = fm.image || mlProducts[0]?.thumbnail || "";
  const markdown = `---
title: "${fm.title.replace(/"/g, '\\"')}"
description: "${fm.description.replace(/"/g, '\\"')}"
pubDate: ${today}
tags: [${fm.tags.map((t) => `"${t.trim().replace(/"/g, '\\"')}"`).join(", ")}]
category: "${fm.category}"
affiliate: ${fm.affiliate || mlProducts.length > 0}
image: "${cover}"
---

${body}
`;

  const fp = path.join(ARTIGOS_DIR, `${slug}.md`);
  fs.writeFileSync(fp, markdown, "utf-8");
  log("INFO", `Artigo salvo: ${slug}.md`);

  state.last_success = today;
  state.last_slug = slug;
  state.last_error = null;
  state.last_error_date = null;
  state.consecutive_failures = 0;
  state.total_articles = countArticlesInDir();
  state.last_topic = topic.hint;
  state.last_category = topic.category;
  state.trending_source = trendingSource;
  state.recent_keywords = topic.trending_keywords || [];
  state.recent_topics = [...((state.recent_topics || []).slice(-9)), topic.hint.slice(0, 60)];
  saveState(state);
  log("INFO", `Estado atualizado: ${state.total_articles} artigos, ultimo hoje`);

  generateStatusFile(state);

  log("INFO", "=== CONCLUIDO ===");
}

async function generateStatusFile(state) {
  const status = {
    ultimo_artigo: state.last_success || "nunca",
    ultimo_deploy: new Date().toISOString(),
    artigos_semana: countArticlesInDir(),
    total_artigos: state.total_articles,
    erros_recentes: state.last_error ? [`${state.last_error_date}: ${state.last_error}`] : [],
    apis: {
      groq: "ok",
      tavily: TAVILY_API_KEY ? "ok" : "nao-configurada",
      rawg: RAWG_API_KEY ? "ok" : "nao-configurada"
    },
    saudavel: state.consecutive_failures === 0
  };
  const statusDir = path.resolve("public");
  if (!fs.existsSync(statusDir)) fs.mkdirSync(statusDir, { recursive: true });
  fs.writeFileSync(path.join(statusDir, "status.json"), JSON.stringify(status, null, 2), "utf-8");
  log("INFO", "status.json gerado");
}

// ============================================================================
// GERACAO SEGMENTADA (Fase 2): em vez de uma chamada unica que decide tudo, o
// artigo de produtos e montado por partes deterministicas:
//   - generateArticleFrontmatter  -> titulo/descricao/tags/categoria
//   - generateProductBlurb        -> 1 chamada POR produto (texto do item)
//   - generateMainBody            -> 1 chamada (intro + secoes finais)
//   - assembleArticle              -> montagem em codigo (itens + tabela)
// Isso impede a LLM de juntar modelos, reescrever estrutura ou colocar botao
// apontando para pagina errada: o sistema decide os itens, a ordem e o botao.
// ============================================================================

const SEG_STYLE_OPINATIVO = `PERSONA: Voce e o "Mano Gamer", narrador raiz do Blog Gamer — gamer brasileiro que escreve como se estivesse trocando ideia com os amigos no Discord.
- OPINIAO FORTE: tome lado. Critique quando erram, elogie quando acertam. Ex: "A Capcom lancou mais um remake. Surpresa: zero."
- HUMOR: metaforas do mundo gamer ("mais dificil que matar Malenia no level 1", "preco de scalper", "nao tankei").
- GIRIAS NATURAIS e DOSADAS: "ta on", "brabo", "tankar", "o bagulho", "mermao", "ta ligado", "rage quit" (maximo 1 giria marcante a cada 2-3 paragrafos).
- FALE COM O LEITOR: "voce", "teu setup", "bora ver?", "vai encarar?". Faca perguntas retoricas.
- NUNCA: voz passiva, emojis, "Alem disso...", "E importante notar que...", termos corporativos.`;

const SEG_STYLE_FACTUAL = `PERSONA: redator tecnico especializado em {{DOMINIO}} do Blog Gamer. Guias e reviews com precisao e profundidade.
- OBJETIVIDADE: direto e informativo. Compare specs, mostre dados, explique o "por que" de cada recomendacao.
- ESTRUTURA: tabelas, pros/contras, passos numerados.
- TOM: profissional mas acessivel. Ex: "A RTX 4060 entrega 60 fps estaveis em 1080p." (e nao "apresenta desempenho satisfatorio no que tange a...").
- HUMOR SECO DOSADO: no maximo 1 toque ironico a cada 3 paragrafos ("mais exigente que boss de soulslike"). Nunca giria de boteco.
- NUNCA: "mermao", "ta ligado", voz passiva, emojis, termos corporativos.`;

function segStyle(categoria, domain) {
  if (categoria === "noticia" || categoria === "lista") return SEG_STYLE_OPINATIVO;
  return SEG_STYLE_FACTUAL.replace(/\{\{DOMINIO\}\}/g, domainLabel(domain));
}

function formatPriceBRL(price) {
  if (!(price > 0)) return "Ver no ML";
  return `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Frontmatter via chamada curta e dedicada: titulo/descricao nao podem ser
// decididos junto com o corpo (la a LLM burlava a regra de estrutura).
async function generateArticleFrontmatter({ topic, domain, categoria, primaryKeyword, productCount, today }) {
  const estilo = segStyle(categoria, domain);
  const sys = `Voce e redator senior de um blog gamer brasileiro de alto trafego. Responda APENAS com YAML de frontmatter, sem markdown e sem comentario.

${estilo}

## DOMINIO UNICO
Este artigo e APENAS sobre ${domainLabel(domain)}. Nunca misture games e hardware no titulo/description/tags.

## REGRAS DE TITULO
- 55 a 65 caracteres.
- ${primaryKeyword ? `A palavra-chave "${primaryKeyword}" DEVE aparecer nos primeiros 40% do titulo.` : "A palavra-chave principal (jogo, produto ou evento) deve aparecer nos primeiros 40%."}
- PROIBIDO: "Tudo que voce precisa saber", "Novidades que vao bombar", "Fique por dentro", "Imperdivel", "Revolucionario", "O que esperar".
- Use numero, data ou beneficio concreto: "10 Melhores X em 2026", "X vs Y: Qual Vale a Pena".
- Nada de clickbait vazio.

## SAIDA (somente este bloco, nao escreva o artigo)
---
title: "Titulo SEO (55-65 caracteres)"
description: "Descricao persuasiva (120-160 caracteres, sem markdown)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${categoria}"
affiliate: true
---

category DEVE ser: noticia, review, guia ou lista. Tags relevantes e sem ** dentro de title/description. Sem emoji.`;

  const user = `Artigo sobre: ${topic.hint}\nDominio: ${domainLabel(domain)}. ${productCount} produtos serao listados na secao principal.`;
  const out = await fetchLLM(sys, user, 3, { maxTokens: 512, temperature: 0.7 });
  try {
    return parseFrontmatter(out).frontmatter;
  } catch {
    log("WARN", "Frontmatter segmentado sem separador --- — tentando parse tolerante");
    const clean = out.replace(/^[\s\S]*?---\s*/m, "").split(/\n---\s*/)[0].trim();
    return parseRaw(clean);
  }
}

// Extrai tagline/corpo/nota/destaque do texto bruto do blurb (formato TAGLINE:/CORPO:).
function parseBlurb(out) {
  const tagline = (out.match(/^TAGLINE:\s*(.+)$/m) || [])[1]?.trim() || "";
  let nota = Number((out.match(/^NOTA:\s*(\d+(?:[.,]\d+)?)/m) || [])[1]?.replace(",", "."));
  if (!Number.isFinite(nota) || nota < 1 || nota > 10) nota = null;
  const destaque = (out.match(/^DESTAQUE:\s*(.+)$/m) || [])[1]?.trim() || "";
  let text = "";
  const corpoMatch = out.match(/CORPO:\s*([\s\S]*?)(?=\n\s*(?:NOTA|DESTAQUE):|$)/);
  if (corpoMatch) text = corpoMatch[1].trim();
  if (!text) {
    text = out
      .replace(/^TAGLINE:[^\n]*\n?/m, "")
      .replace(/\n\s*(?:NOTA|DESTAQUE):[\s\S]*$/m, "")
      .replace(/^\s*CORPO:\s*\n?/, "")
      .trim();
  }
  text = text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { tagline, text, nota, destaque };
}

// 1 chamada POR produto: descreve SO este item, sem preco, sem heading, sem botao.
async function generateProductBlurb({ product, topic, domain, categoria, index }) {
  const estilo = segStyle(categoria, domain);
  const sys = `Voce escreve a descricao de UM UNICO produto para um blog gamer brasileiro. ${estilo}

## O QUE VOCE GERA (somente texto, sem heading)
1. "TAGLINE:" — uma frase curta (2-6 palavras) que vira o subtitulo do item. Destaque o diferencial do produto com a persona escolhida. Nao use aspas.
2. "CORPO:" — 2 a 3 paragrafos curtos (60-110 palavras no total) sobre APENAS este produto. Sem lista, sem bullets.
3. "NOTA:" — nota de 1 a 10 (numero inteiro ou decimal), justificada indiretamente pelo texto.
4. "DESTAQUE:" — o diferencial do produto em ate 8 palavras.

## REGRAS ABSOLUTAS
- NUNCA escreva preco, "R$", card, botao, "confira o preco", nem mencione tabela ou comparativo.
- NUNCA use "#" nem markdown de titulo. Paragrafos separados por linha em branco.
- NUNCA compare com outros produtos nem fale de marcas concorrentes.
- NUNCA invente especificacao numerica (GHz, GB, W, fps, cores) que nao esteja no nome do produto. Fale de categoria, uso, publico-alvo e do que o proprio nome afirma.
- Nao repita o nome do produto mais de 2 vezes.
- O nome do produto citado no texto precisa bater com o titulo recebido (mesmo modelo).`;

  const user = `Produto ${index}: ${product.title}\nTopico do artigo: ${topic.hint}`;
  try {
    const out = await fetchLLM(sys, user, 3, { maxTokens: 900, temperature: 0.8 });
    const parsed = parseBlurb(out);
    if (!parsed.text) log("WARN", `Blurb vazio para "${product.title?.slice(0, 40)}"`);
    return parsed;
  } catch (e) {
    log("WARN", `Blurb falhou para "${product.title?.slice(0, 40)}": ${e.message}`);
    return {
      tagline: "",
      text: `O ${product.title} aparece entre os destaques desta lista — vale o seu tempo se bater com o que voce busca.`,
      nota: null,
      destaque: "",
    };
  }
}

// 1 chamada: intro SEM H2, o heading da lista, e as secoes finais. Nao escreve
// os itens (o sistema monta) nem a tabela comparativa (o sistema monta).
async function generateMainBody({ mlProducts, topic, domain, categoria, researchContext, internalLinksBlock, primaryKeyword, mainMinWords }) {
  const estilo = segStyle(categoria, domain);
  const productLines = mlProducts
    .map((p, i) => `${i + 1}. ${p.title}${p.price ? ` (${formatPriceBRL(p.price)})` : ""}`)
    .join("\n");
  const sys = `Voce e redator senior de um blog gamer brasileiro. Escreve UMA PARTE de um artigo de produtos: a introducao, o heading da lista e as secoes finais. O sistema monta os itens e a tabela comparativa.

${estilo}

## DOMINIO UNICO
Este artigo e APENAS sobre ${domainLabel(domain)}. Nunca misture games e hardware.

## ESTRUTURA EXATA (em ordem)
1. INTRODUCAO SEM H2: 1-2 paragrafos com gancho direto. Nos primeiros 2-3 paragrafos, resuma em 2 frases os criterios que definem os itens (o que diferencia um bom item). NAO crie secao ## para isso.
2. A LINHA "## Os ${mlProducts.length} Melhores {tipo} em 2026" — a PRIMEIRA linha ## do seu texto. Apos essa linha, NAO escreva mais nada na secao: o sistema insere os itens e a tabela ali.
3. "## Veredito" (ou "## Qual X Escolher?"): bullets por perfil de usuario — nunca "depende do orcamento".
4. "## FAQ": 3-4 perguntas que as pessoas pesquisam no Google sobre o tema.
5. "## Quer mais ofertas?": "Entre para o nosso [grupo VIP no Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) e receba ofertas diarias de ${domain === "hardware" ? "perifericos e hardware gamer" : "games e consoles"}!"
6. "## Fontes": os links da pesquisa fornecida.
7. "## Continue Explorando": 2-3 links internos SOMENTE dos slugs fornecidos, formato [texto](/blog-gamer/blog/slug-do-artigo/).

## MARCADORES DE IMAGEM
- [IMG:Nome] em linha sozinha ANTES de cada heading ## das secoes 3 a 7 (pelo menos 2 delas). Ex: [IMG:Setup Gamer], [IMG:Perguntas Frequentes]. NUNCA em linhas de itens (nao existem no seu texto) nem antes de "## Os ... Melhores".

## REGRAS DE CONTEUDO
- GROUNDING: todo dado concreto (spec, data, numero, nota) vem da pesquisa fornecida. Se nao esta la, use "segundo rumores"/"ainda sem confirmacao".
- Minimo ${mainMinWords} palavras no total do que voce escreve. Paragrafos com frases de tamanhos variados.
- Voce pode citar um produto pelo nome no texto corrido, mas NUNCA com preco e NUNCA como heading ##.
- NUNCA escreva "R$" nem preco de produto listado.
- NUNCA diga "confira no card" — os itens tem botao "VER NO MERCADO LIVRE". Se precisar, diga "confira o preco atual no Mercado Livre".
- NUNCA deixe secao ## vazia ou sem conteudo abaixo dela.
- NUNCA escreva "## Comparativo" nem "## Os ${mlProducts.length} Melhores" duas vezes, nem use [PRODUTO:N].
- Jogos/produtos citados pela primeira vez em **negrito**.
- Emojis, voz passiva, termos corporativos: proibido.

## PRODUTOS (cite naturalmente; nunca como heading, nunca com preco)
${productLines}

## SAIDA
Somente o markdown das secoes acima, na ordem. Sem frontmatter, sem comentario.`;

  const user = `${topic.hint ? `Escreva a parte do artigo sobre: ${topic.hint}\n\n` : ""}${
    researchContext ? `PESQUISA (use estes fatos — nao invente dados fora daqui):\n${researchContext}\n\n` : "SEM PESQUISA DISPONIVEL: escreva so conhecimento consolidado, sem inventar numeros, datas ou precos.\n\n"
  }${internalLinksBlock}`;
  return fetchLLM(sys, user, 3, { maxTokens: 6000, temperature: 0.7 });
}

// Separa o corpo principal em intro / heading da lista / resto.
function splitMainBody(mainBody) {
  if (typeof mainBody !== "string" || !mainBody.trim()) return null;
  const m = mainBody.match(/^##\s+([^\n]+)\n([\s\S]*)$/m);
  if (!m) return null;
  const listHeading = m[1].trim();
  if (/^(veredito|qual\s|faq|perguntas\s+frequentes|fontes|quer\s+mais|continue\s+explorando|comparativo|conclus)/i.test(listHeading)) {
    return null;
  }
  return {
    intro: mainBody.slice(0, m.index).trim(),
    listHeading,
    rest: m[2].trim(),
  };
}

function buildComparativoTable(mlProducts) {
  const rows = mlProducts
    .map((p) => `| ${p.title} | ${formatPriceBRL(p.price)} | ${p.destaque || "—"} | ${p.nota ? `${p.nota}/10` : "—"} |`)
    .join("\n");
  return `## Comparativo\n\n| Produto | Preco | Destaque | Nota |\n|---|---|---|---|\n${rows}\n`;
}

function buildItemSection(p) {
  const img = buildProductImageTag(p);
  const btn = buildProductButtonHtml(p);
  const tagline = p.tagline ? ` — ${p.tagline}` : "";
  const text = p.blurbText || `O ${p.title} aparece entre os destaques desta lista.`;
  const imgBlock = img ? `${img}\n\n` : "";
  const btnBlock = btn ? `\n\n${btn}` : "";
  return `## ${p.title}${tagline}\n\n${imgBlock}${text}${btnBlock}`;
}

// Injeta os itens (foto local + paragrafos + botao) e a tabela comparativa logo
// apos o heading da lista. Deterministico: nada fica a criterio da LLM.
function injectSegmentedItems(body, listHeading, mlProducts) {
  const itemBlock = mlProducts.map((p) => buildItemSection(p)).join("\n\n");
  const table = buildComparativoTable(mlProducts);
  const marker = `## ${listHeading}`;
  const idx = body.indexOf(marker);
  if (idx === -1) {
    log("WARN", "Heading da lista nao encontrado no corpo — itens anexados no fim");
    return `${body}\n\n${itemBlock}\n\n${table}`;
  }
  const after = idx + marker.length;
  return `${body.slice(0, after)}\n\n${itemBlock}\n\n${table}${body.slice(after)}`;
}

// Pipeline segmentado completo: frontmatter + blurbs + corpo + assembleia.
async function generateSegmentedArticle({ mlProducts, topic, domain, categoria, primaryKeyword, researchContext, internalLinksBlock, today, minWords }) {
  const fm = await generateArticleFrontmatter({ topic, domain, categoria, primaryKeyword, productCount: mlProducts.length, today });
  if (!fm) throw new Error("Frontmatter segmentado falhou");

  for (let i = 0; i < mlProducts.length; i++) {
    const b = await generateProductBlurb({ product: mlProducts[i], topic, domain, categoria, index: i + 1 });
    mlProducts[i].tagline = b.tagline;
    mlProducts[i].blurbText = b.text;
    mlProducts[i].nota = b.nota;
    mlProducts[i].destaque = b.destaque;
    log("INFO", `Blurb ok (${i + 1}/${mlProducts.length}): "${mlProducts[i].title?.slice(0, 45)}"`);
  }

  const mainMinWords = Math.max(350, Math.round(minWords * 0.75));
  let parts = null;
  for (let attempt = 1; attempt <= 2 && !parts; attempt++) {
    try {
      const raw = await generateMainBody({ mlProducts, topic, domain, categoria, researchContext, internalLinksBlock, primaryKeyword, mainMinWords });
      parts = splitMainBody(raw);
      if (!parts) log("WARN", `Corpo principal sem estrutura valida (tentativa ${attempt}/2)`);
    } catch (e) {
      log("WARN", `Corpo principal falhou (tentativa ${attempt}/2): ${e.message}`);
    }
  }
  if (!parts) {
    const fallbackKw = (topic.hint || primaryKeyword || "").split(" ").slice(0, 3).join(" ");
    parts = {
      intro: `Fala, gamer! Bora conferir quais ${fallbackKw} valem a pena em 2026 — a lista considera o que entrega mais por real, o que segura o tranco no dia a dia e o que a galera anda comprando.`,
      listHeading: `Os ${mlProducts.length} Melhores ${fallbackKw || "Itens"} em 2026`,
      rest: "",
    };
    log("WARN", "Usando corpo principal fallback (estrutura minima)");
  }

  return { fm, parts };
}

// So roda o pipeline quando o arquivo e executado direto (node scripts/gerar-artigo.mjs).
// Importado como modulo (pelos testes), apenas expoe as funcoes puras abaixo.
const executadoDireto = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executadoDireto) {
  main().catch((err) => {
    const errorMsg = err?.message || String(err);
    const errorStack = (err?.stack || errorMsg).slice(0, 500);
    log("ERROR", errorMsg);
    log("DEBUG", `Stack trace: ${errorStack}`);
    const state = loadState();
    const today = new Date().toISOString().split("T")[0];
    state.last_error = errorMsg.slice(0, 200);
    state.last_error_date = today;
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
    saveState(state);
    generateStatusFile(state);
    process.exit(1);
  });
}

export {
  similarity,
  nameSimilarity,
  extractImageMarkers,
  repositionImageMarkers,
  injectGameImages,
  injectProductCards,
  buildProductButtonHtml,
  productButtonLabel,
  buildProductImageTag,
  imageExtension,
  sanitizeProducts,
  splitMainBody,
  parseBlurb,
  buildComparativoTable,
  buildItemSection,
  injectSegmentedItems,
  injectTableOfContents,
  validateSourceCoverage,
  formatProductPriceForPrompt,
  stripLeftoverMarkers,
  extractGameNames,
  checkTitle,
  capitalizeTitle,
  validate,
  findPricesInBody,
  computeMaxTokens,
  MIN_WORDS,
  GENERIC_TITLE_PATTERNS,
};
