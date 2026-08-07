// Fonte UNICA do ano usado em queries, prompts, titulos e headings.
//
// Antes o ano estava escrito a mao ("2026") em ~15 pontos do gerador. Alem de
// virar divida no dia 1º de janeiro, isso nao impedia a LLM de escrever outro
// ano no titulo ("Top 5 mouse gamer de 2024") — o prompt pedia um ano, o modelo
// devolvia outro e ninguem conferia. Aqui ficam o ano corrente e a correcao
// deterministica pos-LLM.

// ANO_ARTIGO permite fixar o ano em teste/backfill sem mexer no relogio.
export const ANO_ATUAL = Number(process.env.ANO_ARTIGO) || new Date().getFullYear();

// Ano seguinte e legitimo em texto ("lancamentos previstos para 2027"), entao
// nao e corrigido. Qualquer outro 20XX no titulo e erro do modelo.
export const ANOS_VALIDOS = new Set([ANO_ATUAL, ANO_ATUAL + 1]);

const ANO_RE = /\b(20\d{2})\b/g;

export function anoValido(ano) {
  return ANOS_VALIDOS.has(Number(ano));
}

// Devolve os anos invalidos citados no texto (sem repeticao).
export function anosInvalidos(texto) {
  const achados = new Set();
  for (const m of String(texto || "").matchAll(ANO_RE)) {
    if (!anoValido(m[1])) achados.add(m[1]);
  }
  return [...achados];
}

// Troca todo 20XX fora de ANOS_VALIDOS pelo ano corrente. Usado em titulo,
// description e no heading da lista — os tres lugares onde um ano velho
// desmente o artigo inteiro.
export function normalizarAnos(texto) {
  if (typeof texto !== "string" || !texto) return texto;
  return texto.replace(ANO_RE, (m) => (anoValido(m) ? m : String(ANO_ATUAL)));
}
