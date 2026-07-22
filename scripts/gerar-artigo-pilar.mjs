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

// ====== SEÇÕES COM PESQUISA TAVILY + ML ======

const SEÇÕES = [
  {
    titulo: "PC vs Console em 2026: Qual Vale Mais a Pena?",
    pesquisa: "PC vs console gaming 2026 custo benefício Brasil",
    ml_query: "console Playstation 5 Xbox Series",
    foco: "Comparar PC gamer, PS5, Xbox Series X e Nintendo Switch 2 em custo-benefício, performance, exclusivos e facilidade de uso. Dar um veredito claro por perfil de jogador."
  },
  {
    titulo: "Processadores (CPU): O Cérebro do Seu Setup",
    pesquisa: "melhores CPUs para jogos 2026 custo benefício Brasil Intel AMD",
    ml_query: "processador Intel Core i5 i7 AMD Ryzen",
    foco: "Comparar Intel Core i5/i7 14ª geração vs AMD Ryzen 5/7 9000. Explicar o que olhar: clock, núcleos, cache, socket. Recomendar 3 opções por faixa de preço."
  },
  {
    titulo: "Placas de Vídeo (GPU): O Coração Gamer",
    pesquisa: "melhores placas de vídeo 2026 custo benefício Brasil NVIDIA AMD",
    ml_query: "placa de video RTX 4060 4070 RX 7600 gamer",
    foco: "Comparar RTX 4060/4070 vs RX 7600/7700. Explicar VRAM, DLSS, FSR, ray tracing. Tabela comparativa com specs e preços. Recomendar por resolução."
  },
  {
    titulo: "Memória RAM e Armazenamento: Velocidade que Faz Diferença",
    pesquisa: "melhor RAM DDR5 gaming 2026 NVMe SSD custo benefício Brasil",
    ml_query: "memoria RAM DDR5 SSD NVMe gamer",
    foco: "16GB vs 32GB, DDR4 vs DDR5, frequências e latência. NVMe vs SATA SSD, PCIe 4.0 vs 5.0. Marcas recomendadas: Kingston, Corsair, Samsung, WD."
  },
  {
    titulo: "Monitores Gamer: Taxa de Atualização, Resolução e Painel",
    pesquisa: "melhores monitores gamer 2026 144Hz 240Hz custo benefício Brasil",
    ml_query: "monitor gamer 144Hz 240Hz IPS",
    foco: "IPS vs VA vs OLED. 1080p@144Hz, 1440p@165Hz, 4K@144Hz. G-Sync vs FreeSync. Recomendações por faixa de preço."
  },
  {
    titulo: "Periféricos: Teclado, Mouse, Headset e Cadeira",
    pesquisa: "melhores periféricos gamer 2026 teclado mecânico mouse headset cadeira Brasil",
    ml_query: "teclado mecanico gamer mouse headset cadeira",
    foco: "Teclados mecânicos, mouses, headsets, cadeiras gamer. Marcas: Redragon, Logitech, HyperX, Corsair. Recomendar 1-2 produtos por categoria."
  },
  {
    titulo: "Orçamentos: Setup Gamer para Cada Bolso",
    pesquisa: null,
    ml_query: "PC gamer completo montado",
    foco: "Montar 3 builds completas: Setup Econômico (~R$3.000), Setup Intermediário (~R$5.000), Setup High-End (~R$10.000). Listar cada peça com preço."
  },
  {
    titulo: "Conclusão: O Setup Ideal Para Você em 2026",
    pesquisa: null,
    ml_query: null,
    foco: "Resumo executivo. Reforçar os melhores custo-benefício. Dicas finais. Call-to-action forte para o grupo Telegram."
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
    log("INFO", `ML "${secao.titulo.slice(0, 30)}": ${produtos.length} produtos`);
    return produtos;
  } catch (e) {
    log("WARN", `ML erro "${secao.titulo.slice(0, 30)}": ${e.message}`);
    return [];
  }
}

function buildProductBlock(produtos) {
  if (!produtos.length) return "";
  return `\nProdutos do Mercado Livre para esta secao (use-os no artigo):\n${
    produtos.map((p, i) =>
      `[Produto ${i + 1}]\nNome: ${p.title}\nPreco: R$ ${p.price?.toFixed(2) || "N/A"}\nImagem: ${p.thumbnail}\nLink: ${p.affiliate_link || p.permalink}\n`
    ).join("\n")
  }`;
}

// ====== MAIN ======

