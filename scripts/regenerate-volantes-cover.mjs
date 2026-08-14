// Regenera a capa do artigo de volantes com FOCO NOS ITENS (os 4 volantes),
// nao num cenario com personagens. Passa as imagens reais dos volantes como
// referencia para a IA compor os produtos sobre a mesa/vitrine gamer.
//
// Uso:
//   node scripts/regenerate-volantes-cover.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

// Imagens reais de cada volante (as mesmas usadas nas subsecoes do artigo) —
// a capa e composta a partir DELAS, garantindo que os itens dominem o quadro.
const products = [
  {
    name: "Moza R12 Direct Drive V1",
    image: "https://mozaracing.com/cdn/shop/files/R12_V2-1.webp?v=1755053461&width=1000",
  },
  {
    name: "Thrustmaster T128",
    image: "https://eshop.thrustmaster.com/media/catalog/product/t/1/t128p_1000x1000_1.webp",
  },
  {
    name: "Linha Logitech G",
    image: "https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/drivingforce/2025/gallery/g920-xbox-3qtr-angle-gallery-1.png",
  },
  {
    name: "Xbox 360 Wireless Speed Wheel",
    image: "https://m.media-amazon.com/images/I/71ScjfApIIL.jpg",
  },
];

async function main() {
  console.log("Regenerando capa para:", SLUG);

  const result = await gerarCapaOpenAI({
    mlProducts: products,
    category: "guia",
    slug: SLUG,
    context: "gaming steering wheels for racing simulators, arranged on a clean gaming desk. Focus on the wheels themselves, they must dominate the frame.",
  });

  if (!result) {
    console.error("Falha ao gerar capa");
    process.exit(1);
  }

  console.log("Nova capa gerada:", result);

  let artigo = fs.readFileSync(ARTIGO_PATH, "utf-8");
  artigo = artigo.replace(/^image:\s*.+$/m, `image: "${result}"`);
  fs.writeFileSync(ARTIGO_PATH, artigo, "utf-8");

  console.log("Frontmatter atualizado!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
