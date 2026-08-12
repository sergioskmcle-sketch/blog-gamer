// Auto-melhoria: le os relatorios de revisao por etapa de um artigo e
//  1. append de ocorrencias em output/ocorrencias.jsonl
//  2. gera output/planos-melhoria/YYYY-MM-DD--<slug>.md quando ha P0/P1 ou >=3 P2
//  3. grava licoes em _expxagents/_memory/memories.md
//  4. grava digest em _expxagents/_memory/insights/daily/YYYY-MM-DD.md
// Uso: node scripts/auto-melhoria.mjs <slug> [--dry-run] [--no-llm]
import fs from "fs";
import path from "path";

const SQUAD_DIR = path.resolve("squads", "marketing", "conteudo-digital", "blog-gamer");
const OUTPUT_DIR = path.join(SQUAD_DIR, "output");
const REVIEWS_DIR = path.join(OUTPUT_DIR, "reviews");
const OCORRENCIAS_PATH = path.join(OUTPUT_DIR, "ocorrencias.jsonl");
const PLANOS_DIR = path.join(OUTPUT_DIR, "planos-melhoria");
const MEMORY_DIR = path.resolve(SQUAD_DIR, "_expxagents", "_memory");
const MEMORIES_PATH = path.join(MEMORY_DIR, "memories.md");
const INSIGHTS_DIR = path.join(MEMORY_DIR, "insights", "daily");
const AGENTS_DIR = path.resolve(SQUAD_DIR, "agents");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const AGENTE_ARQUIVO = {
  pesquisadora: "pesquisadora.agent.md",
  redator: "redator.agent.md",
  "otimizador-seo": "otimizador-seo.agent.md",
  designer: "designer.agent.md",
  revisora: "revisora.agent.md",
  publicadora: "publicadora.agent.md",
};

function log(level, msg) {
  const ts = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${ts}] [${level}] ${msg}`);
}

function lerRevisoes(slug) {
  const fp = path.join(REVIEWS_DIR, slug, "revisoes.json");
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch (e) {
    log("ERROR", `revisoes.json invalido para ${slug}: ${e.message}`);
    return null;
  }
}

function lerUltimaRevisao() {
  if (!fs.existsSync(REVIEWS_DIR)) return null;
  const slugs = fs.readdirSync(REVIEWS_DIR).filter((d) => fs.existsSync(path.join(REVIEWS_DIR, d, "revisoes.json")));
  if (slugs.length === 0) return null;
  slugs.sort((a, b) => {
    const ta = fs.statSync(path.join(REVIEWS_DIR, a)).mtimeMs;
    const tb = fs.statSync(path.join(REVIEWS_DIR, b)).mtimeMs;
    return tb - ta;
  });
  return slugs[0];
}

function problemaJaRegistrado(chave) {
  if (!fs.existsSync(OCORRENCIAS_PATH)) return false;
  const txt = fs.readFileSync(OCORRENCIAS_PATH, "utf-8");
  return txt.includes(chave);
}

function registrarOcorrencias(slug, revisoes) {
  const hoje = new Date().toISOString().split("T")[0];
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  let linhas = [];
  for (const rel of revisoes) {
    for (const p of rel.problemas) {
      const chave = `"artigo":"${slug}","etapa":"${rel.etapa}","problema":"${p.mensagem}"`;
      if (problemaJaRegistrado(chave)) continue;
      linhas.push(JSON.stringify({
        data: hoje,
        artigo: slug,
        etapa: rel.etapa,
        agente: rel.agente,
        severidade: p.severidade,
        problema: p.mensagem,
        evidencia: p.evidencia,
      }));
    }
  }
  if (linhas.length > 0) {
    fs.appendFileSync(OCORRENCIAS_PATH, linhas.join("\n") + "\n", "utf-8");
    log("INFO", `ocorrencias: ${linhas.length} novas para ${slug}`);
  } else {
    log("INFO", `ocorrencias: nenhuma nova para ${slug}`);
  }
}

function precisaPlano(revisoes) {
  const problemas = revisoes.flatMap((r) => r.problemas);
  const p0 = problemas.filter((p) => p.severidade === "P0").length;
  const p1 = problemas.filter((p) => p.severidade === "P1").length;
  const p2 = problemas.filter((p) => p.severidade === "P2").length;
  return { p0, p1, p2, precisa: p0 + p1 > 0 || p2 >= 3 };
}

function correlacaoHistorica(etapa) {
  if (!fs.existsSync(OCORRENCIAS_PATH)) return 0;
  const txt = fs.readFileSync(OCORRENCIAS_PATH, "utf-8");
  const linhas = txt.split("\n").filter((l) => l.includes(`"etapa":"${etapa}"`) && l.includes(`"severidade":"P0"`));
  return linhas.length;
}

function extractJson(texto) {
  const t = String(texto || "").trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const alvo = m ? m[1] : t;
  const abertura = alvo.indexOf("{");
  const fim = alvo.lastIndexOf("}");
  if (abertura !== -1 && fim > abertura) {
    try {
      return JSON.parse(alvo.slice(abertura, fim + 1));
    } catch {}
  }
  return null;
}

async function fetchGemini(systemPrompt, userPrompt, maxTokens = 1500) {
  if (!GEMINI_API_KEY) throw new Error("Gemini: chave ausente");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: resposta vazia");
  return text;
}

async function fetchGroq(systemPrompt, userPrompt, maxTokens = 1500) {
  if (!GROQ_API_KEY) throw new Error("Groq: chave ausente");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function fetchOpenAI(systemPrompt, userPrompt, maxTokens = 1500) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI: chave ausente");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function fetchLLM(systemPrompt, userPrompt, maxTokens = 1500) {
  const erros = [];
  for (const fn of [fetchGemini, fetchGroq, fetchOpenAI]) {
    try {
      return await fn(systemPrompt, userPrompt, maxTokens);
    } catch (e) {
      erros.push(e.message);
    }
  }
  throw new Error(`LLM indisponivel: ${erros.join("; ")}`);
}

function montarResumo(revisoes, contagem) {
  const linhas = [`Resumo: ${contagem.p0} P0, ${contagem.p1} P1, ${contagem.p2} P2.`];
  for (const rel of revisoes) {
    if (rel.problemas.length === 0) continue;
    linhas.push(`\n### ${rel.nome} (${rel.rotulo})\n`);
    for (const p of rel.problemas) {
      linhas.push(`- [${p.severidade}] ${p.mensagem}${p.evidencia ? ` (${p.evidencia})` : ""}`);
    }
  }
  return linhas.join("\n");
}

