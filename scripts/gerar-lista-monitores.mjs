import fs from "fs";
import path from "path";
import { generateAffiliateLink, getMLToken } from "./ml_affiliate.mjs";

const GROQ_KEY = process.env.GROQ_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const ML_ID = process.env.ML_CLIENT_ID;
const ML_SECRET = process.env.ML_CLIENT_SECRET;
const COOKIE_PATH = path.resolve("ml_cookies.json");
const ARTIGOS_DIR = path.resolve("src/content/artigos");

function log(level, msg) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${ts}] [${level}] ${msg}`);
}

function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function fetchGroq(systemPrompt, userPrompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.7, max_tokens: 8192,
        }),
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, attempt * 30000));
        continue;
      }
      if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (attempt === 3) throw err;
      log("WARN", `Groq: erro, retentando... ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function tavilySearchML(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: TAVILY_KEY, query: `${query} site:mercadolivre.com.br`, search_depth: "basic", max_results: 10 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

log("INFO", "=== GERANDO ARTIGO: 10 MONITORES GAMER ===");

const token = await getMLToken(ML_ID, ML_SECRET);

// Search multiple monitor queries to find more products
const queries = [
  "monitor gamer 144hz",
  "monitor gamer 165hz",
  "monitor gamer 180hz",
  "monitor gamer 240hz",
  "monitor gamer ips",
];

const seen = new Set();
const products = [];

for (const q of queries) {
  if (products.length >= 12) break;
  log("INFO", `Tavily: "${q}"`);
  const results = await tavilySearchML(q);
  
  for (const r of results) {
    if (products.length >= 12) break;
    const m = r.url.match(/\/p\/(MLB\d+)/);
    if (!m) continue;
    const pid = m[1];
    if (seen.has(pid)) continue;
    seen.add(pid);
    
    try {
      const pr = await fetch(`https://api.mercadolibre.com/products/${pid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!pr.ok) continue;
      const data = await pr.json();
      const title = data.name || data.title || "";
      if (!title || !title.toLowerCase().includes("monitor")) continue;
      
      const image = data.pictures?.[0]?.url || "";
      const permalink = data.permalink ? `https://www.mercadolivre.com.br${data.permalink}` : `https://www.mercadolivre.com.br/p/${pid}`;
      
      let price = 0;
      try {
        const ir = await fetch(`https://api.mercadolibre.com/products/${pid}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ir.ok) {
          const itemsData = await ir.json();
          price = itemsData.results?.[0]?.price || 0;
        }
      } catch {}
      
      if (price === 0) continue;
      
      products.push({ id: pid, title, price, image, permalink });
      log("INFO", `  -> ${title.slice(0, 60)} | R$${price}`);
    } catch (e) {
      log("WARN", `  Erro ${pid}: ${e.message}`);
    }
  }
}

log("INFO", `Total de produtos encontrados: ${products.length}`);

if (products.length < 4) {
  log("ERROR", "Poucos produtos encontrados, abortando");
  process.exit(1);
}

// Take up to 10
const selected = products.slice(0, 10);

// Generate affiliate links
for (const p of selected) {
  if (fs.existsSync(COOKIE_PATH)) {
    try {
      const lr = await generateAffiliateLink(p.permalink, COOKIE_PATH);
      p.affiliate_link = lr?.short_url || lr?.link || lr?.url || p.permalink;
    } catch {
      p.affiliate_link = p.permalink;
    }
  } else {
    p.affiliate_link = p.permalink;
  }
}

// Build product block
const productBlock = selected.map((p, i) =>
  `[Produto ${i + 1}]\nNome: ${p.title}\nPreco: R$ ${p.price.toFixed(2)}\nImagem: ${p.image}\nLink: ${p.affiliate_link}`
).join("\n\n");

const today = new Date().toISOString().split("T")[0];

// GROQ
const systemPrompt = `Voce e um redator especializado em videogames do Blog Gamer, site brasileiro. Escreva em portugues brasileiro, tom natural de gamer.

Regras:
- Artigo: MINIMO 1500 palavras
- Inclua imagens usando <img src="URL_IMAGEM" alt="NOME" class="product-image">
- Inclua botoes "VER NO MERCADO LIVRE": <a href="LINK" class="btn btn-primary" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>
- Para cada monitor: tamanho, resolucao, taxa de atualizacao, tempo de resposta, tipo de painel, publico alvo
- NUNCA mencione IA
- LISTA EXATAMENTE ${selected.length} monitores (um de cada vez)
- No final: secao "## Dicas de Compra" e depois "## Fontes"
- Saida EXATA: frontmatter YAML entre "---" e fechando com "---" depois o conteudo markdown

Frontmatter:
title: "Os ${selected.length} Melhores Monitores Gamer Custo-Beneficio do Mercado Livre em 2026"
description: "Lista completa com os ${selected.length} melhores monitores gamers custo-beneficio para 2026. Precos, especificacoes e links do Mercado Livre."
pubDate: ${today}
tags: [monitores, hardware, "guia de compra", "custo beneficio", 2026]
category: guia
affiliate: true`;

const userPrompt = `Escreva um artigo de lista: "Os ${selected.length} Melhores Monitores Gamer Custo-Beneficio do Mercado Livre em 2026".

Dados dos produtos:
${productBlock}

Instrucoes:
1. Introducao sobre a importancia de escolher um bom monitor gamer custo-beneficio
2. Liste EXATAMENTE ${selected.length} monitores com: nome, especificacoes detalhadas, para quem e indicado, imagem e botao "VER NO MERCADO LIVRE"
3. TODOS os monitores devem ter seus dados reais da lista acima
4. Dicas de compra no final
5. Secao "## Fontes" com links de sites de tecnologia (Adrenaline, TechTudo, etc)`;

log("INFO", "Gerando artigo com Groq...");
const article = await fetchGroq(systemPrompt, userPrompt);
log("INFO", "Artigo gerado, parseando...");

const fmMatch = article.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!fmMatch) throw new Error("Frontmatter nao encontrado");
const body = fmMatch[2].trim();

// Word count
const wc = body.split(/\s+/).length;
log("INFO", `Artigo: ${wc} palavras`);

const title = "Os " + selected.length + " Melhores Monitores Gamer Custo-Beneficio do Mercado Livre em 2026";
const slug = slugify(title);

const markdown = `---
title: "${title}"
description: "Lista completa com os ${selected.length} melhores monitores gamers custo-beneficio para 2026. Compare precos e especificacoes no Mercado Livre."
pubDate: ${today}
tags: [monitores, hardware, "guia de compra", "custo beneficio", 2026]
category: guia
affiliate: true
image: "${selected[0]?.image || ""}"
---

${body}
`;

if (!fs.existsSync(ARTIGOS_DIR)) fs.mkdirSync(ARTIGOS_DIR, { recursive: true });
const fp = path.join(ARTIGOS_DIR, `${slug}.md`);
fs.writeFileSync(fp, markdown, "utf-8");
log("INFO", `Artigo salvo: ${slug}.md (${wc} palavras, ${selected.length} produtos)`);
log("INFO", "=== CONCLUIDO ===");
