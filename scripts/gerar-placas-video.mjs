import "dotenv/config";
import fs from "fs";
import path from "path";
import { generateAffiliateLink, getMLToken } from "./ml_affiliate.mjs";

const ARTIGOS_DIR = path.resolve("src/content/artigos");
const ML_COOKIES_PATH = path.resolve("ml_cookies.json");

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
  if (!TAVILY_API_KEY) {
    log("WARN", "TAVILY_API_KEY nao definida — pulando pesquisa de fontes");
    return null;
  }
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
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
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
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const data = await res.json();
      if (!data.choices?.[0]?.message?.content) throw new Error("Groq: resposta vazia");
      return data.choices[0].message.content;
    } catch (err) {
      if (attempt === retries) throw err;
      log("WARN", `Groq: erro na tentativa ${attempt}, retentando...`);
      await sleep(5000);
    }
  }
}

function parseFrontmatter(text) {
  let m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    m = text.match(/^---\n([\s\S]*?)\n+## /);
    if (m) {
      const raw = m[1];
      const body = text.slice(text.indexOf("## "));
      return { frontmatter: parseRaw(raw), body: body.trim() };
    }
    throw new Error("Frontmatter nao encontrado");
  }
  return { frontmatter: parseRaw(m[1]), body: m[2].trim() };
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
  if (!fm.description || String(fm.description).length < 50) errors.push("description: muito curto");
  if (!fm.pubDate) errors.push("pubDate: ausente");
  if (!fm.category) errors.push("category: ausente");
  if (!fm.tags || !Array.isArray(fm.tags) || fm.tags.length < 3) errors.push("tags: minimo 3");
  if (fm.affiliate === undefined) errors.push("affiliate: ausente");
  const wc = body.split(/\s+/).length;
  if (wc < 400) errors.push(`Conteudo muito curto: ${wc} palavras`);
  return errors;
}

