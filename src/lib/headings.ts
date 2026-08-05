import { tagSlug } from "./slug";

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export function extractHeadings(raw: string): Heading[] {
  const headings: Heading[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const depth = m[1].length;
    const anchor = m[2].match(/id="([^"]+)"/);
    const slug = anchor ? anchor[1] : "";
    const text = m[2]
      .replace(/<a[^>]*>.*?<\/a>/g, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (!text || /^índice$/i.test(text)) continue;
    headings.push({ depth, slug: slug || tagSlug(text), text });
  }
  return headings;
}