async function main() {
  log("INFO", "=== GERANDO ARTIGO PILAR C/ PRODUTOS ML ===");

  if (!GROQ_API_KEY) { log("ERROR", "GROQ_API_KEY nao configurada"); process.exit(1); }

  // Decode ML cookies
  if (ML_COOKIES_B64) {
    try { fs.writeFileSync(ML_COOKIES_PATH, Buffer.from(ML_COOKIES_B64, "base64"), "utf-8"); log("INFO", "Cookies ML carregados"); }
    catch (e) { log("WARN", `Erro cookies: ${e.message}`); }
  }

  const today = new Date().toISOString().split("T")[0];
  let pesquisaCompleta = "";
  let produtosML = [];
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
        secao._produtos = prods;
        produtosML.push({ secao: secao.titulo, produtos: prods });
        if (!primeiroProduto && prods[0]?.thumbnail) primeiroProduto = prods[0].thumbnail;
        log("INFO", `  → ${prods.length} produtos para "${secao.titulo}"`);
      }
    }
  }

  // Construir product blocks por seção
  const productBlocos = produtosML.map(({ secao, produtos }) =>
    `\n=== PRODUTOS PARA: ${secao} ===\n${produtos.map((p, i) =>
      `[${i + 1}] ${p.title} — R$ ${p.price?.toFixed(2) || "N/A"}\n   Imagem: ${p.thumbnail}\n   Link: ${p.affiliate_link || p.permalink}`
    ).join("\n")}`
  ).join("\n\n");

  // PASSO 2: Gerar draft
  log("INFO", "Passo 1/2: gerando draft...");

  const systemDraft = `Voce e um jornalista especializado em hardware e games. Escreva para o Blog Gamer, site brasileiro referencia em setup gamer.

REGRAS:
- Artigo de 3000-4000 palavras (MINIMO 3000)
- Tom opinativo e direto: recomende produtos, de notas, aponte vencedores
- Portugues brasileiro natural
- Use **negrito** na primeira mencao de cada produto/peca
- ESTRUTURA: cada secao usa ##, subsecoes ###
- Inclua TABELAS COMPARATIVAS em markup
- Inclua precos em reais (R$)
- ${produtosML.length > 0 ? `PRODUTOS DO MERCADO LIVRE: use apenas os produtos fornecidos abaixo. Para cada um, inclua: <img src="URL_IMAGEM" alt="NOME" class="product-image"> e um botao <a href="LINK_AFILIADO" class="btn btn-primary" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>. IGNORE whey protein, parafusadeiras, relogios — apenas hardware gamer.` : "Modo informativo puro."}
- Inclua links internos: [guia de placas de video](/blog-gamer/blog/as-10-melhores-placas-de-video-custo-beneficio-do-mercado-livre-em-2026/) e [monitores gamer](/blog-gamer/blog/os-10-melhores-monitores-gamer-custo-beneficio-do-mercado-livre-em-2026/)
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

  const instrucoesSecoes = SEÇÕES.map((s) =>
    `## ${s.titulo}\n${s.foco}${s._produtos ? `\nProdutos para usar NESTA secao: ${s._produtos.map(p => `"${p.title}" (R$ ${p.price?.toFixed(2)})`).join(", ")}` : ""}`
  ).join("\n\n");

  const userDraft = `Escreva o GUIA DEFINITIVO DO SETUP GAMER 2026.

Pesquisa:
${pesquisaCompleta.slice(0, 6000)}

${productBlocos ? `Produtos do Mercado Livre para incluir:\n${productBlocos.slice(0, 4000)}\n` : ""}

Estrutura:
${instrucoesSecoes}

Cada secao 300-500 palavras com:
- Explicacao acessivel + recomendacao com justificativa
- ${produtosML.length > 0 ? "Produtos do ML com <img> + botao VER NO MERCADO LIVRE" : "Precos aproximados em reais"}
- Tabela comparativa quando 3+ itens

No final ## Fontes com links.`;

  let draft;
  try {
    draft = await fetchGroq(systemDraft, userDraft, 4096);
    log("INFO", `Draft: ${draft.length} caracteres`);
  } catch (err) { log("ERROR", `Falha draft: ${err.message}`); process.exit(1); }

  // PASSO 3: Refinar
  log("INFO", "Passo 2/2: refinando...");

  const systemRefine = `Voce e editor-chefe gamer. Revise e melhore o artigo:

- Remova repeticoes e frases genericas
- Adicione detalhes tecnicos onde vago
- Garanta que CADA secao recomenda algo com justificativa
- Corrija portugues
- Mantenha tom opinativo
- Mantenha EXATAMENTE o mesmo frontmatter e estrutura
- NAO reduza o tamanho
- Saida: frontmatter + markdown`;

  let finalArticle;
  try {
    finalArticle = await fetchGroq(systemRefine, `Revise:\n\n${draft}`, 2048);
    log("INFO", `Refinado: ${finalArticle.length} caracteres`);
  } catch (err) {
    log("WARN", `Falha refino: ${err.message}`);
    finalArticle = draft;
  }

  // Salvar — sobrescreve se existir
  const ARTIGOS_DIR = path.resolve("src/content/artigos");
  if (!fs.existsSync(ARTIGOS_DIR)) fs.mkdirSync(ARTIGOS_DIR, { recursive: true });

  const slug = "guia-definitivo-setup-gamer-2026";
  const fp = path.join(ARTIGOS_DIR, `${slug}.md`);

  if (fs.existsSync(fp)) {
    log("INFO", "Artigo pilar existente removido para regeneração");
    fs.unlinkSync(fp);
  }

  fs.writeFileSync(fp, finalArticle, "utf-8");
  log("INFO", `Salvo: ${slug}.md (${finalArticle.split(/\s+/).length} palavras)`);

  // Atualizar state
  const STATE_FILE = path.resolve("state.json");
  let state = {};
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")); } catch {}
  state.last_pilar = today;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");

  log("INFO", "=== CONCLUIDO ===");
}

main().catch((err) => { log("ERROR", err.message); process.exit(1); });