async function main() {
  log("INFO", "=== GERANDO ARTIGO: PLACAS DE VIDEO ===");

  if (!GROQ_API_KEY) { log("ERROR", "GROQ_API_KEY nao configurada"); process.exit(1); }
  if (!TAVILY_API_KEY) log("WARN", "TAVILY_API_KEY nao definida — artigo seguira sem fontes pesquisadas");

  // 1. Research
  let researchContext = "";
  try {
    const sr = await fetchTavily("melhores placas de video 2026 Brasil custo beneficio");
    researchContext = sr.results
      .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 300)}`)
      .join("\n\n");
  } catch (err) {
    log("WARN", `Tavily: ${err.message}`);
  }

  // 2. Search ML for GPU products via category API (more reliable than Tavily search)
  let mlProducts = [];
  if (ML_CLIENT_ID && ML_CLIENT_SECRET) {
    try {
      log("INFO", "Buscando placas de video via API ML (categoria)...");
      const token = await getMLToken(ML_CLIENT_ID, ML_CLIENT_SECRET);
      const GPU_CATEGORY = "MLB1658"; // Placas de Vídeo

      // Get highlights from Placas de Vídeo category
      const highlightsRes = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${GPU_CATEGORY}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (highlightsRes.ok) {
        const highlightsData = await highlightsRes.json();
        const productIds = (highlightsData.content || [])
          .filter((x) => x.type === "PRODUCT")
          .map((x) => x.id);

        for (const pid of productIds) {
          // Get product details (name, image)
          const prodRes = await fetch(`https://api.mercadolibre.com/products/${pid}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!prodRes.ok) continue;
          const prodData = await prodRes.json();
          const title = prodData.name || "";
          if (!title || !title.toLowerCase().includes("plac")) continue;
          const image = prodData.pictures?.[0]?.url || "";

          // Get active items (price)
          const itemsRes = await fetch(`https://api.mercadolibre.com/products/${pid}/items`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          let price = 0;
          let originalPrice = 0;
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            const firstItem = itemsData.results?.[0];
            if (firstItem) {
              price = firstItem.price || 0;
              originalPrice = firstItem.original_price || 0;
            }
          }

          if (!price) continue;
          mlProducts.push({
            id: pid, title, price, thumbnail: image,
            original_price: originalPrice,
            permalink: `https://www.mercadolivre.com.br/p/${pid}`,
            images: [image],
          });
          if (mlProducts.length >= 8) break;
        }
      }

      // Fallback hardcoded GPU product IDs if highlights returned < 5
      if (mlProducts.length < 5) {
        log("INFO", "Poucos produtos da highlights, usando IDs fixos...");
        const fallbackIds = [
          "MLB27353799", "MLB2006784640", "MLB28761680",
          "MLB26915015", "MLB25803302", "MLB51032833",
        ];
        for (const pid of fallbackIds) {
          if (mlProducts.some((p) => p.id === pid)) continue;
          const prodRes = await fetch(`https://api.mercadolibre.com/products/${pid}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!prodRes.ok) continue;
          const prodData = await prodRes.json();
          const title = prodData.name || "";
          const image = prodData.pictures?.[0]?.url || "";
          if (!title) continue;
          const itemsRes = await fetch(`https://api.mercadolibre.com/products/${pid}/items`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          let price = 0;
          let originalPrice = 0;
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            const firstItem = itemsData.results?.[0];
            if (firstItem) {
              price = firstItem.price || 0;
              originalPrice = firstItem.original_price || 0;
            }
          }
          if (!price) continue;
          mlProducts.push({
            id: pid, title, price, thumbnail: image,
            original_price: originalPrice,
            permalink: `https://www.mercadolivre.com.br/p/${pid}`,
            images: [image],
          });
          if (mlProducts.length >= 10) break;
        }
      }

      for (const p of mlProducts) {
        if (fs.existsSync(ML_COOKIES_PATH)) {
          try {
            const linkResult = await generateAffiliateLink(p.permalink, ML_COOKIES_PATH);
            p.affiliate_link = linkResult?.short_url || linkResult?.link || linkResult?.url || p.permalink;
            log("INFO", `Link afiliado: ${p.title?.slice(0, 40)} -> ${p.affiliate_link === p.permalink ? "FALLBACK" : "OK"}`);
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
  }

  const today = new Date().toISOString().split("T")[0];

  const productBlock = mlProducts.length > 0
    ? `\nProdutos do Mercado Livre (use TODOS eles no artigo, com imagens e links obrigatoriamente):\n${mlProducts.map((p, i) =>
        `[Produto ${i + 1}]\n` +
        `Nome: ${p.title}\n` +
        `Preco: R$ ${p.price?.toFixed(2) || "N/A"}\n` +
        `Imagem: ${p.thumbnail}\n` +
        `Link Mercado Livre: ${p.affiliate_link || p.permalink}\n`
      ).join("\n")}`
    : "";

  const systemPrompt = `Voce e um redator especializado em hardware e videogames do Blog Gamer, site brasileiro. Escreva em portugues brasileiro, tom natural de gamer.

Regras:
- Artigo: MINIMO 1500 palavras (obrigatorio)
- Inclua imagens dos produtos usando <img src="URL_IMAGEM" alt="NOME_PRODUTO" class="product-image">
- Para cada produto, coloque um botao "VER NO MERCADO LIVRE" com link de afiliado: <a href="LINK_AFILIADO" class="btn btn-primary" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>
- Cite as fontes de pesquisa no final do artigo: "## Fontes" com links
- NUNCA mencione que e IA
- Saida EXATA: frontmatter YAML entre "---" e fechando com "---" depois o conteudo markdown

Frontmatter obrigatorio:
title: "Titulo SEO"
description: "Descricao curta (100-160 caracteres)"
pubDate: ${today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "lista"
affiliate: true`;

  const userPrompt = `Escreva um artigo de lista sobre "as 10 melhores placas de video custo beneficio do Mercado Livre em 2026".

${researchContext ? `Fontes de pesquisa:\n${researchContext}\n` : ""}
${productBlock}

Instrucoes:
1. Titulo SEO atraente: "As 10 Melhores Placas de Video Custo-Beneficio do Mercado Livre em 2026"
2. Descricao persuasiva (100-160 chars)
3. Artigo markdown com subtitulos ##
4. Use TODOS os produtos listados acima, cada um com sua imagem (<img>) e botao de afiliado
5. Para cada produto, inclua: especificacoes tecnicas (chipset, VRAM, etc), para qual tipo de gamer e indicado, e um botao "VER NO MERCADO LIVRE"
6. Inclua dicas de compra (ex: o que observar ao comprar placa de video, diferenca entre DLSS/FSR, etc)
7. No final, secao "## Fontes" com links das fontes pesquisadas
8. 5 tags
9. Introducao contextual sobre o mercado de GPUs em 2026`;

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

  // Build tags ensuring all are strings
  const tags = (fm.tags || []).map((t) => `"${String(t).trim()}"`);

  const markdown = `---
title: "${fm.title}"
description: "${fm.description}"
pubDate: ${today}
tags: [${tags.join(", ")}]
category: "${fm.category}"
affiliate: true
image: "${mlProducts[0]?.thumbnail || ""}"
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
