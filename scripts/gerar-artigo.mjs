import "dotenv/config";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import Parser from "rss-parser";
import { searchGoogleShopping } from "./google_shopping.mjs";
import { buscarProdutosLoteRemoto } from "./monitor_api.mjs";
import { gerarCapaStability } from "./stability-cover.mjs";
import { gerarCapaOpenAI, downloadImage, searchTavilyImage } from "./openai-cover.mjs";
import { cleanProductTitle, detectArticleCategory, detectBrand, detectModel, productMatchesCategory, PRODUCT_CATEGORIES, CATEGORY_BRANDS, KNOWN_BRANDS } from "./product_naming.mjs";
import { rankProducts, filterEligible, medianPrice, MIN_CRITERIA } from "./product_ranking.mjs";
import { upgradeImageUrl, imageDimensions, isImageUsable, searchSerperImage } from "./product_images.mjs";
import { SESSION_HEADERS, extractMLProductData } from "./ml_affiliate.mjs";
import { dedupeProducts } from "./product_dedupe.mjs";
import { buildEditorialShortlist } from "./editorial_shortlist.mjs";
import { buildGamesCandidateList } from "./games_candidates.mjs";
import { ANO_ATUAL, normalizarAnos, normalizarAnosPreposicional } from "./tempo.mjs";
import { pesquisarFundo } from "./pesquisar-fundo.mjs";
import {
  revisarPesquisa, revisarSourcing, revisarRedacao, revisarSeo, revisarDesign, revisarFinal, revisarPublicacao,
  emitirParecer, statusGeraLLM, salvarRevisoes, salvarOcorrencias,
} from "./revisar-etapas.mjs";

const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogGamer/1.0)" },
});

const ARTIGOS_DIR = path.resolve("src/content/artigos");
const STATE_FILE = path.resolve("state.json");
const PROD_IMAGES_DIR = path.resolve("public/images/produtos");
// TAREFA 4.3: ultimo recurso de imagem — nunca deixa o item sem foto. O caminho
// usa /images (site servido na raiz, com dominio proprio); o arquivo vive em
// public/images/produtos/_placeholder.webp.
const PLACEHOLDER_IMAGE = "/images/produtos/_placeholder.webp";

// Ultima rede de seguranca de capa: reutiliza capas genericas ja publicadas
// quando a cadeia inteira falha (IA contextual -> getBestCoverImage -> RAWG).
// Melhor uma capa generica do que um artigo publicado sem imagem principal.
const DEFAULT_COVER_BY_PRODUCT_CATEGORY = {
  cadeira: "/images/capas/melhores-cadeiras-gamer-de-2026.png",
  headset: "/images/capas/melhores-fones-de-ouvido-gamer-custo-beneficio-2026.png",
  monitor: "/images/capas/monitor-gamer-2026-top-5-para-alta-performance-em-jogos.png",
  mouse: "/images/capas/3-melhores-mouses-gamer-com-tecnologia-de-rastreamento-otico-em-2026.png",
  teclado: "/images/capas/5-melhores-teclados-gamer-mecanicos-de-2025-para-desempenho.png",
  placa_video: "/images/capas/aumento-em-placas-de-video-da-amd-guia-de-precos-em-2026.png",
  console: "/images/capas/playstation-julho-2026-guia-de-jogos-ps-plus-e-acessorios.png",
  tv: "/images/capas/monitor-gamer-2026-top-5-para-alta-performance-em-jogos.png",
};
const DEFAULT_COVER_GENERIC = "/images/capas/gta-6-e-jogos-de-2026-performance-e-o-que-esperar-no-ps5.png";

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { last_success: null, last_error: null, last_error_date: null, consecutive_failures: 0, total_articles: 0, last_category: null, rotation_pos: 0 };
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

// Rodizio de categorias: noticia alterna com guia/lista/review. A noticia
// aparece em posicoes pares (0, 2, 4) — o objetivo e que a maioria dos dias
// publica noticia (que nunca aborta no sourcing) e os demais giram entre
// guia/lista/review. O avancio usa ROTATION_POS (posicao inteira no ciclo),
// porque "noticia" se repete e indexOf nao distingue qual ocorrencia e a atual.
const CATEGORY_ROTATION = ["noticia", "guia", "noticia", "lista", "noticia", "review"];

// Migracao: state.json antigo nao tem rotation_pos. Deriva a posicao do nome
// da ultima categoria (indexOf retorna a 1a ocorrencia — ambiguo para "noticia",
// aceitavel como bootstrap; o ciclo se auto-corrige em 6 dias).
function rotationPosFromLastCategory(lastCategory) {
  const idx = CATEGORY_ROTATION.indexOf(lastCategory || "");
  return idx >= 0 ? idx : -1;
}

function nextCategory(state) {
  const pos = typeof state.rotation_pos === "number"
    ? state.rotation_pos
    : rotationPosFromLastCategory(state.last_category || "");
  const nextPos = pos < 0 ? 0 : (pos + 1) % CATEGORY_ROTATION.length;
  return CATEGORY_ROTATION[nextPos];
}

// Funcao (nao const) para o ano vir sempre de ANO_ATUAL, nunca hardcoded.
function topicSeeds() {
  return [
    { category: "noticia", hint: "lancamento de game, evento de games, anuncio de console", ml_query: `lancamento jogo ps5 xbox ${ANO_ATUAL}` },
    { category: "review", hint: `review de jogo popular de ${ANO_ATUAL}, performance nos consoles, o que esperar do jogo`, ml_query: `jogo popular ps5 xbox switch ${ANO_ATUAL}` },
    { category: "guia", hint: "melhores headsets gamers, teclado mecanico, mouse gamer, monitor, cadeira", ml_query: "headset gamer teclado mecanico mouse gamer monitor" },
    { category: "lista", hint: "melhores jogos para PC, jogos gratis, jogos multiplayer, jogos estilo", ml_query: `jogo pc mais vendido ${ANO_ATUAL}` },
  ];
}

// Temas proibidos: apostas, cassino, caça-níqueis e afins. Nunca podem virar artigo.
// A lista completa vale para topicos curtos (titulo, keyword, headline), onde
// "aposta/apostar" indica tema de jogo de dinheiro. Em texto livre (description,
// corpo) o termo aparece figurativamente demais ("a aposta mais segura", "nao
// aposte em marcas baratas"), entao so bloqueamos termos inequivocos de jogo.
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

// Termos inequivocos de jogo de dinheiro para aplicar em prosa gerada por IA
// (description e corpo), evitando falso positivo com "aposta" figurativo.
const FORBIDDEN_PROSE_PATTERNS = [
  /\bca[çc]a[- ]?n[ií]queis?\b/,
  /\bn[ií]queis?\b/,
  /\bcassinos?\b/,
  /\bcasinos?\b/,
  /\broletas?\b/,
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

function hasForbiddenProseTerm(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const lower = String(text).toLowerCase();
    if (FORBIDDEN_PROSE_PATTERNS.some((re) => re.test(lower))) return true;
  }
  return false;
}

const RSS_FEEDS = [
  { name: "MeuPlayStation", url: "https://meups.com.br/feed/" },
  { name: "GameVicio", url: "https://www.gamevicio.com/feed/" },
  { name: "IGN Brasil", url: "https://br.ign.com/feed.xml" },
  { name: "TecMundo Games", url: "https://rss.tecmundo.com.br/games" },
  { name: "Adrenaline", url: "https://www.adrenaline.com.br/feed/" },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
  { name: "Gematsu", url: "https://www.gematsu.com/feed" },
  { name: "Push Square", url: "https://www.pushsquare.com/feeds/news" },
  { name: "Eurogamer PT", url: "https://www.eurogamer.pt/feed" },
  { name: "GameSpot", url: "https://www.gamespot.com/feeds/game-news/" },
  { name: "VG247", url: "https://www.vg247.com/feed" },
];

const REDDIT_SUBS = [
  { name: "r/gaming", url: "https://old.reddit.com/r/gaming/hot.json?limit=15" },
  { name: "r/gamesEcultura", url: "https://old.reddit.com/r/gamesEcultura/hot.json?limit=10" },
  { name: "r/pcgaming", url: "https://old.reddit.com/r/pcgaming/hot.json?limit=15" },
  { name: "r/PS5", url: "https://old.reddit.com/r/PS5/hot.json?limit=10" },
  { name: "r/XboxSeriesX", url: "https://old.reddit.com/r/XboxSeriesX/hot.json?limit=10" },
  { name: "r/GameDealsBR", url: "https://old.reddit.com/r/GameDealsBR/hot.json?limit=10" },
  { name: "r/Steam", url: "https://old.reddit.com/r/Steam/hot.json?limit=10" },
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
  "nintendo", "indie", "esports", "e-sports", "mobile", "marvel", "x-men",
  "mcu", "remake", "remaster", "crossplay", "multiplataforma",
  "cross-platform", "battle pass",
];

const CONSOLE_KEYWORDS = [
  "playstation", "playstation 5", "xbox", "xbox series", "nintendo switch",
  "switch 2", "steam deck", "pc gamer", "ps5", "ps4", "steam",
  "game pass", "ps plus", "playstation plus", "cloud gaming",
];

const HARDWARE_KEYWORDS = [
  "monitor", "headset", "teclado", "mouse", "cadeira", "placa de video",
  "processador", "ssd", "memoria", "rtx", "nvidia", "geforce", "radeon",
  "amd", "intel",   "fonte de alimentação", "water cooler", "gabinete",
  "periféricos", "perifericos", "mousepad", "mouse pad", "webcam",
  "microfone", "cooler", "ventoinha", "notebook", "gpu", "cpu",
  "placa mãe", "placa mae", "placa-mae", "acessório", "acessorio",
  "smart tv", "smartv", "televisão", "televisao", "tv",
  "volante", "volantes", "volante gamer", "volante de corrida",
  "racing wheel", "direct drive", "simulador de corrida", "pedaleira",
];

const EVENT_KEYWORDS = ["e3", "game awards", "gamescom", "brasil game show", "bgs", "lançamento", "lancamento", "colaboração", "colaboracao", "collab", "crossover", "parceria", "atualização", "atualizacao", "queda de preço", "queda de preco", "recorde de vendas", "trailer", "gameplay", "beta", "demo", "dlc", "expansão", "expansao", "anúncio", "anuncio", "skin", "temporada", "season"];

const KEYWORD_CATEGORY_MAP = {};