async function gerarPlano(slug, revisoes, contagem, usarLLM) {
  const hoje = new Date().toISOString().split("T")[0];
  const nomeArquivo = `${hoje}--${slug}.md`;
  const fp = path.join(PLANOS_DIR, nomeArquivo);
  if (fs.existsSync(fp)) {
    log("INFO", `plano ja existe: ${nomeArquivo}`);
    return fp;
  }
  fs.mkdirSync(PLANOS_DIR, { recursive: true });

  let corpo = "";
  const recorrencia = new Set();
  for (const rel of revisoes) {
    for (const p of rel.problemas) {
      if ((p.severidade === "P0" || p.severidade === "P1")) {
        const n = correlacaoHistorica(rel.etapa);
        if (n > 0) recorrencia.add(`${rel.agente}: ${p.mensagem} (ja viu ${n} P0/P1 em ocorrencias anteriores)`);
      }
    }
  }

  if (usarLLM) {
    try {
      const sys = "Voce e o arquiteto de pipelines do expxagents do blog gamer. Recebe o resumo de ocorrencias de um artigo e escreve um plano de melhoria acionavel, em portugues, markdown, sem emojis.";
      const user = `Resumo das ocorrencias de "${slug}":\n\n${montarResumo(revisoes, contagem)}\n\nEscreva um plano com: ## Causa Raiz, ## Acoes Corretivas (listadas, cada uma apontando arquivo/funcao/regra a alterar em scripts/gerar-artigo.mjs, scripts/revisar-etapas.mjs ou agents/*.agent.md), ## Aceitacao (criterio de quando marcar como resolvido).`;
      corpo = await fetchLLM(sys, user, 2000);
    } catch (e) {
      log("WARN", `plano LLM falhou (${e.message}) — usando template deterministico`);
      corpo = "";
    }
  }

  if (!corpo.trim()) {
    const linhas = [
      `# Plano de Melhoria — ${slug}`,
      `## Data: ${hoje}`,
      "",
      "## Causa Raiz",
      "> A definir (LLM indisponivel ou desabilitado).",
      "",
      "## Ocorrencias desta execucao",
      ...montarResumo(revisoes, contagem).split("\n"),
      "",
      "## Recorrencias (P0/P1 em artigos anteriores)",
      recorrencia.size > 0 ? [...recorrencia].map((r) => `- ${r}`).join("\n") : "- Nenhuma recorrencia conhecida.",
      "",
      "## Acoes Corretivas (proposta — nao aplicada automaticamente)",
      "- Revisar as checklists das etapas afetadas.",
      "- Ajustar regras em scripts/gerar-artigo.mjs ou agents/*.agent.md.",
      "",
      "## Aceitacao",
      "- Artigo seguinte do mesmo tipo sem P0/P1 na etapa correspondente.",
    ];
    corpo = linhas.join("\n");
  }

  fs.writeFileSync(fp, corpo + "\n", "utf-8");
  log("INFO", `plano gerado: ${nomeArquivo}`);
  return fp;
}

