// Pauta do dia — a lista ranqueada de assuntos, antes de escolher um.
//
// Por que existe: ate 09/09/2026 o pipeline escolhia UM tema direto das
// manchetes, numa unica chamada, e ninguem conseguia ver por que aquele. Se o
// artigo saia ruim, nao dava para saber se o assunto era fraco, se a pesquisa
// falhou ou se a escrita nao cumpriu. A pauta separa a decisao editorial da
// producao e deixa a decisao legivel — em arquivo, para o operador conferir.
//
// Tres etapas, na ordem em que uma redacao faz:
//   1. AGRUPAR  — manchetes diferentes sobre o mesmo fato viram UM assunto.
//                 "Novo Zelda anunciado", "Nintendo revela remake de Zelda" e
//                 "Ocarina of Time Remake e anunciado" sao o mesmo assunto.
//   2. PONTUAR  — cada assunto recebe nota por criterios editoriais explicitos.
//   3. FILTRAR  — sai o que ja foi coberto, o que nao tem novidade real e o que
//                 esta fora do nicho.
//
// A pauta sobra: os assuntos nao usados hoje ficam no arquivo e podem virar
// artigo amanha sem repetir a pesquisa.
import fs from "fs";
import path from "path";

const PAUTA_DIR = path.resolve(
  "squads", "marketing", "conteudo-digital", "blog-gamer", "output", "pautas"
);

// Pesos da nota final. Somam 100. Ajustaveis sem mexer no resto do codigo.
export const PESOS = {
  interesse: 30,      // o quanto o assunto esta movimentando agora
  buscaPotencial: 25, // o quanto as pessoas vao pesquisar sobre isso
  novidade: 15,       // e fato novo ou assunto perene?
  seo: 15,            // rende palavra-chave com intencao clara?
  relevancia: 10,     // interessa ao publico gamer do blog?
  comercial: 5,       // tem produto relacionado de forma natural?
};

function log(nivel, msg) {
  const hora = new Date().toTimeString().slice(0, 8);
  console.log(`[${hora}] [pauta] [${nivel}] ${msg}`);
}

