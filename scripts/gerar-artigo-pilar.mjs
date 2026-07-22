import "dotenv/config";
import fs from "fs";
import path from "path";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

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
      search_depth: "advanced", max_results: 3,
      topic: "news", include_answer: true, time_range: "year",
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  log("INFO", `Tavily: ${data.results?.length || 0} resultados`);
  return data;
}

// ====== SEÇÕES DO ARTIGO PILAR ======

const SEÇÕES = [
  {
    titulo: "PC vs Console em 2026: Qual Vale Mais a Pena?",
    pesquisa: "PC vs console gaming 2026 custo benefício Brasil",
    foco: "Comparar PC gamer, PS5, Xbox Series X e Nintendo Switch 2 em custo-benefício, performance, exclusivos e facilidade de uso. Dar um veredito claro por perfil de jogador."
  },
  {
    titulo: "Processadores (CPU): O Cérebro do Seu Setup",
    pesquisa: "melhores CPUs para jogos 2026 custo benefício Brasil Intel AMD",
    foco: "Comparar Intel Core i5/i7 14ª geração vs AMD Ryzen 5/7 9000. Explicar o que olhar: clock, núcleos, cache, socket. Recomendar 3 opções por faixa de preço."
  },
  {
    titulo: "Placas de Vídeo (GPU): O Coração Gamer",
    pesquisa: "melhores placas de vídeo 2026 custo benefício Brasil NVIDIA AMD",
    foco: "Comparar RTX 4060/4070/4080 vs RX 7600/7700/7800. Explicar VRAM, DLSS, FSR, ray tracing. Tabela comparativa com specs e preços. Recomendar por resolução (1080p, 1440p, 4K)."
  },
  {
    titulo: "Memória RAM e Armazenamento: Velocidade que Faz Diferença",
    pesquisa: "melhor RAM DDR5 gaming 2026 NVMe SSD custo benefício Brasil",
    foco: "16GB vs 32GB, DDR4 vs DDR5, frequências e latência. NVMe vs SATA SSD, PCIe 4.0 vs 5.0. Marcas recomendadas: Kingston, Corsair, Samsung, WD."
  },
  {
    titulo: "Monitores Gamer: Taxa de Atualização, Resolução e Painel",
    pesquisa: "melhores monitores gamer 2026 144Hz 240Hz custo benefício Brasil",
    foco: "IPS vs VA vs OLED. 1080p@144Hz, 1440p@165Hz, 4K@144Hz. G-Sync vs FreeSync. Tempo de resposta. Recomendações por faixa de preço."
  },
  {
    titulo: "Periféricos: Teclado, Mouse, Headset e Cadeira",
    pesquisa: "melhores periféricos gamer 2026 teclado mecânico mouse headset cadeira Brasil",
    foco: "Teclados mecânicos (switch blue/red/brown). Mouses (DPI, sensor, peso). Headsets (7.1 surround, microfone). Cadeiras (ergonomia, material). Marcas: Redragon, Logitech, HyperX, Corsair."
  },
  {
    titulo: "Orçamentos: Setup Gamer para Cada Bolso",
    pesquisa: "quanto custa montar PC gamer 2026 Brasil preço peças",
    foco: "Montar 3 builds completas com preços reais do mercado brasileiro: Setup Econômico (~R$3.000), Setup Intermediário (~R$5.000), Setup High-End (~R$10.000). Listar cada peça com preço aproximado."
  },
  {
    titulo: "Conclusão: O Setup Ideal Para Você em 2026",
    pesquisa: null,
    foco: "Resumo executivo. Reforçar os melhores custo-benefício de cada categoria. Dar dicas finais (onde comprar, quando esperar promoções, peças que duram mais). Call-to-action forte para o grupo Telegram."
  },
];

// ====== MAIN ======

