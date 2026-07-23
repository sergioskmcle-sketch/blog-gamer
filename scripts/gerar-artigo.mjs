import "dotenv/config";
import fs from "fs";
import path from "path";
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

  let category = KEYWORD_CATEGORY_MAP[kw] || "noticia";
  let hint = "";
  let ml_query = "";

  if (GAME_KEYWORDS.some((g) => kw.includes(g) || g.includes(kw))) {
    category = "noticia";
    hint = `lancamentos, novidades e guia sobre ${kw} — topicos em alta: ${ctx}`;
    ml_query = `${kw} jogo ps5 xbox pc`;
  } else if (CONSOLE_KEYWORDS.some((c) => kw.includes(c) || c.includes(kw))) {
    category = "noticia";
    hint = `novidades, jogos e acessorios para ${kw} — topicos em alta: ${ctx}`;
    ml_query = `${kw} jogo acessorio`;
  } else if (HARDWARE_KEYWORDS.some((h) => kw.includes(h) || h.includes(kw))) {
    category = "guia";
    hint = `melhores ${kw}s gamer em 2026 — topicos em alta: ${ctx}`;
    ml_query = `${kw} gamer 2026`;
  } else if (EVENT_KEYWORDS.some((e) => kw.includes(e) || e.includes(kw))) {
    category = "noticia";
    hint = `${kw}: anuncios, novidades e expectativas — topicos em alta: ${ctx}`;
    ml_query = `games lancamento 2026`;
  } else if (PROMO_KEYWORDS.some((p) => kw.includes(p) || p.includes(kw))) {
    category = "promocao";
    hint = `melhores ${kw} de games e perifericos em 2026 — topicos em alta: ${ctx}`;
    ml_query = `promocao gamer oferta`;
  } else {
    category = "noticia";
    hint = `novidades sobre ${kw} no mundo gamer — topicos em alta: ${ctx}`;
    ml_query = `${kw} gamer 2026`;
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

async function fetchRAWGImage(gameName) {
  if (!RAWG_API_KEY) return null;
  if (GAME_IMAGE_CACHE[gameName]) return GAME_IMAGE_CACHE[gameName];

  const clean = gameName
    .replace(/[^a-zA-Z0-9 àáâãéêíóôõúç:]/g, "")
    .replace(/\b(ps4|ps5|xbox|nintendo|switch|pc|midia fisica|edicao|edition|standard)\b/gi, "")
    .replace(/\s+/g, " ").trim();

  if (!clean || clean.length < 3) return null;

  try {
    const r = await fetch(
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(clean)}&page_size=1&page=1`,
      { timeout: 10000 }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const bg = data.results?.[0]?.background_image;
    if (bg) {
      const hqUrl = bg.replace("/media/", "/media/crop/600/400/") + "?auto=format&fit=crop&w=800&h=450";
      try {
        GAME_IMAGE_CACHE[gameName] = hqUrl;
        log("INFO", `RAWG imagem "${gameName.slice(0, 40)}": ${hqUrl.slice(0, 60)}...`);
        return hqUrl;
      } catch {}
    }
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
  ]);
  const found = body.match(/\*\*([^*]+)\*\*/g);
  if (!found) return [];
  const seen = new Set();
  const result = [];
  for (const match of found) {
    const name = match.replace(/^\*\*|\*\*$/g, "").trim();
    if (name && name.length > 3 && !name.startsWith("http") && !name.startsWith("R$")) {
      const lower = name.toLowerCase();
      if (nonGameTerms.has(lower)) continue;
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result;
}

function injectGameImages(body, gameImages) {
  let result = body;
  for (const [name, imgUrl] of Object.entries(gameImages)) {
    if (!imgUrl) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boldRegex = new RegExp(`\\*\\*${escaped}\\*\\*`, "g");
    const match = boldRegex.exec(result);
    if (!match) continue;

    const boldPos = match.index;
    let paraStart = result.lastIndexOf("\n\n", boldPos);
    paraStart = paraStart === -1 ? 0 : paraStart + 2;
    let paraEnd = result.indexOf("\n\n", boldPos + match[0].length);
    paraEnd = paraEnd === -1 ? result.length : paraEnd;

    const imageTag = `<img src="${imgUrl}" alt="${name}" class="article-game-img" loading="lazy" decoding="async">`;
    result = result.slice(0, paraEnd) + `\n\n${imageTag}` + result.slice(paraEnd);
  }
  return result;
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

function injectProductCards(body, mlProducts) {
  if (!mlProducts || mlProducts.length === 0) return body;

  const productCards = mlProducts.map((p) => {
    const img = p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "";
    const link = p.affiliate_link || p.permalink || "";
    const preco = p.price ? `R$ ${p.price.toFixed(2)}` : "";
    return `<div class="product-card">
  ${img ? `<img src="${img}" alt="${p.title}" class="product-card-img" loading="lazy" decoding="async">` : ""}
  <div class="product-card-body">
    <h3>${p.title}</h3>
    ${preco ? `<div class="product-price">${preco}</div>` : ""}
    <p class="product-desc">Adquira no Mercado Livre com o melhor preço e frete rápido.</p>
    <div class="product-pros"><strong>Destaque:</strong> Excelente custo-benefício para esta categoria.</div>
    ${link ? `<a href="${link}" class="product-btn" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>` : ""}
  </div>
</div>`;
  }).join("\n\n");

  const allProductsBlock = `\n\n${productCards}\n`;

  const headingRegex = /## (?!Fontes|Quer mais ofertas\?|Conclus[aã]o\b)[^\n]+/gi;
  const headings = [...body.matchAll(headingRegex)];

  if (headings.length >= 2) {
    const insertAt = headings[1].index;
    return body.slice(0, insertAt) + allProductsBlock + "\n" + body.slice(insertAt);
  }

  return body + allProductsBlock;
}

function cleanFakeImages(body) {
  return body
    .replace(/<img[^>]*src="https?:\/\/upload\.wikimedia\.org[^"]*"[^>]*>/gi, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n");
}

async function getBestCoverImage(products, articleBody) {
  if (products.length > 0) {
    for (const p of products) {
      if (p.thumbnail && p.thumbnail.startsWith("http")) {
        return p.thumbnail;
      }
    }
  }
  const gameNames = extractGameNames(articleBody);
  if (gameNames.length > 0) {
    const img = await fetchRAWGImage(gameNames[0]);
    if (img) return img;
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
      search_depth: "advanced", max_results: 6,
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

async function fetchGroq(systemPrompt, userPrompt, maxAttempts = 8) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  };
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
        throw new Error(msg);
      }
      const data = await res.json();
      if (!data.choices?.[0]?.message?.content)
        throw new Error(`Groq: resposta vazia: ${JSON.stringify(data).slice(0, 200)}`);
      return data.choices[0].message.content;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const wait = Math.min(10 * Math.pow(2, attempt - 1), 300);
      log("WARN", `Groq: erro "${err.message.slice(0,80)}", retentando em ${wait}s...`);
      await sleep(wait * 1000);
    }
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

function validate(fm, body) {
  const errors = [];
  if (!fm.title || String(fm.title).length < 10) errors.push("title: muito curto");
  if (!fm.description || String(fm.description).length < 120) errors.push("description: muito curto (min 120)");
  if (!fm.pubDate) errors.push("pubDate: ausente");
  if (!fm.category) errors.push("category: ausente");
  if (!fm.tags || !Array.isArray(fm.tags) || fm.tags.length < 3) errors.push("tags: minimo 3");
  if (fm.affiliate === undefined) errors.push("affiliate: ausente");
  const wc = body.split(/\s+/).length;
  if (wc < 400) errors.push(`Conteudo muito curto: ${wc} palavras`);
  return errors;
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
    researchContext = sr?.results
      .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 600)}`)
      .join("\n\n");
  } catch (err) {
    log("WARN", `Tavily: ${err.message}`);
  }

  let mlProducts = [];
  if (ML_CLIENT_ID && ML_CLIENT_SECRET) {
    try {
      const trendingKws = topic.trending_keywords || [];
      const searchQueries = [
        topic.ml_query,
        ...trendingKws.slice(0, 2).map((kw) => `${kw} jogo acessorio console`),
      ].slice(0, 3);

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
    ? `\nProdutos do Mercado Livre (APENAS mencione-os no texto, o sistema ja injeta imagens e links):\n${mlProducts.map((p, i) =>
        `[Produto ${i + 1}]\n` +
        `Nome: ${p.title}\n` +
        `Preco: R$ ${p.price?.toFixed(2) || "N/A"}\n` +
        `Imagem: ${p.thumbnail}\n` +
        `Link Mercado Livre: ${p.affiliate_link || p.permalink}\n`
      ).join("\n")}`
    : "";

  const trendingNote = topic.trending_keywords
    ? `\nCONTEXTO: Este topico esta em alta agora em sites de games e redes sociais. Palavras-chave trending: ${topic.trending_keywords.join(", ")}. Escreva um artigo relevante e atual conectando esses temas.`
    : "";

  const systemPrompt = `Voce e um redator especializado em videogames do Blog Gamer, site brasileiro. Escreva em portugues brasileiro, tom natural de gamer.${trendingNote}

Regras:
- Artigo: MINIMO 800 palavras (obrigatorio, o sistema rejeita artigos com menos de 800 palavras)
- ESTRUTURA OBRIGATORIA: Todo artigo DEVE ter headings ## para cada secao principal. Use ## para secoes (ex: ## Introducao, ## Analise, ## Dicas) e ### para subsecoes. NUNCA escreva um artigo sem headings.
- Sempre que citar um jogo pela PRIMEIRA vez, use **Nome Do Jogo** em negrito. Ex: "**EA Sports FC 26** e um dos melhores..."
- IMPORTANTE: NUNCA invente URLs de imagens (ex: wikipedia, google). O sistema insere imagens automaticamente para nomes de jogos em negrito.
- ${mlProducts.length > 0 ? `Produtos do Mercado Livre: O sistema ja injeta os produtos automaticamente no artigo. NÃO inclua imagens, preços ou links dos produtos listados abaixo — apenas MENCIONE-OS NATURALMENTE no texto quando relevante. Para cada produto gamer mencionado use: texto descritivo sem duplicar o que o sistema ja faz.` : "Modo informativo: artigo de conteudo puro. Nao invente produtos, precos, links de compra, ou URLs de imagens. Use APENAS **negrito** nos nomes de jogos."}
- ${mlProducts.length > 0 ? `ENRIQUECIMENTO OBRIGATORIO: inclua uma TABELA COMPARATIVA dos produtos com colunas: Produto | Preco | Destaque | Nota (1-10). Inclua uma secao ## FAQ com 3-4 perguntas e respostas. Para cada produto, liste PROS e CONTRAS em bullets estruturadas ## Pros e Contras. IMPORTANTE: use listas e bullets (<ul>/<li> ou -) em TODAS as secoes para melhorar a legibilidade.` : `ENRIQUECIMENTO OBRIGATORIO: inclua uma secao ## FAQ com 3-4 perguntas. Inclua tabelas quando relevante para comparar jogos, especificacoes, ou dados. Use listas e bullets em todas as secoes.`}
- IMPORTANTE: Toda secao do artigo DEVE ter pelo menos 2-3 bullets/listas com topicos claros. Numere passos (1. 2. 3.) ou use bullets (- texto). Artigos sem topicos/listas sao rejeitados.
- IMPORTANTE: Inclua 2 a 3 links internos para outros artigos do Blog Gamer usando o formato [texto](/blog-gamer/blog/slug-do-artigo/). Ex: "Confira tambem nosso [guia de placas de video](/blog-gamer/blog/as-10-melhores-placas-de-video-custo-beneficio-do-mercado-livre-em-2026/)".
- Ao final do artigo, inclua um call-to-action convidando o leitor a entrar no grupo VIP do Telegram para ofertas diarias: "## Quer mais ofertas?\\n\\nEntre para o nosso [grupo VIP no Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) e receba ofertas diarias de games, consoles e perifericos!"
- Cite as fontes de pesquisa no final: "## Fontes" com links
- NUNCA mencione que e IA. NUNCA use emojis.
- Saida EXATA: frontmatter YAML entre "---" e fechando com "---" depois o conteudo markdown

Frontmatter obrigatorio:
title: "Titulo SEO (50-60 caracteres)"
description: "Descricao persuasiva (120-160 caracteres)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: ${mlProducts.length > 0}

category DEVE ser: noticia, review, guia, lista ou promocao`;

  let userPrompt = `Escreva um artigo sobre "${topic.hint}".

${researchContext ? `Fontes de pesquisa:\n${researchContext}\n` : ""}
${productBlock}

Instrucoes:
1. Titulo SEO atraente (50-60 caracteres)
2. Descricao persuasiva (120-160 caracteres, sem exageros promocionais)
3. Artigo em markdown com estrutura clara: ## Introducao, ## [Topico Principal], ## Dicas, ## Conclusao, ## Fontes
4. ${mlProducts.length > 0 ? `Mencione produtos do Mercado Livre naturalmente no texto — o sistema ja injeta cards, imagens e botoes automaticamente.` : `NAO invente links de compra nem URLs de imagens.`}
5. USE **NEGRITO** nos nomes de jogos na primeira mencao
6. Inclua 2-3 links internos para outros artigos do Blog Gamer (ex: [guia de placas de video](/blog-gamer/blog/as-10-melhores-placas-de-video-custo-beneficio-do-mercado-livre-em-2026/))
7. Ao final, secao "## Quer mais ofertas?" com link para o grupo Telegram (https://t.me/+TRWZ67WHuk85Y2Nh)
8. Minimo 800 palavras de conteudo real (o sistema rejeita artigos menores)
9. 5 tags relevantes
10. Dicas praticas e uteis para gamers`;

  log("INFO", "Gerando artigo com Groq...");
  let article;
  try {
    article = await fetchGroq(systemPrompt, userPrompt);
    log("INFO", "Artigo gerado, parseando...");
  } catch (err) {
    log("ERROR", `Falha na geracao: ${err.message}`);
    process.exit(1);
  }

  let fm, body;
  try {
    const parsed = parseFrontmatter(article);
    fm = parsed.frontmatter;
    body = parsed.body;
  } catch (err) {
    log("ERROR", `Erro frontmatter: ${err.message}`);
    log("DEBUG", article.slice(0, 600));
    process.exit(1);
  }

  const errors = validate(fm, body);
  if (errors.length > 0) {
    log("ERROR", `Validacao falhou:\n${errors.join("\n")}`);
    log("DEBUG", JSON.stringify(fm, null, 2));
    process.exit(1);
  }

  log("INFO", "Validacoes OK");

  log("INFO", "Validando links internos...");
  body = validateInternalLinks(body);
  log("INFO", "Links internos validados");

  log("INFO", "Injetando produtos do Mercado Livre no artigo...");
  body = injectProductCards(body, mlProducts);
  log("INFO", `${mlProducts.length} produtos injetados no corpo do artigo`);

  log("INFO", "Buscando imagens de jogos via RAWG...");
  body = cleanFakeImages(body);
  const gameNames = extractGameNames(body);
  if (gameNames.length > 0) {
    log("INFO", `${gameNames.length} jogos detectados: ${gameNames.slice(0, 8).join(", ")}`);
    const gameImages = {};
    for (const name of gameNames.slice(0, 8)) {
      const img = await fetchRAWGImage(name);
      if (img) gameImages[name] = img;
    }
    if (Object.keys(gameImages).length > 0) {
      body = injectGameImages(body, gameImages);
      log("INFO", `${Object.keys(gameImages).length} imagens RAWG injetadas`);
    } else {
      log("WARN", "Nenhuma imagem RAWG encontrada");
    }
  } else {
    log("WARN", "Nenhum nome de jogo detectado no artigo");
  }

  const coverImage = await getBestCoverImage(mlProducts, body);
  if (!coverImage) {
    const trendingKw = topic.trending_keywords?.[0] || topic.ml_query?.split(" ").slice(0, 2).join(" ") || "";
    if (trendingKw) {
      const fallbackImg = await fetchRAWGImage(trendingKw);
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