function extrairJson(texto) {
  const limpo = String(texto || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const ini = limpo.search(/[[{]/);
  const fim = Math.max(limpo.lastIndexOf("]"), limpo.lastIndexOf("}"));
  if (ini === -1 || fim === -1) return null;
  try {
    return JSON.parse(limpo.slice(ini, fim + 1));
  } catch {
    return null;
  }
}

function notaFinal(criterios) {
  let total = 0;
  for (const [chave, peso] of Object.entries(PESOS)) {
    const nota = Number(criterios?.[chave]);
    total += (Number.isFinite(nota) ? Math.max(0, Math.min(10, nota)) : 0) * peso;
  }
  return Math.round(total / 10);
}

// ---------------------------------------------------------------------------
// Etapa 1+2+3 numa chamada so. Separar em tres chamadas triplicaria o custo sem
// ganho pratico: a LLM agrupa, pontua e filtra melhor vendo o conjunto inteiro.
// ---------------------------------------------------------------------------
export async function montarPauta({ manchetes = [], trending = [], jaCobertos = [], fetchLLM, maxPautas = 8 }) {
  if (typeof fetchLLM !== "function") return [];
  if (manchetes.length === 0 && trending.length === 0) {
    log("WARN", "Sem manchetes nem trending — pauta vazia");
    return [];
  }

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const anoAtual = new Date().getFullYear();

  const sistema = [
    "Voce e o editor-chefe de um blog gamer brasileiro montando a pauta do dia.",
    "Sua tarefa NAO e escrever: e decidir o que merece virar artigo e por que.",
    "Responda EXCLUSIVAMENTE com JSON valido, sem cercas de codigo.",
  ].join(" ");

  const usuario = [
    `DATA DE HOJE: ${hoje}. Ano corrente: ${anoAtual}.`,
    "",
    "MANCHETES COLETADAS (RSS, Reddit, Google News):",
    manchetes.slice(0, 40).map((m, i) => `${i + 1}. ${String(m).slice(0, 160)}`).join("\n") || "(nenhuma)",
    "",
    "TERMOS EM ALTA (por frequencia):",
    trending.slice(0, 10).map(([k, v]) => `- ${k} (${v}x)`).join("\n") || "(nenhum)",
    "",
    "JA PUBLICADO PELO BLOG (nao repetir):",
    jaCobertos.slice(0, 20).map((c, i) => `${i + 1}. ${String(c).slice(0, 80)}`).join("\n") || "(nenhum)",
    "",
    "TAREFA — nesta ordem:",
    "",
    "1. AGRUPAR: manchetes diferentes sobre o MESMO acontecimento sao UM assunto.",
    "   Ex.: 'Novo Zelda anunciado', 'Nintendo revela remake' e 'Ocarina of Time Remake e anunciado'",
    "   sao um unico assunto: 'Ocarina of Time Remake'.",
    "",
    "2. NOMEAR: cada assunto recebe um nome especifico e proprio, como manchete curta.",
    "   NUNCA use categoria generica ('lancamentos de games', 'novidades de hardware').",
    "   Se o assunto nao tiver nome proprio, ele nao vira pauta.",
    "",
    "3. PONTUAR de 0 a 10 em cada criterio:",
    "   - interesse: o quanto esta movimentando agora (varias fontes cobrindo = alto)",
    "   - buscaPotencial: o quanto as pessoas vao pesquisar sobre isso nos proximos dias",
    "   - novidade: fato novo e datavel = alto; assunto perene = baixo",
    "   - seo: rende palavra-chave com intencao clara (preco, data, como fazer) = alto",
    "   - relevancia: interessa ao publico gamer brasileiro",
    "   - comercial: existe produto com relacao NATURAL com o assunto (nao force)",
    "",
    "4. DESCARTAR (nao inclua no resultado):",
    "   - assunto ja publicado pelo blog",
    "   - sem novidade real (so repeticao do que ja se sabia)",
    "   - fora do nicho gamer",
    "   - apostas, cassino, caca-niqueis, jogos de azar (proibido sempre)",
    "   - baseado apenas em rumor sem veiculo confiavel",
    "",
    "5. DEFINIR o formato mais adequado a cada assunto:",
    "   noticia (fato novo) | guia (como fazer) | lista (ranking) | review (analise)",
    "",
    `Devolva no maximo ${maxPautas} assuntos, do mais forte ao mais fraco:`,
    '[{"assunto":"nome proprio e especifico","formato":"noticia|guia|lista|review",',
    '"oQueAconteceu":"1 frase factual","porQueAgora":"1 frase",',
    '"palavraChave":"termo principal que as pessoas buscam",',
    '"criterios":{"interesse":0-10,"buscaPotencial":0-10,"novidade":0-10,"seo":0-10,"relevancia":0-10,"comercial":0-10}}]',
  ].join("\n");

  let bruto;
  try {
    bruto = await fetchLLM(sistema, usuario, 2, { maxTokens: 2500, temperature: 0.3 });
  } catch (e) {
    log("WARN", `Montagem da pauta falhou: ${e.message}`);
    return [];
  }

  const lista = extrairJson(bruto);
  if (!Array.isArray(lista)) {
    log("WARN", "Resposta da pauta nao era um array JSON");
    return [];
  }

  const pautas = lista
    .filter((p) => p && typeof p.assunto === "string" && p.assunto.trim().length >= 4)
    .map((p) => ({
      assunto: String(p.assunto).trim().slice(0, 120),
      formato: ["noticia", "guia", "lista", "review"].includes(String(p.formato || "").toLowerCase())
        ? String(p.formato).toLowerCase()
        : "noticia",
      oQueAconteceu: String(p.oQueAconteceu || "").slice(0, 300),
      porQueAgora: String(p.porQueAgora || "").slice(0, 300),
      palavraChave: String(p.palavraChave || p.assunto).trim().slice(0, 80),
      criterios: p.criterios || {},
      nota: notaFinal(p.criterios),
    }))
    // Rede de seguranca contra o defeito que gerou "titulo de headset com corpo
    // de teclado": assunto em forma de lista de categorias nao e assunto.
    .filter((p) => (p.assunto.match(/,/g) || []).length < 2)
    .sort((a, b) => b.nota - a.nota);

  log("INFO", `Pauta do dia: ${pautas.length} assunto(s)`);
  for (const p of pautas) {
    log("INFO", `  ${String(p.nota).padStart(3)}/100 [${p.formato}] ${p.assunto}`);
  }
  return pautas;
}

// Grava a pauta para o operador poder abrir e conferir a decisao editorial.
export function salvarPauta(pautas, escolhido = null) {
  try {
    if (!fs.existsSync(PAUTA_DIR)) fs.mkdirSync(PAUTA_DIR, { recursive: true });
    const dia = new Date().toISOString().slice(0, 10);
    const arquivo = path.join(PAUTA_DIR, `${dia}.json`);
    let anterior = [];
    if (fs.existsSync(arquivo)) {
      try {
        anterior = JSON.parse(fs.readFileSync(arquivo, "utf-8")).rodadas || [];
      } catch {}
    }
    anterior.push({
      hora: new Date().toISOString(),
      escolhido: escolhido ? escolhido.assunto : null,
      pautas,
    });
    fs.writeFileSync(arquivo, JSON.stringify({ dia, rodadas: anterior }, null, 2), "utf-8");
    log("INFO", `Pauta gravada em ${arquivo}`);
    return arquivo;
  } catch (e) {
    log("WARN", `Nao consegui gravar a pauta: ${e.message}`);
    return null;
  }
}

export default montarPauta;
