import fs from "fs";
import path from "path";

const ARTIGOS_DIR = path.resolve("src/content/artigos");

const CATEGORIES = [
  { slug: "noticia", name: "Notícia" },
  { slug: "review", name: "Review" },
  { slug: "guia", name: "Guia de Compra" },
  { slug: "lista", name: "Lista" },
  { slug: "promocao", name: "Promoção" },
];

const TOPIC_SEEDS = [
  { category: "noticia", hint: "lancamento de game, evento de games, anuncio de console, placa de video" },
  { category: "review", hint: "review de jogo popular, analise de gameplay, dicas de jogo" },
  { category: "guia", hint: "melhores headsets gamers, teclado mecanico, mouse gamer, monitor, cadeira" },
  { category: "lista", hint: "melhores jogos para PC, jogos gratis, jogos multiplayer, jogos estilo" },
  { category: "promocao", hint: "promocoes Steam, ofertas de games, descontos em perifericos gamers" },
];

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

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
  log("INFO", `Tavily: buscando "${query}"`);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 4,
      topic: "general",
      include_answer: true,
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
    max_tokens: 4096,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log("INFO", `Groq: tentativa ${attempt}/${retries}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
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

      if (!data.choices?.[0]?.message?.content) {
        throw new Error(
          `Groq: resposta vazia: ${JSON.stringify(data).slice(0, 200)}`
        );
      }

      return data.choices[0].message.content;
    } catch (err) {
      if (attempt === retries) throw err;
      log("WARN", `Groq: erro na tentativa ${attempt}, retentando...`);
      await sleep(5000);
    }
  }
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Frontmatter nao encontrado");

  const raw = match[1];
  const body = match[2].trim();
  const fm = {};

  for (const line of raw.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 2).trim();

    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    if (val === "true") val = true;
    if (val === "false") val = false;

    fm[key] = val;
  }

  return { frontmatter: fm, body };
}

function validate(fm, body) {
  const errors = [];
  if (!fm.title || String(fm.title).length < 10) errors.push("title: muito curto");
  if (!fm.description || String(fm.description).length < 50)
    errors.push("description: muito curto");
  if (!fm.pubDate) errors.push("pubDate: ausente");
  if (!fm.category) errors.push("category: ausente");
  if (!fm.tags || !Array.isArray(fm.tags) || fm.tags.length < 3)
    errors.push("tags: minimo 3");
  if (fm.affiliate === undefined) errors.push("affiliate: ausente");
  const wc = body.split(/\s+/).length;
  if (wc < 500) errors.push(`Conteudo muito curto: ${wc} palavras`);
  if (!body.includes("mercadolivre") && !body.includes("shopee"))
    errors.push("Sem link de afiliado");
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
  const sorted = [...CATEGORIES].sort(
    (a, b) => (counts[a.slug] || 0) - (counts[b.slug] || 0)
  );
  return TOPIC_SEEDS.find((s) => s.category === sorted[0].slug) || TOPIC_SEEDS[0];
}

async function main() {
  log("INFO", "=== INICIANDO GERACAO ===");
  log("INFO", `GROQ_API_KEY definida: ${!!GROQ_API_KEY}`);
  log("INFO", `TAVILY_API_KEY definida: ${!!TAVILY_API_KEY}`);

  if (!GROQ_API_KEY) {
    log("ERROR", "GROQ_API_KEY nao configurada");
    process.exit(1);
  }
  if (!TAVILY_API_KEY) {
    log("ERROR", "TAVILY_API_KEY nao configurada");
    process.exit(1);
  }

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
    const q = `${topic.hint} Brasil 2026`;
    const sr = await fetchTavily(q);
    researchContext = sr.results
      .map((r, i) => `[Fonte ${i + 1}] ${r.title}\n${r.content?.slice(0, 1200)}`)
      .join("\n\n");
  } catch (err) {
    log("WARN", `Pesquisa falhou: ${err.message}`);
  }

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `Voce e um redator especializado em videogames do Blog Gamer, site brasileiro. Escreva em portugues brasileiro, tom natural de gamer.

Regras:
- Artigo: 800 a 1500 palavras
- Inclua links de afiliado para Mercado Livre e Shopee usando <div class="affiliate-box">
- NUNCA mencione que e IA
- Saida EXATA: frontmatter YAML entre "---" depois o conteudo markdown

Frontmatter obrigatorio:
title: "Titulo"
description: "Descricao curta (100-160 caracteres)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: true

category DEVE ser: noticia, review, guia, lista ou promocao`;

  const userPrompt = `Escreva um artigo sobre "${topic.hint}".

${researchContext ? `Fontes:\n${researchContext}\n` : "Sem fontes, use seu conhecimento."}

Instrucoes:
1. Titulo SEO atraente
2. Descricao persuasiva (100-160 chars)
3. Artigo markdown com subtitulos ##
4. Pelo menos 2 blocos affiliate-box com links Mercado Livre e Shopee
5. 5 tags
6. Dicas praticas`;

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
  const published =
    fs.existsSync(ARTIGOS_DIR)
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
