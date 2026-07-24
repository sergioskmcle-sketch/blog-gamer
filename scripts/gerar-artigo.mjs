import "dotenv/config";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import Parser from "rss-parser";
import { searchML, generateAffiliateLink, searchMLviaGoogle } from "./ml_affiliate.mjs";

const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogGamer/1.0)" },
});

const ARTIGOS_DIR = path.resolve("src/content/artigos");
const ML_COOKIES_PATH = path.resolve("ml_cookies.json");
const STATE_FILE = path.resolve("state.json");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { last_success: null, last_error: null, last_error_date: null, consecutive_failures: 0, total_articles: 0 };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

const CATEGORIES = [
  { slug: "noticia", name: "Notícia" },
  { slug: "review", name: "Review" },
  { slug: "guia", name: "Guia de Compra" },
  { slug: "lista", name: "Lista" },
  { slug: "promocao", name: "Promoção" },
];

const TOPIC_SEEDS = [
  { category: "noticia", hint: "lancamento de game, evento de games, anuncio de console, placa de video", ml_query: "lancamento games 2026" },
  { category: "review", hint: "review de jogo popular, analise de gameplay, dicas de jogo", ml_query: "jogo popular ps5 xbox switch" },
  { category: "guia", hint: "melhores headsets gamers, teclado mecanico, mouse gamer, monitor, cadeira", ml_query: "headset gamer teclado mecanico mouse gamer monitor" },
  { category: "lista", hint: "melhores jogos para PC, jogos gratis, jogos multiplayer, jogos estilo", ml_query: "jogo pc mais vendido 2026" },
  { category: "promocao", hint: "promocoes Steam, ofertas de games, descontos em perifericos gamers", ml_query: "promocao jogo pc periferico gamer" },
];

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
  "amd", "intel", "fonte", "water cooler", "gabinete",
];

const EVENT_KEYWORDS = ["e3", "game awards", "gamescom", "brasil game show", "bgs", "lançamento", "lancamento"];

const PROMO_KEYWORDS = ["promocao", "promoção", "oferta", "gratis", "grátis", "desconto", "steam sale"];

const KEYWORD_CATEGORY_MAP = {};

