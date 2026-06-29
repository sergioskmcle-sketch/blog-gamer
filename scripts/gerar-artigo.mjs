import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ARTIGOS_DIR = path.resolve("src/content/artigos");
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CATEGORIES = [
  { slug: "noticia", name: "Notícia", icon: "📰" },
  { slug: "review", name: "Review", icon: "⭐" },
  { slug: "guia", name: "Guia de Compra", icon: "📖" },
  { slug: "lista", name: "Lista", icon: "📋" },
  { slug: "promocao", name: "Promoção", icon: "🏷️" },
];

const TOPIC_SEEDS = [
  { category: "noticia", hint: "lançamento de game, atualização, evento, anúncio de console ou placa de vídeo" },
  { category: "review", hint: "review de jogo que fez sucesso recentemente, análise de desempenho" },
  { category: "guia", hint: "guia de compra de monitor gamer, headset, teclado, mouse, cadeira, console" },
  { category: "lista", hint: "lista dos melhores jogos de um gênero, melhores periféricos por faixa de preço" },
  { category: "promocao", hint: "promoções sazonais de games, descontos em hardware gamer" },
];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

function log(level, msg) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${ts}] [${level}] ${msg}`);
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
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
      topic: "general",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily API error ${res.status}: ${err}`);
  }

  return res.json();
}

async function fetchClaude(systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Frontmatter não encontrado no artigo gerado");

  const raw = match[1];
  const body = match[2].trim();

  const fm = {};
  for (const line of raw.split("\n")) {
    const sep = line.indexOf(": ");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let val = line.slice(sep + 2).trim();

    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    }

    fm[key] = val;
  }

  return { frontmatter: fm, body };
}

function validateFrontmatter(fm) {
  const errors = [];

  if (!fm.title || fm.title.length < 10) errors.push("title: muito curto ou ausente");
  if (fm.title && fm.title.length > 100) errors.push("title: muito longo (>100 chars)");
  if (!fm.description || fm.description.length < 50) errors.push("description: muito curto ou ausente");
  if (fm.description && fm.description.length > 200) errors.push("description: muito longo (>200 chars)");
  if (!fm.pubDate) errors.push("pubDate: ausente");
  if (!fm.category) errors.push("category: ausente");
  if (!fm.tags || !Array.isArray(fm.tags) || fm.tags.length < 3) errors.push("tags: mínimo 3 tags");
  if (fm.affiliate === undefined) errors.push("affiliate: ausente");

  return errors;
}

function validateBody(body) {
  const errors = [];
  const wordCount = body.split(/\s+/).length;
  if (wordCount < 800) errors.push(`Conteúdo muito curto: ${wordCount} palavras (mínimo 800)`);
  if (!body.includes("mercadolivre") && !body.includes("shopee")) {
    errors.push("Nenhum link de afiliado (Mercado Livre ou Shopee) encontrado");
  }
  return errors;
}

