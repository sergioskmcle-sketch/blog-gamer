import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "melhores-cadeiras-gamer-de-2026";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const products = [
  { name: "Cadeira Gamer DT3 Rhino", image: "https://m.media-amazon.com/images/I/71VRx5VKS4L._AC_SX679_.jpg", link: "https://www.mercadolivre.com.br/cadeira-gamer-dt3-rhino/p/MLB27651414" },
  { name: "Cadeira Gamer ThunderX3 Yama", image: "https://m.media-amazon.com/images/I/71HBlNlD65L._AC_SX679_.jpg", link: "https://www.mercadolivre.com.br/cadeira-gamer-thunderx3-yama/p/MLB28809216" },
  { name: "Cadeira Gamer Husky Storm", image: "https://m.media-amazon.com/images/I/71bWpYl-9AL._AC_SY879_.jpg", link: "https://www.mercadolivre.com.br/cadeira-gamer-husky-storm/p/MLB28696875" },
  { name: "Cadeira Gamer Corsair T3 Rush", image: "https://m.media-amazon.com/images/I/61x-1QHKMbL._AC_SX679_.jpg", link: "https://www.mercadolivre.com.br/cadeira-gamer-corsair-t3-rush/p/MLB23996215" },
  { name: "Cadeira Gamer LuvinCo Genebra G500", image: "https://m.media-amazon.com/images/I/71Ub1YHrpIL._AC_SX679_.jpg", link: "https://www.mercadolivre.com.br/cadeira-gamer-luvinco-genebra-g500/p/MLB27545452" },
  { name: "Cadeira Gamer DT3 Vita", image: "https://m.media-amazon.com/images/I/71VRx5VKS4L._AC_SX679_.jpg", link: "https://www.mercadolivre.com.br/cadeira-gamer-dt3-vita/p/MLB34923880" },
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
