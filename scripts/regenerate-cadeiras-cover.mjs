import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "melhores-cadeiras-gamer-de-2026";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const products = [
  { title: "Cadeira Gamer DT3 Rhino Super - Preto" },
  { title: "Cadeira Gamer ThunderX3 Yama" },
  { title: "Cadeira Gamer Husky Storm" },
  { title: "Cadeira Gamer Corsair T3 Rush" },
  { title: "Cadeira Gamer LuvinCo Genebra G500" },
  { title: "Cadeira Gamer DT3 Vita" },
];

async function main() {
  console.log("Regenerando capa para:", SLUG);

  const result = await gerarCapaOpenAI({
    mlProducts: products,
    category: "guia",
    slug: SLUG,
  });

  if (!result) {
    console.error("Falha ao gerar capa");
    process.exit(1);
  }

  console.log("Nova capa gerada:", result);

  let imagePath = result;
  if (imagePath.startsWith("/") && !imagePath.startsWith("/blog-gamer") && !imagePath.startsWith("http")) {
    imagePath = "/blog-gamer" + imagePath;
  }

  let artigo = fs.readFileSync(ARTIGO_PATH, "utf-8");
  artigo = artigo.replace(/^image:\s*.+$/m, `image: "${imagePath}"`);
  fs.writeFileSync(ARTIGO_PATH, artigo, "utf-8");

  console.log("Frontmatter atualizado!");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
