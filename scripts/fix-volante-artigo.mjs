// Corrige o artigo de volantes publicado: injeta imagem em cada subsecao ###
// de item que ficou sem imagem (Moza R12, Thrustmaster T128, Logitech G,
// Xbox 360 Speed Wheel). Usa o mesmo mecanismo de busca do pipeline
// (fetchTavilyImage) e insere <img class="article-game-img"> logo apos o
// heading ### — mesmo padrao das secoes ## que ja tem imagem.
//
// Uso:
//   node scripts/fix-volante-artigo.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fetchTavilyImage } from "./gerar-artigo.mjs";

const SLUG = "volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

// Item (heading ### apos o anchor) -> query de busca de imagem do produto real.
const ITEMS = [
  { heading: "Moza R12 Direct Drive V1", query: "Moza R12 direct drive racing wheel" },
  { heading: "Thrustmaster T128", query: "Thrustmaster T128 racing wheel" },
  { heading: "Linha Logitech G", query: "Logitech G29 G920 racing wheel" },
  { heading: "Xbox 360 Wireless Speed Wheel", query: "Xbox 360 Wireless Speed Wheel" },
];

function buildImgTag(name, url) {
  return `<img src="${url}" alt="${name.replace(/"/g, "&quot;")}" class="article-game-img" loading="lazy" decoding="async">`;
}

async function main() {
  let artigo = fs.readFileSync(ARTIGO_PATH, "utf-8");

  for (const item of ITEMS) {
    // O heading pode vir com anchor <a id="..."></a> antes do titulo e um
    // sufixo " — Subtitulo" depois do nome do item.
    const escHeading = item.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingRe = new RegExp(`^(#{3}\\s+(?:<a[^>]*>\\s*<\\/a>\\s*)?${escHeading}[^\\n]*)$`, "m");
    const match = artigo.match(headingRe);
    if (!match) {
      console.error(`Heading nao encontrado: "${item.heading}"`);
      continue;
    }

    // Ja tem <img> logo apos o heading (proximo bloco nao vazio)?
    const after = artigo.slice(match.index + match[1].length).replace(/^\n+/, "");
    if (/^<img\s/.test(after)) {
      console.log(`Ja tem imagem: ${item.heading}`);
      continue;
    }

    const url = await fetchTavilyImage(item.query);
    if (!url) {
      console.error(`Nenhuma imagem via Tavily para: ${item.heading}`);
      continue;
    }

    const imgTag = buildImgTag(item.heading, url);
    artigo = artigo.replace(match[1], `${match[1]}\n${imgTag}`);
    console.log(`Imagem inserida: ${item.heading} -> ${url.slice(0, 60)}`);
  }

  fs.writeFileSync(ARTIGO_PATH, artigo, "utf-8");
  console.log("Artigo atualizado:", ARTIGO_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
