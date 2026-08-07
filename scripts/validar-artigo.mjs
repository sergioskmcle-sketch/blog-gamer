// Portao de qualidade dos artigos (checklist V3 do plano de reformulacao).
// Valida o markdown de um artigo gerado/regenerado e falha com exit 1 se
// algum criterio HARD nao passar. O cron e o workflow de regeneracao usam
// este script para NAO publicar artigo ruim.
//
// Uso:
//   node scripts/validar-artigo.mjs <arquivo.md> [<arquivo2.md> ...]
//   node scripts/validar-artigo.mjs --all
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  KNOWN_BRANDS,
  detectArticleCategory,
  productMatchesCategory,
} from "./product_naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIGOS_DIR = path.resolve(__dirname, "..", "src", "content", "artigos");
const PROD_IMAGES_DIR = path.resolve(__dirname, "..", "public", "images", "produtos");

const BRANDS = Object.keys(KNOWN_BRANDS);
const BRAND_RE = new RegExp(`(^|[^a-z])(${BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^a-z]|$)`, "i");
const MODEL_RE = /\b[A-Z]{1,4}[- ]?\d{2,5}[A-Z-]{0,4}\b/;
const YEAR_AT_START_RE = /^(20(1[5-9]|2[0-9]|3[0-5]))\b/i;
const FIXED_SECTIONS = /^(comparativo|tabela|veredito|conclus[aã]o|faq|perguntas\s+frequentes?|fontes|quer\s+mais\s+ofertas\??|continue\s+explorando|como\s+escolhemos|qual\b.*\bescolher\??|pr[oó]s\s+e\s+contras|produtos\s+recomendados)/i;

let failures = 0;

function fail(file, msg) {
  failures++;
  console.error(`  [FALHA] ${file}: ${msg}`);
}

function parseFrontmatter(text) {
  text = String(text || "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const fm = {};
  let listKey = null;
  for (const line of match[1].split("\n")) {
    const listItem = line.match(/^\s+- (.+)$/);
    if (listItem) {
      if (listKey) fm[listKey].push(listItem[1].trim().replace(/^"|"$/g, ""));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) { listKey = null; continue; }
    const key = kv[1].trim();
    let val = kv[2].trim();
    listKey = null;
    if (val === "") { listKey = key; fm[key] = []; continue; }
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    }
    if (val === "true") val = true;
    if (val === "false") val = false;
    fm[key] = val;
  }
  return { fm, body: match[2] };
}

function extractProductHeadings(body) {
  const lines = body.split("\n");
  const topicIdx = lines.findIndex((l) => /^##\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(os\s+\d+\s+melhores|ranking dos)\b/i.test(l));
  if (topicIdx === -1) return [];
  const out = [];
  for (let i = topicIdx + 1; i < lines.length; i++) {
    const h2 = lines[i].match(/^##\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(.+)$/);
    if (h2 && FIXED_SECTIONS.test(h2[1].trim())) break; // fim da lista
    const m = lines[i].match(/^###\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(.+)$/);
    if (m) {
      const text = m[1].trim().replace(/\s*—\s+.+$/, "").trim();
      if (text) out.push(text);
    }
  }
  return out;
}

function sectionFor(imgIndex, lines) {
  // Volta da linha do <img> ate o heading ### mais proximo para saber a qual
  // produto a imagem pertence.
  for (let i = imgIndex; i >= 0; i--) {
    const m = lines[i].match(/^###\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(.+)$/);
    if (m) return m[1].trim().replace(/\s*—\s+.+$/, "").trim();
  }
  return "";
}

function validateArticle(file) {
  const fp = path.join(ARTIGOS_DIR, file);
  if (!fs.existsSync(fp)) {
    fail(file, "arquivo nao existe");
    return;
  }
  const content = fs.readFileSync(fp, "utf-8").replace(/\r\n/g, "\n");
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    fail(file, "frontmatter invalido");
    return;
  }
  const { fm, body } = parsed;

  // 1. Nenhum indice duplicado "## Indice".
  if (/^##\s*(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?[ÍI]ndice\s*$/m.test(body)) {
    fail(file, 'contem "## Indice" (indice duplicado) — deve ter sumido na geracao');
  }

  const hasProductImages = /src="\/images\/produtos\//.test(body);
  if (!hasProductImages) return; // artigo sem produtos: so o indice importa aqui

  const hasListTopic = /^##\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(os\s+\d+\s+melhores|ranking dos)\b/im.test(body);

  // 2. Secao de metodologia em artigo de lista com produtos.
  if (hasListTopic && !/^##\s+como\s+escolhemos/im.test(body)) {
    fail(file, "faltando secao '## Como Escolhemos' (metodologia de ranking)");
  }

  // 3. Tabela comparativa com coluna "Por que entrou".
  const comparativo = body.match(/^##\s+comparativo\s*$/im);
  if (hasListTopic && comparativo) {
    const tableBlock = body.slice(comparativo.index);
    if (!/por\s+que\s+entrou/i.test(tableBlock.slice(0, 2000))) {
      fail(file, "tabela Comparativo sem coluna 'Por que entrou'");
    }
  }

  // 4. Categoria do artigo (so se detectavel).
  const topic = {
    hint: String(fm.title || ""),
    title: String(fm.title || ""),
    category: String(fm.category || ""),
    ml_query: String(fm.title || ""),
    trending_keywords: Array.isArray(fm.tags) ? fm.tags : [],
  };
  const articleCat = detectArticleCategory(topic);

  // 5. Produtos: headings ###, titulo curto/sem ano, categoria certa, imagem local.
  const productTitles = extractProductHeadings(body);
  if (hasListTopic && productTitles.length === 0) {
    fail(file, "artigo tem imagem de produto mas nenhum heading ### de produto");
  }

  for (const title of productTitles) {
    if (YEAR_AT_START_RE.test(title)) {
      fail(file, `produto comeca com ano: "${title}"`);
    }
    if (title.length > 60) {
      fail(file, `nome de produto > 60 chars (${title.length}): "${title}"`);
    }
    if (!BRAND_RE.test(title) && !MODEL_RE.test(title)) {
      fail(file, `nome de produto sem marca/modelo reconheciveis: "${title}"`);
    }
    if (articleCat && !productMatchesCategory(title, articleCat)) {
      fail(file, `produto fora da categoria "${articleCat}" do artigo: "${title}"`);
    }
  }

  // 6. Toda imagem de produto referenciada existe localmente.
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/src="(\/images\/produtos\/[^"]+)"/);
    if (!m) continue;
    const relFile = m[1].replace(/^\//, "");
    const localPath = path.join(__dirname, "..", "public", relFile);
    if (!fs.existsSync(localPath)) {
      const sec = sectionFor(i, lines) || "?";
      fail(file, `imagem de produto nao existe em public/${relFile} (produto: "${sec}")`);
    }
  }
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--all");
  let files;
  if (process.argv.includes("--all")) {
    files = fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md")).sort();
  } else if (args.length > 0) {
    files = args.map((a) => (a.endsWith(".md") ? a : `${a}.md`));
  } else {
    console.error("Use: node scripts/validar-artigo.mjs <arquivo.md> [--all]");
    process.exit(2);
  }

  for (const file of files) validateArticle(file);

  console.log(`\n${files.length} artigo(s) validado(s) — ${failures} falha(s).`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
