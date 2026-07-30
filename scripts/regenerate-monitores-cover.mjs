import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "monitores-gamer-guia-completo-de-modelos-100hz-a-165hz-em-2026";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const products = [
  { name: "Samsung Odyssey G5 165Hz", image: "https://m.media-amazon.com/images/I/61Lb5JbFxML.jpg", link: "https://www.mercadolivre.com.br/" },
  { name: "LG 27MS500 100Hz", image: "https://m.media-amazon.com/images/I/91uKrkA4snL.jpg", link: "https://www.mercadolivre.com.br/" },
  { name: "Superframe Ace 27 144Hz", image: "https://img.terabyteshop.com.br/produto/g/monitor-gamer-superframe-ace-27-pol-full-hd-ips-144hz-1ms-flicker-free-hdmidp-sf-mn-ace27fsifd1b_274844.jpg", link: "https://www.mercadolivre.com.br/" },
];

async function main() {
  console.log("Regenerando capa para:", SLUG);

  const result = await gerarCapaOpenAI({
    mlProducts: products,
    category: "review",
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
