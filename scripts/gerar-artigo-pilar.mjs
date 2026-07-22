import "dotenv/config";
import fs from "fs";
import path from "path";
import { searchML, generateAffiliateLink } from "./ml_affiliate.mjs";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const ML_COOKIES_B64 = process.env.ML_COOKIES_B64;
const ML_COOKIES_PATH = path.resolve("ml_cookies.json");

function log(level, msg) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${ts}] [${level}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchGroq(systemPrompt, userPrompt, maxTokens = 4096) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      log("INFO", `Groq: tentativa ${attempt}/5...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status === 503 || res.status === 502) {
        const wait = Math.min(30 * Math.pow(2, attempt - 1), 600);
        log("WARN", `Groq: ${res.status}, aguardando ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq ${res.status}: ${err.slice(0, 300)}`);
      }
      const data = await res.json();
      if (!data.choices?.[0]?.message?.content)
        throw new Error(`Groq: resposta vazia`);
      return data.choices[0].message.content;
    } catch (err) {
      if (attempt === 5) throw err;
      const wait = Math.min(10 * Math.pow(2, attempt - 1), 60);
      log("WARN", `Groq: erro "${err.message.slice(0, 80)}", retentando em ${wait}s...`);
      await sleep(wait * 1000);
    }
  }
}

async function fetchTavily(query) {
  if (!TAVILY_API_KEY) return null;
  log("INFO", `Tavily: buscando "${query.slice(0, 80)}"`);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY, query,
      search_depth: "advanced", max_results: 2,
      topic: "news", include_answer: true, time_range: "year",
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  log("INFO", `Tavily: ${data.results?.length || 0} resultados`);
  return data;
}

// ====== SEÇÕES COM ML QUERIES MAIS CURTAS ======

const SEÇÕES = [
  {
    titulo: "PC vs Console em 2026: Qual Vale Mais a Pena?",
    pesquisa: "PC vs console gaming 2026 custo benefício Brasil",
    ml_query: "playstation 5",
    foco: "Comparar PC gamer, PS5, Xbox Series X e Nintendo Switch 2 em custo-benefício, performance, exclusivos e facilidade de uso. Dar um veredito claro por perfil de jogador."
  },
  {
    titulo: "Processadores (CPU): O Cérebro do Seu Setup",
    pesquisa: "melhores CPUs para jogos 2026 custo benefício Brasil Intel AMD",
    ml_query: "processador Intel i5 i7 AMD Ryzen",
    foco: "Comparar Intel vs AMD. Explicar clock, núcleos, cache, socket. Recomendar por faixa de preço."
  },
  {
    titulo: "Placas de Vídeo (GPU): O Coração Gamer",
    pesquisa: "melhores placas de vídeo 2026 custo benefício Brasil NVIDIA AMD",
    ml_query: "placa de video RTX 4060",
    foco: "Comparar RTX vs RX. Explicar VRAM, DLSS, FSR, ray tracing. Recomendar por resolução."
  },
  {
    titulo: "Memória RAM e Armazenamento: Velocidade que Faz Diferença",
    pesquisa: "melhor RAM DDR5 gaming 2026 NVMe SSD Brasil",
    ml_query: "memoria DDR5 16GB",
    foco: "16GB vs 32GB, DDR4 vs DDR5, NVMe vs SATA. Marcas: Kingston, Corsair, Samsung, WD."
  },
  {
    titulo: "Monitores Gamer: Taxa de Atualização, Resolução e Painel",
    pesquisa: "melhores monitores gamer 2026 144Hz 240Hz custo benefício Brasil",
    ml_query: "monitor gamer 144hz",
    foco: "IPS vs VA vs OLED. 1080p@144Hz, 1440p@165Hz, 4K@144Hz. Recomendações por faixa de preço."
  },
  {
    titulo: "Periféricos: Teclado, Mouse, Headset e Cadeira",
    pesquisa: "melhores periféricos gamer 2026 teclado mouse headset Brasil",
    ml_query: "teclado mecanico gamer",
    foco: "Teclados mecânicos, mouses, headsets, cadeiras. Marcas: Redragon, Logitech, HyperX, Corsair."
  },
  {
    titulo: "Orçamentos: Setup Gamer para Cada Bolso",
    pesquisa: null,
    ml_query: null,
    foco: "Montar 3 builds: Setup Econômico (~R$3.000), Intermediário (~R$5.000), High-End (~R$10.000). Listar peças com preço."
  },
  {
    titulo: "Conclusão: O Setup Ideal Para Você em 2026",
    pesquisa: null,
    ml_query: null,
    foco: "Resumo executivo. Melhores custo-benefício. Dicas finais. Call-to-action Telegram."
  },
];

async function buscarProdutosML(secao) {
  if (!secao.ml_query || !ML_CLIENT_ID || !ML_CLIENT_SECRET) return [];
  try {
    const produtos = await searchML(secao.ml_query, ML_CLIENT_ID, ML_CLIENT_SECRET, TAVILY_API_KEY, ML_COOKIES_PATH, 2);
    for (const p of produtos) {
      if (fs.existsSync(ML_COOKIES_PATH)) {
        try {
          const linkResult = await generateAffiliateLink(p.permalink, ML_COOKIES_PATH);
          p.affiliate_link = linkResult?.url || linkResult?.link || p.permalink;
        } catch { p.affiliate_link = p.permalink; }
      } else { p.affiliate_link = p.permalink; }
    }
    return produtos;
  } catch (e) {
    log("WARN", `ML erro "${secao.titulo.slice(0, 30)}": ${e.message}`);
    return [];
  }
}

// ====== POST-PROCESSING: Injeta produtos diretamente no markdown ======

function injectProducts(article, produtosPorSecao) {
  if (!produtosPorSecao.size) return article;

  let result = article;
  for (const [secaoTitulo, produtos] of produtosPorSecao) {
    if (!produtos.length) continue;

    const escapedTitle = secaoTitulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingRegex = new RegExp(`(## ${escapedTitle}\\n)`, "i");
    const match = result.match(headingRegex);

    if (!match) {
      log("WARN", `Heading não encontrado para injeção: ${secaoTitulo}`);
      continue;
    }

    const productCards = produtos.map((p, i) => {
      const img = p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : "";
      const link = p.affiliate_link || p.permalink || "";
      const preco = p.price ? `R$ ${p.price.toFixed(2)}` : "Consulte no site";
      return `<div class="product-card">
  ${img ? `<img src="${img}" alt="${p.title}" class="product-card-img" loading="lazy" decoding="async">` : ""}
  <div class="product-card-body">
    <h3>${p.title}</h3>
    <div class="product-price">${preco}</div>
    <p class="product-desc">${p.title} — adquira no Mercado Livre com link de afiliado.</p>
    <div class="product-pros"><strong>Destaque:</strong> Excelente custo-benefício para sua categoria.</div>
    ${link ? `<a href="${link}" class="product-btn" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>` : ""}
  </div>
</div>`;
    }).join("\n\n");

    result = result.replace(headingRegex, `$1\n${productCards}\n`);
  }

  return result;
}

// ====== MAIN ======

async function main() {
  log("INFO", "=== GERANDO ARTIGO PILAR C/ PRODUTOS ML ===");

  if (!GROQ_API_KEY) { log("ERROR", "GROQ_API_KEY nao configurada"); process.exit(1); }

  if (ML_COOKIES_B64) {
    try { fs.writeFileSync(ML_COOKIES_PATH, Buffer.from(ML_COOKIES_B64, "base64"), "utf-8"); log("INFO", "Cookies ML carregados"); }
    catch (e) { log("WARN", `Erro cookies: ${e.message}`); }
  }

  const today = new Date().toISOString().split("T")[0];
  let pesquisaCompleta = "";
  const produtosPorSecao = new Map();
  let primeiroProduto = null;

  // PASSO 1: Pesquisar Tavily + ML para cada seção
  for (const secao of SEÇÕES) {
    log("INFO", `--- ${secao.titulo} ---`);

    if (secao.pesquisa) {
      try {
        const sr = await fetchTavily(secao.pesquisa);
        if (sr?.results) {
          pesquisaCompleta += `\n\n=== ${secao.titulo} ===\n${sr.results
            .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 200)}`)
            .join("\n\n")}`;
        }
      } catch (e) { log("WARN", `Tavily erro: ${e.message}`); }
    }

    if (secao.ml_query) {
      const prods = await buscarProdutosML(secao);
      if (prods.length > 0) {
        produtosPorSecao.set(secao.titulo, prods);
        if (!primeiroProduto && prods[0]?.thumbnail) primeiroProduto = prods[0].thumbnail;
        log("INFO", `  → ${prods.length} produtos injetados em "${secao.titulo}"`);
      }
    }
  }

  // Construir instruções de produtos para o prompt
  const totalProdutos = [...produtosPorSecao.values()].flat().length;
  let productInstructions = "";
  if (produtosPorSecao.size > 0) {
    productInstructions = `\nPRODUTOS DO MERCADO LIVRE (${totalProdutos} produtos, use APENAS estes):\n`;
    for (const [secao, prods] of produtosPorSecao) {
      productInstructions += `\nSeção "${secao}":\n${prods.map((p, i) =>
        `  ${i + 1}. ${p.title} (R$ ${p.price?.toFixed(2) || "N/A"}) — Imagem: ${p.thumbnail} — Link: ${p.affiliate_link || p.permalink}`
      ).join("\n")}\n`;
    }
  }

  // PASSO 2: Gerar draft
  log("INFO", "Passo 1/2: gerando draft...");

  const systemDraft = `Voce e um jornalista especializado em hardware e games. Escreva para o Blog Gamer, site brasileiro.

REGRAS:
- Artigo de 2000-3000 palavras
- Tom opinativo e direto: recomende produtos, de notas, aponte vencedores
- Portugues brasileiro natural
- Use **negrito** na primeira mencao de cada produto/peca
- ESTRUTURA: cada secao usa ##, subsecoes ###
- Inclua TABELAS COMPARATIVAS em markup
- Inclua precos em reais (R$)
- NUNCA invente URLs de imagens — o sistema injeta os produtos automaticamente depois. Voce so precisa mencionar os nomes dos produtos no texto.
- ${produtosPorSecao.size > 0 ? `MENCIONE os produtos do Mercado Livre no corpo do texto pelo nome (ex: "A **RTX 4060** por R$ 1.899..."). O sistema inserira as imagens e botoes depois.` : ""}
- Inclua links internos para: /blog-gamer/blog/as-10-melhores-placas-de-video-custo-beneficio-do-mercado-livre-em-2026/ e /blog-gamer/blog/os-10-melhores-monitores-gamer-custo-beneficio-do-mercado-livre-em-2026/
- Ao final: ## Quer montar seu setup?\\n\\nEntre no [grupo VIP do Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) para ofertas diarias de hardware!
- NUNCA mencione IA. Sem emojis.
- Saida: frontmatter YAML "---" + markdown

Frontmatter:
title: "Guia Definitivo do Setup Gamer 2026: Monte o PC Ideal do Econômico ao High-End"
description: "Guia completo para montar seu PC gamer em 2026. CPUs, GPUs, monitores e periféricos com recomendações, preços e links do Mercado Livre."
pubDate: ${today}
tags: ["setup gamer", "pc gamer", "placa de video", "monitor gamer", "guia"]
category: "guia"
affiliate: true
image: "${primeiroProduto || ""}"`;

  const instrucoesSecoes = SEÇÕES.map((s) => `## ${s.titulo}\n${s.foco}`).join("\n\n");

  const userDraft = `Escreva o GUIA DEFINITIVO DO SETUP GAMER 2026.

Pesquisa:
${pesquisaCompleta.slice(0, 6000)}

${productInstructions.slice(0, 3000)}

Estrutura:
${instrucoesSecoes}

Cada secao 200-400 palavras com explicacao, comparacao e recomendacao com justificativa.
No final ## Fontes com links.`;

  let draft;
  try {
    draft = await fetchGroq(systemDraft, userDraft, 4096);
    log("INFO", `Draft: ${draft.length} caracteres`);
  } catch (err) { log("ERROR", `Falha draft: ${err.message}`); process.exit(1); }

  // PASSO 3: INJETAR PRODUTOS DIRETAMENTE NO MARKDOWN
  log("INFO", "Injetando produtos no artigo...");
  let finalArticle = injectProducts(draft, produtosPorSecao);
  log("INFO", `Após injeção: ${finalArticle.length} caracteres`);

  // PASSO 4: Refinar (opcional)
  if (totalProdutos > 0) {
    log("INFO", "Passo 4/4: refinando...");
    const systemRefine = `Editor-chefe gamer. Revise o artigo e melhore:
- Corrija portugues e concordancia
- Mantenha tom opinativo
- NAO remova os product cards (eles foram inseridos corretamente)
- Mantenha EXATAMENTE o mesmo frontmatter
- Saida: frontmatter + markdown`;

    try {
      finalArticle = await fetchGroq(systemRefine, `Revise mantendo tudo:\n\n${finalArticle.slice(0, 6000)}...`, 2048);
      log("INFO", `Refinado: ${finalArticle.length} caracteres`);
    } catch (err) {
      log("WARN", `Falha refino: ${err.message} — mantendo com produtos injetados`);
    }
  }

  // Salvar
  const ARTIGOS_DIR = path.resolve("src/content/artigos");
  if (!fs.existsSync(ARTIGOS_DIR)) fs.mkdirSync(ARTIGOS_DIR, { recursive: true });

  const slug = "guia-definitivo-setup-gamer-2026";
  const fp = path.join(ARTIGOS_DIR, `${slug}.md`);

  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  fs.writeFileSync(fp, finalArticle, "utf-8");
  log("INFO", `Salvo: ${slug}.md`);
  log("INFO", `Palavras: ${finalArticle.split(/\s+/).length}`);
  log("INFO", `Produtos ML injetados: ${totalProdutos}`);

  const STATE_FILE = path.resolve("state.json");
  let state = {};
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")); } catch {}
  state.last_pilar = today;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");

  log("INFO", "=== CONCLUIDO ===");
}

main().catch((err) => { log("ERROR", err.message); process.exit(1); });
