import "dotenv/config";
import fs from "fs";
import path from "path";
import { searchML, generateAffiliateLink } from "./ml_affiliate.mjs";

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
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(clean)}&page_size=1`,
      { timeout: 10000 }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const bg = data.results?.[0]?.background_image;
    if (bg) {
      try {
        const headRes = await fetch(bg, { method: "HEAD", timeout: 5000 });
        if (headRes.ok) {
          GAME_IMAGE_CACHE[gameName] = bg;
          log("INFO", `RAWG imagem "${gameName.slice(0, 40)}": ${bg.slice(0, 60)}...`);
          return bg;
        }
      } catch {}
    }
  } catch (e) {
    log("WARN", `RAWG erro "${gameName.slice(0, 40)}": ${e.message}`);
  }
  return null;
}

function extractGameNames(body) {
  const found = body.match(/\*\*([^*]+)\*\*/g);
  if (!found) return [];
  const seen = new Set();
  const result = [];
  for (const match of found) {
    const name = match.replace(/^\*\*|\*\*$/g, "").trim();
    if (name && name.length > 3 && !name.startsWith("http") && !name.startsWith("R$")) {
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
    const re = new RegExp(`\\*\\*${escaped}\\*\\*`, "g");
    if (re.test(result)) {
      result = result.replace(
        new RegExp(`\\*\\*${escaped}\\*\\*`),
        `**${name}**\n<img src="${imgUrl}" alt="${name}" class="article-game-img">`
      );
    }
  }
  return result;
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
      search_depth: "basic", max_results: 5,
      topic: "general", include_answer: true,
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
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 8192,
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
  const today = new Date().toISOString().split("T")[0];
  const totalArticles = countArticlesInDir();
  log("INFO", `Total artigos: ${totalArticles}`);

  if (state.last_success === today) {
    log("INFO", "Artigo ja gerado com sucesso hoje, pulando");
    process.exit(0);
  }

  if (state.consecutive_failures > 0) {
    log("INFO", `${state.consecutive_failures} falhas consecutivas anteriores, tentando novamente`);
  }

  const topic = pickTopic(getCategoryCounts());
  log("INFO", `Tema: ${topic.category} - ${topic.hint}`);

  let researchContext = "";
  try {
    const sr = await fetchTavily(`${topic.hint} Brasil 2026`);
    researchContext = sr?.results
      .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 1200)}`)
      .join("\n\n");
  } catch (err) {
    log("WARN", `Tavily: ${err.message}`);
  }

  let mlProducts = [];
  if (ML_CLIENT_ID && ML_CLIENT_SECRET) {
    try {
      mlProducts = await searchML(topic.ml_query, ML_CLIENT_ID, ML_CLIENT_SECRET, TAVILY_API_KEY, ML_COOKIES_PATH, 4);
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

  const productBlock = mlProducts.length > 0
    ? `\nProdutos do Mercado Livre (use imagens e links obrigatoriamente):\n${mlProducts.map((p, i) =>
        `[Produto ${i + 1}]\n` +
        `Nome: ${p.title}\n` +
        `Preco: R$ ${p.price?.toFixed(2) || "N/A"}\n` +
        `Imagem: ${p.thumbnail}\n` +
        `Link Mercado Livre: ${p.affiliate_link || p.permalink}\n`
      ).join("\n")}`
    : "";

  const systemPrompt = `Voce e um redator especializado em videogames do Blog Gamer, site brasileiro. Escreva em portugues brasileiro, tom natural de gamer.

Regras:
- Artigo: MINIMO 1200 palavras (obrigatorio)
- IMPORTANTE: NUNCA invente URLs de imagens (ex: wikipedia, google). Apenas mencione jogos em **negrito** que o sistema insere imagens automaticamente.
- Sempre que citar um jogo pela PRIMEIRA vez, use **Nome Do Jogo** em negrito. Ex: "**EA Sports FC 26** e um dos melhores..."
- ${mlProducts.length > 0 ? `Para produtos do Mercado Livre, use: <img src="URL_IMAGEM" alt="NOME" class="product-image"> e botoes: <a href="LINK_AFILIADO" class="btn btn-primary" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>` : "Modo informativo: artigo de conteudo puro. Nao invente produtos, precos, links de compra, ou URLs de imagens. Use APENAS **negrito** nos nomes de jogos."}
- Subtitulos DEVEM usar ##, NUNCA **negrito** como subtitulo
- Cite as fontes de pesquisa no final do artigo: "## Fontes" com links
- NUNCA mencione que e IA. NUNCA use emojis.
- Saida EXATA: frontmatter YAML entre "---" e fechando com "---" depois o conteudo markdown

Frontmatter obrigatorio:
title: "Titulo SEO"
description: "Descricao curta (120-160 caracteres)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: ${mlProducts.length > 0}

category DEVE ser: noticia, review, guia, lista ou promocao`;

  let userPrompt = `Escreva um artigo sobre "${topic.hint}".

${researchContext ? `Fontes de pesquisa:\n${researchContext}\n` : ""}
${productBlock}

Instrucoes:
1. Titulo SEO atraente
2. Descricao persuasiva (120-160 caracteres no minimo)
3. Artigo markdown com subtitulos ## (NUNCA usar **negrito** no lugar de ## — use ## para TODOS os subtitulos)
${mlProducts.length > 0 ? "4. Use as imagens dos produtos com <img src=\"https://...\" alt=\"NOME\" class=\"product-image\"> (sempre https://)\n5. Para cada produto mencionado, coloque um botao \"VER NO MERCADO LIVRE\" com o link de afiliado" : "4. USE **NEGRITO** nos nomes de jogos na primeira mencao. NAO invente tags <img> — o sistema insere imagens automaticamente.\n5. NAO invente links de compra nem URLs de imagens (wikipedia, google, etc)"}
6. No final, crie secao "## Fontes" com links das fontes pesquisadas
7. 5 tags
8. Dicas praticas`;

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
  if (coverImage) {
    fm.image = coverImage;
    log("INFO", `Imagem de capa: ${coverImage.slice(0, 80)}`);
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
affiliate: true
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