function initKeywordMap() {
  for (const kw of HARDWARE_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "guia";
  for (const kw of EVENT_KEYWORDS) KEYWORD_CATEGORY_MAP[kw] = "noticia";
}

initKeywordMap();

// Classifica um texto como "games" (jogos/consoles/software) ou "hardware" (periféricos/PC)
// Retorna tambem "promo" (termos genericos de promocao), "mixed" (ambos) ou "unknown".
// Console/plataforma (PS5, Xbox, PC) NAO e assunto de games quando o texto tem
// hardware: "volante gamer para PS5" e um artigo de hardware cujo console e so
// plataforma. So um titulo/evento de jogo real misturado com hardware e "mixed".
function classifyDomain(text) {
  // Ignora a secao de Fontes, que e obrigatoria em todo artigo e pode conter termos ambiguos
  const cleaned = String(text || "").replace(/##?\s*Fontes[\s\S]*$/im, "");
  const lower = cleaned.toLowerCase();
  const hasGameSubject = GAME_KEYWORDS.some((k) => lower.includes(k)) ||
                        EVENT_KEYWORDS.some((k) => lower.includes(k) && k !== "lancamento" && k !== "lançamento");
  const hasConsole = CONSOLE_KEYWORDS.some((k) => lower.includes(k));
  const hasHardware = HARDWARE_KEYWORDS.some((k) => lower.includes(k));

  if (hasHardware) {
    if (hasGameSubject) return "mixed";
    return "hardware";
  }
  if (hasGameSubject || hasConsole) return "games";
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

// Contagem de mencoes por dominio — detecta FOCO misto real. Artigo de hardware
// cita jogos como contexto ("ideal para Valorant") sem ser misto; o foco so e
// dividido quando os DOIS lados tem peso equivalente no corpo.
// Console/plataforma (PS5, Xbox, PC) conta como "games" apenas quando o texto
// NAO tem hardware: num artigo de volante, "PS5" e plataforma, nao assunto.
function dominiosNoTexto(text) {
  const lower = String(text || "").replace(/##?\s*Fontes[\s\S]*$/im, "").toLowerCase();
  let games = 0;
  let hardware = 0;
  let consoles = 0;
  for (const k of GAME_KEYWORDS) if (k) games += lower.split(k).length - 1;
  for (const k of CONSOLE_KEYWORDS) if (k) consoles += lower.split(k).length - 1;
  for (const k of EVENT_KEYWORDS) if (k && k !== "lancamento" && k !== "lançamento") games += lower.split(k).length - 1;
  for (const k of HARDWARE_KEYWORDS) if (k) hardware += lower.split(k).length - 1;
  if (hardware === 0) games += consoles;
  return { games, hardware };
}

function temFocoMisto(text) {
  const { games, hardware } = dominiosNoTexto(text);
  if (games === 0 || hardware === 0) return false;
  const min = Math.min(games, hardware);
  const max = Math.max(games, hardware);
  return min >= 2 && max <= min * 2;
}

// Filtra palavras-chave mantendo apenas as do mesmo dominio da palavra principal.
function filterSameDomain(keywords, targetDomain) {
  if (!targetDomain || targetDomain === "unknown" || targetDomain === "promo") return keywords;
  return keywords.filter((k) => {
    const d = classifyDomain(k);
    return d === targetDomain || d === "promo" || d === "unknown";
  });
}

// Vira query de busca de produto de verdade: tira a frase editorial do topico
// ("melhores periféricos gamer sustentáveis de 2024") e fica so com o
// vocabulario de produto que existe no catalogo da Frente 4 ("perifericos
// gamer"). A busca da Frente 4 exige casar pelo menos metade dos termos do
// titulo — palavra editorial ("sustentaveis", "melhores", ano antigo) nunca
// aparece em titulo de produto, entao query literal = zero resultados.
function sanitizeProductQuery(query, domain) {
  const norm = normalizarAnos(String(query || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const kws = domain === "hardware" ? HARDWARE_KEYWORDS : [...GAME_KEYWORDS, ...CONSOLE_KEYWORDS];
  const hits = [];
  for (const k of kws) {
    const esc = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (new RegExp(`(^|[^a-z0-9])${esc}(?![a-z0-9])`).test(norm)) hits.push(esc);
  }
  hits.sort((a, b) => b.length - a.length);
  const base = [...new Set(hits)].slice(0, 4);

  if (domain === "hardware") {
    const palavraProduto = base.filter((h) => h !== "gamer");
    if (palavraProduto.length === 0) return "";
    return `${palavraProduto.slice(0, 2).join(" ")} gamer`.trim();
  }
  const words = new Set(norm.split(/\s+/).filter(Boolean));
  if (words.has("jogo") || words.has("jogos")) base.push("jogo");
  return [...new Set(base)].slice(0, 4).join(" ");
}

// Normaliza anos no corpo do artigo SEM tocar em URLs: links internos
// (/blog/...-2024-.../) e imagens externas com ano no path continuam intactos.
// So o texto corrido e corrigido — "em 2024" vira "em 2026" na prosa, o link
// continua apontando pro mesmo artigo.
function normalizarAnosBody(body) {
  if (typeof body !== "string" || !body) return body;
  const urls = [];
  const tmp = body.replace(/https?:\/\/[^\s"')<>]+|\/blog\/[^\s)"']+/g, (m) => {
    urls.push(m);
    return `\u0000${urls.length - 1}\u0000`;
  });
  const normalizado = normalizarAnosPreposicional(tmp);
  return normalizado.replace(/\u0000(\d+)\u0000/g, (_, i) => urls[Number(i)] || "");
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

// Tavily News (Brasil) — terceiro sinal de tendencia, somado ao RSS/Reddit.
// (Google Trends foi descartado: o endpoint publico do Google morreu (404) e o
// Serper nao tem endpoint de trends.)
async function fetchTavilyTrends() {
  if (!TAVILY_API_KEY) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: "videogames games",
        topic: "news",
        time_range: "day",
        max_results: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { log("WARN", `Tavily News: HTTP ${res.status}`); return []; }
    const data = await res.json();
    const out = (data.results || []).map((r) => String(r.title || "").trim()).filter(Boolean);
    log("INFO", `Tavily News (BR): ${out.length} noticias`);
    return out.slice(0, 20);
  } catch (e) {
    log("WARN", `Tavily News falhou: ${e.message}`);
    return [];
  }
}

// Janela para a "familia" de tema poder ser republicada (refresh mensal de listas).
// Configuravel via FAMILY_REFRESH_DAYS para permitir tuning sem mexer no codigo.
const REFRESH_WINDOW_DAYS = Number(process.env.FAMILY_REFRESH_DAYS) || 28;

// "Familias" de um texto: TODOS os perifericos/jogos/consoles que ele toca.
// Serve para anti-repeticao por familia — nao basta repetir a palavra exata —
// com excecao de refresh mensal (a mesma familia volta depois de
// REFRESH_WINDOW_DAYS dias). Registrar todas as familias evita que um artigo
// misto (ex.: "GTA 6 e PS5") esconda uma delas (o "gta" sumia por causa do "ps5").
function familyOf(text) {
  const lower = String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fams = new Set();
  for (const kw of HARDWARE_KEYWORDS) if (lower.includes(kw)) fams.add(`hw:${kw}`);
  for (const kw of CONSOLE_KEYWORDS) if (lower.includes(kw)) fams.add(`console:${kw}`);
  for (const kw of GAME_KEYWORDS) if (lower.includes(kw)) fams.add(`game:${kw}`);
  return [...fams];
}

// Data da publicacao mais recente por familia, lendo os artigos ja publicados.
// `excludeSlug` ignora um arquivo (o proprio artigo em regeneracao — ele nao
// pode "repetir" a propria familia).
function buildFamilyDates(excludeSlug) {
  const dates = {};
  if (!fs.existsSync(ARTIGOS_DIR)) return dates;
  const excl = excludeSlug ? `${excludeSlug}.md` : null;
  for (const f of fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"))) {
    if (excl && f === excl) continue;
    const c = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
    const fm = (c.split("---")[1] || "");
    const mDate = fm.match(/pubDate:\s*["']?([^"'\s]+)/);
    const fams = familyOf(fm);
    if (!mDate || fams.length === 0) continue;
    const d = new Date(mDate[1]);
    if (isNaN(d.getTime())) continue;
    for (const fam of fams) {
      if (!dates[fam] || d > dates[fam]) dates[fam] = d;
    }
  }
  return dates;
}

// true se alguma familia do texto foi coberta nos ultimos
// REFRESH_WINDOW_DAYS dias (mesma logica da descoberta, para o hook de
// pesquisa receber um sinal real em vez de um "passa sempre").
function isFamiliaRepetida(hint, familyDates = {}) {
  const fams = familyOf(hint);
  for (const fam of fams) {
    if (!familyDates[fam]) continue;
    const ageDays = (Date.now() - familyDates[fam].getTime()) / (24 * 3600 * 1000);
    if (ageDays < REFRESH_WINDOW_DAYS) return true;
  }
  return false;
}

// Cobertura por dominio (games vs hardware) para favorecer temas sub-representados.
function getDomainCoverage() {
  const counts = { games: 0, hardware: 0 };
  if (!fs.existsSync(ARTIGOS_DIR)) return counts;
  for (const f of fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"))) {
    const c = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
    const d = classifyDomain(c.split("---")[1] || "");
    if (d === "games" || d === "mixed") counts.games += 1;
    else if (d === "hardware") counts.hardware += 1;
  }
  return counts;
}

function isTopicDuplicate(keyword, existingTopics, recentKeywords = [], familyDates = {}) {
  const kw = keyword.toLowerCase();

  // Anti-repeticao por familia com janela de refresh mensal: basta que UMA das
  // familias do keyword esteja coberta recentemente para bloquear.
  const fams = familyOf(keyword);
  let covered = false;
  let blocked = false;
  for (const fam of fams) {
    if (!familyDates[fam]) continue;
    covered = true;
    const ageDays = (Date.now() - familyDates[fam].getTime()) / (24 * 3600 * 1000);
    if (ageDays < REFRESH_WINDOW_DAYS) { blocked = true; break; }
  }
  if (blocked) return true;
  if (covered) return false; // refresh mensal liberado (mesma familia, janela vencida)

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
    hint = `melhores ${kw}s gamer em ${ANO_ATUAL} — topicos em alta: ${ctx}`;
    ml_query = `${kw} gamer ${top3.filter(k => k !== kw).slice(0, 1).join(" ")} ${ANO_ATUAL}`;
  } else if (EVENT_KEYWORDS.some((e) => kw.includes(e) || e.includes(kw))) {
    category = "noticia";
    hint = `${kw}: anuncios, novidades e expectativas — topicos em alta: ${ctx}`;
    ml_query = `${top2names} jogo ps5 pc`;
  } else {
    category = "noticia";
    hint = `novidades sobre ${kw} no mundo gamer — topicos em alta: ${ctx}`;
    ml_query = `${top2names} gamer ${ANO_ATUAL}`;
  }

  // Guard: tema hibrido (games + hardware) nunca chega a redacao — bloqueado aqui
  // na descoberta, incluindo a keyword em si ("console vs placa de video").
  if (isMixedDomain(kw) || isMixedDomain(hint) || isMixedDomain(ml_query)) {
    log("WARN", `buildTopicFromKeyword gerou tema misto para "${kw}": ${hint}`);
    return null;
  }

  return { category, hint, ml_query, trending_score: topKeywords[0]?.[1] || 0, trending_keywords: top3 };
}

async function analyzeTrendsWithAI(headlines, trending, existingTopics, recentKeywords, familyDates = {}, coverage = {}) {
  const topHeadlines = headlines.slice(0, 15).map((h, i) => `${i + 1}. ${h}`).join("\n");
  const topTrending = trending.slice(0, 6).map(([k, v]) => `- "${k}" (${v}x mencoes)`).join("\n");
  const covered = [...new Set([...recentKeywords, ...existingTopics.map(t => t.slice(0, 60))])].slice(0, 15);
  const coveredList = covered.length > 0 ? covered.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(nenhum)";
  const cobertura = `- Dominio GAMES/JOGOS/CONSOLES: ${coverage.games || 0} artigos no blog\n- Dominio PERIFERICOS/HARDWARE: ${coverage.hardware || 0} artigos no blog`;

  const systemPrompt = `Você é um editor de blog de games do Brasil. Analisa trending topics e decide qual assunto NOVO e INÉDITO escrever sobre.

REGRAS:
- O artigo NÃO pode ser sobre o mesmo jogo/assunto dos artigos já escritos (mesmo que seja um ângulo diferente)
- Priorize assuntos que NÃO estão na lista de "Já cobertos"
- FOCO UNICO: o artigo deve tratar APENAS de um dos dois domínios — JOGOS/SOFTWARE/CONSOLES ou PERIFERICOS/HARDWARE GAMER. Nunca misture os dois domínios no mesmo artigo.
  - Se escolher um jogo/console/evento: o hint, o ml_query e o conteudo devem ser sobre games (ex: "jogo ps5 xbox pc", "lancamentos de games", "ofertas de jogos").
  - Se escolher hardware/periférico: o hint, o ml_query e o conteudo devem ser sobre perifericos gamer (ex: "mouse gamer", "headset gamer", "monitor gamer ${ANO_ATUAL}").
  - NUNCA escreva algo como "games e perifericos" no mesmo tema.
- PROIBIDO escolher temas de apostas, cassino, slots, caça-níqueis, roleta, jogos de azar ou qualquer conteúdo de jogo de dinheiro real. O blog não cobre esse tipo de assunto.
- EQUILIBRIO ENTRE DOMINIOS: se um dos dois dominios tem muito mais artigos no blog que o outro, prefira um tema do dominio MENOS coberto.
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

COBERTURA ATUAL DO BLOG:
${cobertura}

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

  // Rejeita familia ja coberta recentemente (anti-repeticao com refresh mensal)
  const famsAI = familyOf(parsed.topic);
  let famBloqueada = null;
  for (const fam of famsAI) {
    if (familyDates[fam]) {
      const ageDays = (Date.now() - familyDates[fam].getTime()) / (24 * 3600 * 1000);
      if (ageDays < REFRESH_WINDOW_DAYS) { famBloqueada = fam; break; }
    }
  }
  if (famBloqueada) {
    log("WARN", `IA escolheu familia ja coberta recentemente: ${famBloqueada}`);
    return null;
  }

  // Mantem palavras-chave trending apenas do mesmo dominio escolhido
  const trendingKws = [parsed.topic, ...trending.slice(0, 4).map(([k]) => k)];
  const sameDomainKws = filterSameDomain(trendingKws, domain).slice(0, 3);

  return {
    category: parsed.category,
    hint: parsed.hint,
    ml_query: parsed.ml_query || `${parsed.topic} gamer ${ANO_ATUAL}`,
    trending_score: trending[0]?.[1] || 1,
    trending_keywords: sameDomainKws.length > 0 ? sameDomainKws : [parsed.topic],
  };
}

async function discoverTrendingTopic(existingTopics = [], recentKeywords = [], familyDates = {}, coverage = {}) {
  log("INFO", "Buscando topicos trending (RSS + Reddit + Tavily News)...");

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
        // V16: timeout como option nao existe no fetch do Node (era sinal morto)
        // e o UA "BlogGamer/1.0" e bloqueado pelo Reddit (403 em todos os subs).
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(15000),
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

  const trends = await fetchTavilyTrends();
  for (const t of trends) headlines.push(t);
  log("INFO", `Tavily News: ${trends.length} noticias`);

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

  // Portao de tema por IA: roda quando QUALQUER LLM esta disponivel — o
  // fetchLLM tenta Gemini 1º (V5), entao chavear so em GROQ pulava a escolha
  // por IA em ambientes so-GEMINI.
  if (GROQ_API_KEY || GEMINI_API_KEY) {
    try {
      const aiResult = await analyzeTrendsWithAI(filteredHeadlines, trending, existingTopics, recentKeywords, familyDates, coverage);
      if (aiResult) {
        log("INFO", `IA escolheu topico novo: [${aiResult.category}] ${aiResult.hint}`);
        return aiResult;
      }
    } catch (e) {
      log("WARN", `Analise IA falhou, usando fallback por keyword: ${e.message}`);
    }
  }

  for (const [kw, score] of trending) {
    if (isTopicDuplicate(kw, existingTopics, recentKeywords, familyDates)) {
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
// Pool de candidatos antes do ranking/filtro de elegibilidade. Antes o gerador
// parava de coletar assim que tinha MAX_PRODUCTS e so entao ranqueava — na
// pratica "os 5 primeiros que a busca devolveu" viravam "os 5 melhores". Agora
// coleta ate CANDIDATE_POOL, filtra por elegibilidade (preco/avaliacoes/marca)
// e ranqueia, so truncando pra MAX_PRODUCTS no final.
const CANDIDATE_POOL = 20;
// TAREFA 5.3: quantidade minima de produtos da categoria certa para o artigo
// "Top N" valer a pena. Abaixo disso o gerador tenta mais buscas e, se ainda
// faltar, aborta em vez de publicar um artigo cheio de produto errado.
const MIN_PRODUCTS = Number(process.env.MIN_PRODUCTS) || 3;
// remote = usa a Frente 4 (produtos com comissao) e completa com Google
// Shopping. legacy = so Google Shopping. Default remote: a Frente 4 e o fluxo
// primario; sem ela o ramo remote falha limpo e cai no Shopping.
const AFFILIATE_MODE = process.env.AFFILIATE_MODE || "remote";

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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Match tolerante de keyword no titulo: cada token da keyword precisa aparecer
// como prefixo de palavra (cobre plural real: "headsets" casa com "headset",
// "mouses" com "mouse"), e a primeira ocorrencia deve ficar nos 40% iniciais.
// Retorna { ok, idx } com o indice de caractere normalizado da ocorrencia.
function keywordTokensMatch(title, primaryKeyword) {
  const tokens = normalizeForMatch(primaryKeyword).split(" ").filter(Boolean);
  if (tokens.length === 0) return { ok: true, idx: -1 };
  const words = normalizeForMatch(title).split(" ").filter(Boolean);
  if (words.length === 0) return { ok: false, idx: -1 };
  let firstIdx = -1;
  for (const token of tokens) {
    const found = words.findIndex((w) => w === token || w.startsWith(token));
    if (found === -1) return { ok: false, idx: -1 };
    const charIdx = words.slice(0, found).reduce((acc, w) => acc + w.length + 1, 0);
    if (firstIdx === -1 || charIdx < firstIdx) firstIdx = charIdx;
  }
  return { ok: true, idx: firstIdx };
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

// Palavras de versao generica que o RAWG nao usa no nome oficial e que poluem
// a busca ("Remake", "Edition", "Deluxe"...). Removidas uma a uma na queda.
const GENERIC_GAME_SUFFIX = new Set([
  "remake", "remaster", "remastered", "remasters", "reloaded", "edition",
  "ultimate", "deluxe", "definitive", "anniversary", "complete", "enhanced",
  "premium", "collector", "standard", "digital", "hd", "collection",
  "game of the year", "goty",
]);

// Variantes de busca para um nome de jogo, da mais especifica para a mais
// generica. O titulo da secao costuma ter subtitulo de marketing
// ("— Nostalgia em Alta Definicao") que o RAWG nao conhece; em vez de
// desistir na primeira busca, cai progressivamente:
//   nome completo -> sem subtitulo -> sem sufixo de versao -> partes apos ":"
//   -> ultimas palavras removidas -> sem artigo inicial.
function progressiveGameQueries(gameName) {
  const out = [];
  const add = (s) => {
    let t = String(s || "").replace(/\s+/g, " ").trim();
    t = t.replace(/^[\s:;.,\-]+|[\s:;.,\-]+$/g, "");
    if (t.length >= 3 && !out.includes(t)) out.push(t);
  };

  const base = String(gameName || "").replace(/\s+/g, " ").trim();
  if (!base) return out;
  add(base);

  // Subtitulo marketing separado por travesao/traco/barra com espacos
  // (" — ", " - "). Traco interno sem espaco ("E-Day") NAO separa.
  const core = base.split(/\s+[|—–-]\s+/)[0].trim();
  if (core && core !== base) add(core);

  let semSufixo = core
    .split(" ")
    .filter((w) => !GENERIC_GAME_SUFFIX.has(w.toLowerCase()))
    .join(" ");
  if (semSufixo && semSufixo !== core) add(semSufixo);

  const colon = base.split(":");
  if (colon.length > 1) {
    add(colon[0]);
    add(colon.slice(1).join(":").trim());
  }

  let cur = semSufixo || core;
  for (let i = 0; i < 3; i++) {
    const parts = cur.split(" ");
    if (parts.length <= 1) break;
    parts.pop();
    cur = parts.join(" ");
    if (cur.length >= 3) add(cur);
  }

  const semArtigo = base.replace(/^the\s+/i, "");
  if (semArtigo && semArtigo !== base) add(semArtigo);

  return out;
}

async function rawgSearchOnce(clean, originalName) {
  try {
    const r = await fetch(
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(clean)}&page_size=5&page=1`,
      { signal: AbortSignal.timeout(10000) }
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
      log("WARN", `RAWG descartado "${clean.slice(0, 40)}": melhor match "${best?.name || "-"}" (score ${bestScore.toFixed(2)} < ${RAWG_MATCH_THRESHOLD})`);
      return null;
    }

    return {
      name: best.name,
      hqUrl: best.background_image.replace("/media/", "/media/crop/600/400/") + "?auto=format&fit=crop&w=800&h=450",
      score: bestScore,
    };
  } catch (e) {
    log("WARN", `RAWG erro "${originalName.slice(0, 40)}": ${e.message}`);
    return null;
  }
}

async function fetchRAWGImage(gameName) {
  if (!RAWG_API_KEY) return null;
  if (GAME_IMAGE_CACHE[gameName] !== undefined) return GAME_IMAGE_CACHE[gameName];

  const queries = progressiveGameQueries(gameName);
  for (const q of queries) {
    const clean = q
      .replace(/[^a-zA-Z0-9 àáâãéêíóôõúç:]/g, " ")
      .replace(/\b(ps4|ps5|xbox|nintendo|switch|pc|midia fisica|edicao|edition|standard)\b/gi, "")
      .replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 3) continue;

    const found = await rawgSearchOnce(clean, gameName);
    if (found) {
      GAME_IMAGE_CACHE[gameName] = found.hqUrl;
      log("INFO", `RAWG imagem "${gameName.slice(0, 40)}" -> "${found.name}" (query "${clean.slice(0, 40)}", score ${found.score.toFixed(2)})`);
      return found.hqUrl;
    }
  }

  GAME_IMAGE_CACHE[gameName] = null;
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

// A IA as vezes marca a imagem numa posicao errada. A imagem de uma secao
// DEVE ficar DENTRO da propria secao: na linha imediatamente apos o titulo
// ##/### (abaixo do titulo, acima do texto). Aqui todo marcador e reposicionado
// deterministicamente para logo apos o titulo que menciona o topico; se nenhum
// titulo ou paragrafo cita, o marcador e mantido (Tavily vai tentar achar imagem).
function repositionImageMarkers(body) {
  const blocks = body.split(/\n{2,}/);
  const isMarker = (b) => /^\[IMG:\s*[^\]\n]+\]$/.test(b.trim());
  const markerName = (b) => b.trim().replace(/^\[IMG:\s*|\s*\]$/g, "");
  const isHeading = (b) => /^#{1,6}\s/.test(b.trim());
  // Casamento tolerante: substring de um lado ou ao menos 1 token significativo
  // em comum. "Cyberpunk 2026 Phantom Liberty" casa com "## Cyberpunk 2026 — ...".
  const sigToks = (s) => normalizeForMatch(s).split(" ").filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const mentions = (block, name) => {
    const a = normalizeForMatch(block);
    const b = normalizeForMatch(name);
    if (a.includes(b) || b.includes(a)) return true;
    const A = new Set(sigToks(block));
    return sigToks(name).some((t) => A.has(t));
  };

  const kept = [];
  const pending = [];

  for (const block of blocks) {
    if (!isMarker(block)) { kept.push(block); continue; }
    pending.push({ name: markerName(block), block });
  }

  for (const { name, block } of pending) {
    const headingTarget = kept.findIndex((b) => isHeading(b) && mentions(b, name));
    if (headingTarget !== -1) {
      kept.splice(headingTarget + 1, 0, block);
      log("INFO", `Marcador [IMG:${name}] movido para depois do titulo que menciona o topico`);
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

// Headings que encerram a lista de itens (nao sao itens em si).
const LISTA_STOP_HEADING = /^(?:comparativ|tabela|veredito|qual\s|faq|perguntas|quer\s+mais|fontes|continue\s+explorando|conclus|considera[çc][õo]es\s+fin)/i;
// Heading-pai de lista ja presente no corpo ("## Os 5 Melhores ... em 2026").
const LISTA_PARENT_HEADING = /^(?:os\s+\d+\s+melhores|os\s+melhores|melhores)\b/i;

// Frase da lista a partir do topico/titulo: "jogos para PC" em
// "melhores jogos para PC, jogos gratis..." -> "Os 5 Melhores Jogos para PC em 2026".
function buildGamesListHeading(count, topic, title) {
  const src = String(title && String(title).includes(":") ? title : topic?.hint || title || "");
  let phrase = src
    .split(",")[0]
    .replace(/[–—-].*$/g, " ")
    .replace(/:.*$/g, " ")
    .replace(/\b(?:os\s+)?\d+\s+melhores?\b/gi, " ")
    .replace(/\bmelhores?\b/gi, " ")
    .replace(/\b(?:20\d{2})\b/g, " ")
    .replace(/\b(?:em|de|para|ate|até)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  phrase = phrase
    .split(" ")
    .filter(Boolean)
    .map((w) => (/^(de|da|do|das|dos|em|para|com|e|a|o|as|os)$/i.test(w) ? w.toLowerCase() : (w.toUpperCase() === "PC" ? "PC" : w.charAt(0).toUpperCase() + w.slice(1))))
    .join(" ");
  if (!phrase) phrase = "Jogos para PC";
  return normalizarAnos(`Os ${count} Melhores ${phrase} em ${ANO_ATUAL}`);
}

// Garante a hierarquia de lista no fluxo sem produtos (games): um heading-pai
// "## Os N Melhores ... em {ano}" com os itens rebaixados para "###". Sem isso
// os jogos viram topicos soltos no indice (TOC trata ## como topico e ### como
// subtopico) — e a secao de Itens deve ser a PRIMEIRA ## do artigo.
function ensureListStructure(body, { categoria, domain, productCount, ano, topic, title }) {
  if (productCount > 0) return body;
  if (!["lista", "review"].includes(categoria)) return body;
  if (domain !== "games") return body;
  if (!/^##\s+/m.test(body)) return body;

  const lines = body.split("\n");
  const headIdx = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+)$/);
    if (m) headIdx.push({ i, text: m[1].trim().replace(/^<a[^>]*>\s*<\/a>\s*/i, "") });
  }
  if (headIdx.length === 0) return body;

  // Sequencia inicial de ## = os itens (ate o primeiro heading "de fim").
  let end = 0;
  while (end < headIdx.length && !LISTA_STOP_HEADING.test(headIdx[end].text)) end++;
  if (end < 2) return body;

  const run = headIdx.slice(0, end);
  let parentText = null;
  let itemIdxs;
  if (LISTA_PARENT_HEADING.test(run[0].text)) {
    parentText = run[0].text;
    itemIdxs = run.slice(1).map((h) => h.i);
  } else {
    itemIdxs = run.map((h) => h.i);
  }
  if (itemIdxs.length < 2) return body;

  // Itens viram subtopicos (###) sob o heading-pai.
  for (const i of itemIdxs) lines[i] = lines[i].replace(/^##\s+/, "### ");

  if (!parentText) {
    const heading = buildGamesListHeading(itemIdxs.length, topic, title);
    lines.splice(itemIdxs[0], 0, `## ${heading}`, "");
    log("INFO", `Estrutura de lista: heading-pai "## ${heading}" + ${itemIdxs.length} itens como ###`);
  } else {
    log("INFO", `Estrutura de lista: heading-pai existente + ${itemIdxs.length} itens como ###`);
  }

  return lines.join("\n");
}

// Titulos dos itens de uma lista de games no corpo bruto da LLM (heading ## da
// sequencia inicial, ignorando o heading-pai "Os N Melhores" e os de fim).
function extractListItemTitles(body) {
  const heads = [];
  for (const line of String(body || "").split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) heads.push(m[1].trim().replace(/^<a[^>]*>\s*<\/a>\s*/i, "").replace(/\s*[—–-].*$/g, "").trim());
  }
  let start = 0;
  if (heads.length > 0 && LISTA_PARENT_HEADING.test(heads[0])) start = 1;
  const itens = [];
  for (let i = start; i < heads.length; i++) {
    if (LISTA_STOP_HEADING.test(heads[i])) break;
    itens.push(heads[i]);
  }
  return itens.filter(Boolean);
}

// Nomes dos itens listados como subsecoes ### de um artigo de hardware SEM
// produtos (ex.: "### Moza R12 Direct Drive V1 — A Forca Bruta para PC"). Usados
// como referencia para a capa IA focar nos ITENS (e nao num cenario generico).
// So coleta as ### dentro da secao principal da lista: para ao cruzar uma secao
// de fim (Comparativo/Veredito/FAQ), que nao sao itens.
function extractSubsectionItemNames(body) {
  const out = [];
  let inListSection = false;
  for (const line of String(body || "").split("\n")) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const text = h2[1].trim().replace(/^<a[^>]*>\s*<\/a>\s*/i, "").trim();
      if (LISTA_STOP_HEADING.test(text)) break;
      if (inListSection) break;
      inListSection = true;
      continue;
    }
    if (!inListSection) continue;
    const m = line.match(/^###\s+(.+)$/);
    if (!m) continue;
    const text = m[1].trim().replace(/^<a[^>]*>\s*<\/a>\s*/i, "").replace(/\s*[—–-].*$/g, "").trim();
    if (!text || LISTA_STOP_HEADING.test(text)) continue;
    out.push(text);
  }
  return [...new Set(out)].slice(0, 6);
}

// Similaridade de titulo de jogo: igualdade, substring ou >= 60% dos tokens
// significativos em comum ("Resident Evil 4 Remake" ~ "Resident Evil 4 Remake").
function tituloSemelhante(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tok = (s) => s.split(" ").filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const A = tok(na);
  const B = tok(nb);
  if (A.length === 0 || B.length === 0) return false;
  let hit = 0;
  for (const t of B) if (A.includes(t)) hit++;
  return hit / Math.min(A.length, B.length) >= 0.6;
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
// Enriquecimento de nome de produto: quando o titulo vindo do catalogo e
// generico (sem marca/modelo), tenta descobrir o nome completo do produto.
// So roda em regeneracao (opts.enrichNames) para nao custar chamadas extras no
// cron — e nunca quebra o pipeline se a busca falhar. Duas fontes, em ordem:
//   1. A pagina do proprio produto (permalink) quando o site serve og:title.
//   2. Busca web (Tavily) pelo titulo generico — pega o titulo da pagina do
//      produto. Quando o produto tem id MLB, exige que o resultado seja do
//      mesmo anuncio (id na URL) para nao trocar o nome por outro teclado.
const BRAND_RE = new RegExp(`(^|[^a-z])(${Object.keys(KNOWN_BRANDS).map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^a-z]|$)`, "i");
const MODEL_RE = /\b[A-Z]{1,4}[- ]?\d{2,5}[A-Z-]{0,4}\b/;
const STORE_SUFFIX_RE = /\s*[|\-]\s*(mercadolivre|mercado libre|mercado livre|shopee|amazon(\.com\.br)?|magazine luiza|magalu|kabum|pichau|terabyte).*$/i;
const FAKE_TITLE_RE = /^(mercado libre|mercado livre|captcha|just a moment|verifica[cç][aã]o de seguran[cç][aã]|acesso negado|access denied|attention required|error|404|p[aá]gina n[aã]o encontrada|hmm)/i;

async function enrichWithProductPage(p) {
  const url = String(p.permalink || p.affiliate_link || "");
  if (!/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: SESSION_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const data = extractMLProductData(html, url);
    const t = String(data.title || "").trim();
    if (t.length < 10 || FAKE_TITLE_RE.test(t)) return null;
    return data;
  } catch {
    return null;
  }
}

async function enrichWithTavilyDetails(p) {
  if (!TAVILY_API_KEY) return null;
  const raw = String(p.raw_title || p.title || "").trim();
  if (!raw || raw.length < 5) return null;
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: `"${raw}"`,
      search_depth: "advanced",
      max_results: 6,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const pId = String(p.id || "");
  for (const r of data.results || []) {
    const url = String(r.url || "");
    if (/MLB\d{8,}/.test(pId) && !url.includes(pId)) continue;
    const t = String(r.title || "").trim().replace(STORE_SUFFIX_RE, "").trim();
    if (t.length < 10 || FAKE_TITLE_RE.test(t)) continue;
    if (t.toLowerCase() === raw.toLowerCase()) continue;
    const desc = String(r.content || "").replace(/\s+/g, " ").trim().slice(0, 500);
    return { title: t, description: desc, brand: detectBrand(`${t} ${desc}`) };
  }
  return null;
}

// Captura marca, descricao e specs do produto: pagina oficial primeiro, busca
// web (Tavily) depois. Nunca quebra o pipeline — se nada vier, o produto segue
// sem detalhe (mesma tolerancia do enriquecimento de titulo).
async function enrichProductDetails(p) {
  const page = await enrichWithProductPage(p);
  if (page) return page;
  return enrichWithTavilyDetails(p);
}

async function enrichProducts(mlProducts) {
  let enriched = 0;
  for (const p of mlProducts) {
    if (!p || typeof p !== "object") continue;
    const d = await enrichProductDetails(p);
    if (!d) continue;
    const raw = String(p.raw_title || p.title || "").trim();
    const t = String(d.title || "").trim();
    if (
      t.length >= 10
      && !FAKE_TITLE_RE.test(t)
      && !BRAND_RE.test(raw)
      && !MODEL_RE.test(raw)
      && t.toLowerCase() !== raw.toLowerCase()
    ) {
      p.raw_title = t;
      p.title = t;
      log("INFO", `Titulo enriquecido: "${raw}" -> "${t.slice(0, 60)}"`);
    }
    if (d.brand) p.brand = String(d.brand).trim();
    if (d.description) p.description = String(d.description).trim();
    if (Array.isArray(d.specs) && d.specs.length) p.specs = d.specs;
    if (p.brand || p.description || (p.specs && p.specs.length)) {
      enriched++;
      log("INFO", `Detalhe enriquecido: "${(p.title || "").slice(0, 45)}" (marca: ${p.brand || "-"}, desc: ${p.description ? "sim" : "nao"}, specs: ${(p.specs || []).length})`);
    }
  }
  return enriched;
}

function sanitizeProducts(products, topic, ctx = {}) {
  const metrics = ctx.metrics;
  // Metrica registrada ANTES do guard: uma rodada que chega com lista vazia
  // tambem e uma rodada real (entra no funil com 0) — sem isso `rodadas` podia
  // ficar vazio mesmo havendo tentativas de retry.
  if (metrics) {
    metrics.ultimoRound = {
      bruto: Array.isArray(products) ? products.length : 0,
      semPreco: 0,
      aposCategoria: 0,
      descartadosCategoria: 0,
      aposDedup: 0,
      descartadosDedup: 0,
      aposPiso: 0,
      descartadosPiso: 0,
      descartadosTruncados: 0,
    };
  }
  if (!Array.isArray(products) || products.length === 0) return [];
  const seen = new Set();
  const candidates = [];
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const url = String(p.permalink || "");
    const title = String(p.title || "");
    if (ML_NON_PRODUCT_URL.test(url)) continue;
    if (ML_ARTICLE_TITLE.test(title)) continue;
    // Produto da Shopee nao tem id no formato MLB — sem isto ele seria descartado.
    const id = p.id
      || (url.match(/MLB\d{8,}/) || [])[0]
      || (url.match(/shopee\.com\.br\/product\/(\d+)\/(\d+)/) || []).slice(1, 3).join("_")
      || "";
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
  if (metrics) metrics.ultimoRound.semPreco = candidates.length - out.length;

  // TAREFA 5.3: filtra produtos que NAO pertencem a categoria do artigo.
  const articleCat = detectArticleCategory(topic);
  if (articleCat) {
    const before = out.length;
    const matched = out.filter((p) => productMatchesCategory(p.raw_title || p.title, articleCat));
    if (matched.length >= MIN_PRODUCTS) {
      out = matched;
      if (before > out.length) {
        log("INFO", `${before - out.length} produto(s) fora da categoria "${articleCat}" descartados`);
      }
    } else {
      log("WARN", `Filtro de categoria "${articleCat}" deixaria so ${matched.length} produto(s) — mantendo os que casam e sinalizando falta`);
      out = matched;
    }
    if (metrics) {
      metrics.ultimoRound.aposCategoria = out.length;
      metrics.ultimoRound.descartadosCategoria = before - out.length;
    }
  } else if (metrics) {
    metrics.ultimoRound.aposCategoria = out.length;
  }

  const tokens = mlTopicTokens(topic);

  // TAREFA 1: normaliza o nome de cada produto e preserva o bruto em raw_title.
  // Se raw_title ja existe (ex.: re-chamada no laço de retry da TAREFA 5.4),
  // nao sobrescreve com o titulo ja limpo.
  for (const p of out) {
    if (p && typeof p === "object") {
      const raw = String(p.raw_title || p.title || "").trim();
      if (raw) {
        p.raw_title = raw;
        p.title = cleanProductTitle(raw) || raw;
      }
    }
  }

  // Dedup SEMANTICO: id/URL identicos ja foram removidos acima, mas o mesmo
  // produto anunciado duas vezes (lojas diferentes, ou o mesmo anuncio com uma
  // spec extra no titulo — ex. "Razer DeathAdder Essential" e "Razer 6400dpi
  // DeathAdder Essential") passava disso. Aqui a identidade e por
  // marca+modelo/imagem/URL canonica, nao so string exata. Quem mescla ganha
  // as ofertas/imagem/avaliacao de quem perdeu.
  {
    const before = out.length;
    const { items, removidos } = dedupeProducts(out);
    out = items;
    for (const r of removidos) {
      log("INFO", `Duplicado descartado: "${r.descartado}" == "${r.mantido}" (${r.motivo})`);
    }
    if (before > out.length) {
      log("INFO", `${before - out.length} produto(s) duplicado(s) semanticamente removido(s)`);
    }
    if (metrics) {
      metrics.ultimoRound.aposDedup = out.length;
      metrics.ultimoRound.descartadosDedup = before - out.length;
    }
  }

  // TAREFA 6.2/6.3: ordena por score objetivo (rankProducts) em vez de so
  // sobreposicao de tokens — essa vira apenas criterio de desempate.
  if (out.length > 1) {
    out = rankProducts(out, {
      rankingContext: ctx.rankingContext || "",
      tieBreak: (a, b) => mlProductRelevanceScore(b, tokens) - mlProductRelevanceScore(a, tokens),
    });
  }

  // Piso de elegibilidade objetivo: preco plausivel perto da mediana da lista,
  // prova de que gente comprou e avaliou, identidade reconhecivel. Sem isso o
  // "Top 5" aceitava qualquer coisa que a busca devolvesse.
  if (out.length > 0) {
    const median = medianPrice(out);
    const { items, descartados, fallback } = filterEligible(out, { median }, MIN_PRODUCTS);
    if (descartados.length > 0) {
      for (const d of descartados) {
        log(fallback ? "WARN" : "INFO", `Fora do piso de qualidade: "${(d.produto.raw_title || d.produto.title || "").slice(0, 50)}" — ${d.motivos.join("; ")}`);
      }
    }
    out = items;
    if (metrics) {
      metrics.ultimoRound.aposPiso = out.length;
      metrics.ultimoRound.descartadosPiso = descartados.length;
    }
  }

  // Trunca para MAX_PRODUCTS so agora, depois de ranking+elegibilidade — antes
  // o corte acontecia na coleta ("os 5 primeiros que a busca achou"), agora
  // acontece depois de comparar um pool maior de candidatos.
  const antesTrunc = out.length;
  if (out.length > MAX_PRODUCTS) out = out.slice(0, MAX_PRODUCTS);
  if (metrics) {
    // aposPiso passa a refletir a entrega FINAL (pos-truncamento), fiel ao
    // campo `final` do relatorio — o funil mostra a perda real do pipeline.
    metrics.ultimoRound.aposPiso = out.length;
    metrics.ultimoRound.descartadosTruncados = antesTrunc - out.length;
  }

  return out;
}

// TAREFA 5.4: queries especificas de retry quando sobrarem menos de
// MIN_PRODUCTS itens da categoria do artigo apos o filtro. Marcas primeiro:
// trazem produto com nome reconhecivel (o portao de qualidade reprova nome
// generico); as genericas da categoria entram depois.
function buildCategoryRetryQueries(articleCat) {
  if (!articleCat || !PRODUCT_CATEGORIES[articleCat]) return [];
  const label = PRODUCT_CATEGORIES[articleCat].label;
  const ano = ANO_ATUAL;
  const marcas = CATEGORY_BRANDS[articleCat] || [];
  return [
    ...marcas.slice(0, 3).map((marca) => `${label} ${marca}`),
    `${label} gamer ${ano}`,
    `melhor ${label} gamer custo beneficio`,
  ];
}

// Fallback de tema (TAREFA 5.4/ideia 1): quando a lista/review abortaria por
// falta de produtos da categoria certa, antes de morrer o sourcing tenta a
// "proxima keyword da mesma familia/categoria" — cada variacao de keyword da
// categoria vira query de retry, aumentando a chance de achar produto com nome
// reconhecivel. O process.exit(1) so acontece se TODAS falharem.
const CATEGORY_FALLBACK_KEYWORDS = {
  teclado: ["teclado mecanico gamer", "teclado gamer sem fio", "teclado gamer compacto", "teclado gamer rgb"],
  mouse: ["mouse gamer sem fio", "mouse gamer rgb", "mouse gamer leve", "mouse gamer ergonomico"],
  mousepad: ["mousepad gamer grande", "mousepad gamer speed", "mousepad gamer XL"],
  headset: ["headset gamer sem fio", "headset gamer com microfone", "headset gamer 7.1"],
  monitor: ["monitor gamer 144hz", "monitor gamer 240hz", "monitor curvo gamer", "monitor gamer 2k"],
  cadeira: ["cadeira gamer ergonomica", "cadeira gamer reclinavel", "cadeira gamer premium", "cadeira gamer com apoio lombar"],
  placa_video: ["placa de video rtx", "placa de video rx", "placa de video barata gamer"],
  processador: ["processador ryzen", "processador intel core i5", "processador gamer"],
  console: ["console playstation 5", "console xbox series x", "console nintendo switch 2"],
  controle: ["controle sem fio gamer", "controle ps5", "controle xbox wireless"],
  notebook: ["notebook gamer", "notebook gamer barato"],
  webcam: ["webcam gamer", "webcam full hd 1080p"],
  microfone: ["microfone gamer", "microfone usb gamer"],
  gabinete: ["gabinete gamer rgb", "gabinete gamer mid tower"],
  cooler: ["water cooler gamer", "cooler para processador gamer"],
  fonte: ["fonte 650w 80 plus", "fonte gamer 80 plus bronze"],
  ssd: ["ssd nvme gamer", "ssd 1tb gamer"],
  memoria: ["memoria ram 16gb ddr4", "memoria ram ddr5 gamer"],
  tv: ["smart tv 4k", "tv 4k gamer", "smart tv 50 polegadas", "tv oled gamer", "smart tv qled"],
};

function buildCategoryFallbackKeywords(articleCat) {
  if (!articleCat || !PRODUCT_CATEGORIES[articleCat]) return [];
  return CATEGORY_FALLBACK_KEYWORDS[articleCat] || [];
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
  let url = p.local_thumbnail || (p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "");
  if (!url) return "";
  // Imagem local so entra no markup se o arquivo existir de verdade: o portao
  // (validar-artigo.mjs) reprova referencia a /images/... inexistente, e o
  // artigo nao pode ser salvo apontando para um arquivo que nao existe.
  if (url.startsWith("/images/") || url.startsWith("images/")) {
    if (!fs.existsSync(path.resolve("public", url.replace(/^\//, "")))) {
      url = p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "";
    }
  }
  if (!url) return "";
  const title = p.title || "Produto no Mercado Livre";
  const size =
    p.image_width && p.image_height
      ? ` width="${p.image_width}" height="${p.image_height}"`
      : "";
  return `<img src="${url}" alt="${title}"${size} class="article-game-img" loading="lazy" decoding="async">`;
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

const OFFER_META = {
  mercadolivre: { label: "VER NO MERCADO LIVRE", cls: "product-btn product-btn--ml" },
  shopee:       { label: "VER NA SHOPEE",        cls: "product-btn product-btn--shopee" },
};

export function buildOfferButtonsHtml(p) {
  const lojas = Object.keys(p?.offers || {}).filter(
    (k) => OFFER_META[k] && (p.offers[k].affiliate_link || p.offers[k].permalink)
  );
  if (lojas.length === 0) return "";

  const botoes = lojas.map((k) => {
    const o = p.offers[k];
    const m = OFFER_META[k];
    const href = o.affiliate_link || o.permalink;
    return `<a href="${href}" class="${m.cls}" target="_blank" rel="nofollow sponsored">${m.label}</a>`;
  });

  if (botoes.length === 1) return botoes[0];
  return `<div class="product-btns">\n${botoes.join("\n")}\n</div>`;
}

function produtoTemAfiliado(p) {
  if (String(p?.affiliate_link || "").trim()) return true;
  return Object.values(p?.offers || {}).some((o) => String(o?.affiliate_link || "").trim());
}

// Etapa explicita e incondicional: roda SEMPRE, fora de qualquer `if
// (SERPER_API_KEY...)`. Antes o link de afiliado so era preenchido dentro de
// um bloco condicional (e so com o permalink cru, sem tag nenhuma) — se a
// Frente 4 ja tivesse entregue MAX_PRODUCTS, esse bloco nunca rodava e o
// produto ficava sem NENHUM affiliate_link, com o botao sumindo em silencio.
//
// REGRA PERMANENTE (docs/TROUBLESHOOTING.md): o blog NUNCA gera link de
// afiliado do ML por conta propria. A sessao/cookie do ML e compartilhada com
// o monitor-telegram e nao suporta um segundo consumidor — uma chamada feita
// a partir do processo do blog ja derrubou a sessao em producao (06/08/2026),
// tirando as Frentes 1/2 do ar. Produtos do ML SO entram com link de afiliado
// vindo pronto da Frente 4 (monitor_api.mjs).
//
// POLITICA ATUAL (ago/2026): produto bom SEM link de afiliado NAO e mais
// descartado — e publicado com o permalink cru e a flag `affiliate_pending:
// true`, e registrado em src/data/afiliados_pendentes.json para o autor
// corrigir o link na aba "Pendencias" do painel /admin/. A geracao de link de
// afiliado continua NUNCA sendo feita aqui.
async function resolverAfiliados(produtos) {
  const out = [];
  for (const p of produtos) {
    if (produtoTemAfiliado(p)) {
      p.affiliate_pending = false;
      out.push(p);
    } else {
      p.affiliate_pending = true;
      out.push(p);
      log("WARN", `Sem link de afiliado para "${(p.title || "").slice(0, 60)}" — publicado com permalink pendente (corrigir na aba Pendencias do /admin/)`);
    }
  }
  const pendentes = out.filter((p) => p.affiliate_pending).length;
  if (pendentes > 0) {
    log("WARN", `${pendentes} produto(s) com link de afiliado pendente (publicados com permalink; corrija no /admin/)`);
  }
  return out;
}

// Gate de abandono do sourcing de produtos. Retorna true apenas quando ha
// motivo para abortar: menos de MIN_PRODUCTS E categoria de produto detectada.
// Noticias nunca abortam (o artigo informativo segue com 0..n produtos) e tema
// sem categoria de produto detectavel tambem segue adiante.
function shouldAbortProductSourcing({ count, articleCat, isNoticia = false }) {
  if (isNoticia) return false;
  if (count >= MIN_PRODUCTS) return false;
  if (!articleCat) return false;
  return true;
}

const AFILIADOS_PENDENTES_PATH = path.resolve("src/data/afiliados_pendentes.json");

// Registra produtos publicados sem link de afiliado (perm ranhamento do autor).
// A aba "Pendencias" do /admin/ le este arquivo e, ao salvar o link, marca o
// item como resolvido e atualiza o <a href> do botao no markdown do artigo.
function salvarPendentesAfiliados(slug, produtos) {
  try {
    let registry = { updatedAt: new Date().toISOString(), items: [] };
    if (fs.existsSync(AFILIADOS_PENDENTES_PATH)) {
      try {
        const existente = JSON.parse(fs.readFileSync(AFILIADOS_PENDENTES_PATH, "utf-8"));
        if (Array.isArray(existente?.items)) registry.items = existente.items;
      } catch {
        log("WARN", "afiliados_pendentes.json corrompido — reiniciando registro");
      }
    }
    // Remove entradas antigas deste slug (o artigo foi regerado) e re-adiciona
    // os pendentes atuais. Entradas de outros artigos e as resolvidas ficam.
    const outros = registry.items.filter((e) => e.slug !== slug);
    const pendentes = (produtos || [])
      .filter((p) => p.affiliate_pending && p.permalink)
      .map((p) => ({
        id: `${slug}::${p.permalink}`,
        slug,
        produto: p.title,
        botao: productButtonLabel(p),
        permalink: p.permalink,
        imagem: p.local_thumbnail || p.thumbnail || "",
        artigo: `/blog/${slug}/`,
        status: "pendente",
      }));
    registry.items = [...outros, ...pendentes];
    registry.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(AFILIADOS_PENDENTES_PATH), { recursive: true });
    fs.writeFileSync(AFILIADOS_PENDENTES_PATH, JSON.stringify(registry, null, 2), "utf-8");
    if (pendentes.length > 0) {
      log("WARN", `${pendentes.length} produto(s) registrado(s) em src/data/afiliados_pendentes.json (aba Pendencias do /admin/)`);
    }
  } catch (e) {
    log("WARN", `Registro de afiliados pendentes falhou: ${e.message}`);
  }
}

function buildProductButtonHtml(p) {
  // Produto da Frente 4: um botao por loja.
  const duplo = buildOfferButtonsHtml(p);
  if (duplo) return duplo;

  // Caminho antigo (Google Shopping) — NAO ALTERAR, os testes dependem dele.
  const link = p.affiliate_link || p.permalink || "";
  if (!link) {
    log("ERROR", `buildProductButtonHtml: "${(p.title || "").slice(0, 60)}" sem affiliate_link nem permalink — botao omitido`);
    return "";
  }
  const label = productButtonLabel(p);
  // Produto pendente de afiliado sai com classe propria (product-btn--pending):
  // a aba Pendencias do /admin/ usa essa marca para localizar o botao a corrigir.
  const pendingClass = p.affiliate_pending ? " product-btn--pending" : "";
  return `<a href="${link}" class="product-btn${pendingClass}" target="_blank" rel="nofollow">${label}</a>`;
}

// Ultimo recurso de imagem do item: gera uma foto de catalogo via OpenAI.
async function gerarImagemItemIA(title, slug) {
  if (!OPENAI_API_KEY || process.env.SKIP_COVER || !title) return null;
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
// TAREFA 4 — cadeia de fallback robusta; para no primeiro sucesso que passe
// na validacao de dimensao real (isImageUsable, >= 500px):
//   1. thumbnail do Google Shopping com URL turbinada (upgradeImageUrl);
//   2. thumbnail original;
//   3. cada p.images[] (tambem com upgrade);
//   4. Google Images via Serper (raw_title, o titulo completo acha o produto);
//   5. busca web (Tavily);
//   6. geracao por IA (ultimo recurso pago);
//   7. placeholder local — o item NUNCA sai sem foto.
async function ensureProductImages(mlProducts) {
  if (!mlProducts || mlProducts.length === 0) return;
  if (!fs.existsSync(PROD_IMAGES_DIR)) fs.mkdirSync(PROD_IMAGES_DIR, { recursive: true });

  const stats = { cache: 0, url_upgrade: 0, url_original: 0, url_images: 0, serper: 0, tavily: 0, ia: 0, placeholder: 0 };

  for (const p of mlProducts) {
    const slug = slugify(p.title || p.raw_title || `produto-${mlProducts.indexOf(p) + 1}`);

    for (const ext of [".png", ".jpg", ".webp"]) {
      const cachedPath = path.join(PROD_IMAGES_DIR, `${slug}${ext}`);
      if (fs.existsSync(cachedPath)) {
        p.local_thumbnail = `/images/produtos/${slug}${ext}`;
        stats.cache++;
        break;
      }
    }
    if (p.local_thumbnail) continue;

    let buf = null;
    const stages = [
      { name: "url_upgrade", urls: [upgradeImageUrl(p.thumbnail)] },
      { name: "url_original", urls: [p.thumbnail] },
      { name: "url_images", urls: (p.images || []).map((u) => upgradeImageUrl(u)) },
    ];
    for (const stage of stages) {
      for (const url of stage.urls) {
        if (!url || !url.startsWith("http")) continue;
        try {
          const b = await downloadImage(url);
          if (b && isImageUsable(b)) {
            buf = b;
            stats[stage.name]++;
            break;
          }
        } catch {}
      }
      if (buf) break;
    }

    if (!buf) {
      buf = await searchSerperImage(p.raw_title || p.title);
      if (buf) stats.serper++;
    }
    if (!buf) {
      buf = await searchTavilyImage(p.raw_title || p.title);
      if (buf) stats.tavily++;
    }
    if (!buf) {
      buf = await gerarImagemItemIA(p.title, slug);
      if (buf) stats.ia++;
    }

    if (buf) {
      const ext = imageExtension(buf);
      fs.writeFileSync(path.join(PROD_IMAGES_DIR, `${slug}${ext}`), buf);
      p.local_thumbnail = `/images/produtos/${slug}${ext}`;
      const dim = imageDimensions(buf);
      if (dim) {
        p.image_width = dim.width;
        p.image_height = dim.height;
      }
      log("INFO", `Imagem do item salva: ${p.local_thumbnail} (${(buf.length / 1024).toFixed(1)} KB)`);
    } else {
      p.local_thumbnail = PLACEHOLDER_IMAGE;
      stats.placeholder++;
      log("WARN", `Nenhuma imagem valida para "${p.title?.slice(0, 40)}" — usando placeholder local`);
    }
  }

  const resumo = Object.entries(stats)
    .map(([k, v]) => `${k}=${v}`)
    .join(" | ");
  log("INFO", `Imagens dos itens (${mlProducts.length}): ${resumo}`);
}

// Injeta âncoras unicas nos headings ## e ### do artigo para o componente
// Neste artigo (TableOfContents) consumir — produtos (###) entram como
// sub-topicos do H2 da lista. NAO gera mais o bloco "## Indice" — o indice e
// responsabilidade do componente Astro.
function injectHeadingAnchors(body) {
  if (!body || typeof body !== "string") return body;

  const headings = [...body.matchAll(/^(#{2,3}) ([^\n]+)$/gm)];
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
  const tocItems = items.map((item) => {
    let anchor = item.baseAnchor;
    let suffix = 1;
    while (usedAnchors.has(anchor)) {
      anchor = `${item.baseAnchor}-${suffix}`;
      suffix++;
    }
    usedAnchors.add(anchor);
    return { title: item.title, anchor };
  });

  // Cria mapa título -> âncora final para inserir nos headings
  const anchorMap = new Map(tocItems.map((item) => [item.title, item.anchor]));

  // Insere âncoras nos headings originais
  const result = body.replace(/^(#{2,3}) ([^\n]+)$/gm, (match, hashes, title) => {
    const trimmedTitle = title.trim();
    if (excluded.test(trimmedTitle)) return match;
    const anchor = anchorMap.get(trimmedTitle);
    if (!anchor) return match;
    return `${hashes} <a id="${anchor}"></a>${trimmedTitle}`;
  });

  return result;
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
    const headingMatch = [...result.slice(0, markerIndex).matchAll(/^(#{2,3})\s+([^\n]+)$/gm)]
      .reverse()
      .find((m) => !excludedHeading.test(m[2].trim()));
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

// TAREFA 6.1: consenso editorial para o ranking. UMA chamada por artigo (Serper
// Search + Tavily), nao por produto. Devolve um texto unico onde as mencões de
// marca/modelo dos produtos candidatos serao contadas. Nunca lanca — sem chaves
// ou com falha, retorna "" e o sinal editorial vale 0.
let rankingContextCache = "";
let rankingContextLoaded = false;

async function fetchRankingContext(articleCat, topicHint) {
  if (rankingContextLoaded) return rankingContextCache;
  rankingContextLoaded = true;
  const ano = ANO_ATUAL;
  const label = (articleCat && PRODUCT_CATEGORIES[articleCat]?.label) || String(topicHint || "produtos gamer");
  const query = `melhores ${label} gamer ${ano} review`;
  const parts = [];

  if (SERPER_API_KEY) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": SERPER_API_KEY },
        body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 10 }),
      });
      if (res.ok) {
        const data = await res.json();
        const organic = Array.isArray(data.organic) ? data.organic : [];
        for (const o of organic) {
          if (o.title) parts.push(String(o.title));
          if (o.snippet) parts.push(String(o.snippet));
        }
        log("INFO", `Consenso editorial (Serper): ${organic.length} paginas de review`);
      } else {
        log("WARN", `Serper ranking: HTTP ${res.status}`);
      }
    } catch (e) {
      log("WARN", `Serper ranking falhou: ${e.message}`);
    }
  }

  if (TAVILY_API_KEY) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY, query,
          search_depth: "advanced", max_results: 5, include_answer: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of data.results || []) {
          if (r.title) parts.push(String(r.title));
          if (r.content) parts.push(String(r.content));
        }
        log("INFO", `Consenso editorial (Tavily): ${(data.results || []).length} paginas de review`);
      } else {
        log("WARN", `Tavily ranking: HTTP ${res.status}`);
      }
    } catch (e) {
      log("WARN", `Tavily ranking falhou: ${e.message}`);
    }
  }

  rankingContextCache = parts.join("\n").slice(0, 60000);
  return rankingContextCache;
}

const TAVILY_IMAGE_CACHE = {};

// URLs que quebram facilmente ou dependem de auth — nunca usadas no corpo.
const FRAGILE_IMAGE_URL = /(upload\.wikimedia\.org|instagram\.com|facebook\.com|fbsbx\.com|tiktok\.com|redd\.it|redditmedia\.com|data:image)/i;

function isFragileImageUrl(url) {
  return FRAGILE_IMAGE_URL.test(String(url || ""));
}

// Hosts mais estaveis para o corpo do artigo — priorizados no resultado do
// Tavily. Evita cair em CDN instavel (ex.: resizers de portal) quando ha uma
// opcao confiavel (RAWG, YouTube, fabricante oficial, Steam) na mesma resposta.
const STABLE_IMAGE_HOSTS = [
  "media.rawg.io",
  "i.ytimg.com",
  "nintendo.com",
  "shared.akamai.steamstatic.com",
  "store.steampowered.com",
];

function imageHostRank(url) {
  try {
    const host = new URL(url).hostname;
    const idx = STABLE_IMAGE_HOSTS.findIndex((h) => host === h || host.endsWith("." + h));
    return idx === -1 ? STABLE_IMAGE_HOSTS.length : idx;
  } catch {
    return STABLE_IMAGE_HOSTS.length;
  }
}

async function imageHeadOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function fetchTavilyImage(query) {
  if (!TAVILY_API_KEY) return null;
  const cacheKey = query.toLowerCase().trim();
  if (TAVILY_IMAGE_CACHE[cacheKey] !== undefined) return TAVILY_IMAGE_CACHE[cacheKey];

  // Mesma queda progressiva do RAWG: nome completo -> variantes curtas. Cada
  // variante tenta achar uma imagem estavel (sem wikimedia/redes sociais),
  // validando o HTTP antes de aceitar.
  for (const q of progressiveGameQueries(query).slice(0, 4)) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: q + " gaming",
          search_depth: "basic",
          max_results: 5,
          include_images: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const urls = (data.images || [])
        .map((it) => (typeof it === "string" ? it : it?.url))
        .filter((u) => typeof u === "string" && /^https?:/i.test(u) && !isFragileImageUrl(u))
        .sort((a, b) => imageHostRank(a) - imageHostRank(b));
      for (const url of urls) {
        if (await imageHeadOk(url)) {
          TAVILY_IMAGE_CACHE[cacheKey] = url;
          log("INFO", `Tavily imagem "${query.slice(0, 30)}" (variante "${q.slice(0, 30)}") -> ${url.slice(0, 60)}`);
          return url;
        }
      }
    } catch (e) {
      log("WARN", `Tavily image erro "${q.slice(0, 30)}": ${e.message}`);
    }
  }

  log("WARN", `Tavily: nenhuma imagem estavel para "${query.slice(0, 30)}"`);
  TAVILY_IMAGE_CACHE[cacheKey] = null;
  return null;
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

  const explicitMax = opts.maxTokens != null;
  if (!explicitMax && body.max_tokens < 1000) {
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

  const explicitMax = opts.maxTokens != null;
  if (!explicitMax && body.generationConfig.maxOutputTokens < 1000) {
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
  // Arquivo existente pode vir com CRLF (Windows/git). Sem normalizar, o valor
  // de pubDate fica com \r e o keepPubDate nao reconhece a data original — o
  // artigo "vira novo" no RSS/SEO a cada regeneracao.
  text = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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
// Regra das 900 palavras (12/08/2026, decisao do operador): noticia tem minimo
// de 900 palavras. Para a geracao cumprir a regra, a faixa-alvo de noticia/lista
// subiu de 700-900 para 900-1100 (ter minimo 900 com teto-alvo 900 era uma
// contradicao — a geracao nunca atingiria, como no run 12/08 que parou em 814).
// ABSOLUTE_MIN_WORDS continua sendo o piso de ultima tentativa.
const MIN_WORDS = { guia: 1000, review: 800, noticia: 900, lista: 800 };
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
    const { ok, idx } = keywordTokensMatch(t, primaryKeyword);
    if (!ok) problems.push(`title: nao contem a palavra-chave "${primaryKeyword}"`);
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

// Remove do corpo os precos de produto que aparecem em prosa (a regra e: preco
// fica so na tabela comparativa e nos cards). Protege a tabela "## Comparativo"
// e as secoes "### <produto>" para nao apagar o que ja esta no lugar certo.
// So deve ser chamado em artigos com produtos (tabela/cards presentes).
function stripPricesFromBody(body, productPrices = []) {
  const prices = (productPrices || []).filter((p) => Number.isFinite(Number(p))).map((p) => Number(p));
  if (prices.length === 0) return body;

  const ranges = [];
  const tableMatch = body.match(/^##\s+Comparativo[^\n]*$/m);
  if (tableMatch) {
    const start = tableMatch.index;
    const after = body.slice(tableMatch.index + tableMatch[0].length);
    const next = after.search(/\n##\s+/);
    ranges.push([start, next === -1 ? body.length : tableMatch.index + tableMatch[0].length + next]);
  }
  for (const m of body.matchAll(/^###\s+[^\n]+$/gm)) {
    const start = m.index;
    const after = body.slice(m.index + m[0].length);
    const next = after.search(/\n(?:##|###)\s+/);
    ranges.push([start, next === -1 ? body.length : m.index + m[0].length + next]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const stripProse = (chunk) =>
    chunk
      .replace(/R\$\s*([\d.,]+)/g, (full, raw) => {
        const val = Math.round(parseFloat(raw.replace(/\./g, "").replace(",", ".")) * 100) / 100;
        if (Number.isNaN(val)) return full;
        if (prices.some((p) => Math.abs(p - val) < 0.01)) return "";
        return full;
      })
      .replace(/[ \t]{2,}/g, " ");

  let cursor = 0;
  let out = "";
  for (const [s, e] of ranges) {
    if (s > cursor) out += stripProse(body.slice(cursor, s));
    out += body.slice(Math.max(cursor, s), e);
    cursor = Math.max(cursor, e);
  }
  if (cursor < body.length) out += stripProse(body.slice(cursor));
  return out;
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

  if (hasForbiddenTerm(fm.title, fm.category, (fm.tags || []).join(" ")) || hasForbiddenProseTerm(fm.description, body)) {
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
  if (temFocoMisto(body)) {
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

  // Lista plural ("Melhores"/"Os N Melhores" com N>=2) so faz sentido com pelo
  // menos 2 produtos. Um artigo de lista com 1 item (ex.: "Os 1 Melhores") e
  // inconsistente e nunca deve publicar. Conta os dois lugares onde a promessa
  // aparece: o titulo e o heading da lista no corpo.
  const prometeListaPlural = (() => {
    const t = String(fm?.title || "").toLowerCase();
    if (/\bmelhores\b/.test(t) || /\bos\s+\d+\s+melhores\b/.test(t)) return true;
    return /^##\s+<a[^>]*>\s*<\/a>\s*(?:os\s+\d+\s+melhores|melhores)\b/im.test(body)
      || /^##\s+(?:os\s+\d+\s+melhores|melhores)\b/im.test(body);
  })();
  if (prometeListaPlural && ctx.productCount > 0 && ctx.productCount < 2) {
    hard.push(`Titulo/heading promete lista plural de produtos, mas o artigo tem so ${ctx.productCount} item(ns) — lista "Melhores" exige no minimo 2 produtos`);
  } else if (prometeListaPlural && ctx.productCount === 0 && /melhores/i.test(String(fm?.title || ""))) {
    soft.push(`Titulo usa "Melhores" mas o artigo ficou sem produtos — confira se o titulo combina com o conteudo`);
  }

  // Grounding da lista de games (P3): com candidatos do Google disponiveis, os
  // itens DEVEM estar entre eles. Gate P2 — regenera nas primeiras tentativas e
  // so publica com ressalva se a LLM insistir em titulo fora da lista.
  if (ctx.gamesCandidates && ctx.gamesCandidates.length > 0 && ctx.productCount === 0) {
    const itens = extractListItemTitles(body);
    const fora = itens.filter((t) => !ctx.gamesCandidates.some((c) => tituloSemelhante(t, c.titulo)));
    if (fora.length > 0) {
      soft.push(`Itens fora dos titulos apontados pelo Google (escolha entre os CANDIDATOS OBRIGATORIOS): ${fora.join(" | ")}`);
    }
  }

  // Fluxo segmentado: cada produto DEVE virar um item "### Nome" e aparecer na
  // tabela comparativa. Se a montagem quebrou, o artigo nao pode publicar.
  if (ctx.segmented && ctx.productCount > 0) {
    const headings = [...body.matchAll(/^(?:##|###)\s+([^\n]+)$/gm)].map((m) => m[1].trim());
    const tableRows = body.split("\n").filter((l) => /^\|.*\|$/.test(l)).join("\n");
    const missingAsHeading = [];
    const missingInTable = [];
    for (const p of ctx.products || []) {
      if (!p?.title) continue;
      // injectHeadingAnchors adiciona <a id="..."></a> no inicio dos headings;
      // limpa antes de comparar com o titulo do produto.
      const okHeading = headings.some((h) => {
        const ch = h.replace(/<a\s[^>]*>[^<]*<\/a>\s*/i, "").trim();
        return ch === p.title || ch.startsWith(`${p.title} `) || ch.startsWith(`${p.title} - `);
      });
      if (!okHeading) missingAsHeading.push(p.title.slice(0, 60));
      if (!tableRows.includes(p.title)) missingInTable.push(p.title.slice(0, 60));
    }
    if (missingAsHeading.length > 0) hard.push(`Itens sem secao propria (montagem quebrou): ${missingAsHeading.join(" | ")}`);
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

  // Aviso de [IMG:] vale para artigos de jogo/noticia (imagens via marcador).
  // Artigos de produto usam fotos locais injetadas nos cards - nao exigem [IMG:].
  const temProdutos = (ctx.products?.length || 0) > 0 || Boolean(ctx.segmented);
  if (!temProdutos && extractImageMarkers(body).length === 0) {
    soft.push("Nenhum marcador [IMG:Nome do Jogo] usado - artigo ficara sem imagens no corpo");
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

// Lista de artigos para o bloco de links internos. `excludeSlug` remove o
// proprio artigo em regeneracao (nunca link para si mesmo).
function buildInternalLinksBlock(excludeSlug = "") {
  const articles = getRecentArticlesForPrompt(12);
  if (articles.length === 0) return "";
  const alvo = String(excludeSlug || "").replace(/\.md$/, "");
  const lines = articles
    .filter((a) => a.slug !== alvo)
    .map((a) => `- ${a.title} -> /blog/${a.slug}/`);
  if (lines.length === 0) return "";
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

  // Regioes de estrutura (tabela comparativa, links internos do rodape e
  // anchors de heading) nao sao claims editoriais: anos/notas/precos que
  // aparecem so nelas nao podem gerar aviso de suporte. Tabela e filtrada
  // por linha "|" (mesmo criterio de revisarRedacao); "Continue Explorando"
  // carrega apenas slugs internos com anos; anchors tem o ano da keyword.
  const regioesNaoClaim = body
    .split("\n")
    .filter((l) => !l.trim().startsWith("|"))
    .join("\n")
    .replace(/^##\s+Continue Explorando[\s\S]*$/im, "")
    .replace(/<a id="[^"]*"><\/a>/g, "");

  // Extrai anos (ex: 2026, 2027) e verifica se estão nas fontes. So fiscaliza o
  // "intervalo de claim": [ANO_ATUAL-3, ANO_ATUAL+1], exceto o proprio ano do
  // artigo. Anos mais velhos (ex.: 2021, data de lancamento de um jogo) sao
  // fatos historicos e nao desmentem o artigo.
  const years = [...new Set([...(regioesNaoClaim.match(/\b20[2-9]\d\b/g) || [])])];
  const missingYears = years.filter((y) => {
    const n = Number(y);
    if (n === ANO_ATUAL) return false;
    if (n < ANO_ATUAL - 3 || n > ANO_ATUAL + 1) return false;
    return !sourceTextLower.includes(y);
  });
  if (missingYears.length > 0) {
    warnings.push(`Anos mencionados sem suporte nas fontes: ${missingYears.join(", ")}`);
  }

  // Extrai notas de review (ex: 8/10, 9.5, Metacritic 85)
  const scores = [...new Set([
    ...(regioesNaoClaim.match(/\b\d{1,2}(?:[.,]\d+)?\s*\/\s*10\b/gi) || []),
    ...(regioesNaoClaim.match(/\bMetacritic\s*[:\-]?\s*\d{1,3}\b/gi) || []),
    ...(regioesNaoClaim.match(/\bnota\s*[:\-]?\s*\d{1,2}(?:[.,]\d+)?\b/gi) || []),
  ])];
  const missingScores = scores.filter((s) => !sourceTextLower.includes(s.toLowerCase()));
  if (missingScores.length > 0) {
    warnings.push(`Notas/reviews mencionadas sem suporte nas fontes: ${missingScores.join(", ")}`);
  }

  // Verifica se há preços em prosa (preços de produtos devem ficar nos cards
  // e na tabela comparativa — linhas "|" foram excluidas acima)
  const prosePrices = [...regioesNaoClaim.matchAll(/R\$\s*([\d.,]+)/g)].map((m) => m[0]);
  if (prosePrices.length > 0) {
    warnings.push(`Precos em prosa detectados (${prosePrices.length}x) — preco deve ficar apenas no card do produto`);
  }

  return warnings;
}

// TAREFA E — correcao automatica do gate. O gate nao so deleta/rollback:
// tenta corrigir deterministicamente os problemas P0/P1 corrigiveis, reaplica
// os passos deterministas (produtos, precos, marcadores, âncoras) e revalida.
// So cai no rollback se a correcao nao zerar as etapas reprovadas.

function removeEmptySections(body, listHeading) {
  const lines = body.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const h2 = lines[i].match(/^##\s+(.+)$/);
    if (!h2) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const title = h2[1].trim();
    if (listHeading && title === listHeading) {
      out.push(lines[i]);
      i++;
      continue;
    }
    let j = i + 1;
    let content = "";
    while (j < lines.length && !/^##\s+/.test(lines[j])) {
      content += lines[j] + "\n";
      j++;
    }
    if (!content.trim()) {
      i = j;
      continue;
    }
    out.push(lines[i]);
    for (let k = i + 1; k < j; k++) out.push(lines[k]);
    i = j;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function removeBase64Images(body) {
  return body.replace(/!\[[^\]]*\]\(data:image\/[a-z0-9.+-]+;base64[^)]*\)/g, "").replace(/\n{3,}/g, "\n\n");
}

const IMAGEM_FRAGIL_REVISAO = /lookaside\.(fbsbx|instagram)\.com|tiktok\.com\/api\/img/;

function removeFragileImages(body) {
  return body.replace(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g, (m, url) => (IMAGEM_FRAGIL_REVISAO.test(url) ? "" : m)).replace(/\n{3,}/g, "\n\n");
}

function removeAberturasProibidas(body) {
  return body
    .replace(/neste artigo vamos|hoje vamos falar|neste conte[úu]do/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^,\s*/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

function ajustarDescription(fm, body) {
  if ((fm.description || "").length >= 120) return fm;
  const limpo = String(body || "")
    .replace(/<a\s[^>]*>\s*<\/a>/g, "")
    .replace(/\[(?:IMG|PRODUTO):[^\]]*\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const base = (fm.description || "").trim();
  const nova = (base ? base + " " : "") + limpo;
  return { ...fm, description: nova.replace(/\s+/g, " ").slice(0, 160) };
}

function ajustarTags(fm, categoria, topicHint) {
  const tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
  if (tags.length >= 3) return fm;
  const extras = [];
  if (categoria) extras.push(categoria);
  const palavras = String(topicHint || "").toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !["para", "para os", "melhor"].includes(w));
  for (const w of palavras) {
    if (tags.length + extras.length >= 3) break;
    if (!extras.includes(w) && !tags.includes(w)) extras.push(w);
  }
  for (const e of extras) {
    if (tags.length >= 3) break;
    if (!tags.includes(e)) tags.push(e);
  }
  return { ...fm, tags };
}

function montarMarkdown({ fm, body, pubDate, cover, mlProducts }) {
  return `---
title: "${fm.title.replace(/"/g, '\\"')}"
description: "${fm.description.replace(/"/g, '\\"')}"
pubDate: ${pubDate}
tags: [${fm.tags.map((t) => `"${t.trim().replace(/"/g, '\\"')}"`).join(", ")}]
category: "${fm.category}"
affiliate: ${fm.affiliate || mlProducts.length > 0}
image: "${cover}"
---

${body}
`;
}

// Aplica correcoes deterministicas para os problemas P0/P1 do gate. Devolve
// { body, fm, mudancas }; mudancas vazio = nada corrigivel (vai direto ao rollback).
function corrigirPeloGate({ body, fm, gateReprovados, categoria, listHeading, topicHint }) {
  const problemas = gateReprovados.flatMap((r) => r.problemas.map((p) => ({ etapa: r.etapa, ...p })));
  const tem = (re) => problemas.some((p) => re.test(p.mensagem));

  let novoBody = body;
  let novoFm = { ...fm, tags: Array.isArray(fm.tags) ? [...fm.tags] : [] };
  const mudancas = [];

  if (tem(/## vazia/i)) {
    const antes = novoBody;
    novoBody = removeEmptySections(novoBody, listHeading);
    if (novoBody !== antes) mudancas.push("secoes-vazias-removidas");
  }
  if (tem(/data:/)) {
    novoBody = removeBase64Images(novoBody);
    mudancas.push("base64-removido");
  }
  if (tem(/Instagram|Facebook|TikTok/)) {
    novoBody = removeFragileImages(novoBody);
    mudancas.push("imagens-frageis-removidas");
  }
  if (tem(/abertura proibida|abertura/i)) {
    novoBody = removeAberturasProibidas(novoBody);
    mudancas.push("abertura-proibida-removida");
  }
  if (tem(/marcador/i)) {
    novoBody = novoBody.replace(/\[(?:IMG|PRODUTO):[^\]\n]*\]/g, "").replace(/\n{3,}/g, "\n\n");
    mudancas.push("marcadores-restantes-removidos");
  }
  const descAntes = novoFm.description;
  novoFm = ajustarDescription(novoFm, novoBody);
  if (novoFm.description !== descAntes) mudancas.push("description-ajustada");
  const tagsAntes = novoFm.tags.length;
  novoFm = ajustarTags(novoFm, categoria, topicHint);
  if (novoFm.tags.length !== tagsAntes) mudancas.push("tags-completadas");

  return { body: novoBody, fm: novoFm, mudancas: [...new Set(mudancas)] };
}

function validateInternalLinks(body) {
  const existingSlugs = getExistingSlugs();
  const linkRegex = /\[([^\]]+)\]\(\/blog\/([^)]+?)\/?\)/g;
  let match;
  let fixed = body;
  while ((match = linkRegex.exec(fixed)) !== null) {
    const slug = match[2];
    if (!existingSlugs.includes(slug)) {
      log("WARN", `Link interno invalido removido: /blog/${slug}/`);
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
  const seeds = topicSeeds();
  return seeds.find((s) => s.category === sorted[0].slug) || seeds[0];
}

async function main() {
  log("INFO", "=== INICIANDO GERACAO (Groq) ===");
  log("INFO", `GEMINI_API_KEY definida: ${!!GEMINI_API_KEY}`);
  log("INFO", `GROQ_API_KEY definida: ${!!GROQ_API_KEY}`);
  log("INFO", `TAVILY_API_KEY definida: ${!!TAVILY_API_KEY}`);
  log("INFO", `SERPER_API_KEY definida: ${!!SERPER_API_KEY}`);

  // V13: OPENAI_API_KEY tambem conta como LLM primario — antes OpenAI sozinho
  // nao rodava o pipeline (exigia GEMINI ou GROQ e so caia na OpenAI por fallback).
  if (!GEMINI_API_KEY && !GROQ_API_KEY && !OPENAI_API_KEY) {
    log("ERROR", "Nenhuma chave de IA configurada (GEMINI_API_KEY, GROQ_API_KEY ou OPENAI_API_KEY)");
    process.exit(1);
  }
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
  // FORCE_TOPIC=<keyword>|<categoria>: topico deterministico (teste/operacao),
  // ignora a descoberta de trending e a esteira de categoria.
  if (process.env.FORCE_TOPIC && process.env.FORCE_TOPIC.includes("|")) {
    const [kw, cat] = process.env.FORCE_TOPIC.split("|").map((s) => s.trim());
    if (kw && cat) {
      topic = {
        category: cat,
        hint: `Descubra os melhores ${kw}.`,
        ml_query: `${kw} ${ANO_ATUAL}`,
        trending_keywords: [kw],
      };
      trendingSource = "forcado";
      log("INFO", `FORCE_TOPIC: [${cat}] ${kw}`);
    }
  }
  const existingTopics = state.recent_topics || [];
  const recentKeywords = state.recent_keywords || [];
  // FORCE_GENERATE e a sobreposicao do operador: ignora a janela de 28d por
  // familia (mantem duplicidade exata). O cron diario segue estrito.
  const familyDates = process.env.FORCE_GENERATE ? {} : buildFamilyDates();
  const coverage = getDomainCoverage();
  log("INFO", `Cobertura: ${coverage.games} games / ${coverage.hardware} hardware | familias monitoradas: ${Object.keys(familyDates).length}`);

  if (!topic) {
    try {
      const trending = await discoverTrendingTopic(existingTopics, recentKeywords, familyDates, coverage);
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
  }

  // Temas de trending escolhidos pela IA mantêm sua categoria — a IA já
  // analisou o formato ideal do assunto. A esteira só força temas estáticos.
  // Sem isto, uma notícia quente (ex: Marvel's Wolverine) era forçada para
  // "review"/"lista" da rotação, abrindo busca de produtos de console e
  // abortando o artigo (10/08/2026). E um review escolhido pela IA era forçado
  // para "noticia", gerando ~800 palavras em um artigo que o gate exige 900
  // (29/08/2026).
  // FALLBACK DE TEMA (P2): em vez de uma única tentativa, o main() monta um
  // pool de candidatos — o tema principal, as alternativas do mesmo trending e
  // os seeds estáticos (o da categoria do dia primeiro, notícia por último como
  // rede de segurança, pois notícia nunca aborta por falta de produtos).
  const diaCategoria = nextCategory(state);
  const aplicarCategoriaDoDia = (cand, src) => {
    if (process.env.FORCE_TOPIC) return;
    if (src !== "estatico") return;
    if (cand.category === "noticia") return;
    cand.category = diaCategoria;
  };
  aplicarCategoriaDoDia(topic, trendingSource);

  const candidatos = [];
  const hintsVistos = new Set();
  const addCandidato = (cand, src) => {
    if (!cand || !cand.hint) return;
    const chave = cand.hint.toLowerCase().slice(0, 60);
    if (hintsVistos.has(chave)) return;
    hintsVistos.add(chave);
    candidatos.push({ topic: cand, src });
  };

  addCandidato(topic, trendingSource);

  if (!process.env.FORCE_TOPIC) {
    const kws = Array.isArray(topic.trending_keywords) ? topic.trending_keywords.slice(1) : [];
    const topKeywords = Array.isArray(topic.trending_keywords) ? topic.trending_keywords.map((k) => [k, 1]) : [];
    for (const kw of kws) {
      try {
        const alt = buildTopicFromKeyword(kw, topKeywords, existingTopics, recentKeywords);
        if (alt && alt.hint !== topic.hint) {
          aplicarCategoriaDoDia(alt, "trending");
          addCandidato(alt, "trending");
        }
      } catch (e) {
        log("WARN", `Alternativa de tema "${kw}" falhou: ${e.message}`);
      }
    }
    const seeds = topicSeeds();
    const seedDia = seeds.find((s) => s.category === diaCategoria);
    const seedNoticia = seeds.find((s) => s.category === "noticia");
    const seedOutros = seeds.filter((s) => s.category !== diaCategoria && s.category !== "noticia");
    for (const s of [seedDia, seedNoticia, ...seedOutros].filter(Boolean)) {
      addCandidato(s, "estatico");
    }
  }

  log("INFO", `Pool de temas (${candidatos.length} candidato(s)): ${candidatos.map((c) => `[${c.topic.category}] ${c.topic.hint.slice(0, 40)}`).join(" | ")}`);

  let publicado = false;
  for (const { topic: cand, src } of candidatos) {
    log("INFO", `=== Tentando tema [${cand.category}] ${cand.hint} (${src}) ===`);
    try {
      await generateArticle({ topic: cand, state, trendingSource: src, opts: {} });
      publicado = true;
      break;
    } catch (e) {
      log("ERROR", `Tema falhou: ${e.message}`);
    }
  }

  if (!publicado) {
    log("ERROR", "Todos os temas candidatos falharam — abortando.");
    process.exit(1);
  }
}

// Query de pesquisa limpa: remove o prefixo editorial ("melhores", "os N
// melhores") e corta na virgula — senao "melhores jogos para PC, jogos gratis..."
// vira "melhores melhores jogos para pc, jogos gratis... Brasil 2026".
function montarQueryPesquisa(topic, ano) {
  if (topic.category === "noticia") return `${topic.hint} Brasil ${ano}`;
  const limpo = String(topic.hint || "")
    .split(",")[0]
    .replace(/\b(?:os\s+)?\d+\s+melhores?\b/gi, " ")
    .replace(/\bmelhores?\b/gi, " ")
    .replace(/\b(?:20\d{2})\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${limpo || topic.hint} Brasil ${ano}`;
}

// Gera um artigo para um topico dado. Usado pelo cron (main) e pela
// regeneracao de artigos existentes (scripts/regenerar-artigos.mjs).
// opts:
//   overwriteSlug  - se informado, escreve nesse arquivo em vez de criar um
//                    slug novo; ignora a checagem de slug duplicado.
//   keepPubDate    - (default true) preserva a pubDate original do arquivo.
//   reuseImageMap  - Map<titulo antigo do produto, caminho local> de imagens
//                    a reutilizar quando o produto novo casar com um antigo.
async function generateArticle({ topic, state, trendingSource = "estatico", opts = {} }) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const keepPubDate = opts.keepPubDate !== false;
  // Regeneracao nao deve mexer no estado do cron (cooldown/ultimo artigo).
  const persistState = () => {
    if (opts.updateState !== false) {
      saveState(state);
      generateStatusFile(state);
    }
  };

  // Determina o dominio do tema para manter foco unico (games OU hardware)
  const topicDomain = classifyDomain(topic.hint);
  if (topicDomain === "mixed") {
    log("WARN", `Tema com dominio misto detectado: ${topic.hint}. Pulando geracao.`);
    state.last_error = "Tema misto (games + hardware) — pulando";
    state.last_error_date = today;
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
    persistState();
    process.exit(1);
  }
  const effectiveDomain = topicDomain === "hardware" ? "hardware" : "games";
  log("INFO", `Dominio do artigo: ${effectiveDomain}`);

  let researchContext = "";
  let researchSources = [];
  let verifiedFacts = [];
  let coberturaPesquisa = null;
  let subQueries = [];
  try {
    const query = montarQueryPesquisa(topic, ANO_ATUAL);
    const pesquisa = await pesquisarFundo({
      topic,
      query,
      categoria: topic.category,
      tavilyKey: TAVILY_API_KEY,
      fetchLLM,
    });
    researchContext = pesquisa?.researchContext || "";
    researchSources = pesquisa?.researchSources || [];
    verifiedFacts = pesquisa?.verifiedFacts || [];
    coberturaPesquisa = pesquisa?.cobertura || null;
    subQueries = pesquisa?.subQueries || [];
    log("INFO", `Pesquisa concluida: ${researchSources.length} fontes, ${verifiedFacts.length} fatos verificados (nivel ${pesquisa?.nivel || "basico"})`);
  } catch (err) {
    log("WARN", `Pesquisa: ${err.message}`);
  }

  const revPesquisa = revisarPesquisa({
    topic,
    researchSources,
    cobertura: coberturaPesquisa || {},
    topicDomain,
    // V4: sinal real (janela FAMILY_REFRESH_DAYS via pubDates). FORCE_GENERATE
    // e a sobreposicao do operador — a descoberta ja ignora a janela nesse modo
    // (buildFamilyDates() = {}), entao o gate tambem nao pode reprovar por ela.
    familiaRepetida: process.env.FORCE_GENERATE ? false : isFamiliaRepetida(topic.hint, buildFamilyDates(opts.overwriteSlug)),
    temaProibido: hasForbiddenTerm(topic.hint, topic.category),
    subQueries,
  });
  let revPesquisaParecer = null;
  if (statusGeraLLM(revPesquisa)) {
    revPesquisaParecer = await emitirParecer({
      etapa: "pesquisa",
      rel: revPesquisa,
      contexto: { topico: topic.hint, categoria: topic.category, fontes: researchSources.slice(0, 5).map((f) => f.url) },
      fetchLLM,
    });
  }
  revPesquisa.parecer = revPesquisaParecer;

  let mlProducts = [];
  // Dedup compartilhado entre Frente 4 e Google Shopping: sem isto, o Serper
  // reinsere produto que a Frente 4 ja trouxe.
  const seen = new Set();

  // TAREFA 5.4: se depois do filtro por categoria sobrarem menos de
  // MIN_PRODUCTS itens, refaz a busca com queries especificas da categoria
  // (label + ano, custo beneficio, 3 marcas conhecidas) — ate 3 rodadas
  // extras. Se ainda faltar, aborta: melhor nao publicar do que publicar um
  // artigo de teclado cheio de mouse.
  const articleCat = detectArticleCategory(topic);
  // Noticia nao participa do funil de produtos por categoria: sem retry de
  // queries especificas, sem shortlist editorial e sem aborto. Produtos
  // relacionados (ex: console/jogo citado na noticia) entram so se a busca
  // principal achar com link — nunca sao condicao para publicar.
  const isNoticia = topic.category === "noticia";
  const fallbackKeywords = isNoticia ? [] : buildCategoryFallbackKeywords(articleCat);
  const retryQueries = isNoticia ? [] : [...buildCategoryRetryQueries(articleCat), ...fallbackKeywords];
  if (fallbackKeywords.length > 0) {
    log("INFO", `Fallback de tema pronto (proxima keyword da mesma familia): ${fallbackKeywords.join(" | ")}`);
  }
  const triedQueries = new Set();
  // Medicao da etapa 5 (ideia 8): funil busca -> categoria -> dedup -> piso,
  // registrado por rodada. O helper monta o relatorio revisarSourcing no padrao
  // das demais etapas (salvo no aborto e no sucesso junto das outras).
  const sourcingMetrics = { rodadas: [] };
  const montarRevSourcing = ({ abortado, gateAtingido }) => revisarSourcing({
    categoria: articleCat || "",
    noticia: isNoticia,
    minProdutos: MIN_PRODUCTS,
    rodadas: sourcingMetrics.rodadas,
    comAfiliado: mlProducts.filter((p) => !p.affiliate_pending).length,
    final: mlProducts.length,
    abortado,
    gateAtingido,
    queriesUsadas: [...triedQueries],
  });

  // TAREFA 6.1: consenso editorial coletado UMA vez, fora do laço de retry.
  const rankingContext = await fetchRankingContext(articleCat, topic.hint);

  // Shortlist editorial: modelos especificos citados em reviews/rankings
  // independentes viram query de busca PRIORITARIA. Sem isso a busca mirava
  // so a categoria ("mouse gamer") e aceitava o que a Frente 4/Shopping
  // devolvesse — agora ela mira nomeadamente "Logitech G Pro X Superlight 2"
  // quando esse e o modelo que o mercado esta recomendando.
  let shortlistQueries = [];
  if (articleCat && PRODUCT_CATEGORIES[articleCat] && !isNoticia) {
    try {
      const shortlist = await buildEditorialShortlist({
        categoriaLabel: PRODUCT_CATEGORIES[articleCat].label,
        ano: ANO_ATUAL,
        serperKey: SERPER_API_KEY,
        tavilyKey: TAVILY_API_KEY,
        fetchLLM,
      });
      shortlistQueries = shortlist.queries;
      if (shortlistQueries.length > 0) {
        log("INFO", `Shortlist editorial: ${shortlistQueries.join(" | ")}`);
      }
    } catch (e) {
      log("WARN", `Shortlist editorial falhou: ${e.message}`);
    }
  }

  for (let extraRound = 0; extraRound <= 3; extraRound++) {
    const retryQ = retryQueries.filter((q) => !triedQueries.has(q));

    // Frente 4 primeiro: produtos que ja vem com link de afiliado.
    if (AFFILIATE_MODE === "remote") {
      try {
        const trendingKws = topic.trending_keywords || [];
        // Marcas da categoria entram JÁ na primeira rodada (seed), para artigo
        // novo nascer com produto de nome reconhecivel — nao so no retry.
        const queriesRemotas = [
          ...shortlistQueries,
          ...(opts.extraMlQueries || []),
          ...retryQ,
          sanitizeProductQuery(topic.ml_query, effectiveDomain) || topic.ml_query,
          ...trendingKws.slice(0, 2).map((k) => sanitizeProductQuery(k, effectiveDomain) || k),
        ].filter(Boolean);
        const queriesUnicas = [...new Set(queriesRemotas)].slice(0, 5);
        // Registra as consultas enviadas (V6): sem isso o lote remoto era
        // reenviado identico a cada rodada extra — o funil gastava 4 rodadas
        // repetindo a mesma busca em vez de girar as keywords de retry.
        for (const q of queriesUnicas) triedQueries.add(q);

        const remotos = await buscarProdutosLoteRemoto(queriesUnicas, { limitPorQuery: 3 });
        // Prioriza produtos da categoria do artigo com marca/modelo
        // reconheciveis: o portao de qualidade (validar-artigo.mjs) reprova
        // artigo com nome generico, e a lista e re-rankeada depois, entao a
        // ordem aqui so define o conjunto.
        const artigoCat = detectArticleCategory(topic);
        const peso = (p) => {
          const cat = artigoCat && productMatchesCategory(p.title, artigoCat) ? 2 : 0;
          const id = detectBrand(p.title) || detectModel(p.title) ? 1 : 0;
          return cat + id;
        };
        const comIdentidade = [...remotos].sort((a, b) => peso(b) - peso(a));
        for (const p of comIdentidade) {
          if (mlProducts.length >= CANDIDATE_POOL) break;
          if (p.permalink && seen.has(p.permalink)) continue;
          if (p.permalink) seen.add(p.permalink);
          mlProducts.push(p);
        }
        log("INFO", `Frente 4: ${mlProducts.length} produtos no pool de candidatos`);
      } catch (e) {
        log("WARN", `Frente 4 falhou: ${e.message} — seguindo com Google Shopping`);
      }
    }

    // Google Shopping so completa o que faltou (ou assume tudo, no modo legacy).
    if (SERPER_API_KEY && mlProducts.length < CANDIDATE_POOL) {
      try {
        const trendingKws = topic.trending_keywords || [];
        // Queries seguem o dominio do artigo: games -> jogos; hardware -> perifericos
        const searchQueries = [
          ...shortlistQueries,
          ...trendingKws.slice(0, 2).flatMap((kw) => {
            const q = sanitizeProductQuery(kw, effectiveDomain) || kw;
            return effectiveDomain === "hardware"
              ? [`${q} gamer ${ANO_ATUAL}`, `${q} ${ANO_ATUAL}`]
              : [`${q} jogo ps5`, `${q} jogo xbox`];
          }),
          sanitizeProductQuery(topic.ml_query, effectiveDomain) || topic.ml_query,
          ...(extraRound > 0 ? retryQ : []),
        ].slice(0, CANDIDATE_POOL);

        for (const query of searchQueries) {
          if (triedQueries.has(query)) continue;
          triedQueries.add(query);
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
          if (mlProducts.length >= CANDIDATE_POOL) break;
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

        // Link de afiliado NAO e mais preenchido aqui com o permalink cru —
        // isso escondia produtos sem comissao atras de um botao normal.
        // resolverAfiliados() cuida disso depois que a lista final estiver
        // fechada (ver TAREFA afiliados abaixo).
      } catch (err) {
        log("WARN", `Shopping Search: ${err.message}`);
      }
    } else {
      log("WARN", "SERPER_API_KEY nao configurada — pulando busca de produtos");
    }

    if (opts.enrichNames) {
      const n = await enrichProducts(mlProducts);
      if (n > 0) log("INFO", `${n} produto(s) enriquecido(s) com nome completo e detalhes`);
    }

    mlProducts = sanitizeProducts(mlProducts.filter((p) => isGamerProduct(p.title)), topic, { rankingContext, metrics: sourcingMetrics });
    mlProducts = await resolverAfiliados(mlProducts);
    if (sourcingMetrics.ultimoRound) {
      sourcingMetrics.rodadas.push({ round: extraRound, ...sourcingMetrics.ultimoRound });
      sourcingMetrics.ultimoRound = null;
    }

    if (!shouldAbortProductSourcing({ count: mlProducts.length, articleCat, isNoticia })) break;

    if (extraRound < 3 && retryQ.length > 0) {
      log("WARN", `Filtro de categoria "${articleCat}" deixou ${mlProducts.length} produto(s) — rodada ${extraRound + 1}/3, tentando proxima keyword da mesma familia: ${retryQ.join(" | ")}`);
      continue;
    }

    // Ideia 1: antes de morrer, salva o funil da etapa 5 para o operador ver
    // onde os produtos se perderam (busca -> categoria -> dedup -> piso).
    const revSourcingAbort = montarRevSourcing({ abortado: true, gateAtingido: false });
    const abortSlug = `${slugify(topic.hint || topic.ml_query || "artigo")}-sourcing-abort-${today}`;
    try {
      salvarRevisoes(abortSlug, [revSourcingAbort]);
      salvarOcorrencias(abortSlug, [revSourcingAbort]);
    } catch (e) {
      log("WARN", `Falha ao salvar relatorio de sourcing: ${e.message}`);
    }
    const ultimaRodadaAbort = sourcingMetrics.rodadas[sourcingMetrics.rodadas.length - 1] || {};
    log("ERROR", `Funil de sourcing (rodadas: ${sourcingMetrics.rodadas.length}): ${ultimaRodadaAbort.bruto} brutos -> ${ultimaRodadaAbort.aposCategoria} categoria -> ${ultimaRodadaAbort.aposDedup} dedup -> ${ultimaRodadaAbort.aposPiso} piso -> ${mlProducts.length} final`);
    log("ERROR", `Menos de ${MIN_PRODUCTS} produtos da categoria "${articleCat}" (so ${mlProducts.length}) — abortando para nao publicar artigo errado`);
    // Fallback de tema (P2): em vez de exit(1) aqui, lanca para o main() tentar
    // o proximo candidato do pool (keyword trending alternativa ou seed estatico;
    // se virar noticia, publica noticia). O relatorio do funil ja foi salvo acima.
    throw new Error(`sourcing abortou para "${articleCat}" — faltaram produtos (${mlProducts.length}/${MIN_PRODUCTS})`);
  }

  const revSourcing = montarRevSourcing({ abortado: false, gateAtingido: true });

  const productBlock = mlProducts.length > 0
    ? `\nPRODUTOS DISPONIVEIS (cada um vira um item da secao de Itens):\n${mlProducts.map((p, i) => {
        const marca = p.brand ? `Marca: ${p.brand}\n` : "";
        const desc = p.description ? `Descricao: ${p.description}\n` : "";
        const specs = Array.isArray(p.specs) && p.specs.length
          ? `Especificacoes: ${p.specs.map((s) => `${s.key}: ${s.value}`).join("; ")}\n`
          : "";
        return (
          `Marcador: [PRODUTO:${i + 1}]\n` +
          `Nome: ${p.title}\n` +
          `Preco: ${formatProductPriceForPrompt(p)}\n` +
          marca + desc + specs
        );
      }).join("\n")}\nO sistema monta a foto e o botao de compra do item no lugar do marcador. Voce NAO escreve preco, link nem imagem desses produtos — so decide ONDE cada item entra. O nome do item vira o heading "## Nome do Produto — Subtitulo". NUNCA escreva "R$ X" no texto para produtos listados — o preco fica so na tabela comparativa.\nREGRA DE PRECO AUSENTE: se o produto estiver marcado como "Preco: NAO DISPONIVEL", voce NAO escreve preco, NUNCA diz gratis, gratuito, preco zero ou de graca, e orienta o leitor a conferir o preco atual na tabela.\nREGRA DE DETALHES: quando o produto tiver "Marca:", "Descricao:" ou "Especificacoes:", use-os como FONTE DE VERDADE nos itens — o leitor pode comparar com o que esta listado. NUNCA invente especificacao numerica (GHz, GB, W, fps, cores, DPI, sensor) fora do que aparecer nesses campos.`
    : "";

  const internalLinksBlock = buildInternalLinksBlock(opts.overwriteSlug);

  const trendingNote = topic.trending_keywords
    ? `\nCONTEXTO: Este topico esta em alta agora em sites de games e redes sociais. Palavras-chave trending: ${topic.trending_keywords.join(", ")}. Escreva um artigo relevante e atual conectando esses temas.`
    : "";

  const categoria = topic.category;
  const estiloOpinativo = categoria === "noticia" || categoria === "lista";
  const estiloFactual = categoria === "guia" || categoria === "review";

  const personaManoGamer = `PERSONA: Voce e o "Mano Gamer", narrador raiz do Promo Gamer — um gamer brasileiro que escreve como se estivesse trocando ideia com os amigos no Discord.

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

  const personaFactual = `PERSONA: Voce e um redator tecnico especializado em {{DOMINIO}} do Promo Gamer. Escreve reviews e guias com precisao e profundidade.

REGRAS DE ESTILO:
- ABERTURA: Va direto ao ponto. Contextualize o topico em 1-2 frases. Ex: "Escolher o monitor certo para games em ${ANO_ATUAL} exige atencao a 3 especificacoes-chave: taxa de atualizacao, tempo de resposta e tipo de painel."
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
  const alvoWords = "900-1100";
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
- [IMG:Nome] — OBRIGATORIO em cada secao ## EXCETO nos itens da secao de lista de produtos (nesses itens a foto do produto e injetada automaticamente). Tambem e OBRIGATORIO em subsecoes ### que descrevem um item/modelo quando NAO ha foto automatica de produto (ex.: "### Moza R12 Direct Drive V1" sem [PRODUTO:N]) — coloque [IMG:Nome do item] em linha sozinha, logo APOS o titulo ###. Coloque o marcador em uma linha sozinha, logo APOS o titulo da propria secao (a imagem fica DENTRO da secao, abaixo do titulo e acima do texto). Para secoes sobre um jogo, use o nome do jogo (ex: [IMG:God of War Laufey]). Para secoes gerais (setup, comparativos, FAQ, lancamentos), use uma descricao curta do topico (ex: [IMG:Setup Gamer], [IMG:Comparativo de Consoles], [IMG:Perguntas Frequentes]). O sistema busca imagens automaticamente via web. SEMPRE use um marcador — nao existe secao sem imagem.
- ${mlProducts.length > 0 ? `[PRODUTO:N] — um marcador por item, na secao de Itens (a primeira secao ## do artigo, logo apos a introducao), cada um na linha sozinha e logo APOS o texto que descreve aquele item. NAO empilhe todos no comeco. Use o numero exato indicado na lista de produtos.` : "Nao ha produtos nesta rodada — nao use [PRODUTO:N]."}
- Nunca coloque dois marcadores seguidos sem texto entre eles. Se um jogo ou produto nao tem relevancia real em nenhum trecho, omita o marcador — melhor faltar do que forcar.
- Se o sistema nao achar imagem para um [IMG:...], ele remove o marcador. Entao o paragrafo tem que fazer sentido sozinho, sem depender da imagem.

## REGRAS DE TITULO
- 55 a 65 caracteres.
- ${primaryKeyword ? `A palavra-chave "${primaryKeyword}" DEVE aparecer nos primeiros 40% do titulo.` : "A palavra-chave principal (jogo, produto ou evento) deve aparecer nos primeiros 40% do titulo."}
- PROIBIDO: "Tudo que voce precisa saber", "Novidades que vao bombar/mexer/transformar", "Fique por dentro", "Imperdivel", "Revolucionario", "O que esperar".
- Use numero, data ou beneficio concreto: "10 Melhores X em ${ANO_ATUAL}", "X vs Y: Qual Vale a Pena", "X Chega em Marco: O Que Muda".
- Nada de clickbait vazio: o titulo tem que ser 100% sustentado pelo conteudo.

## REGRAS DE CONTEUDO
1. GROUNDING: todo dado concreto (preco, spec, data, numero de vendas, nota) vem das fontes de pesquisa fornecidas. Se nao esta la, nao afirme como fato — use "segundo rumores", "ainda sem confirmacao".
2. ESPECIFICIDADE: proibido "incrivel", "revolucionario", "surpreendente" sem uma frase logo depois explicando o motivo concreto.
3. TESE POR SECAO: cada secao defende um ponto, nao lista fatos soltos. Nao "as specs do monitor X", e sim "o monitor X vale o preco por causa de Y, apesar de Z".
4. COMPARACAO REAL: em tabela comparativa, os numeros precisam diferenciar os itens. Nota SEMPRE na escala 0 a 5 estrelas (a mesma do Mercado Livre) — NUNCA escala 0-10, NUNCA numero maior que 5. Nada de todo mundo com a mesma nota.
  5. EXTENSAO: minimo ${minWords} palavras, alvo ${alvoWords}, maximo 1200 palavras. Extensao e consequencia de profundidade — nao encha linguica pra bater numero.
6. E permitido (e recomendado) discordar do hype de marketing quando os dados sustentarem. Isso gera credibilidade.
7. Frases curtas alternadas com uma ou duas mais longas. Paragrafos com frases todas do mesmo tamanho denunciam texto de IA.
${estiloOpinativo ? "8. Giria e humor sao tempero, nao estrutura: no maximo 1 giria marcante a cada 2-3 paragrafos, nunca empilhadas." : "8. Tom tecnico com humor seco dosado: no maximo 1 toque ironico a cada 3 paragrafos, sem giria de boteco."}

## ESTRUTURA (ordem obrigatoria — adapte so o conteudo de cada bloco)
- INTRODUCAO SEM H2: 1-2 paragrafos diretos com gancho concreto. Nos primeiros 2-3 paragrafos, resuma os criterios/requisitos que definem os itens da lista (o que diferencia um bom item, em 2 frases no maximo) — NAO crie secao ## separada para esse contexto.
- PRIMEIRA SECAO ## (a principal): a lista de Itens. ${mlProducts.length > 0 ? `Titulo tipo: "## Os ${mlProducts.length} Melhores {Itens} em ${ANO_ATUAL}". Um bloco por item, nesta ordem: "## Nome do Produto — Subtitulo" (SEM [IMG:] — a foto e injetada automaticamente), 2-3 paragrafos com os principais detalhes do item, e [PRODUTO:N] numa linha sozinha logo apos o texto.` : `Titulo tipo: "## Os Melhores {Jogos/Itens} em ${ANO_ATUAL}". Um bloco por item: "## Nome — Subtitulo" com [IMG:Nome] na linha logo apos o titulo (imagem abaixo do titulo, acima do texto), 2-3 paragrafos de detalhes, sem botao de compra.`}
- Depois da lista, secoes curtas nesta ordem (omita o que nao se aplica):
  - ${mlProducts.length > 0 ? "Tabela comparativa dos produtos (Produto | Preco | Destaque | Nota de 0 a 5 estrelas, NUNCA 0-10) com notas que realmente diferenciam." : "Tabela quando houver o que comparar (jogos, specs, edicoes)."}
  - "## Veredito" (ou "## Qual X Escolher?") com bullets por perfil de usuario — nunca "depende do orcamento".
  - "## FAQ" com 3-4 perguntas que as pessoas realmente pesquisam no Google sobre o tema.
  - "## Quer mais ofertas?" com: Entre para o nosso [grupo VIP no Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) e receba ofertas diarias de ${domain === "hardware" ? "perifericos e hardware gamer" : "games e consoles"}!
  - "## Fontes" com os links da pesquisa.
- LINKS INTERNOS: 2 a 3, SOMENTE na ultima secao "## Continue Explorando" (formato [texto](/blog/slug-do-artigo/), usando SOMENTE slugs da lista de artigos existentes fornecida). NUNCA coloque links internos no meio do artigo.
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

  const buildUserPrompt = (research, gamesCandidates = []) => {
  const candidatosBlock = gamesCandidates.length > 0
    ? `\nCANDIDATOS OBRIGATORIOS (a lista de itens DEVE ser escolhida entre estes titulos exatos, nao invente nem use jogos antigos):\n${gamesCandidates.map((c, i) => `${i + 1}. ${c.titulo}`).join("\n")}\n`
    : "";
  return `Escreva um artigo de categoria "${categoria}" sobre: ${topic.hint}

DOMINIO OBRIGATORIO: este artigo é APENAS sobre ${domainLabel(domain)}. Nao misture games e hardware no mesmo texto.
${domain === "hardware"
  ? `Foque em perifericos e hardware gamer. Exemplos validos: "Melhores Mouses Wireless ${ANO_ATUAL}", "Headset Gamer Custo-Beneficio", "Monitor 144Hz vs 240Hz".
PROIBIDO NO TEXTO: GTA, Resident Evil, Fortnite, Zelda, Game Awards, E3, Gamescom, lancamentos de jogos, gameplay, historia de jogo.`
  : `Foque em jogos, consoles, software ou eventos de games. Exemplos validos: "GTA 6: data de lancamento", "Melhores Jogos de Corrida ${ANO_ATUAL}", "Resident Evil Requiem no PS5", "Game Awards ${ANO_ATUAL}".
PROIBIDO NO TEXTO: mouse, teclado, headset, monitor, placa de video, RTX, processador, SSD, fonte, gabinete, water cooler, setup gamer.`}

${candidatosBlock}
${research ? `PESQUISA (use estes fatos — nao invente dados fora daqui):\n${research}\n` : "SEM PESQUISA DISPONIVEL: escreva so o que e conhecimento consolidado, sem inventar numeros, datas ou precos.\n"}
${productBlock}${internalLinksBlock}
${isNoticia && mlProducts.length === 0 ? `
NOTICIA SEM CARDS: alem da noticia em si, inclua perto do fim (antes de ## Fontes) uma secao "## Onde Jogar" (ou "Consoles e Plataformas") que menciona em texto natural quais consoles/plataformas rodam os jogos citados e o que o leitor precisa para jogar — sem cards de produto, sem links de compra, sem precos. Se as fontes nao sustentarem o detalhe, mantenha generico ("disponivel para as principais plataformas").
` : ""}

Checklist antes de responder:
1. Titulo com 55-65 chars${primaryKeyword ? `, com "${primaryKeyword}" no comeco` : ""}, sem frase generica.
2. Description 120-160 chars, sem ** e sem exagero promocional.
3. Minimo ${minWords} palavras de conteudo real (alvo ${alvoWords}).
4. ${mlProducts.length > 0 ? `Marcadores [PRODUTO:1]..[PRODUTO:${mlProducts.length}] TODOS dentro da secao de Itens (a primeira secao ## apos a introducao), um por item, cada um em linha sozinha logo apos o texto do item.` : "Sem produtos nesta rodada — os itens sao jogos e usam [IMG:]."}
5. 2 a 4 marcadores [IMG:Nome], um logo apos o titulo de cada secao ## que NAO seja item de produto (itens com produto NAO usam [IMG:] — a foto e injetada automaticamente).
6. Cada dado concreto rastreavel ate a pesquisa acima.
7. 5 tags relevantes.
8. ${estiloOpinativo ? "Voz Mano Gamer: opiniao com lado tomado, giria dosada, sem enrolacao." : "Voz tecnica hibrida: precisao, comparacao de specs, humor seco dosado (max 1 a cada 3 paragrafos)."}
9. 2 a 3 links internos usando SOMENTE slugs da lista ARTIGOS EXISTENTES acima, colocados SOMENTE na secao final "## Continue Explorando".`;
  };

  // Grounding da lista de games (P3): busca no Google quais sao os melhores
  // jogos de PC do ano e obriga a LLM a escolher os itens entre esses titulos.
  let gamesCandidates = [];
  if (effectiveDomain === "games" && ["lista", "review"].includes(categoria) && mlProducts.length === 0) {
    try {
      gamesCandidates = await buildGamesCandidateList({
        ano: ANO_ATUAL,
        serperKey: SERPER_API_KEY,
        tavilyKey: TAVILY_API_KEY,
        fetchLLM,
      });
    } catch (e) {
      log("WARN", `Candidatos de jogos falharam: ${e.message}`);
    }
  }

  // Encolhe a pesquisa ate sobrar espaco de saida suficiente dentro do TPM.
  // So para o fluxo de chamada unica (sem produtos): no segmentado a pesquisa
  // vai inteira para a chamada do corpo principal.
  let userPrompt = buildUserPrompt(researchContext, gamesCandidates);
  while (mlProducts.length === 0 && computeMaxTokens(systemPrompt, userPrompt) < MIN_OUTPUT && researchContext.length > 800) {
    researchContext = researchContext.slice(0, Math.floor(researchContext.length * 0.75));
    userPrompt = buildUserPrompt(researchContext, gamesCandidates);
    log("WARN", `Pesquisa reduzida para caber no limite de ${TOKEN_BUDGET} TPM`);
  }
  log("INFO", `Orcamento Groq: prompt ~${estimateTokens(systemPrompt) + estimateTokens(userPrompt)} tokens, saida ~${computeMaxTokens(systemPrompt, userPrompt)} tokens`);

  const MAX_GEN_ATTEMPTS = 3;
  const validationCtx = {
    category: categoria,
    productCount: mlProducts.length,
    productPrices: mlProducts.filter((p) => p.price).map((p) => p.price),
    primaryKeyword,
    gamesCandidates,
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
        researchContext, internalLinksBlock, today, minWords, articleCat,
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
      persistState();
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
      persistState();
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
        // TAREFA P23 (gate corretor): antes de abortar, tenta corrigir o que e
        // deterministico (description curta, tags, marcadores, secoes vazias).
        const corrigido = corrigirPeloGate({
          body: parsed.body,
          fm: parsed.frontmatter,
          gateReprovados: [{ etapa: "revisao", problemas: hard.map((m) => ({ severidade: "P0", mensagem: m })) }],
          categoria,
          listHeading: null,
          topicHint: topic.hint,
        });
        if (corrigido.mudancas.length > 0) {
          const reval = validate(corrigido.fm, corrigido.body, { ...validationCtx, lastAttempt: true });
          if (reval.hard.length === 0) {
            log("INFO", `Correcao deterministica aplicada pelo gate (${corrigido.mudancas.join(", ")})`);
            fm = corrigido.fm;
            body = corrigido.body;
            break;
          }
          log("WARN", `Correcao deterministica insuficiente: ${reval.hard.join("; ")}`);
        }
        log("ERROR", `Validacao falhou apos ${MAX_GEN_ATTEMPTS} tentativas:\n${hard.join("\n")}`);
        log("DEBUG", JSON.stringify(parsed.frontmatter, null, 2));
        process.exit(1);
      }
      log("WARN", "Publicando com ressalvas de qualidade (ultima tentativa)");
      fm = parsed.frontmatter;
      body = parsed.body;
      break;
    }

    const domainFeedback = (isMixedDomain(parsed.frontmatter.title) || temFocoMisto(parsed.body))
      ? `\n\nREGRA DE DOMINIO VIOLADA: voce misturou games e hardware no mesmo texto. Escolha APENAS UM dos lados e remova TODO o outro. Se o artigo for sobre jogos/consoles, remova qualquer mencao a mouse, teclado, headset, monitor, placa de video, processador, fonte, SSD, gabinete, cadeira, setup gamer. Se for sobre hardware, remova qualquer mencao a jogos especificos, lancamentos de jogos, eventos de games, gameplay.`
      : "";
    feedback = `\n\nA versao anterior foi rejeitada. Corrija TUDO isto e reescreva o artigo inteiro:\n- ${[...hard, ...soft].join("\n- ")}${domainFeedback}`;
  }
  }

  // Categoria e decisao do pipeline (esteira/trending/FORCE_TOPIC), nunca da
  // LLM: o frontmatter segmentado ja re-afirma dentro de generateArticleFrontmatter;
  // o fluxo de chamada unica precisa da mesma trava, senao um "review" planejado
  // vira "lista" (ou qualquer outra) no arquivo final.
  if (fm && fm.category !== categoria) {
    log("WARN", `Categoria sobrescrita pela LLM (${fm.category}) — reafirmando para "${categoria}"`);
    fm.category = categoria;
  }

  const revRedacao = revisarRedacao({
    fm,
    body,
    categoria,
    minWords,
    mixedDomain: isMixedDomain(fm.title) || temFocoMisto(body),
    primaryKeyword,
  });
  let revRedacaoParecer = null;
  if (statusGeraLLM(revRedacao)) {
    revRedacaoParecer = await emitirParecer({
      etapa: "redacao",
      rel: revRedacao,
      contexto: { titulo: fm.title, descricao: fm.description, palavras: body.split(/\s+/).filter(Boolean).length },
      fetchLLM,
    });
  }
  revRedacao.parecer = revRedacaoParecer;

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
  // Ultima trava contra ano velho no titulo/description, cobrindo tambem o
  // fluxo de chamada unica (sem produtos) que nao passa por generateArticleFrontmatter.
  const tituloCorrigido = normalizarAnos(fm.title);
  if (tituloCorrigido !== fm.title) log("WARN", `Ano corrigido no titulo final: "${fm.title}" -> "${tituloCorrigido}"`);
  fm.title = tituloCorrigido;
  fm.description = normalizarAnos(fm.description);
  // Mesma trava no corpo e nas tags: a LLM copia ano velho do topico/fontes
  // ("melhores ... de 2024") pro texto corrido, e so titulo/description/heading
  // passavam por normalizarAnos. URLs de links internos sao protegidas.
  body = normalizarAnosBody(body);
  fm.tags = (fm.tags || []).map((t) => normalizarAnos(String(t)));

  // Lista de games sem produtos: heading-pai "## Os N Melhores..." + itens "###"
  // (TOC aninhado) — roda antes do reposicionamento de imagens e das ancoras.
  body = ensureListStructure(body, {
    categoria,
    domain: effectiveDomain,
    productCount: mlProducts.length,
    ano: ANO_ATUAL,
    topic,
    title: fm.title,
  });

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
  // SKIP_COVER=1 pula a geracao por IA (OpenAI/Stability) e usa so os fallbacks
  // gratuitos (thumbnail de produto / RAWG) — util para testes sem gasto.
  const capaSlug = slugify(fm.title);
  const coverContext = topic.hint || fm.title || "";
  const gameRefs = Object.values(gameImages);
  const hasProducts = mlProducts.length > 0;
  // Artigo de hardware sem produtos (ex.: noticia sobre volantes): a capa deve
  // focar nos ITENS do artigo, nao num cenario generico. Os nomes das subsecoes
  // ### viram referencia para a IA compor os produtos sobre a mesa.
  const hardwareItemNames = effectiveDomain === "hardware" && !hasProducts
    ? extractSubsectionItemNames(body)
    : [];
  const coverProducts = hasProducts ? mlProducts : hardwareItemNames.map((name) => ({ name }));

  if (process.env.SKIP_COVER) {
    log("INFO", "SKIP_COVER: capa IA pulada — usando fallbacks gratuitos");
  } else {
    log("INFO", `Gerando capa IA contextual (categoria: ${categoria}, ${coverProducts.length > 0 ? coverProducts.length + " itens de referencia" : "sem referencia de itens"}, ${gameRefs.length} imagens de jogo)...`);
    if (coverProducts.length > 0) {
      coverImage = await gerarCapaOpenAI({ mlProducts: coverProducts, category: categoria, slug: capaSlug, context: coverContext }) || "";
    } else {
      coverImage = await gerarCapaOpenAI({ mlProducts: [], category: categoria, slug: capaSlug, contentType: "game", context: coverContext, gameRefs }) || "";
    }
    if (!coverImage) {
      coverImage = await gerarCapaStability({ mlProducts: coverProducts, category: categoria, slug: capaSlug, context: coverContext, gameRefs }) || "";
    }
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
    // Regeneracao: reaproveita a imagem local de produtos que se mantiveram
    // (match por similaridade de titulo), evitando re-baixar foto boa.
    if (opts.reuseImageMap && opts.reuseImageMap.size > 0) {
      let reused = 0;
      for (const p of mlProducts) {
        const raw = (p.raw_title || p.title || "").trim();
        if (!raw) continue;
        let bestPath = null;
        let bestScore = 0;
        for (const [oldTitle, oldPath] of opts.reuseImageMap) {
          if (!oldTitle || !oldPath) continue;
          const s = nameSimilarity(raw, oldTitle);
          if (s > bestScore) { bestScore = s; bestPath = oldPath; }
        }
        if (bestPath && bestScore >= 0.55) {
          const localFile = path.join(PROD_IMAGES_DIR, path.basename(bestPath));
          if (fs.existsSync(localFile)) {
            p.local_thumbnail = bestPath;
            reused++;
          }
        }
      }
      if (reused > 0) log("INFO", `${reused} imagem(ns) de produto reutilizada(s) do artigo anterior`);
    }
    log("INFO", `Baixando imagens dos ${mlProducts.length} itens (ML -> web -> IA)...`);
    await ensureProductImages(mlProducts);
  }
  if (parts) {
    body = injectSegmentedItems(body, parts.listHeading, mlProducts, true);
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

  // Preco de produto so vive na tabela comparativa / no card, nunca em prosa.
  if (mlProducts.length > 0 && validationCtx.productPrices.length > 0) {
    const proseAntes = findPricesInBody(body, validationCtx.productPrices);
    body = stripPricesFromBody(body, validationCtx.productPrices);
    const proseDepois = findPricesInBody(body, validationCtx.productPrices);
    if (proseDepois.length < proseAntes.length) {
      log("INFO", `Precos em prosa removidos (${proseAntes.length} -> ${proseDepois.length})`);
    }
  }

  // Gera sumário/índice com links âncora para melhor navegação e SEO
  body = injectHeadingAnchors(body);

  if (!coverImage) {
    const fallbackKw = trendingKeywordForCover || (topic.ml_query ? topic.ml_query.split(" ").slice(0, 2).join(" ") : "") || "";
    if (fallbackKw) coverImage = await fetchRAWGImage(fallbackKw) || "";
  }
  // Ultima rede de seguranca: capa padrao por categoria de produto (reutiliza
  // capas genericas ja publicadas) — melhor uma capa generica do que nenhuma.
  if (!coverImage) {
    const defaultPath = (articleCat && DEFAULT_COVER_BY_PRODUCT_CATEGORY[articleCat]) || DEFAULT_COVER_GENERIC;
    if (fs.existsSync(path.resolve("public", defaultPath.replace(/^\//, "")))) {
      coverImage = defaultPath;
      log("INFO", `Capa padrao por categoria: ${defaultPath}`);
    }
  }
  if (coverImage) {
    fm.image = coverImage;
    log("INFO", `Imagem de capa: ${coverImage.slice(0, 80)}`);
  } else {
    log("WARN", "Nenhuma imagem de capa encontrada - artigo ficara sem imagem principal");
  }

  // Revisao SEO roda DEPOIS da capa resolvida (fm.image preenchida acima):
  // o hook mede "imagem de capa presente" contra o frontmatter final.
  const internalLinksCount = [...body.matchAll(/\/blog\/[^)\s"'#]+/g)].length;
  const fontesSection = body.match(/^##\s+Fontes\s*$/im);
  // Fontes sao escritas como URLs cruas ("- https://...") ou links markdown:
  // conta os dois formatos para nao submedir a cobertura.
  const fontesComUrl = fontesSection
    ? [...body.slice(fontesSection.index).matchAll(/(?:\[[^\]]*\]\()?https?:\/\/[^\s)\]>]+/g)].length
    : 0;
  const revSeo = revisarSeo({
    fm,
    body,
    primaryKeyword,
    internalLinks: internalLinksCount,
    fontesComUrl,
    titleProblems: checkTitle(fm.title, primaryKeyword),
  });
  let revSeoParecer = null;
  if (statusGeraLLM(revSeo)) {
    revSeoParecer = await emitirParecer({
      etapa: "seo",
      rel: revSeo,
      contexto: { titulo: fm.title, descricao: fm.description, tags: fm.tags, linksInternos: internalLinksCount },
      fetchLLM,
    });
  }
  revSeo.parecer = revSeoParecer;

  const produtoImagensRevisao = mlProducts
    .filter((p) => p.local_thumbnail)
    .map((p) => ({ title: p.title, path: p.local_thumbnail }));
  const revDesign = revisarDesign({
    body,
    fm,
    coverImage,
    produtoImagens: produtoImagensRevisao,
    gameImages: Object.keys(gameImages),
  });
  let revDesignParecer = null;
  if (statusGeraLLM(revDesign)) {
    revDesignParecer = await emitirParecer({
      etapa: "design",
      rel: revDesign,
      contexto: { imagensJogos: Object.keys(gameImages).length, imagensProdutos: produtoImagensRevisao.length, capa: coverImage.slice(0, 60) },
      fetchLLM,
    });
  }
  revDesign.parecer = revDesignParecer;

  const slug = opts.overwriteSlug || slugify(fm.title);
  const published = fs.existsSync(ARTIGOS_DIR)
    ? fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
    : [];

  if (!opts.overwriteSlug && published.includes(slug)) {
    log("ERROR", `Slug duplicado: ${slug}`);
    state.last_error = `Slug duplicado: ${slug}`;
    state.last_error_date = today;
    state.consecutive_failures = (state.consecutive_failures || 0) + 1;
    persistState();
    process.exit(1);
  }

  // Regeneracao: preserva a pubDate original para o artigo nao "virar novo"
  // no RSS/SEO. So o conteudo e regenerado, a data de publicacao fica.
  let pubDate = today;
  if (opts.overwriteSlug && keepPubDate) {
    const existingPath = path.join(ARTIGOS_DIR, `${opts.overwriteSlug}.md`);
    if (fs.existsSync(existingPath)) {
      try {
        const antigo = parseFrontmatter(fs.readFileSync(existingPath, "utf-8"));
        if (antigo.frontmatter && antigo.frontmatter.pubDate) pubDate = String(antigo.frontmatter.pubDate);
      } catch {}
    }
  }

  const cover = fm.image || mlProducts[0]?.thumbnail || "";
  const finalValidate = validate(fm, body, {
    ...validationCtx,
    segmented: mlProducts.length > 0 && Boolean(parts),
    listHeading: parts?.listHeading,
    products: mlProducts,
    productCount: mlProducts.length,
    relaxedWordCount: true,
    softMixedDomain: true,
    lastAttempt: true,
  });
  const finalWarnings = validateSourceCoverage(body, researchSources);
  const revFinal = revisarFinal({
    hard: finalValidate.hard,
    soft: finalValidate.soft,
    sourceWarnings: finalWarnings,
    wc: body.split(/\s+/).filter(Boolean).length,
    minWords,
    productCount: mlProducts.length,
  });
  let revFinalParecer = null;
  if (statusGeraLLM(revFinal)) {
    revFinalParecer = await emitirParecer({
      etapa: "revisao",
      rel: revFinal,
      contexto: { titulo: fm.title, fontes: researchSources.slice(0, 5).map((f) => f.url) },
      fetchLLM,
    });
  }
  revFinal.parecer = revFinalParecer;

  const markdown = montarMarkdown({ fm, body, pubDate, cover, mlProducts });

  const fp = path.join(ARTIGOS_DIR, `${slug}.md`);
  // Backup do conteudo anterior (regeneracao): o gate de revisao pode precisar
  // restaurar o artigo antigo se a nova versao for reprovada.
  const backupOriginal = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : null;
  fs.writeFileSync(fp, markdown, "utf-8");
  log("INFO", `Artigo salvo: ${slug}.md`);
  salvarPendentesAfiliados(slug, mlProducts);

  if (opts.updateState !== false) {
    state.last_success = today;
    state.last_slug = slug;
    state.last_error = null;
    state.last_error_date = null;
    state.consecutive_failures = 0;
    state.total_articles = countArticlesInDir();
    state.last_topic = topic.hint;
    state.last_category = topic.category;
    state.rotation_pos = (typeof state.rotation_pos === "number" ? state.rotation_pos : rotationPosFromLastCategory(topic.category)) + 1;
    state.rotation_pos = state.rotation_pos % CATEGORY_ROTATION.length;
    state.trending_source = trendingSource;
    state.recent_keywords = topic.trending_keywords || [];
    state.recent_topics = [...((state.recent_topics || []).slice(-9)), topic.hint.slice(0, 60)];
    persistState();
    log("INFO", `Estado atualizado: ${state.total_articles} artigos, ultimo hoje`);
  }

  const revPublicacao = revisarPublicacao({
    slug,
    fm,
    body,
    arquivoExiste: fs.existsSync(fp),
    linksInternos: internalLinksCount,
  });
  let revPublicacaoParecer = null;
  if (statusGeraLLM(revPublicacao)) {
    revPublicacaoParecer = await emitirParecer({
      etapa: "publicacao",
      rel: revPublicacao,
      contexto: { titulo: fm.title, slug, tamanhoMarkdown: markdown.length },
      fetchLLM,
    });
  }
  revPublicacao.parecer = revPublicacaoParecer;

  const relatoriosPiloto = [
    revPesquisa,
    revSourcing,
    revRedacao,
    revSeo,
    revDesign,
    revFinal,
    revPublicacao,
  ];
  try {
    salvarRevisoes(slug, relatoriosPiloto);
    salvarOcorrencias(slug, relatoriosPiloto);
  } catch (err) {
    log("WARN", `Falha ao persistir relatorios de revisao: ${err.message}`);
  }

  // GATE DE REVISAO: etapa reprovada (qualquer P0/P1) bloqueia a publicacao.
  // Os relatorios ja foram persistidos acima. TAREFA E: antes de desistir, o
  // gate tenta corrigir deterministicamente (secoes vazias, base64, imagens
  // frageis, abertura proibida, marcadores restantes, description/tags) e
  // reaplica os passos deterministas (precos, marcadores, âncoras) revalidando
  // o artigo. So remove/restaura se a correcao nao zerar as reprovacoes.
  const gateReprovados = relatoriosPiloto.filter((r) => r.status === "reprovado");
  if (gateReprovados.length > 0) {
    log("ERROR", `Gate de revisao: ${gateReprovados.length} etapa(s) reprovada(s) — ${gateReprovados.map((r) => `${r.etapa} (${r.score}/10)`).join(", ")}`);
    for (const r of gateReprovados) {
      for (const p of r.problemas.filter((x) => x.severidade === "P0" || x.severidade === "P1")) {
        log("ERROR", `  [${r.etapa}] ${p.severidade}: ${p.mensagem} (${p.evidencia || "sem evidencia"})`);
      }
    }
    if (!(opts.forcePublicar || process.env.IGNORE_REVIEW_GATE === "1")) {
      // Revalidacao deterministica pos-correcao, com os mesmos criterios do
      // finalValidate. Nao re-emite pareceres LLM: eles sao apenas registro.
      const revalidar = ({ fm: f, body: b }) => {
        const v = validate(f, b, {
          ...validationCtx,
          segmented: mlProducts.length > 0 && Boolean(parts),
          listHeading: parts?.listHeading,
          products: mlProducts,
          productCount: mlProducts.length,
          relaxedWordCount: true,
          softMixedDomain: true,
          lastAttempt: true,
        });
        const sw = validateSourceCoverage(b, researchSources);
        const wc = b.split(/\s+/).filter(Boolean).length;
        const internalLinks = [...b.matchAll(/\/blog\/[^)\s"'#]+/g)].length;
        const fsx = b.match(/^##\s+Fontes\s*$/im);
        const fontesComUrl = fsx ? [...b.slice(fsx.index).matchAll(/(?:\[[^\]]*\]\()?https?:\/\/[^\s)\]>]+/g)].length : 0;
        const produtoImagensRe = mlProducts.filter((p) => p.local_thumbnail).map((p) => ({ title: p.title, path: p.local_thumbnail }));
        const rels = [
          revisarRedacao({ fm: f, body: b, categoria, minWords, mixedDomain: isMixedDomain(f.title) || temFocoMisto(b), primaryKeyword }),
          revisarSeo({ fm: f, body: b, primaryKeyword, internalLinks, fontesComUrl, titleProblems: checkTitle(f.title, primaryKeyword) }),
          revisarDesign({ body: b, fm: f, coverImage: cover, produtoImagens: produtoImagensRe, gameImages }),
          revisarFinal({ hard: v.hard, soft: v.soft, sourceWarnings: sw, wc, minWords, productCount: mlProducts.length }),
          revisarPublicacao({ slug, fm: f, body: b, arquivoExiste: true, linksInternos: internalLinks }),
        ];
        return { rels, reprovados: rels.filter((r) => r.status === "reprovado") };
      };

      let corpoOk = null;
      let fmOk = null;
      for (let iter = 0; iter < 3; iter++) {
        const res = corrigirPeloGate({
          body: corpoOk ?? body,
          fm: fmOk ?? fm,
          gateReprovados,
          categoria,
          listHeading: parts?.listHeading,
          topicHint: topic.hint,
        });
        if (res.mudancas.length === 0) break;
        let b = stripPricesFromBody(res.body, validationCtx.productPrices);
        b = stripLeftoverMarkers(b);
        b = injectHeadingAnchors(b);
        const { reprovados } = revalidar({ fm: res.fm, body: b });
        log("INFO", `Correcao do gate (tentativa ${iter + 1}): ${res.mudancas.join(", ")} -> ${reprovados.length === 0 ? "todas as etapas aprovadas" : `ainda reprovado: ${reprovados.map((r) => r.etapa).join(", ")}`}`);
        corpoOk = b;
        fmOk = res.fm;
        if (reprovados.length === 0) break;
      }

      if (corpoOk != null && fmOk != null) {
        const { rels, reprovados } = revalidar({ fm: fmOk, body: corpoOk });
        if (reprovados.length === 0) {
          const markdownCorrigido = montarMarkdown({ fm: fmOk, body: corpoOk, pubDate, cover, mlProducts });
          fs.writeFileSync(fp, markdownCorrigido, "utf-8");
          log("INFO", `Gate corrigiu o artigo automaticamente e publicou: ${slug}.md`);
          try {
            salvarRevisoes(slug, [revPesquisa, revSourcing, ...rels]);
          } catch (err) {
            log("WARN", `Falha ao persistir relatorios corrigidos: ${err.message}`);
          }
          log("INFO", "=== CONCLUIDO ===");
          return;
        }
        log("WARN", `Correcao automatica nao zerou as reprovacoes (${reprovados.map((r) => r.etapa).join(", ")}) — rollback.`);
      } else {
        log("WARN", "Nenhuma correcao automatica aplicavel — rollback.");
      }

      if (backupOriginal != null) {
        fs.writeFileSync(fp, backupOriginal, "utf-8");
        log("ERROR", "Artigo anterior restaurado (regeneracao reprovada pelo gate).");
      } else {
        fs.rmSync(fp, { force: true });
        log("ERROR", "Artigo removido (reprovado pelo gate).");
      }
      state.last_error = `Gate de revisao reprovou: ${gateReprovados.map((r) => r.etapa).join(", ")}`;
      state.last_error_date = today;
      state.consecutive_failures = (state.consecutive_failures || 0) + 1;
      // O bloco acima ja tinha marcado last_success/last_slug como publicados;
      // revert para o artigo nao contar como sucesso (cooldown reaberto).
      state.last_success = null;
      state.last_slug = null;
      state.total_articles = countArticlesInDir();
      persistState();
      process.exit(1);
    } else {
      log("WARN", "Gate ignorado (IGNORE_REVIEW_GATE/forcePublicar) — publicando mesmo assim.");
    }
  }

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

const SEG_STYLE_OPINATIVO = `PERSONA: Voce e o "Mano Gamer", narrador raiz do Promo Gamer — gamer brasileiro que escreve como se estivesse trocando ideia com os amigos no Discord.
- OPINIAO FORTE: tome lado. Critique quando erram, elogie quando acertam. Ex: "A Capcom lancou mais um remake. Surpresa: zero."
- HUMOR: metaforas do mundo gamer ("mais dificil que matar Malenia no level 1", "preco de scalper", "nao tankei").
- GIRIAS NATURAIS e DOSADAS: "ta on", "brabo", "tankar", "o bagulho", "mermao", "ta ligado", "rage quit" (maximo 1 giria marcante a cada 2-3 paragrafos).
- FALE COM O LEITOR: "voce", "teu setup", "bora ver?", "vai encarar?". Faca perguntas retoricas.
- NUNCA: voz passiva, emojis, "Alem disso...", "E importante notar que...", termos corporativos.`;

const SEG_STYLE_FACTUAL = `PERSONA: redator tecnico especializado em {{DOMINIO}} do Promo Gamer. Guias e reviews com precisao e profundidade.
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
- Use numero, data ou beneficio concreto: "10 Melhores X em ${ANO_ATUAL}", "X vs Y: Qual Vale a Pena".
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
  let fm = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const out = await fetchLLM(sys, user, 3, { maxTokens: 512, temperature: 0.7 });
    try {
      fm = parseFrontmatter(out).frontmatter;
    } catch {
      log("WARN", `Frontmatter segmentado sem separador --- — tentando parse tolerante (tentativa ${attempt}/2)`);
      const clean = out.replace(/^[\s\S]*?---\s*/m, "").split(/\n---\s*/)[0].trim();
      fm = parseRaw(clean);
    }
    if (fm && String(fm.description || "").length >= 120) return normalizeFrontmatterYears(fm);
    log("WARN", `Description curta (${String(fm?.description || "").length} chars) — regenerando frontmatter (${attempt}/2)`);
  }
  if (fm) {
    log("WARN", "Estendendo description ate o minimo de 120 caracteres");
    fm.description = extendDescription(fm.description, topic.hint, primaryKeyword);
  }
  return normalizeFrontmatterYears(fm);
}

// Correcao deterministica pos-LLM: troca qualquer ano fora de ANOS_VALIDOS
// (ex.: "2024" escrito por habito do modelo) pelo ano corrente. E aqui, nao no
// prompt, que a garantia realmente existe — prompt e pedido, isto e regra.
function normalizeFrontmatterYears(fm) {
  if (!fm || typeof fm !== "object") return fm;
  if (fm.title) {
    const corrigido = normalizarAnos(fm.title);
    if (corrigido !== fm.title) log("WARN", `Ano corrigido no titulo: "${fm.title}" -> "${corrigido}"`);
    fm.title = corrigido;
  }
  if (fm.description) fm.description = normalizarAnos(fm.description);
  return fm;
}

// Garante description com 120-160 caracteres no frontmatter (validador exige min 120).
function extendDescription(cur, hint, primaryKeyword) {
  const base = String(cur || "").trim().replace(/\*+/g, "");
  if (base.length >= 120) return base.slice(0, 160).trim();
  const kw = primaryKeyword || hint || `os melhores produtos em ${ANO_ATUAL}`;
  const head = base && base.length >= 40 ? base : `${kw.charAt(0).toUpperCase()}${kw.slice(1)} em ${ANO_ATUAL}.`;
  let d = `${head} Compare custo-beneficio, leia os destaques e o veredito e descubra qual modelo entrega mais pelo seu dinheiro para escolher sem errar.`;
  if (d.length < 120) d += " Analise completa com pros e contras de cada opcao do guia.";
  return d.slice(0, 160).trim();
}

// Extrai tagline/corpo/nota/destaque do texto bruto do blurb (formato TAGLINE:/CORPO:).
function parseBlurb(out) {
  const tagline = (out.match(/^TAGLINE:\s*(.+)$/m) || [])[1]?.trim() || "";
  // NOTA da LLM nao alimenta mais a tabela (a nota do consumidor, 0-5, vem do
  // rating real do produto) — o campo so e mantido aqui por compatibilidade de
  // parsing, sem uso downstream.
  let nota = Number((out.match(/^NOTA:\s*(\d+(?:[.,]\d+)?)/m) || [])[1]?.replace(",", "."));
  if (!Number.isFinite(nota) || nota < 0 || nota > 5) nota = null;
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

// TAREFA 5.5: reforco no prompt para o artigo tratar SO da categoria dele.
function categoriaUnicaPrompt(articleCat) {
  if (!articleCat || !PRODUCT_CATEGORIES[articleCat]) return "";
  return `## CATEGORIA UNICA
Este artigo e exclusivamente sobre: ${PRODUCT_CATEGORIES[articleCat].label}.
NUNCA cite, recomende ou descreva produto de outra categoria (mouse, headset, monitor, kit, combo)
a nao ser como acessorio complementar mencionado de passagem no Veredito.

`;
}

// 1 chamada POR produto: descreve SO este item, sem preco, sem heading, sem botao.
async function generateProductBlurb({ product, topic, domain, categoria, index, articleCat }) {
  const estilo = segStyle(categoria, domain);
  const sys = `Voce escreve a descricao de UM UNICO produto para um blog gamer brasileiro. ${estilo}

${categoriaUnicaPrompt(articleCat)}
## O QUE VOCE GERA (somente texto, sem heading)
1. "TAGLINE:" — uma frase curta (2-6 palavras) que vira o subtitulo do item. Destaque o diferencial do produto com a persona escolhida. Nao use aspas.
2. "CORPO:" — 2 a 3 paragrafos curtos (60-110 palavras no total) sobre APENAS este produto. Sem lista, sem bullets.
3. "DESTAQUE:" — o diferencial do produto em ate 8 palavras.

## REGRAS ABSOLUTAS
- NUNCA escreva preco, "R$", card, botao, "confira o preco", nem mencione tabela ou comparativo.
- NUNCA use "#" nem markdown de titulo. Paragrafos separados por linha em branco.
- NUNCA compare com outros produtos nem fale de marcas concorrentes.
- NUNCA invente especificacao numerica (GHz, GB, W, fps, cores, DPI, sensor). Use APENAS as que vierem no bloco "Detalhes do produto (fonte de verdade)" — se ele nao existir, fale de categoria, uso, publico-alvo e do que o proprio nome afirma.
- Nao repita o nome do produto mais de 2 vezes.
- O nome do produto citado no texto precisa bater com o titulo recebido (mesmo modelo).`;

  const detalhes = [];
  if (product.brand) detalhes.push(`Marca: ${product.brand}`);
  if (Array.isArray(product.specs) && product.specs.length) {
    detalhes.push(`Especificacoes: ${product.specs.map((s) => `${s.key}: ${s.value}`).join("; ")}`);
  }
  if (product.description) detalhes.push(`Descricao: ${product.description}`);
  const blocoDetalhes = detalhes.length ? `\nDetalhes do produto (fonte de verdade):\n${detalhes.join("\n")}` : "";

  const user = `Produto ${index}: ${product.title}\nTopico do artigo: ${topic.hint}${blocoDetalhes}`;
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

// 1 chamada: intro SEM H2, a linha [LISTA], e as secoes finais. Nao escreve
// os itens (o sistema monta) nem a tabela comparativa (o sistema monta) nem o
// heading da lista (o sistema gera em codigo a partir do marcador [LISTA]).
async function generateMainBody({ mlProducts, topic, domain, categoria, researchContext, internalLinksBlock, primaryKeyword, mainMinWords, articleCat, feedback = "" }) {
  const estilo = segStyle(categoria, domain);
  const productLines = mlProducts
    .map((p, i) => `${i + 1}. ${p.title}${p.price ? ` (${formatPriceBRL(p.price)})` : ""}`)
    .join("\n");
  const sys = `Voce e redator senior de um blog gamer brasileiro. Escreve UMA PARTE de um artigo de produtos: a introducao, o heading da lista e as secoes finais. O sistema monta os itens e a tabela comparativa.

${estilo}

${categoriaUnicaPrompt(articleCat)}
## DOMINIO UNICO
Este artigo e APENAS sobre ${domainLabel(domain)}. Nunca misture games e hardware.

## ESTRUTURA EXATA (em ordem)
1. INTRODUCAO SEM H2: 1-2 paragrafos com gancho direto. Nos primeiros 2-3 paragrafos, resuma em 2 frases os criterios que definem os itens (o que diferencia um bom item). NAO crie secao ## para isso.
2. A LINHA "[LISTA]" SOZINHA em uma linha, logo apos a introducao. NAO escreva "## Os ... Melhores" nem nenhum outro heading ##: o sistema gera o heading da lista em codigo e o substitui por "[LISTA]". Apos essa linha, NAO escreva mais nada na secao: o sistema insere os itens e a tabela ali.
3. "## Veredito" (ou "## Qual X Escolher?"): bullets por perfil de usuario — nunca "depende do orcamento".
4. "## FAQ": 3-4 perguntas que as pessoas pesquisam no Google sobre o tema.
5. "## Quer mais ofertas?": "Entre para o nosso [grupo VIP no Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) e receba ofertas diarias de ${domain === "hardware" ? "perifericos e hardware gamer" : "games e consoles"}!"
6. "## Fontes": os links da pesquisa fornecida.
7. "## Continue Explorando": 2-3 links internos SOMENTE dos slugs fornecidos, formato [texto](/blog/slug-do-artigo/).

## MARCADORES DE IMAGEM
- [IMG:Nome] em linha sozinha ANTES de cada heading ## das secoes 3 a 7 (pelo menos 2 delas). Ex: [IMG:Setup Gamer], [IMG:Perguntas Frequentes]. NUNCA em linhas de itens (nao existem no seu texto) nem antes de "[LISTA]".

## REGRAS DE CONTEUDO
- GROUNDING: todo dado concreto (spec, data, numero, nota) vem da pesquisa fornecida. Se nao esta la, use "segundo rumores"/"ainda sem confirmacao".
- Minimo ${mainMinWords} palavras no total do que voce escreve. Paragrafos com frases de tamanhos variados.
- Voce pode citar um produto pelo nome no texto corrido, mas NUNCA com preco e NUNCA como heading ##.
- NUNCA escreva "R$" nem preco de produto listado.
- NUNCA diga "confira no card" — os itens tem botao "VER NO MERCADO LIVRE". Se precisar, diga "confira o preco atual no Mercado Livre".
- NUNCA deixe secao ## vazia ou sem conteudo abaixo dela.
- NUNCA escreva "## Comparativo" nem a linha "[LISTA]" mais de uma vez, nem use [PRODUTO:N].
- Jogos/produtos citados pela primeira vez em **negrito**.
- Emojis, voz passiva, termos corporativos: proibido.

## PRODUTOS (cite naturalmente; nunca como heading, nunca com preco)
${productLines}

## VEREDITO BASEADO EM DADOS
O "## Veredito" deve refletir EXATAMENTE a ordem e as notas do RANKING OBJETIVO enviado na mensagem do usuario (o item 1 e o campeao). NUNCA afirme que um produto e superior a outro sem se apoiar nos criterios objetivos: nota media e volume de avaliacoes de consumidores, mencões em reviews independentes, reputacao da marca e custo-beneficio. Se um item entrou sem criterios objetivos, diga isso de forma honesta — nunca invente nota nem motivo.

## SAIDA
Somente o markdown das secoes acima, na ordem. Sem frontmatter, sem comentario.`;

  const rankingBlock = mlProducts.length > 0
    ? `\n\nRANKING OBJETIVO (use no Veredito, nao invente outra ordem nem outra nota — a ordem ja reflete o score interno, NAO exiba esse score, so a nota do consumidor abaixo):\n${mlProducts
        .map((p, i) => {
          const nota = Number.isFinite(Number(p.rating)) && Number(p.rating) > 0
            ? `${formatRating5(p.rating)}/5${Number(p.ratingCount) > 0 ? ` (${Math.round(Number(p.ratingCount))} avaliacoes)` : ""}`
            : "sem nota de consumidor";
          const motivos = Array.isArray(p.criteriosAtendidos) && p.criteriosAtendidos.length > 0
            ? p.criteriosAtendidos.join(", ")
            : "sem criterios objetivos";
          return `${i + 1}. ${p.title} — nota ${nota} (${motivos})`;
        })
        .join("\n")}`
    : "";

  let user = `${topic.hint ? `Escreva a parte do artigo sobre: ${topic.hint}\n\n` : ""}${
    researchContext ? `PESQUISA (use estes fatos — nao invente dados fora daqui):\n${researchContext}\n\n` : "SEM PESQUISA DISPONIVEL: escreva so conhecimento consolidado, sem inventar numeros, datas ou precos.\n\n"
  }${rankingBlock}${internalLinksBlock}${feedback}`;

  // Evita o 413 do Groq (prompt + max_tokens estourando a TPM) que forcaria o
  // fallback para o OpenAI e costuma entregar conteudo curto. Se o orcamento de
  // saida ficar apertado, encolhe a pesquisa (como ja feito no fluxo de chamada
  // unica) em vez de derrubar o request inteiro.
  let mctxMax = computeMaxTokens(sys, user);
  while (mctxMax < MIN_OUTPUT && researchContext && researchContext.length > 800) {
    researchContext = researchContext.slice(0, Math.floor(researchContext.length * 0.75));
    user = `${topic.hint ? `Escreva a parte do artigo sobre: ${topic.hint}\n\n` : ""}PESQUISA (use estes fatos — nao invente dados fora daqui):\n${researchContext}\n\n${rankingBlock}${internalLinksBlock}${feedback}`;
    mctxMax = computeMaxTokens(sys, user);
    log("WARN", `Pesquisa do corpo segmentado reduzida para caber no limite de ${TOKEN_BUDGET} TPM (saida ~${mctxMax} tokens)`);
  }
  const maxTokens = Math.max(3000, mctxMax);
  return fetchLLM(sys, user, 3, { maxTokens: Math.min(maxTokens, MAX_OUTPUT), temperature: 0.7 });
}

// Marcador do heading da lista no fluxo segmentado: a LLM escreve "[LISTA]"
// (sozinho, em uma linha) no lugar do heading; o sistema o substitui por um
// heading deterministico. Nada de posicionamento fica a criterio da IA.
const LISTA_MARKER = "[LISTA]";

// Heading da lista gerado em codigo — nunca vem da LLM. A IA so escreve intro,
// [LISTA] e as secoes finais; o titulo da secao principal e regra, nao pedido.
function buildListHeading(mlProducts, primaryKeyword, topic) {
  const n = mlProducts.length;
  const stop = new Set(["os", "as", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos", "para", "com", "em", "na", "no", "nas", "nos", "melhores", "melhor", "top", "guia", "review", "o", "a", "e", "melhor", "melhores"]);
  const kw = String(primaryKeyword || topic?.hint || "itens")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w) && !/^\d{4}$/.test(w))
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const base = kw ? ` ${kw}` : "";
  return normalizarAnos(`Os ${n} Melhores${base} em ${ANO_ATUAL}`);
}

// Separa o corpo principal em intro / heading da lista / resto.
function splitMainBody(mainBody) {
  if (typeof mainBody !== "string" || !mainBody.trim()) return null;

  // Contrato atual: a LLM escreve "[LISTA]" sozinho em uma linha. O heading e
  // gerado em codigo depois (buildListHeading) — listHeading vem null aqui.
  const marker = mainBody.match(/^\[LISTA\]\s*$/m);
  if (marker) {
    const intro = mainBody.slice(0, marker.index).trim();
    // H2 antes do marcador = estrutura invalida (intro deve ser SEM heading).
    if (/^##\s/m.test(intro)) return null;
    return {
      intro,
      listHeading: null,
      rest: mainBody.slice(marker.index + marker[0].length).trim(),
    };
  }

  // Tolerancia com o contrato antigo (primeira linha ## valida).
  const m = mainBody.match(/^##\s+([^\n]+)\n([\s\S]*)$/m);
  if (!m) return null;
  const listHeading = normalizarAnos(m[1].trim());
  if (/^(veredito|qual\s|faq|perguntas\s+frequentes|fontes|quer\s+mais|continue\s+explorando|comparativo|conclus)/i.test(listHeading)) {
    return null;
  }
  return {
    intro: mainBody.slice(0, m.index).trim(),
    listHeading,
    rest: m[2].trim(),
  };
}

// TAREFA 6.3.3: secao de metodologia gerada por template (deterministica),
// injetada entre a introducao e o heading da lista. Da credibilidade ao "Top 5".
function buildMetodologiaSection() {
  return `## Como Escolhemos\n\nEsta lista nao e aleatoria. Todo modelo precisou passar por um piso de elegibilidade antes de ser avaliado:\n\n` +
    `- **Preco plausivel** — nem muito abaixo (risco de anuncio errado/acessorio) nem muito acima da mediana da categoria.\n` +
    `- **Avaliacoes de consumidores reais** — nota minima e volume de avaliacoes que sustentam a nota.\n` +
    `- **Identidade reconhecivel** — marca e/ou modelo identificaveis, nunca um anuncio generico.\n\n` +
    `Quem passou por esse piso foi entao ranqueado por: nota media e volume de avaliacoes, consenso editorial (presenca em reviews e rankings independentes consultados nesta pesquisa), reputacao da marca, aderencia as especificacoes que importam na categoria e custo-beneficio frente a mediana. Um produto caro nao entra so por ser caro, e um barato nao entra so por ser barato — o equilibrio entre os criterios decide.\n\n` +
    `Modelos que nao atenderam ao piso minimo ficaram de fora.\n`;
}

// Nota do consumidor, escala 0-5 (a mesma do Mercado Livre e da maioria das
// lojas BR). Vírgula decimal (pt-BR), nunca "/10" nem numero > 5 — ver
// scripts/product_ranking.mjs e scripts/google_shopping.mjs para a
// normalizacao na entrada.
function formatRating5(rating) {
  const r = Math.min(5, Math.max(0, Number(rating) || 0));
  return r.toFixed(1).replace(".", ",");
}

function buildComparativoTable(mlProducts) {
  const rows = mlProducts
    .map((p) => {
      const rating = Number(p.rating);
      const nota = Number.isFinite(rating) && rating > 0 ? `${formatRating5(rating)}/5` : "—";
      const ratingCount = Number(p.ratingCount);
      const avaliacoes = Number.isFinite(ratingCount) && ratingCount > 0 ? String(Math.round(ratingCount)) : "—";
      // TAREFA 6.3.4: coluna "Por que entrou" torna o ranking auditavel.
      const motivo = Array.isArray(p.criteriosAtendidos) && p.criteriosAtendidos.length > 0
        ? p.criteriosAtendidos.join(" · ")
        : "—";
      return `| ${p.title} | ${formatPriceBRL(p.price)} | ${p.destaque || "—"} | ${nota} | ${avaliacoes} | ${motivo} |`;
    })
    .join("\n");
  return `## Comparativo\n\n| Produto | Preco | Destaque | Nota | Avaliacoes | Por que entrou |\n|---|---|---|---|---|---|\n${rows}\n`;
}

function buildItemSection(p) {
  const img = buildProductImageTag(p);
  const btn = buildProductButtonHtml(p);
  const tagline = p.tagline ? ` — ${p.tagline}` : "";
  const text = p.blurbText || `O ${p.title} aparece entre os destaques desta lista.`;
  const imgBlock = img ? `${img}\n\n` : "";
  const btnBlock = btn ? `\n\n${btn}` : "";
  return `### ${p.title}${tagline}\n\n${imgBlock}${text}${btnBlock}`;
}

// Injeta os itens (foto local + paragrafos + botao), a secao de metodologia e a
// tabela comparativa logo apos o heading da lista. Deterministico: nada fica a
// criterio da LLM. withMetodologia injeta "## Como Escolhemos" entre a
// introducao e o heading da lista.
function injectSegmentedItems(body, listHeading, mlProducts, withMetodologia = false) {
  const itemBlock = mlProducts.map((p) => buildItemSection(p)).join("\n\n");
  const table = buildComparativoTable(mlProducts);
  const marker = `## ${listHeading}`;
  const metodologia = withMetodologia ? `${buildMetodologiaSection()}\n\n` : "";
  const idx = body.indexOf(marker);
  if (idx === -1) {
    log("WARN", "Heading da lista nao encontrado no corpo — itens anexados no fim");
    return `${body}\n\n${metodologia}${itemBlock}\n\n${table}`;
  }
  const after = idx + marker.length;
  return `${body.slice(0, idx)}${metodologia}${body.slice(idx, after)}\n\n${itemBlock}\n\n${table}${body.slice(after)}`;
}

// Pipeline segmentado completo: frontmatter + blurbs + corpo + assembleia.
async function generateSegmentedArticle({ mlProducts, topic, domain, categoria, primaryKeyword, researchContext, internalLinksBlock, today, minWords, articleCat }) {
  const fm = await generateArticleFrontmatter({ topic, domain, categoria, primaryKeyword, productCount: mlProducts.length, today });
  if (!fm) throw new Error("Frontmatter segmentado falhou");

  for (let i = 0; i < mlProducts.length; i++) {
    const b = await generateProductBlurb({ product: mlProducts[i], topic, domain, categoria, index: i + 1, articleCat });
    mlProducts[i].tagline = b.tagline;
    mlProducts[i].blurbText = b.text;
    // A nota da tabela e SEMPRE a nota do consumidor (p.rating, escala 0-5,
    // vinda da fonte do produto) — a LLM nao inventa nota. Ver buildComparativoTable.
    mlProducts[i].destaque = b.destaque;
    log("INFO", `Blurb ok (${i + 1}/${mlProducts.length}): "${mlProducts[i].title?.slice(0, 45)}"`);
  }

  const mainMinWords = Math.max(450, Math.round(minWords * 0.8));
  // Piso do que a LLM precisa escrever (intro + secoes finais). Os itens e a
  // tabela sao gerados em codigo depois; se o texto da LLM vier curto demais,
  // mesmo somado aos itens o artigo nao atera o minimo do gate — entao regera.
  const MIN_CORPO_LLM = Math.max(350, Math.round(mainMinWords * 0.8));
  let parts = null;
  let feedback = "";
  for (let attempt = 1; attempt <= 2 && !parts; attempt++) {
    try {
      const raw = await generateMainBody({ mlProducts, topic, domain, categoria, researchContext, internalLinksBlock, primaryKeyword, mainMinWords, articleCat, feedback });
      if (temFocoMisto(raw)) {
        if (attempt === 1) {
          feedback = `\n\nREGRA DE DOMINIO VIOLADA: voce misturou games e hardware no mesmo texto. Este artigo e APENAS sobre ${domainLabel(domain)}. Escolha APENAS UM dos lados, remova TODO o conteudo do outro dominio (no maximo uma mencao de passagem como exemplo de uso) e reescreva o texto inteiro, mantendo o minimo de ${mainMinWords} palavras.`;
          log("WARN", `Corpo principal mistura dominios (games+hardware) — regenerando (tentativa ${attempt}/2)`);
          continue;
        }
        log("WARN", "Corpo principal ainda com dominio misto na 2a tentativa — publicando com ressalva (portao soft)");
      }
      parts = splitMainBody(raw);
      if (!parts) {
        if (attempt === 1) {
          feedback = "\n\nESTRUTURA INVALIDA: seu texto nao tinha a linha [LISTA] sozinha (exigida na ESTRUTURA EXATA, logo apos a introducao). Reescreva com [LISTA] em uma linha sozinha, com o minimo de " + mainMinWords + " palavras.";
          log("WARN", `Corpo principal sem marcador [LISTA] (tentativa ${attempt}/2) — regenerando`);
          continue;
        }
        log("WARN", `Corpo principal sem marcador [LISTA] na 2a tentativa — usando estrutura minima`);
      } else {
        // Conteudo curto: a LLM nao cumpriu o minimo. Regenera com feedback
        // claro na 1a tentativa em vez de aceitar um corpo minúsculo que o
        // gate de revisao rejeitaria (causa de dias sem publicar).
        const llmWords = `${parts.intro} ${parts.rest}`.split(/\s+/).filter(Boolean).length;
        if (attempt === 1 && llmWords < MIN_CORPO_LLM) {
          feedback = `\n\nSEU TEXTO FICOU CURTO: voce escreveu ${llmWords} palavras, mas o minimo e ${mainMinWords} (alvo ${Math.round(mainMinWords * 0.9)}). Expanda a introducao, o Veredito e o FAQ com conteudo real e util para o leitor (nao encha linguiça, escreva paragrafos substantivos com dados da pesquisa). Reescreva o texto inteiro mantendo a estrutura [LISTA].`;
          log("WARN", `Corpo principal curto (${llmWords}/${MIN_CORPO_LLM} palavras) — regenerando (tentativa ${attempt}/2)`);
          parts = null;
          continue;
        }
      }
    } catch (e) {
      log("WARN", `Corpo principal falhou (tentativa ${attempt}/2): ${e.message}`);
    }
  }
  if (!parts) {
    const fallbackKw = (topic.hint || primaryKeyword || "").split(" ").slice(0, 3).join(" ");
    parts = {
      intro: `Fala, gamer! Bora conferir quais ${fallbackKw} valem a pena em ${ANO_ATUAL} — a lista considera o que entrega mais por real, o que segura o tranco no dia a dia e o que a galera anda comprando.`,
      listHeading: buildListHeading(mlProducts, primaryKeyword, topic),
      rest: "",
    };
    log("WARN", "Usando corpo principal fallback (estrutura minima)");
  }
  if (!parts.listHeading) {
    parts.listHeading = buildListHeading(mlProducts, primaryKeyword, topic);
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
  generateArticle,
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
  buildListHeading,
  LISTA_MARKER,
  temFocoMisto,
  dominiosNoTexto,
  classifyDomain,
  parseBlurb,
  buildMetodologiaSection,
  buildComparativoTable,
  buildItemSection,
  injectSegmentedItems,
  sanitizeProductQuery,
  normalizarAnosBody,
  injectHeadingAnchors,
  validateSourceCoverage,
  formatProductPriceForPrompt,
  stripLeftoverMarkers,
  extractGameNames,
  checkTitle,
  capitalizeTitle,
  extendDescription,
  validate,
  findPricesInBody,
  stripPricesFromBody,
  keywordTokensMatch,
  corrigirPeloGate,
  montarMarkdown,
  removeEmptySections,
  ajustarDescription,
  ajustarTags,
  parseFrontmatter,
  DEFAULT_COVER_BY_PRODUCT_CATEGORY,
  DEFAULT_COVER_GENERIC,
  computeMaxTokens,
  MIN_WORDS,
  GENERIC_TITLE_PATTERNS,
  shouldAbortProductSourcing,
  resolverAfiliados,
  progressiveGameQueries,
  fetchRAWGImage,
  fetchTavilyImage,
  isFragileImageUrl,
  ensureListStructure,
  buildGamesListHeading,
  extractListItemTitles,
  extractSubsectionItemNames,
  tituloSemelhante,
  montarQueryPesquisa,
};