function gravarMemorias(slug, revisoes) {
  const licoes = [];
  for (const rel of revisoes) {
    for (const p of rel.problemas) {
      if (p.severidade !== "P0" && p.severidade !== "P1") continue;
      const arquivo = AGENTE_ARQUIVO[rel.agente];
      licoes.push(`- [auto-melhoria ${slug}] ${rel.nome}: ${p.mensagem} — revisar ${arquivo || rel.agente} (${p.severidade})`);
    }
  }
  if (licoes.length === 0) return;
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const header = "\n## Licoes da Auto-Melhoria\n";
  fs.appendFileSync(MEMORIES_PATH, header + licoes.join("\n") + "\n", "utf-8");
  log("INFO", `memorias: ${licoes.length} licoes gravadas`);
}

function gravarDigest(slug, revisoes, contagem) {
  const hoje = new Date().toISOString().split("T")[0];
  fs.mkdirSync(INSIGHTS_DIR, { recursive: true });
  const fp = path.join(INSIGHTS_DIR, `${hoje}.md`);
  const header = `# Insight Daily — ${hoje}\n\nArtigo revisado: **${slug}** — ${contagem.p0} P0, ${contagem.p1} P1, ${contagem.p2} P2.\n`;
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, header, "utf-8");
  const linhas = [
    "",
    `### ${slug}`,
    ...revisoes.filter((r) => r.problemas.length > 0).map((r) => `- ${r.nome}: ${r.problemas.length} problema(s) — ${r.status}`),
  ];
  if (linhas.length > 1) fs.appendFileSync(fp, linhas.join("\n") + "\n", "utf-8");
  log("INFO", `digest atualizado: insights/daily/${hoje}.md`);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const usarLLM = !args.includes("--no-llm");
  const restantes = args.filter((a) => !a.startsWith("--"));

  let slug = restantes[0] || null;
  if (!slug) {
    slug = lerUltimaRevisao();
    if (!slug) {
      log("ERROR", "nenhuma revisao encontrada em output/reviews/");
      process.exit(1);
    }
    log("INFO", `nenhum slug informado — usando a revisao mais recente: ${slug}`);
  }

  const revisoes = lerRevisoes(slug);
  if (!revisoes) {
    log("ERROR", `sem revisoes para ${slug}`);
    process.exit(1);
  }

  const contagem = precisaPlano(revisoes);
  log("INFO", `revisoes de ${slug}: ${revisoes.length} etapas, ${contagem.p0} P0, ${contagem.p1} P1, ${contagem.p2} P2`);

  if (dryRun) {
    log("INFO", "dry-run: nenhuma escrita sera feita");
    return;
  }

  registrarOcorrencias(slug, revisoes);

  if (contagem.precisa) {
    gerarPlano(slug, revisoes, contagem, usarLLM).then(() => {
      gravarMemorias(slug, revisoes);
      gravarDigest(slug, revisoes, contagem);
    }).catch((e) => {
      log("ERROR", `falha na geracao do plano: ${e.message}`);
      process.exit(1);
    });
  } else {
    gravarDigest(slug, revisoes, contagem);
    log("INFO", "sem P0/P1 e menos de 3 P2 — nenhum plano necessario");
  }
}

main();
