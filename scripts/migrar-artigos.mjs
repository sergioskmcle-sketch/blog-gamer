// TAREFA 7 — migracao dos artigos ja publicados para o novo formato.
//
// Para cada src/content/artigos/*.md:
//   1. remove o bloco "## Indice" (heading + lista de links que o segue);
//   2. remove os headings "## Introducao" — o plugin de secoes envolve o que
//      vem antes do primeiro H2 no container #introducao (TAREFA 3.2);
//   3. rebaixa de ## para ### apenas headings que sao PRODUTOS dentro de
//      artigos de lista (ha um topico "Os N Melhores"/"Ranking dos"), com
//      titulo limpo via cleanProductTitle (preservando a tagline apos " — ")
//      e ancora regenerada;
//   4. nao toca em local_thumbnail / src de imagens.
//
// A regra "produto" evita rebaixar secoes editoriais de artigos de noticia:
// o heading precisa (a) nao ser secao fixa, (b) vir depois do topico da
// lista e (c) ter sinal de produto na secao (botao, imagem de produto ou
// <img> logo apos o heading).
//
// Uso:
//   node scripts/migrar-artigos.mjs          # dry-run: so imprime o diff
//   node scripts/migrar-artigos.mjs --apply  # grava as alteracoes
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanProductTitle } from "./product_naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIGOS_DIR = path.resolve(__dirname, "..", "src", "content", "artigos");
const APPLY = process.argv.includes("--apply");

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isFixedSection(text) {
  const t = String(text || "").trim();
  if (/^os\s+\d+\s+melhores\b/i.test(t)) return true;      // topico da lista
  if (/^ranking dos\b/i.test(t)) return true;              // ranking
  if (/^(comparativo|tabela)/i.test(t)) return true;
  if (/^(veredito|conclus[aã]o)/i.test(t)) return true;
  if (/^(faq|perguntas\s+frequentes?)/i.test(t)) return true;
  if (/^fontes:?\s*$/i.test(t)) return true;
  if (/^quer\s+mais\s+ofertas\??/i.test(t)) return true;
  if (/^continue\s+explorando/i.test(t)) return true;
  if (/^como\s+escolhemos/i.test(t)) return true;
  if (/^qual\b.*\bescolher\??/i.test(t)) return true;
  if (/^pr[oó]s\s+e\s+contras/i.test(t)) return true;
  if (/^produtos\s+recomendados/i.test(t)) return true;
  return false;
}

function parseHeading(line) {
  // Linha "## ..." (H2) — devolve a ancora embutida (se houver) e o texto.
  const rest = line.slice(line.indexOf("## ") + 3).trim();
  let anchor = "";
  let text = rest;
  const a = rest.match(/^<a\s+id="([^"]+)"[^>]*>\s*<\/a>\s*(.+)$/i);
  if (a) {
    anchor = a[1];
    text = a[2].trim();
  }
  return { anchor, text };
}

function sectionOf(content, headingIndex) {
  const rest = content.slice(headingIndex);
  const m = rest.match(/^##\s+/m); // next H2 (nao casa com ###)
  if (m && m.index > 0) return rest.slice(0, m.index);
  return rest;
}

function looksLikeProductSection(section) {
  if (/product-btn/.test(section)) return true;
  if (/product-card-img/.test(section)) return true;
  if (/^\s*<img\b/.test(section)) return true; // foto do produto logo apos o heading
  return false;
}

function cleanTitleForHeading(rawTitle) {
  const cleaned = cleanProductTitle(rawTitle).trim();
  // Guarda de seguranca: se a limpeza virar palavra unica/genérica demais
  // (ex.: "Teclado" vindo de um titulo Shopee cru), preserva o original.
  if (cleaned && cleaned.split(/\s+/).length >= 2) return cleaned;
  return String(rawTitle || "").trim();
}

function migrateContent(content) {
  const changes = [];
  let out = content;

  // 1. Bloco "## Indice" (heading + lista de links).
  const indiceRe =
    /^##\s*(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?[ÍI]ndice\s*$\n(?:[ \t]*\n|[ \t]*\d+\.\s[^\n]*\n)+/gm;
  const mIndice = out.match(indiceRe);
  if (mIndice) {
    changes.push(`  remove bloco "## Indice" (${mIndice[0].split("\n").length - 1} linhas de lista)`);
    out = out.replace(indiceRe, "");
  }

  // 2. Headings "## Introducao".
  const introRe = /^##\s*(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?Introdu[cç][aã]o[^\n]*\n[ \t]*\n?/gim;
  const introHits = out.match(introRe);
  if (introHits) {
    changes.push(`  remove ${introHits.length} heading(s) "## Introducao"`);
    out = out.replace(introRe, "");
  }

  // 3. Rebaixar produtos. So quando ha um topico de lista no artigo.
  const topicMatch = out.match(/^##\s+(?:<a[^>]*>\s*<\/a>\s*)?(os\s+\d+\s+melhores|ranking dos)\b/im);
  const isListArticle = Boolean(topicMatch);
  const usedSlugs = new Set();
  const lines = out.split(/\r?\n/);
  const rebuilt = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(\S.*)$/);
    if (!m) {
      rebuilt.push(line);
      continue;
    }
    const { anchor, text } = parseHeading(line);
    const isTopic = /^(os\s+\d+\s+melhores|ranking dos)\b/i.test(text);
    if (!isListArticle || isFixedSection(text) || isTopic) {
      rebuilt.push(line);
      continue;
    }
    const idx = out.indexOf(line);
    const section = sectionOf(out, idx);
    if (!looksLikeProductSection(section)) {
      rebuilt.push(line);
      continue;
    }

    const parts = text.match(/^(.+?)\s*—\s*(.+)$/);
    const titlePart = parts ? parts[1] : text;
    const tagline = parts ? parts[2].trim() : "";
    const newTitle = cleanTitleForHeading(titlePart);
    const fullText = tagline ? `${newTitle} — ${tagline}` : newTitle;
    const slug = (() => {
      const base = slugify(fullText) || "produto";
      let candidate = base;
      let n = 2;
      while (usedSlugs.has(candidate)) candidate = `${base}-${n++}`;
      usedSlugs.add(candidate);
      return candidate;
    })();

    const oldLabel = anchor ? text : text;
    changes.push(`  ## -> ###: "${oldLabel}"  =>  "### ${fullText}"`);
    rebuilt.push(`### <a id="${slug}"></a>${fullText}`);
  }
  out = rebuilt.join("\n");

  return { out, changes };
}

const files = fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).sort();
let totalChanges = 0;

for (const file of files) {
  const filePath = path.join(ARTIGOS_DIR, file);
  const original = fs.readFileSync(filePath, "utf-8");
  const { out, changes } = migrateContent(original);
  if (changes.length === 0) continue;

  console.log(`\n=== ${file} ===`);
  for (const c of changes) console.log(c);
  totalChanges += changes.length;

  if (APPLY) fs.writeFileSync(filePath, out, "utf-8");
}

console.log(`\n${files.length} artigo(s) varridos.${APPLY ? " ALTERACOES GRAVADAS." : " Dry-run — nada foi gravado. Rode com --apply para aplicar."}`);
console.log(`Total de alteracoes: ${totalChanges}`);