function initKeywordMap() {
  for (const kw of HARDWARE_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "guia";
  for (const kw of PROMO_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "promocao";
  for (const kw of EVENT_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "noticia";
}

initKeywordMap();

function extractTrendingTopics(headlines) {
  const allKeywords = [...GAME_KEYWORDS, ...CONSOLE_KEYWORDS, ...HARDWARE_KEYWORDS, ...EVENT_KEYWORDS, ...PROMO_KEYWORDS];
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

function isTopicDuplicate(keyword, existingTopics) {
  if (!existingTopics || existingTopics.length === 0) return false;
  const kw = keyword.toLowerCase();
  const kwWords = kw.split(/\s+/).filter((w) => w.length > 3);
  for (const topic of existingTopics) {
    const topicLower = topic.toLowerCase();
    let matches = 0;
    for (const word of kwWords) {
      if (topicLower.includes(word)) matches++;
    }
    if (matches >= 2) return true;
  }
  return false;
}

function buildTopicFromKeyword(topKeyword, topKeywords, existingTopics = []) {
  const kw = topKeyword.toLowerCase();
  const top3 = topKeywords.map(([k]) => k);
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
  } else if (PROMO_KEYWORDS.some((p) => kw.includes(p) || p.includes(kw))) {
    category = "promocao";
    hint = `melhores ${kw} de games e perifericos em 2026 — topicos em alta: ${ctx}`;
    ml_query = `${top2names} promocao oferta`;
  } else {
    category = "noticia";
    hint = `novidades sobre ${kw} no mundo gamer — topicos em alta: ${ctx}`;
    ml_query = `${top2names} gamer 2026`;
  }

  return { category, hint, ml_query, trending_score: topKeywords[0]?.[1] || 0, trending_keywords: top3 };
}

async function discoverTrendingTopic(existingTopics = []) {
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

  if (headlines.length < 5) {
    log("INFO", `Poucas headlines (${headlines.length}), usando fallback estatico`);
    return null;
  }

  log("INFO", `Total headlines: ${headlines.length}`);

  const trending = extractTrendingTopics(headlines);
  if (trending.length === 0) {
    log("INFO", "Nenhum topico identificado, usando fallback estatico");
    return null;
  }

  log("INFO", `Top trending: ${trending.slice(0, 5).map(([k, v]) => `${k} (${v}x)`).join(", ")}`);

  for (const [kw, score] of trending) {
    if (isTopicDuplicate(kw, existingTopics)) {
      log("INFO", `Topico "${kw}" ja usado recentemente, tentando proximo...`);
      continue;
    }
    const topic = buildTopicFromKeyword(kw, trending.slice(0, 3), existingTopics);
    log("INFO", `Tema escolhido: [${topic.category}] ${topic.hint}`);
    return topic;
  }

  const topic = buildTopicFromKeyword(trending[0][0], trending.slice(0, 3), existingTopics);
  log("INFO", `Tema escolhido (todos repetidos, usando top): [${topic.category}] ${topic.hint}`);

  return topic;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const ML_COOKIES_B64 = process.env.ML_COOKIES_B64;
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

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

// A IA as vezes marca a imagem uma secao antes do trecho que cita o jogo.
// Aqui o marcador e movido para logo depois do paragrafo que NOMEIA o jogo;
// se nenhum paragrafo cita, o marcador cai fora (melhor sem imagem que errada).
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
    const prev = [...kept].reverse().find((b) => b.trim() && !isMarker(b) && !isHeading(b));
    if (prev && mentions(prev, name)) kept.push(block);
    else pending.push({ name, block });
  }

  for (const { name, block } of pending) {
    const target = kept.findIndex((b) => !isHeading(b) && !isMarker(b) && b.trim() && mentions(b, name));
    if (target === -1) {
      log("WARN", `Marcador [IMG:${name}] descartado: nenhum paragrafo cita esse jogo`);
      continue;
    }
    let insertAt = target + 1;
    while (insertAt < kept.length && isMarker(kept[insertAt])) insertAt++;
    kept.splice(insertAt, 0, block);
    log("INFO", `Marcador [IMG:${name}] movido para junto do paragrafo que cita o jogo`);
  }

  return kept.join("\n\n");
}

function buildImageTag(name, imgUrl) {
  return `<img src="${imgUrl}" alt="${name.replace(/"/g, "&quot;")}" class="article-game-img" loading="lazy" decoding="async">`;
}

// Substitui [IMG:Nome] pela tag. Marcadores sem imagem correspondente somem.
// Fallback (IA nao usou marcador): injeta apos o paragrafo do **negrito**.
function injectGameImages(body, gameImages, hasMarkers) {
  if (hasMarkers) {
    return body.replace(IMG_MARKER_REGEX, (full, rawName) => {
      const name = rawName.trim();
      const key = Object.keys(gameImages).find((k) => k.toLowerCase() === name.toLowerCase());
      const url = key ? gameImages[key] : null;
      return url ? buildImageTag(name, url) : "";
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

    let paraEnd = body.indexOf("\n\n", match.index + match[0].length);
    paraEnd = paraEnd === -1 ? body.length : paraEnd;
    insertions.push({ pos: paraEnd, html: `\n\n${buildImageTag(name, imgUrl)}` });
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

function buildProductCardHtml(p, opinativo) {
  const img = p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "";
  const link = p.affiliate_link || p.permalink || "";
  const preco = p.price ? `R$ ${p.price.toFixed(2)}` : "";

  // Destaque derivado do proprio produto (faixa de preco), nao sorteado.
  let highlight;
  if (!p.price) {
    highlight = opinativo ? "Preco varia conforme o vendedor — confere antes de fechar" : "Preco sujeito a variacao no Mercado Livre";
  } else if (p.price < 200) {
    highlight = opinativo ? "Entra facil no orcamento sem comprometer o setup" : "Faixa de entrada: melhor relacao custo-beneficio da lista";
  } else if (p.price < 600) {
    highlight = opinativo ? "Meio-termo honesto: paga bem sem doer no bolso" : "Faixa intermediaria: equilibrio entre preco e desempenho";
  } else {
    highlight = opinativo ? "Investimento alto, mas e o topo da categoria" : "Faixa premium: indicado para quem prioriza desempenho";
  }

  const desc = opinativo
    ? "Garante o teu no Mercado Livre antes que o estoque acabe."
    : "Disponivel no Mercado Livre — confira preco e disponibilidade atualizados.";

  return `<div class="product-card">
  ${img ? `<img src="${img}" alt="${p.title}" class="product-card-img" loading="lazy" decoding="async">` : ""}
  <div class="product-card-body">
    <h3>${p.title}</h3>
    ${preco ? `<div class="product-price">${preco}</div>` : ""}
    <p class="product-desc">${desc}</p>
    <div class="product-pros"><strong>Destaque:</strong> ${highlight}</div>
    ${link ? `<a href="${link}" class="product-btn" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>` : ""}
  </div>
</div>`;
}

// Substitui [PRODUTO:N] pelo card. Produtos sem marcador caem no fallback
// antigo (bloco unico antes do 2o heading), pra nunca perder o afiliado.
function injectProductCards(body, mlProducts, opinativo) {
  if (!mlProducts || mlProducts.length === 0) return body;

  let result = body;
  const orphans = [];

  mlProducts.forEach((p, i) => {
    const html = buildProductCardHtml(p, opinativo);
    const marker = new RegExp(`^[ \\t]*\\[PRODUTO:\\s*${i + 1}\\s*\\][ \\t]*$`, "m");
    if (marker.test(result)) {
      result = result.replace(marker, () => `\n${html}\n`);
    } else {
      orphans.push(html);
    }
  });

  if (orphans.length > 0) {
    log("WARN", `${orphans.length}/${mlProducts.length} produtos sem marcador — usando posicionamento automatico`);
    const block = `\n\n${orphans.join("\n\n")}\n`;
    const headings = [...result.matchAll(/## (?!Fontes|Quer mais ofertas\?|Conclus[aã]o\b)[^\n]+/gi)];
    if (headings.length >= 2) {
      result = result.slice(0, headings[1].index) + block + "\n" + result.slice(headings[1].index);
    } else {
      result = result + block;
    }
  }

  return result;
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

if (ML_COOKIES_B64) {
  try {
    fs.writeFileSync(ML_COOKIES_PATH, Buffer.from(ML_COOKIES_B64, "base64"), "utf-8");
    log("INFO", "Cookies ML carregados");
  } catch (e) {
    log("WARN", `Erro ao salvar cookies: ${e.message}`);
  }
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
    throw new Error(`Tavily ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  log("INFO", `Tavily: ${data.results?.length || 0} resultados`);
  return data;
}

// A conta e service tier on_demand: 8000 tokens por minuto, e a Groq conta
// prompt + max_tokens na MESMA requisicao. Passar disso da 413 deterministico.
const GROQ_TPM_LIMIT = 8000;
const GROQ_SAFETY_MARGIN = 500;
const GROQ_MIN_OUTPUT = 3000;
const GROQ_MAX_OUTPUT = 5000;

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 3.3);
}

// Sobra de tokens para a resposta depois de descontar o prompt. Nunca inventa
// espaco que nao existe: prompt + retorno tem que caber nos 8000 do minuto.
function computeMaxTokens(systemPrompt, userPrompt) {
  const promptTokens = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
  const available = GROQ_TPM_LIMIT - promptTokens - GROQ_SAFETY_MARGIN;
  return Math.min(GROQ_MAX_OUTPUT, available);
}

async function fetchGroq(systemPrompt, userPrompt, maxAttempts = 8, opts = {}) {
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
    throw new Error(`Groq: prompt grande demais — sobram so ${body.max_tokens} tokens de saida no limite de ${GROQ_TPM_LIMIT} TPM`);
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log("INFO", `Groq: tentativa ${attempt}/${maxAttempts}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 503 || res.status === 502) {
        const wait = Math.min(30 * Math.pow(2, attempt - 1), 1800);
        log("WARN", `Groq: ${res.status}, aguardando ${wait}s (tentativa ${attempt}/${maxAttempts})...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        const msg = `Groq ${res.status}: ${err.slice(0, 300)}`;
        if (res.status === 401) {
          log("ERROR", `Groq: API key invalida! Atualize GROQ_API_KEY no GitHub Secrets.`);
        }
        // 413 e deterministico (tamanho da requisicao): retentar so perde tempo.
        if (res.status === 413) {
          log("ERROR", `Groq: requisicao maior que o limite de ${GROQ_TPM_LIMIT} TPM (prompt + max_tokens=${body.max_tokens}). Reduza o prompt.`);
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
      const wait = Math.min(10 * Math.pow(2, attempt - 1), 300);
      log("WARN", `Groq: erro "${err.message.slice(0,80)}", retentando em ${wait}s...`);
      await sleep(wait * 1000);
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
    const out = await fetchGroq(sys, user, 2, { maxTokens: 512, temperature: 0.6 });
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
const MIN_WORDS = { guia: 800, review: 800, noticia: 650, lista: 650, promocao: 650 };
const ABSOLUTE_MIN_WORDS = 500;

const GENERIC_TITLE_PATTERNS = [
  /tudo (o )?que voc[êe] precisa saber/i,
  /novidades que v[ãa]o bombar/i,
  /voc[êe] n[ãa]o vai acreditar/i,
  /fique por dentro/i,
  /confira( agora)?[!?]*$/i,
  /imperd[íi]vel/i,
  /surpreendente/i,
  /revolucion[áa]ri[oa]/i,
  /o que esperar\s*[?!]*$/i,
];

// Regras de SERP/CTR. Retorna lista de problemas (vazia = titulo aprovado).
function checkTitle(title, primaryKeyword) {
  const problems = [];
  const t = String(title || "");
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
function validate(fm, body, ctx = {}) {
  const hard = [];
  const soft = [];

  if (!fm.title || String(fm.title).length < 10) hard.push("title: muito curto");
  if (!fm.description || String(fm.description).length < 120) hard.push("description: muito curto (min 120)");
  if (!fm.pubDate) hard.push("pubDate: ausente");
  if (!fm.category) hard.push("category: ausente");
  if (!fm.tags || !Array.isArray(fm.tags) || fm.tags.length < 3) hard.push("tags: minimo 3");
  if (fm.affiliate === undefined) hard.push("affiliate: ausente");

  const wc = body.split(/\s+/).filter(Boolean).length;
  const min = MIN_WORDS[ctx.category] || 650;
  const floor = ctx.lastAttempt ? ABSOLUTE_MIN_WORDS : min;
  if (wc < floor) hard.push(`Conteudo muito curto: ${wc} palavras (minimo ${min})`);
  else if (wc < min) soft.push(`Conteudo abaixo do alvo: ${wc} palavras (minimo ${min})`);

  if (!/^##\s+/m.test(body)) hard.push("Artigo sem headings ##");

  if (ctx.productCount > 0) {
    const used = new Set([...body.matchAll(PRODUCT_MARKER_REGEX)].map((m) => Number(m[1])));
    const valid = [...used].filter((n) => n >= 1 && n <= ctx.productCount);
    if (valid.length === 0) {
      soft.push(`Nenhum marcador [PRODUTO:N] usado (havia ${ctx.productCount} produtos disponiveis)`);
    } else if (valid.length < Math.min(2, ctx.productCount)) {
      soft.push(`So ${valid.length} de ${ctx.productCount} produtos posicionados com [PRODUTO:N]`);
    }
  }

  if (extractImageMarkers(body).length === 0) {
    soft.push("Nenhum marcador [IMG:Nome do Jogo] usado — artigo ficara sem imagens no corpo");
  }

  soft.push(...checkTitle(fm.title, ctx.primaryKeyword));

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
  log("INFO", `GROQ_API_KEY definida: ${!!GROQ_API_KEY}`);
  log("INFO", `TAVILY_API_KEY definida: ${!!TAVILY_API_KEY}`);
  log("INFO", `ML_CLIENT_ID definida: ${!!ML_CLIENT_ID}`);
  log("INFO", `ML_CLIENT_SECRET definida: ${!!ML_CLIENT_SECRET}`);

  if (!GROQ_API_KEY) { log("ERROR", "GROQ_API_KEY nao configurada"); process.exit(1); }
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

  try {
    const trending = await discoverTrendingTopic(existingTopics);
    if (trending && trending.trending_score >= 2) {
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

  let researchContext = "";
  try {
    const query = topic.category === "noticia"
      ? `${topic.hint} Brasil 2026`
      : `melhores ${topic.hint} Brasil 2026`;
    const sr = await fetchTavily(query);
    // 450 chars por fonte: o limite de 8000 TPM da Groq divide o orcamento
    // entre pesquisa e tamanho do artigo.
    researchContext = (sr?.results || [])
      .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 450)}`)
      .join("\n\n");
  } catch (err) {
    log("WARN", `Tavily: ${err.message}`);
  }

  let mlProducts = [];
  if (ML_CLIENT_ID && ML_CLIENT_SECRET) {
    try {
      const trendingKws = topic.trending_keywords || [];
      const searchQueries = [
        ...trendingKws.slice(0, 2).map((kw) => `${kw} jogo ps5 xbox pc`),
        topic.ml_query,
      ].slice(0, 4);

      const seen = new Set();
      for (const query of searchQueries) {
        try {
          let results = await searchMLviaGoogle(query, ML_COOKIES_PATH, TAVILY_API_KEY, 4);
          if (results.length === 0) {
            log("INFO", `Google: 0 resultados para "${query}", tentando API ML...`);
            results = await searchML(query, ML_CLIENT_ID, ML_CLIENT_SECRET, TAVILY_API_KEY, ML_COOKIES_PATH, 4);
          }
          for (const p of results) {
            if (!seen.has(p.permalink)) {
              seen.add(p.permalink);
              mlProducts.push(p);
            }
          }
        } catch (e) {
          log("WARN", `ML search "${query}": ${e.message}`);
        }
        if (mlProducts.length >= 4) break;
      }

      if (mlProducts.length === 0) {
        log("INFO", "Nenhum produto encontrado via multiplas queries, tentando fallback com query original...");
        mlProducts = await searchMLviaGoogle(topic.ml_query, ML_COOKIES_PATH, TAVILY_API_KEY, 4);
        if (mlProducts.length === 0) {
          mlProducts = await searchML(topic.ml_query, ML_CLIENT_ID, ML_CLIENT_SECRET, TAVILY_API_KEY, ML_COOKIES_PATH, 4);
        }
      }

      for (const p of mlProducts) {
        if (fs.existsSync(ML_COOKIES_PATH)) {
          try {
            const linkResult = await generateAffiliateLink(p.permalink, ML_COOKIES_PATH);
            p.affiliate_link = linkResult?.short_url || linkResult?.link || linkResult?.url || p.permalink;
            log("INFO", `Link afiliado gerado: ${p.title?.slice(0, 40)}`);
          } catch (e) {
            log("WARN", `Falha link afiliado: ${e.message}`);
            p.affiliate_link = p.permalink;
          }
        } else {
          p.affiliate_link = p.permalink;
        }
      }
    } catch (err) {
      log("WARN", `ML Search: ${err.message}`);
    }
  } else {
    log("WARN", "ML_CLIENT_ID/ML_CLIENT_SECRET nao configurados — pulando busca de produtos ML");
  }

  mlProducts = mlProducts.filter((p) => isGamerProduct(p.title));

  const productBlock = mlProducts.length > 0
    ? `\nPRODUTOS DISPONIVEIS (use o marcador indicado para posicionar cada card):\n${mlProducts.map((p, i) =>
        `Marcador: [PRODUTO:${i + 1}]\n` +
        `Nome: ${p.title}\n` +
        `Preco: R$ ${p.price?.toFixed(2) || "nao informado"}\n`
      ).join("\n")}\nO sistema monta o card (imagem, preco, botao de compra) no lugar do marcador. Voce NAO escreve preco, link nem imagem desses produtos — so decide ONDE cada card entra.`
    : "";

  const trendingNote = topic.trending_keywords
    ? `\nCONTEXTO: Este topico esta em alta agora em sites de games e redes sociais. Palavras-chave trending: ${topic.trending_keywords.join(", ")}. Escreva um artigo relevante e atual conectando esses temas.`
    : "";

  const categoria = topic.category;
  const estiloOpinativo = categoria === "noticia" || categoria === "lista" || categoria === "promocao";
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

  const personaFactual = `PERSONA: Voce e um redator tecnico especializado em games e hardware do Blog Gamer. Escreve reviews e guias com precisao e profundidade.

REGRAS DE ESTILO:
- ABERTURA: Va direto ao ponto. Contextualize o topico em 1-2 frases. Ex: "Escolher o monitor certo para games em 2026 exige atencao a 3 especificacoes-chave: taxa de atualizacao, tempo de resposta e tipo de painel."
- OBJETIVIDADE: Seja direto e informativo. Compare especificacoes, mostre dados, explique decisoes tecnicas.
- PROFUNDIDADE: Guias e reviews precisam de detalhes. Explique o "por que" por tras de cada recomendacao.
- ESTRUTURA: Use tabelas comparativas, pros/contras, listas numeradas de passos.
- TOM: Profissional mas acessivel. Nem robotico, nem informal demais. Ex: "A RTX 4060 entrega 60 fps estaveis em 1080p." (e nao: "A placa apresenta desempenho satisfatorio no que tange a...")
- FALE COM O LEITOR: Use "voce" e "seu setup", mas sem girias pesadas.
- JAMAIS: girias de boteco ("mermao", "ta ligado"), humor forcado, sarcasmo`;

  const personaPrompt = estiloOpinativo ? personaManoGamer : personaFactual;
  const minWords = MIN_WORDS[categoria] || 650;
  const alvoWords = estiloFactual ? "900-1100" : "700-900";
  const primaryKeyword = topic.trending_keywords?.[0] || "";

  const systemPrompt = `Voce e redator senior de um blog gamer brasileiro de alto trafego. Seu artigo e publicado como esta, sem revisao humana: generalidade, cliche e dado inventado custam trafego e credibilidade.

${personaPrompt}${trendingNote}

## MARCADORES DE POSICIONAMENTO (OBRIGATORIO)
Voce nao renderiza imagens nem cards de produto — voce decide ONDE eles entram, com marcadores que o sistema substitui depois.
- [IMG:Nome Exato do Jogo] — em uma linha sozinha, logo APOS o paragrafo que apresenta ou descreve aquele jogo. Use so para titulos de jogos reais (ex: [IMG:Resident Evil Requiem]). NUNCA para conceitos, passos, secoes ou specs (nada de [IMG:Instalacao rapida]). Use de 2 a 4 no artigo.
- ${mlProducts.length > 0 ? `[PRODUTO:N] — em uma linha sozinha, no ponto em que aquele produto especifico e relevante (logo depois do paragrafo que fala dele ou da categoria dele). NAO empilhe todos no comeco. Use o numero exato indicado na lista de produtos.` : "Nao ha produtos nesta rodada — nao use [PRODUTO:N]."}
- Nunca coloque dois marcadores seguidos sem texto entre eles. Se um jogo ou produto nao tem relevancia real em nenhum trecho, omita o marcador — melhor faltar do que forcar.
- Se o sistema nao achar imagem para um [IMG:...], ele remove o marcador. Entao o paragrafo tem que fazer sentido sozinho, sem depender da imagem.

## REGRAS DE TITULO
- 55 a 65 caracteres.
- ${primaryKeyword ? `A palavra-chave "${primaryKeyword}" DEVE aparecer nos primeiros 40% do titulo.` : "A palavra-chave principal (jogo, produto ou evento) deve aparecer nos primeiros 40% do titulo."}
- PROIBIDO: "Tudo que voce precisa saber", "Novidades que vao bombar", "Fique por dentro", "Imperdivel", "Revolucionario", "O que esperar".
- Use numero, data ou beneficio concreto: "10 Melhores X em 2026", "X vs Y: Qual Vale a Pena", "X Chega em Marco: O Que Muda".
- Nada de clickbait vazio: o titulo tem que ser 100% sustentado pelo conteudo.

## REGRAS DE CONTEUDO
1. GROUNDING: todo dado concreto (preco, spec, data, numero de vendas, nota) vem das fontes de pesquisa fornecidas. Se nao esta la, nao afirme como fato — use "segundo rumores", "ainda sem confirmacao".
2. ESPECIFICIDADE: proibido "incrivel", "revolucionario", "surpreendente" sem uma frase logo depois explicando o motivo concreto.
3. TESE POR SECAO: cada secao defende um ponto, nao lista fatos soltos. Nao "as specs do monitor X", e sim "o monitor X vale o preco por causa de Y, apesar de Z".
4. COMPARACAO REAL: em tabela comparativa, os numeros precisam diferenciar os itens. Nada de todo mundo com nota 9/10.
5. EXTENSAO: minimo ${minWords} palavras, alvo ${alvoWords}. Extensao e consequencia de profundidade — nao encha linguica pra bater numero.
6. E permitido (e recomendado) discordar do hype de marketing quando os dados sustentarem. Isso gera credibilidade.
7. Frases curtas alternadas com uma ou duas mais longas. Paragrafos com frases todas do mesmo tamanho denunciam texto de IA.
${estiloOpinativo ? "8. Giria e humor sao tempero, nao estrutura: no maximo 1 giria marcante a cada 2-3 paragrafos, nunca empilhadas." : "8. Tom tecnico com clareza: pode ter um toque de humor seco, mas sem giria de boteco."}

## ESTRUTURA (adapte a categoria — nao force todos os blocos sempre)
- Headings ## em toda secao principal (### para subsecoes). Subtitulos que dizem algo, nao "Analise" ou "Detalhes".
- Introducao com gancho concreto (um fato especifico, nao pergunta retorica generica).
- Corpo com os marcadores posicionados conforme as regras acima.
- Jogos citados pela PRIMEIRA vez em **negrito**: "**EA Sports FC 26** chegou..."
- Bullets ou passos numerados nas secoes onde ajudam a leitura (nao em todas a forca).
- ${mlProducts.length > 0 ? "Tabela comparativa dos produtos (Produto | Preco | Destaque | Nota 1-10) com notas que realmente diferenciam, e uma secao ## Pros e Contras especifica de cada item (nada de pro generico)." : "Tabela quando houver o que comparar (jogos, specs, edicoes)."}
- ## FAQ com 3-4 perguntas que as pessoas realmente pesquisam no Google sobre o tema.
- Conclusao com recomendacao clara: pra quem vale a pena e pra quem nao vale.
- 2 a 3 links internos no formato [texto](/blog-gamer/blog/slug-do-artigo/).
- "## Quer mais ofertas?" com: Entre para o nosso [grupo VIP no Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) e receba ofertas diarias de games, consoles e perifericos!
- "## Fontes" com os links da pesquisa.

## PROIBIDO
- Inventar URL de imagem (wikipedia, google, unsplash) ou link de compra.
- Escrever preco, imagem ou botao dos produtos listados — isso e do card.
- Emojis, voz passiva, mencionar que e IA, termos corporativos ("desta forma", "outrossim", "vale ressaltar que").
- Markdown (** ou *) dentro do title e da description do frontmatter.

## SAIDA
Frontmatter YAML entre "---" e "---", depois o markdown do artigo com os marcadores no corpo. Nada alem disso — sem comentarios sobre o processo.

title: "Titulo SEO (55-65 caracteres)"
description: "Descricao persuasiva (120-160 caracteres, sem markdown)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: ${mlProducts.length > 0}

category DEVE ser: noticia, review, guia, lista ou promocao`;

  const buildUserPrompt = (research) => `Escreva um artigo de categoria "${categoria}" sobre: ${topic.hint}

${research ? `PESQUISA (use estes fatos — nao invente dados fora daqui):\n${research}\n` : "SEM PESQUISA DISPONIVEL: escreva so o que e conhecimento consolidado, sem inventar numeros, datas ou precos.\n"}
${productBlock}

Checklist antes de responder:
1. Titulo com 55-65 chars${primaryKeyword ? `, com "${primaryKeyword}" no comeco` : ""}, sem frase generica.
2. Description 120-160 chars, sem ** e sem exagero promocional.
3. Minimo ${minWords} palavras de conteudo real (alvo ${alvoWords}).
4. ${mlProducts.length > 0 ? `Marcadores [PRODUTO:1]..[PRODUTO:${mlProducts.length}] distribuidos ao longo do texto, cada um perto do trecho que fala daquele produto.` : "Sem produtos nesta rodada."}
5. 2 a 4 marcadores [IMG:Nome do Jogo], cada um apos o paragrafo que descreve o jogo.
6. Cada dado concreto rastreavel ate a pesquisa acima.
7. 5 tags relevantes.
8. ${estiloOpinativo ? "Voz Mano Gamer: opiniao com lado tomado, giria dosada, sem enrolacao." : "Voz tecnica: precisao, comparacao de specs, o porque de cada recomendacao."}`;

  // Encolhe a pesquisa ate sobrar espaco de saida suficiente dentro do TPM.
  let userPrompt = buildUserPrompt(researchContext);
  while (computeMaxTokens(systemPrompt, userPrompt) < GROQ_MIN_OUTPUT && researchContext.length > 800) {
    researchContext = researchContext.slice(0, Math.floor(researchContext.length * 0.75));
    userPrompt = buildUserPrompt(researchContext);
    log("WARN", `Pesquisa reduzida para caber no limite de ${GROQ_TPM_LIMIT} TPM`);
  }
  log("INFO", `Orcamento Groq: prompt ~${estimateTokens(systemPrompt) + estimateTokens(userPrompt)} tokens, saida ~${computeMaxTokens(systemPrompt, userPrompt)} tokens`);

  const MAX_GEN_ATTEMPTS = 3;
  const validationCtx = {
    category: categoria,
    productCount: mlProducts.length,
    primaryKeyword,
  };

  let fm = null;
  let body = null;
  let feedback = "";

  for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
    const lastAttempt = attempt === MAX_GEN_ATTEMPTS;
    log("INFO", `Gerando artigo com Groq (tentativa ${attempt}/${MAX_GEN_ATTEMPTS})...`);

    let article;
    try {
      article = await fetchGroq(systemPrompt, userPrompt + feedback);
    } catch (err) {
      log("ERROR", `Falha na geracao: ${err.message}`);
      process.exit(1);
    }

    let parsed;
    try {
      parsed = parseFrontmatter(article);
    } catch (err) {
      log("WARN", `Erro frontmatter: ${err.message}`);
      log("DEBUG", article.slice(0, 600));
      if (lastAttempt) { log("ERROR", "Frontmatter invalido apos todas as tentativas"); process.exit(1); }
      feedback = "\n\nA resposta anterior nao tinha frontmatter YAML valido. Comece a resposta com --- e feche com --- antes do markdown.";
      continue;
    }

    const { hard, soft } = validate(parsed.frontmatter, parsed.body, { ...validationCtx, lastAttempt });

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

    feedback = `\n\nA versao anterior foi rejeitada. Corrija TUDO isto e reescreva o artigo inteiro:\n- ${[...hard, ...soft].join("\n- ")}`;
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

  fm.title = String(fm.title).replace(/\*/g, "").trim();
  fm.description = String(fm.description).replace(/\*/g, "").trim();

  log("INFO", "Validando links internos...");
  body = validateInternalLinks(body);
  log("INFO", "Links internos validados");

  log("INFO", "Buscando imagens de jogos via RAWG...");
  body = cleanFakeImages(body);

  if (extractImageMarkers(body).length > 0) body = repositionImageMarkers(body);

  const markerNames = extractImageMarkers(body);
  const hasImageMarkers = markerNames.length > 0;
  const gameNames = hasImageMarkers ? markerNames : extractGameNames(body);
  const gameImages = {};

  if (gameNames.length > 0) {
    log("INFO", `${gameNames.length} jogos ${hasImageMarkers ? "marcados com [IMG:]" : "detectados por negrito (fallback)"}: ${gameNames.slice(0, 8).join(", ")}`);
    for (const name of gameNames.slice(0, 8)) {
      const img = await fetchRAWGImage(name);
      if (img) gameImages[name] = img;
    }
    body = injectGameImages(body, gameImages, hasImageMarkers);
    log("INFO", `${Object.keys(gameImages).length}/${gameNames.length} imagens RAWG injetadas`);
  } else {
    log("WARN", "Nenhum jogo marcado nem detectado no artigo");
  }

  log("INFO", "Injetando produtos do Mercado Livre no artigo...");
  body = injectProductCards(body, mlProducts, estiloOpinativo);
  log("INFO", `${mlProducts.length} produtos injetados no corpo do artigo`);

  body = stripLeftoverMarkers(body);

  const trendingKeywordForCover = topic.trending_keywords?.[0] || "";
  const coverImage = await getBestCoverImage(mlProducts, body, trendingKeywordForCover, markerNames);
  if (!coverImage) {
    const fallbackKw = trendingKeywordForCover || topic.ml_query?.split(" ").slice(0, 2).join(" ") || "";
    if (fallbackKw) {
      const fallbackImg = await fetchRAWGImage(fallbackKw);
      if (fallbackImg) {
        fm.image = fallbackImg;
        log("INFO", `Imagem de capa via RAWG (fallback): ${fallbackImg.slice(0, 80)}`);
      }
    }
  } else {
    fm.image = coverImage;
    log("INFO", `Imagem de capa: ${coverImage.slice(0, 80)}`);
  }
  if (!fm.image) {
    log("WARN", "Nenhuma imagem de capa encontrada — artigo ficara sem imagem principal");
  }

  const slug = slugify(fm.title);
  const published = fs.existsSync(ARTIGOS_DIR)
    ? fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
    : [];

  if (published.includes(slug)) {
    log("ERROR", `Slug duplicado: ${slug}`);
    process.exit(0);
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

// So roda o pipeline quando o arquivo e executado direto (node scripts/gerar-artigo.mjs).
// Importado como modulo (pelos testes), apenas expoe as funcoes puras abaixo.
const executadoDireto = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (executadoDireto) {
  main().catch((err) => {
    log("ERROR", err.message);
    const state = loadState();
    const today = new Date().toISOString().split("T")[0];
    state.last_error = err.message.slice(0, 200);
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
  buildProductCardHtml,
  stripLeftoverMarkers,
  extractGameNames,
  checkTitle,
  validate,
  computeMaxTokens,
  MIN_WORDS,
};