async function main() {
  log("INFO", "=== GERANDO ARTIGO PILAR (Setup Gamer 2026) ===");

  if (!GROQ_API_KEY) { log("ERROR", "GROQ_API_KEY nao configurada"); process.exit(1); }

  const today = new Date().toISOString().split("T")[0];
  let pesquisaCompleta = "";

  // PASSO 1: Pesquisar cada seção no Tavily
  for (const secao of SEÇÕES) {
    if (!secao.pesquisa) continue;
    log("INFO", `Pesquisando: ${secao.titulo}`);
    try {
      const sr = await fetchTavily(secao.pesquisa);
      if (sr?.results) {
        pesquisaCompleta += `\n\n=== ${secao.titulo} ===\n${sr.results
          .map((r, i) => `[Fonte ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 300)}`)
          .join("\n\n")}`;
      }
    } catch (e) {
      log("WARN", `Tavily erro em "${secao.titulo}": ${e.message}`);
    }
  }

  const instrucoesSecoes = SEÇÕES.map((s) =>
    `## ${s.titulo}\n${s.foco}`
  ).join("\n\n");

  // PASSO 2: Gerar draft longo
  log("INFO", "Passo 1/2: gerando draft (8192 tokens)...");

  const systemDraft = `Voce e um jornalista especializado em hardware e games, com 15 anos de experiencia. Escreva para o Blog Gamer, site brasileiro referencia em setup gamer.

REGRAS FUNDAMENTAIS:
- Artigo de 3000-5000 palavras (MINIMO 3000, o sistema rejeita menos)
- Tom opinativo e direto: voce DEVE recomendar produtos especificos, dar notas, apontar vencedores. NAO seja neutro.
- Portugues brasileiro natural, sem formalidade excessiva
- Use **negrito** na primeira mencao de cada produto/peca
- ESTRUTURA: cada secao usa ##, subsecoes usam ###
- Inclua TABELAS COMPARATIVAS em markup (| Coluna | Coluna |)
- Inclua precos aproximados em reais (R$) baseados no mercado brasileiro
- NUNCA invente URLs de imagens — o sistema insere automaticamente
- NUNCA mencione que e IA. Sem emojis.
- Saida: frontmatter YAML entre "---" fechando com "---" depois markdown

Frontmatter:
title: "Guia Definitivo do Setup Gamer 2026: Monte o PC Ideal do Econômico ao High-End"
description: "Guia completo para montar seu PC gamer em 2026. CPUs, GPUs, monitores, periféricos e orçamentos de R$3K a R$10K com recomendações reais do mercado brasileiro."
pubDate: ${today}
tags: ["setup gamer", "pc gamer", "placa de video", "monitor gamer", "guia"]
category: "guia"
affiliate: false`;

  const userDraft = `Escreva o GUIA DEFINITIVO DO SETUP GAMER 2026.

Dados de pesquisa:
${pesquisaCompleta.slice(0, 8000)}

Estrutura obrigatoria:
${instrucoesSecoes}

Cada secao deve ter 300-500 palavras com:
- Explicacao tecnica em linguagem acessivel
- Comparacao entre pelo menos 2 opcoes
- Recomendacao clara com justificativa
- Precos em reais quando possivel
- Tabela comparativa em markup quando houver 3+ itens para comparar

No final, secao ## Fontes com links pesquisados.`;

  let draft;
  try {
    draft = await fetchGroq(systemDraft, userDraft, 4096);
    log("INFO", `Draft gerado: ${draft.length} caracteres`);
  } catch (err) {
    log("ERROR", `Falha no draft: ${err.message}`);
    process.exit(1);
  }

  // PASSO 3: Refinar
  log("INFO", "Passo 2/2: refinando artigo...");

  const systemRefine = `Voce e um editor-chefe de publicacao gamer. Revise o artigo abaixo e melhore:

REG RAS:
- Remova repeticoes e frases genericas
- Adicione detalhes tecnicos onde estiver vago
- Transforme listas em tabelas comparativas onde fizer sentido
- Garanta que CADA secao tem uma recomendacao clara com justificativa
- Corrija erros de portugues e concordancia
- Mantenha o tom opinativo e direto
- Adicione ao final: ## Quer montar seu setup?\\n\\nEntre no [grupo VIP do Telegram](https://t.me/+TRWZ67WHuk85Y2Nh) para ofertas diarias de hardware e perifericos!
- Mantenha EXATAMENTE o mesmo frontmatter e estrutura de headings
- NAO reduza o tamanho — se algo estiver bom, mantenha
- Saida: o artigo completo revisado, mesmo formato (frontmatter + markdown)`;

  let finalArticle;
  try {
    finalArticle = await fetchGroq(systemRefine, `Revise e melhore este artigo:\n\n${draft}`, 2048);
    log("INFO", `Artigo refinado: ${finalArticle.length} caracteres`);
  } catch (err) {
    log("ERROR", `Falha no refino: ${err.message}`);
    log("INFO", "Salvando draft sem refino...");
    finalArticle = draft;
  }

  // Salvar
  const ARTIGOS_DIR = path.resolve("src/content/artigos");
  if (!fs.existsSync(ARTIGOS_DIR)) fs.mkdirSync(ARTIGOS_DIR, { recursive: true });

  const slug = "guia-definitivo-setup-gamer-2026";
  const fp = path.join(ARTIGOS_DIR, `${slug}.md`);

  if (fs.existsSync(fp)) {
    log("ERROR", `Artigo pilar ja existe: ${slug}`);
    process.exit(1);
  }

  fs.writeFileSync(fp, finalArticle, "utf-8");
  log("INFO", `Artigo pilar salvo: ${slug}.md`);
  log("INFO", `Total de caracteres: ${finalArticle.length}`);
  log("INFO", `Palavras estimadas: ${finalArticle.split(/\s+/).length}`);

  // Atualizar state.json
  const STATE_FILE = path.resolve("state.json");
  let state = {};
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")); } catch {}
  state.last_pilar = today;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");

  log("INFO", "=== CONCLUIDO ===");
}

main().catch((err) => {
  log("ERROR", err.message);
  process.exit(1);
});
