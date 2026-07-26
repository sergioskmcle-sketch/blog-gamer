const WORDS_PER_MINUTE = 200;

/**
 * Conta palavras do markdown bruto, ignorando o que não é texto lido:
 * blocos de código, tags HTML (product-cards, imgs), URLs e sintaxe markdown.
 */
export function countWords(raw: string): number {
  const text = (raw || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*_>|~`]/g, " ");

  return text.split(/\s+/).filter(Boolean).length;
}

export function readingTime(raw: string): number {
  return Math.max(1, Math.round(countWords(raw) / WORDS_PER_MINUTE));
}
