// Briefing do artigo — o roteiro que o redator recebe antes de escrever.
//
// Por que existe: o pipeline entregava ao redator um tema curto e um monte de
// regras de estrutura, e pedia o artigo inteiro numa tacada. E o equivalente a
// mandar um jornalista apurar e escrever no mesmo minuto. O resultado era texto
// formalmente correto e editorialmente vazio — titulo prometendo uma coisa,
// corpo entregando outra.
//
// O briefing separa "o que dizer" de "como escrever". Ele responde, ANTES do
// texto existir:
//   - qual o titulo e a palavra-chave
//   - o que o leitor quer saber (intencao de busca)
//   - quais fatos entram, com a fonte e o grau de confianca de cada um
//   - qual a sequencia de secoes
//
// E fica gravado. Se o artigo sair ruim, da para ver onde quebrou: o assunto
// era fraco, a pesquisa nao achou os fatos, ou a escrita nao cumpriu o roteiro.
import fs from "fs";
import path from "path";

const BRIEF_DIR = path.resolve(
  "squads", "marketing", "conteudo-digital", "blog-gamer", "output", "briefings"
);

function log(nivel, msg) {
  const hora = new Date().toTimeString().slice(0, 8);
  console.log(`[${hora}] [briefing] [${nivel}] ${msg}`);
}

function extrairJson(texto) {
  const limpo = String(texto || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini === -1 || fim === -1) return null;
  try {
    return JSON.parse(limpo.slice(ini, fim + 1));
  } catch {
    return null;
  }
}