function getPublishedSlugs() {
  if (!fs.existsSync(ARTIGOS_DIR)) return [];
  return fs.readdirSync(ARTIGOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

function getLastArticleDate() {
  if (!fs.existsSync(ARTIGOS_DIR)) return null;
  const files = fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return null;

  let latest = null;
  for (const f of files) {
    const content = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
    const match = content.match(/pubDate:\s*(.+)/);
    if (match) {
      const d = new Date(match[1].replace(/["']/g, ""));
      if (!latest || d > latest) latest = d;
    }
  }
  return latest;
}

function getCategoryCounts() {
  const counts = {};
  if (!fs.existsSync(ARTIGOS_DIR)) return counts;
  const files = fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const content = fs.readFileSync(path.join(ARTIGOS_DIR, f), "utf-8");
    const match = content.match(/category:\s*(.+)/);
    if (match) {
      const cat = match[1].replace(/["']/g, "").trim();
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return counts;
}

function pickTopic(categoryCounts) {
  const sorted = [...CATEGORIES].sort((a, b) => {
    return (categoryCounts[a.slug] || 0) - (categoryCounts[b.slug] || 0);
  });
  const chosen = sorted[0];
  const seed = TOPIC_SEEDS.find((s) => s.category === chosen.slug) || TOPIC_SEEDS[0];
  return seed;
}

function generateAffiliateLink(store, product) {
  const stores = {
    mercadolivre: `https://mercadolivre.com.br/${slugify(product)}`,
    shopee: `https://shopee.com.br/${slugify(product)}`,
  };
  return stores[store] || stores.mercadolivre;
}

async function main() {
  log("INFO", "Iniciando geração automática de artigo");

  if (!ANTHROPIC_API_KEY) {
    log("ERROR", "ANTHROPIC_API_KEY não configurada");
    process.exit(1);
  }
  if (!TAVILY_API_KEY) {
    log("ERROR", "TAVILY_API_KEY não configurada");
    process.exit(1);
  }

  const publishedSlugs = getPublishedSlugs();
  const lastDate = getLastArticleDate();
  const categoryCounts = getCategoryCounts();

  if (lastDate) {
    const hoursSinceLast = (Date.now() - lastDate.getTime()) / 36e5;
    log("INFO", `Último artigo: ${lastDate.toISOString().split("T")[0]} (${Math.round(hoursSinceLast)}h atrás)`);
    if (hoursSinceLast < 24) {
      log("INFO", "Menos de 24h desde o último artigo. Pulando execução.");
      process.exit(0);
    }
  }

  const topic = pickTopic(categoryCounts);
  log("INFO", `Tema escolhido: ${topic.category} — ${topic.hint}`);

  log("INFO", "Pesquisando na internet...");
  const searchQuery = `gaming ${topic.hint} Brasil 2026`;
  let searchResults;
  try {
    searchResults = await fetchTavily(searchQuery);
    log("INFO", `Pesquisa concluída: ${searchResults.results.length} resultados`);
  } catch (err) {
    log("ERROR", `Falha na pesquisa: ${err.message}`);
    process.exit(1);
  }

  const researchContext = searchResults.results.map((r, i) =>
    `[Fonte ${i + 1}] ${r.title}\n${r.content?.slice(0, 1500)}`
  ).join("\n\n");

  const currentDate = new Date().toISOString().split("T")[0];

  const systemPrompt = `Você é um redator especializado em games do Blog Gamer, um site brasileiro de notícias, reviews e guias de compra com links de afiliado.

Regras:
- Escreva em português brasileiro (pt-BR), tom informal mas profissional
- Use linguagem natural de gamer brasileiro
- Artigos devem ter entre 1000 e 2000 palavras
- Inclua links de afiliado para Mercado Livre e Shopee quando relevante
- Use a classe CSS "affiliate-box" para destacar links de afiliado
- Não use marcações do tipo "[Insira link aqui]" — gere links reais
- Nunca mencione que você é IA ou que o texto foi gerado automaticamente
- Crie títulos chamativos e descrições persuasivas

Formato de saída:
Primeiro o frontmatter YAML entre "---", depois o conteúdo markdown.

Frontmatter obrigatório:
title: "Título do Artigo"
description: "Descrição curta e persuasiva (100-160 caracteres)"
pubDate: ${currentDate}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "${topic.category}"
affiliate: true

O campo "category" deve ser exatamente um destes: noticia, review, guia, lista, promocao`;

  const userPrompt = `Com base nas fontes abaixo, escreva um artigo para o Blog Gamer sobre "${topic.hint}".

Fontes da pesquisa:
${researchContext}

Instruções:
1. Crie um título atraente e otimizado para SEO
2. Escreva uma descrição persuasiva (entre 100-160 caracteres)
3. Desenvolva o artigo em markdown com seções bem estruturadas (use ## para subtítulos)
4. Inclua pelo menos 2 blocos de affiliate-box com links para Mercado Livre e Shopee
5. Adicione 5 tags relevantes
6. O artigo deve ser útil, informativo e conter dicas práticas
7. Use dados e informações reais das fontes fornecidas`;

  let article;
  log("INFO", "Gerando artigo com IA...");
  try {
    article = await fetchClaude(systemPrompt, userPrompt);
    log("INFO", "Artigo gerado com sucesso");
  } catch (err) {
    log("ERROR", `Falha na geração: ${err.message}`);
    process.exit(1);
  }

  let fm, body;
  try {
    const parsed = parseFrontmatter(article);
    fm = parsed.frontmatter;
    body = parsed.body;
  } catch (err) {
    log("ERROR", `Erro ao parsear frontmatter: ${err.message}`);
    log("DEBUG", article.slice(0, 500));
    process.exit(1);
  }

  const fmErrors = validateFrontmatter(fm);
  if (fmErrors.length > 0) {
    log("ERROR", `Validação do frontmatter falhou:\n${fmErrors.join("\n")}`);
    log("DEBUG", JSON.stringify(fm, null, 2));
    process.exit(1);
  }

  const bodyErrors = validateBody(body);
  if (bodyErrors.length > 0) {
    log("ERROR", `Validação do conteúdo falhou:\n${bodyErrors.join("\n")}`);
    process.exit(1);
  }

  log("INFO", "Validações passadas ✅");

  const slug = slugify(fm.title);
  if (publishedSlugs.includes(slug)) {
    log("ERROR", `Slug duplicado: ${slug}. Pulando.`);
    process.exit(0);
  }

  const markdown = `---
title: "${fm.title}"
description: "${fm.description}"
pubDate: ${currentDate}
tags: [${fm.tags.map((t) => `"${t.trim()}"`).join(", ")}]
category: "${fm.category}"
affiliate: ${fm.affiliate === true || fm.affiliate === "true"}
---

${body}
`;

  const filePath = path.join(ARTIGOS_DIR, `${slug}.md`);
  fs.writeFileSync(filePath, markdown, "utf-8");
  log("INFO", `Artigo salvo: ${filePath}`);

  log("INFO", "Fazendo commit e push...");
  try {
    execSync('git add -A', { cwd: process.cwd(), stdio: 'pipe' });
    execSync(`git commit -m "feat: artigo - ${fm.title}"`, { cwd: process.cwd(), stdio: 'pipe' });
    execSync('git push', { cwd: process.cwd(), stdio: 'pipe' });
    log("INFO", `Artigo publicado: ${fm.title}`);
  } catch (err) {
    log("ERROR", `Falha no git: ${err.message}`);
    process.exit(1);
  }

  log("INFO", "Processo concluído com sucesso!");
}

main().catch((err) => {
  log("ERROR", err.message);
  process.exit(1);
});
