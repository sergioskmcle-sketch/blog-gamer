import "dotenv/config";
import fs from "fs";
import path from "path";
import { searchML } from "./ml_affiliate.mjs";

const ARTIGOS_DIR = path.resolve("src/content/artigos");

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
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

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

async function fetchGroq(systemPrompt, userPrompt, retries = 3) {
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
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log("INFO", `Groq: tentativa ${attempt}/${retries}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        const wait = attempt * 30;
        log("WARN", `Groq: quota excedida, aguardando ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      if (!data.choices?.[0]?.message?.content)
        throw new Error(`Groq: resposta vazia: ${JSON.stringify(data).slice(0, 200)}`);
      return data.choices[0].message.content;
    } catch (err) {
      if (attempt === retries) throw err;
      log("WARN", `Groq: erro na tentativa ${attempt}, retentando...`);
      await sleep(5000);
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

function getLastArticleDate() {
  if (!fs.existsSync(ARTIGOS_DIR)) return null;
  const files = fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return null;
  let latest = null;
  for (const f of files) {
    const c = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
    const m = c.match(/pubDate:\s*(.+)/);
    if (m) {
      const d = new Date(m[1].replace(/["']/g, ""));
      if (!latest || d > latest) latest = d;
    }
  }
  return latest;
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

  const lastDate = getLastArticleDate();
  if (lastDate) {
    const hours = (Date.now() - lastDate.getTime()) / 36e5;
    log("INFO", `Ultimo artigo: ${lastDate.toISOString().split("T")[0]} (${Math.round(hours)}h atras)`);
    if (hours < 24) {
      log("INFO", "Menos de 24h, pulando");
      process.exit(0);
    }
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
      mlProducts = await searchML(topic.ml_query, ML_CLIENT_ID, ML_CLIENT_SECRET, TAVILY_API_KEY, 4);
      for (const p of mlProducts) {
        p.affiliate_link = p.permalink;
      }
    } catch (err) {
      log("WARN", `ML Search: ${err.message}`);
    }
  } else {
    log("WARN", "ML_CLIENT_ID/ML_CLIENT_SECRET nao configurados — pulando busca de produtos ML");
  }

  const today = new Date().toISOString().split("T")[0];

  const productBlock = mlProducts.length > 0
    ? `\nProdutos do Mercado Livre (use imagens e links obrigatoriamente):\n${mlProducts.map((p, i) =>
        `[Produto ${i + 1}]\n` +
        `Nome: ${p.title}\n` +
        `Preco: ${p.price > 0 ? `R$ ${p.price?.toFixed(2)}` : "Consulte o Mercado Livre"}\n` +
        `Imagem: ${p.thumbnail || "https://http2.mlstatic.com/storage/logos-api-admin/bb29e270-15bb-11ec-b3b7-63775c9d0a6b-m.svg"}\n` +
        `Link Mercado Livre: ${(p.affiliate_link || p.permalink) + "?tag=sergioskm"}\n`
      ).join("\n")}`
    : "";

  const systemPrompt = `Voce e um redator especializado em videogames do Blog Gamer, site brasileiro. Escreva em portugues brasileiro, tom natural de gamer.

Regras:
- Artigo: MINIMO 1200 palavras (obrigatorio)
- Inclua imagens dos produtos usando <img src="URL_IMAGEM" alt="NOME_PRODUTO" class="product-image"> (URL deve comecar com https://)
- Inclua botoes "VER NO MERCADO LIVRE" com link de afiliado: <a href="LINK_AFILIADO" class="btn btn-primary" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>
- Subtitulos DEVEM usar ##, NUNCA **negrito**
- Cite as fontes de pesquisa no final do artigo: "## Fontes" com links
- NUNCA mencione que e IA
- Saida EXATA: frontmatter YAML entre "---" e fechando com "---" depois o conteudo markdown

Frontmatter obrigatorio:
title: "Titulo SEO"
description: "Descricao curta (120-160 caracteres)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: true

category DEVE ser: noticia, review, guia, lista ou promocao`;

  let userPrompt = `Escreva um artigo sobre "${topic.hint}".

${researchContext ? `Fontes de pesquisa:\n${researchContext}\n` : ""}
${productBlock}

Instrucoes:
1. Titulo SEO atraente
2. Descricao persuasiva (120-160 caracteres no minimo)
3. Artigo markdown com subtitulos ## (NUNCA usar **negrito** no lugar de ## — use ## para TODOS os subtitulos)
4. Use as imagens dos produtos com <img src="https://..." alt="NOME" class="product-image"> (sempre https://)
5. Para cada produto mencionado, coloque um botao "VER NO MERCADO LIVRE" com o link de afiliado
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

  const slug = slugify(fm.title);
  const published = fs.existsSync(ARTIGOS_DIR)
    ? fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
    : [];

  if (published.includes(slug)) {
    log("ERROR", `Slug duplicado: ${slug}`);
    process.exit(0);
  }

  const markdown = `---
title: "${fm.title}"
description: "${fm.description}"
pubDate: ${today}
tags: [${fm.tags.map((t) => `"${t.trim()}"`).join(", ")}]
category: "${fm.category}"
affiliate: true
image: "${mlProducts[0]?.thumbnail || "https://rockstarintel.com/wp-content/uploads/2026/06/VINTAGE_VICE_CITY_PACK_EXCLUSIVE_LOOKS_03_1280.webp"}"
---

${body}
`;

  const fp = path.join(ARTIGOS_DIR, `${slug}.md`);
  fs.writeFileSync(fp, markdown, "utf-8");
  log("INFO", `Artigo salvo: ${slug}.md`);
  log("INFO", "=== CONCLUIDO ===");
}

main().catch((err) => {
  log("ERROR", err.message);
  process.exit(1);
});