// V13 — Atualidade: ultima olhada no noticiario antes de fechar o roteiro.
// Falha de rede ou de API NUNCA bloqueia: sem resposta, o briefing segue.
export async function verificarAtualidade({ assunto, fatosExistentes = [] }) {
  const chave = process.env.TAVILY_API_KEY;
  if (!chave || !assunto) return null;

  let resultados = [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: chave,
        query: `${assunto} noticias hoje`,
        search_depth: "basic",
        max_results: 5,
        days: 1,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      resultados = (d.results || []).map((r) => ({ title: r.title || "", content: String(r.content || "").slice(0, 500), url: r.url || "" }));
    }
  } catch (e) {
    log("WARN", `Busca de atualidade falhou: ${e.message}`);
    return null;
  }

  if (resultados.length === 0) return null;
  return { resultados };
}
export async function montarBriefing({ assunto, formato = "noticia", palavraChave = "", fontes = [], fatos = [], fetchLLM }) {
  if (typeof fetchLLM !== "function") return null;

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const anoAtual = new Date().getFullYear();

  // As fontes chegam ja ordenadas por hierarquia (oficial -> imprensa -> resto).
  // Manter essa ordem no prompt e o que faz o redator preferir o oficial.
  const blocoFontes = fontes.slice(0, 8)
    .map((f, i) => `[${i + 1}] ${f.title || "(sem titulo)"}\n    ${f.url || ""}`)
    .join("\n") || "(nenhuma fonte)";

  const blocoFatos = fatos.slice(0, 12)
    .map((f) => `- ${f.fato || f}${f.fonte ? ` (fonte: ${f.fonte}${f.confianca ? `, confianca ${f.confianca}` : ""})` : ""}`)
    .join("\n") || "(nenhum fato extraido)";

  const sistema = [
    "Voce e o editor que prepara a pauta para o redator do blog gamer.",
    "Voce NAO escreve o artigo — voce entrega o roteiro dele.",
    "Trabalhe SOMENTE com os fatos e fontes fornecidos. Nao acrescente informacao de fora.",
    "Responda EXCLUSIVAMENTE com JSON valido, sem cercas de codigo.",
  ].join(" ");

  const usuario = [
    `DATA DE HOJE: ${hoje}. Ano corrente: ${anoAtual}.`,
    `ASSUNTO: ${assunto}`,
    `FORMATO: ${formato}`,
    palavraChave ? `PALAVRA-CHAVE SUGERIDA: ${palavraChave}` : "",
    "",
    "FONTES (na ordem de confiabilidade — a primeira e a mais confiavel):",
    blocoFontes,
    "",
    "FATOS EXTRAIDOS DA PESQUISA:",
    blocoFatos,
    "",
    "Monte o roteiro do artigo:",
    "",
    "1. TITULO: 55-65 caracteres, no formato ASSUNTO: o que acontece.",
    "   Ex.: Fortnite: Epic Games traz skins do Mega Man X e Zero para o jogo em 2026.",
    "   Comeca pelo nome do JOGO/FRANQUIZA/PLATAFORMA (o que o leitor busca), seguido de dois-pontos e do fato concreto, dizendo quem fez o que.",
    "   NUNCA comece pelo assunto secundario. Sem clickbait e sem promessa que o corpo nao cumpre.",
    "2. INTENCAO DE BUSCA: o que a pessoa quer ao pesquisar isso?",
    "   informacional (quer saber) | comercial (quer comparar) | transacional (quer comprar)",
    "3. PERGUNTAS: 3 a 6 perguntas que o leitor faz sobre o assunto e que o",
    "   artigo precisa responder (data, preco, plataforma, o que mudou...).",
    "4. SECOES: a sequencia de H2, criada a partir dos FATOS QUE EXISTEM.",
    "   Nao invente secao para engordar o texto: se nao ha fato para sustentar,",
    "   a secao nao entra.",
    "5. FATOS OBRIGATORIOS: os que o artigo precisa conter, cada um com a fonte.",
    "   Classifique cada um:",
    "     confirmado — vem de fonte oficial, pode ser afirmado",
    "     reportado  — vem de veiculo confiavel, escrever como 'segundo X'",
    "     rumor      — nao confirmado, so entra se for relevante e marcado como tal",
    "6. NAO ESCREVER: pontos que as fontes NAO sustentam e que o redator poderia",
    "   ser tentado a afirmar.",
    "",
    "Formato:",
    '{"titulo":"","palavraChave":"","palavrasSecundarias":[""],',
    '"intencaoBusca":"informacional|comercial|transacional",',
    '"perguntas":[""],"secoes":[{"h2":"","oQueCobrir":""}],',
    '"fatosObrigatorios":[{"fato":"","fonte":"","status":"confirmado|reportado|rumor"}],',
    '"naoEscrever":[""]}',
  ].filter(Boolean).join("\n");

  let bruto;
  try {
    bruto = await fetchLLM(sistema, usuario, 2, { maxTokens: 2000, temperature: 0.2 });
  } catch (e) {
    log("WARN", `Briefing falhou: ${e.message} — o artigo segue sem roteiro`);
    return null;
  }

  const b = extrairJson(bruto);
  if (!b || !b.titulo) {
    log("WARN", "Resposta do briefing sem titulo utilizavel");
    return null;
  }

  const briefing = {
    assunto,
    formato,
    titulo: String(b.titulo).trim().slice(0, 120),
    palavraChave: String(b.palavraChave || palavraChave || "").trim().slice(0, 80),
    palavrasSecundarias: Array.isArray(b.palavrasSecundarias) ? b.palavrasSecundarias.slice(0, 8).map(String) : [],
    intencaoBusca: String(b.intencaoBusca || "informacional").toLowerCase(),
    perguntas: Array.isArray(b.perguntas) ? b.perguntas.slice(0, 8).map(String) : [],
    secoes: Array.isArray(b.secoes) ? b.secoes.slice(0, 12) : [],
    fatosObrigatorios: Array.isArray(b.fatosObrigatorios) ? b.fatosObrigatorios.slice(0, 15) : [],
    naoEscrever: Array.isArray(b.naoEscrever) ? b.naoEscrever.slice(0, 8).map(String) : [],
  };

  const confirmados = briefing.fatosObrigatorios.filter((f) => f.status === "confirmado").length;

  // V13: ultima verificacao de atualidade. Compara as manchetes das ultimas
  // 24h com os fatos do roteiro; novidade factual relevante entra marcada,
  // para o redator incluir com atribuicao. Qualquer falha aqui e silenciosa.
  try {
    const fresco = await verificarAtualidade({ assunto: briefing.assunto || briefing.titulo });
    if (fresco && fresco.resultados.length > 0) {
      const jaTem = briefing.fatosObrigatorios.map((f) => String(f.fato || "").toLowerCase());
      const sistemaNovo = "Voce e o verificador de atualidade do blog gamer. Compare as MANCHETES RECENTES com os FATOS JA NO ARTIGO. Identifique SOMENTE fato novo, concreto e relevante (data revelada, preco divulgado, confirmacao oficial, desmentido) que NAO esteja nos fatos ja coletados. Rumor vagou ou repeticao de noticia nao conta. Responda APENAS com JSON: {\"novidade\":bool,\"fato\":\"...\",\"fonte\":\"...\"} — se nao houver novidade, {\"novidade\":false}.";
// ( fim do sistemaNovo )
      const usuarioNovo = [
        `ASSUNTO: ${briefing.assunto || briefing.titulo}`,
        "FATOS JA COLETADOS:",
        ...(jaTem.length ? jaTem : ["(nenhum)"]).map((f) => `- ${f}`),
        "",
        "MANCHETES DAS ULTIMAS 24H:",
        ...fresco.resultados.map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`),
      ].join("\n");
      const brutoNovo = await fetchLLM(sistemaNovo, usuarioNovo, 2, { maxTokens: 400, temperature: 0.1 });
      const jNovo = extrairJson(brutoNovo);
      if (jNovo && jNovo.novidade && jNovo.fato) {
        briefing.fatosObrigatorios.push({
          fato: `[NOVIDADE DE ULTIMA HORA] ${String(jNovo.fato).slice(0, 300)}`,
          fonte: String(jNovo.fonte || "imprensa").slice(0, 120),
          status: "reportado",
        });
        log("INFO", `Atualidade: novidade detectada e incluida no roteiro — ${String(jNovo.fato).slice(0, 100)}`);
      } else {
        log("INFO", "Atualidade: nada de relevante mudou desde a pesquisa");
      }
    }
  } catch (e) {
    log("WARN", `Verificacao de atualidade falhou (nao bloqueia): ${e.message}`);
  }

  log("INFO", `Briefing: "${briefing.titulo}"`);
  log("INFO", `  intencao: ${briefing.intencaoBusca} | ${briefing.secoes.length} secoes | ${briefing.fatosObrigatorios.length} fatos (${confirmados} confirmado(s)) | ${briefing.naoEscrever.length} veto(s)`);
  return briefing;
}

// Converte o briefing no trecho que entra no prompt de escrita.
export function briefingParaPrompt(briefing) {
  if (!briefing) return "";
  const linhas = [
    "## ROTEIRO DESTE ARTIGO (siga-o — ele foi montado a partir das fontes)",
    `TITULO: ${briefing.titulo}`,
    `PALAVRA-CHAVE: ${briefing.palavraChave}`,
  ];
  if (briefing.palavrasSecundarias.length) {
    linhas.push(`TERMOS RELACIONADOS (use com naturalidade, sem forcar): ${briefing.palavrasSecundarias.join(", ")}`);
  }
  linhas.push(`INTENCAO DE BUSCA: ${briefing.intencaoBusca} — escreva para quem quer isso.`);
  if (briefing.perguntas.length) {
    linhas.push("", "PERGUNTAS QUE O ARTIGO PRECISA RESPONDER:", ...briefing.perguntas.map((p) => `- ${p}`));
  }
  if (briefing.secoes.length) {
    linhas.push("", "SECOES (use esta sequencia; adapte a redacao, nao a ordem):");
    for (const s of briefing.secoes) {
      linhas.push(`- ## ${s.h2}${s.oQueCobrir ? ` — ${s.oQueCobrir}` : ""}`);
    }
  }
  if (briefing.fatosObrigatorios.length) {
    linhas.push("", "FATOS QUE O ARTIGO PRECISA CONTER:");
    for (const f of briefing.fatosObrigatorios) {
      const marca = f.status === "confirmado" ? "[CONFIRMADO]"
        : f.status === "rumor" ? "[RUMOR — deixe claro que nao foi confirmado]"
        : "[REPORTADO — escreva como 'segundo " + (f.fonte || "a fonte") + "']";
      linhas.push(`- ${marca} ${f.fato}${f.fonte ? ` (${f.fonte})` : ""}`);
    }
  }
  if (briefing.naoEscrever.length) {
    linhas.push("", "NAO AFIRME (as fontes nao sustentam):", ...briefing.naoEscrever.map((n) => `- ${n}`));
  }
  return linhas.join("\n");
}

export function salvarBriefing(briefing, slug = "") {
  if (!briefing) return null;
  try {
    if (!fs.existsSync(BRIEF_DIR)) fs.mkdirSync(BRIEF_DIR, { recursive: true });
    const dia = new Date().toISOString().slice(0, 10);
    const nome = `${dia}-${(slug || briefing.assunto).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}.json`;
    const arquivo = path.join(BRIEF_DIR, nome);
    fs.writeFileSync(arquivo, JSON.stringify(briefing, null, 2), "utf-8");
    log("INFO", `Briefing gravado em ${arquivo}`);
    return arquivo;
  } catch (e) {
    log("WARN", `Nao consegui gravar o briefing: ${e.message}`);
    return null;
  }
}

export default montarBriefing;
