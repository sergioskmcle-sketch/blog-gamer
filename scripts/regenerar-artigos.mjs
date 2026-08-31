// Regenera artigos existentes com o pipeline ATUAL (limpeza de nome, filtro
// de categoria, ranking objetivo, validacao de imagem) sem trocar o slug nem
// a pubDate. Reutiliza as imagens locais de produtos que se mantiveram e
// baixa as de produtos novos.
//
// Uso:
//   node scripts/regenerar-artigos.mjs --slug <slug> [--apply]
//   node scripts/regenerar-artigos.mjs --all [--apply]
//   node scripts/regenerar-artigos.mjs --slug <slug>   # dry-run padrao
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { generateArticle } from "./gerar-artigo.mjs";
import { CATEGORY_BRANDS, PRODUCT_CATEGORIES, detectArticleCategory, detectBrand, detectModel } from "./product_naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIGOS_DIR = path.resolve(__dirname, "..", "src", "content", "artigos");
const APPLY = process.argv.includes("--apply");

function parseArgs() {
  const slugIdx = process.argv.indexOf("--slug");
  const slug = slugIdx !== -1 && process.argv[slugIdx + 1] ? process.argv[slugIdx + 1] : null;
  const all = process.argv.includes("--all");
  return { slug, all };
}

function parseFrontmatter(text) {
  text = String(text || "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Frontmatter nao encontrado");
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

// Mapa titulo-antigo do produto -> caminho local da imagem, para reusar a
// foto quando o mesmo produto se mantiver na regeneracao.
function buildReuseImageMap(body) {
  const map = new Map();
  let currentTitle = null;
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^###\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(.+)$/);
    if (h) {
      currentTitle = h[1].trim().replace(/\s*—\s*.+$/, "").trim();
      continue;
    }
    const img = line.match(/<img\s+src="(\/images\/produtos\/[^"]+)"/);
    if (img && currentTitle) {
      map.set(currentTitle, img[1]);
      currentTitle = null;
    }
  }
  return map;
}

// Consultas extras para a busca remota na regeneracao. Queries de marca da
// categoria (ex.: "teclado Redragon") trazem produtos com nome reconhecivel;
// titulos antigos genéricos re-trazem os MESMOS produtos sem marca que o
// portao de qualidade reprova — por isso so entram os que tem marca/modelo.
function buildExtraQueries(body, fm) {
  const topic = buildTopic(fm, "");
  const categoria = detectArticleCategory(topic);
  const label = PRODUCT_CATEGORIES[categoria]?.label || "";
  const marcas = CATEGORY_BRANDS[categoria] || [];
  const queries = [];
  if (label && marcas.length > 0) {
    queries.push(...marcas.slice(0, 3).map((marca) => `${label} ${marca}`));
  }

  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^###\s+(?:<a\s+id="[^"]*"[^>]*>\s*<\/a>\s*)?(.+)$/);
    if (!h) continue;
    const t = h[1].trim().replace(/\s*—\s*.+$/, "").trim();
    if (!t || queries.includes(t)) continue;
    if (detectBrand(t) || detectModel(t)) queries.push(t);
  }
  return queries.slice(0, 5);
}

function buildTopic(fm, slug) {
  const tags = Array.isArray(fm.tags) && fm.tags.length > 0 ? fm.tags : [];
  const keyword = tags[0] || fm.title || "";
  return {
    hint: String(fm.title || slug || "").trim(),
    title: String(fm.title || "").trim(),
    category: String(fm.category || "lista"),
    trending_keywords: tags,
    ml_query: keyword ? `${keyword} gamer` : "",
  };
}

function listArticleFiles() {
  return fs
    .readdirSync(ARTIGOS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function hasProductImages(body) {
  return /src="\/images\/produtos\//.test(body);
}

async function main() {
  const { slug, all } = parseArgs();
  if (!slug && !all) {
    console.error("Use --slug <slug> ou --all");
    process.exit(2);
  }

  const files = listArticleFiles();
  const targets = [];
  if (slug) {
    if (!files.includes(`${slug}.md`)) {
      console.error(`Artigo nao encontrado: ${slug}.md`);
      process.exit(2);
    }
    targets.push(slug);
  } else {
    for (const f of files) {
      const fp = path.join(ARTIGOS_DIR, f);
      const content = fs.readFileSync(fp, "utf-8");
      const { fm, body } = parseFrontmatter(content);
      if (!hasProductImages(body)) continue;
      const categoria = String(fm.category || "").trim();
      targets.push({ slug: f.replace(/\.md$/, ""), categoria });
    }
  }

  const modo = APPLY ? "REGENERACAO GRAVANDO" : "DRY-RUN (nada gravado)";
  console.log(`\n=== REGENERAR ARTIGOS [${modo}] ===`);
  console.log(`Alvo(s): ${targets.length}`);

  const state = { last_error: null, consecutive_failures: 0, recent_topics: [] };

  for (const target of targets) {
    const targetSlug = typeof target === "string" ? target : target.slug;
    const fp = path.join(ARTIGOS_DIR, `${targetSlug}.md`);
    const content = fs.readFileSync(fp, "utf-8");
    const { fm, body } = parseFrontmatter(content);
    const topic = buildTopic(fm, targetSlug);
    const reuseImageMap = buildReuseImageMap(body);
    const extraMlQueries = buildExtraQueries(body, fm);

    console.log(`\n--- ${targetSlug}.md ---`);
    console.log(`  titulo: ${topic.hint}`);
    console.log(`  categoria: ${topic.category}`);
    console.log(`  imagens reutilizaveis: ${reuseImageMap.size}`);
    if (extraMlQueries.length > 0) console.log(`  queries extras (produtos antigos): ${extraMlQueries.join(" | ")}`);

    if (!APPLY) {
      console.log("  (dry-run) geracao NAO executada. Rode com --apply para regenerar.");
      continue;
    }

    try {
      await generateArticle({
        topic,
        state,
        trendingSource: "regeneracao",
        opts: {
          overwriteSlug: targetSlug,
          keepPubDate: true,
          reuseImageMap,
          extraMlQueries,
          enrichNames: true,
          updateState: false,
        },
      });
    } catch (err) {
      console.error(`  [FALHA] Geracao reprovou ${targetSlug}.md (${err?.message || String(err)}) — pulando para o proximo alvo.`);
      continue;
    }

    // Portao de qualidade real (V10): o validate() interno do gerador nao
    // cobre tudo que o validar-artigo.mjs exige (marca/modelo, anos, duplicados,
    // imagem local). Sem isto a regeneracao local podia gravar artigo reprovado.
    console.log("  Validando com portao de qualidade (validar-artigo.mjs)...");
    try {
      execFileSync(process.execPath, ["scripts/validar-artigo.mjs", targetSlug], { stdio: "inherit" });
      console.log("  Validacao OK.");
    } catch (e) {
      console.error(`  [FALHA] Portao reprovou ${targetSlug}.md — nada do artigo sera usado`);
      process.exit(1);
    }

    console.log(`  OK: ${targetSlug}.md regenerado (pubDate preservada)`);
  }

  console.log(`\n${targets.length} artigo(s) processado(s).`);
  if (!APPLY) {
    console.log("Dry-run — nada foi gravado. Rode com --apply para regenerar.");
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
