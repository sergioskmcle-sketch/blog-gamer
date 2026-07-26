/**
 * "God of War" -> "god-of-war". Remove acentos para que tags como
 * "lancamentos" gerem URLs ASCII estaveis.
 */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .normalize("NFD")
    // Faixa de diacriticos combinantes, em escapes para nao depender do encoding do arquivo.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
