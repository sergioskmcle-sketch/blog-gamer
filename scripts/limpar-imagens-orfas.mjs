// TAREFA 4.5 — limpeza de imagens orfas em public/images/produtos/.
//
// A TAREFA 1 muda os slugs dos produtos, entao a cada regeneracao as imagens
// antigas deixam de ser referenciadas pelos artigos. Este script cruza o
// diretorio com as referencias a /images/produtos/ presentes em
// src/content/artigos/*.md e LISTA as orfas. Nada e apagado sem --apply.
//
// Uso:
//   node scripts/limpar-imagens-orfas.mjs          # lista apenas
//   node scripts/limpar-imagens-orfas.mjs --apply  # apaga as orfas
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.resolve(__dirname, "..", "public", "images", "produtos");
const ARTIGOS_DIR = path.resolve(__dirname, "..", "src", "content", "artigos");

// Placeholder local: nunca e orfa, mesmo sem artigo referenciando.
const PROTECTED = new Set(["_placeholder.webp"]);

const APPLY = process.argv.includes("--apply");

function collectReferenced() {
  const referenced = new Set();
  if (!fs.existsSync(ARTIGOS_DIR)) return referenced;
  const files = fs.readdirSync(ARTIGOS_DIR).filter((f) => f.endsWith(".md"));
  const pattern = /images[\\/]produtos[\\/]([^"')\s?#]+)(?:\?[^\s"')]*)?/g;
  for (const file of files) {
    const content = fs.readFileSync(path.join(ARTIGOS_DIR, file), "utf-8");
    for (const m of content.matchAll(pattern)) {
      const name = m[1].split(/[\\/]/).pop();
      if (name) referenced.add(name);
    }
  }
  return referenced;
}

if (!fs.existsSync(IMAGES_DIR)) {
  console.log("Diretorio de imagens nao existe ainda — nada a limpar.");
  process.exit(0);
}

const referenced = collectReferenced();
const all = fs
  .readdirSync(IMAGES_DIR)
  .filter((f) => fs.statSync(path.join(IMAGES_DIR, f)).isFile())
  .sort();

const orphans = all.filter((f) => !referenced.has(f) && !PROTECTED.has(f));

if (orphans.length === 0) {
  console.log(`Nenhuma imagem orfa. (${all.length} arquivo(s), ${referenced.size} referenciado(s))`);
  process.exit(0);
}

console.log(`${orphans.length} imagem(ns) orfa(s) de ${all.length} arquivo(s):`);
for (const name of orphans) {
  const size = fs.statSync(path.join(IMAGES_DIR, name)).size;
  console.log(`  - ${name} (${(size / 1024).toFixed(1)} KB)`);
}

if (!APPLY) {
  console.log('\nRode com "--apply" para apagar de fato.');
  process.exit(0);
}

for (const name of orphans) {
  fs.unlinkSync(path.join(IMAGES_DIR, name));
}
console.log(`\nApagadas ${orphans.length} imagem(ns) orfa(s).`);
