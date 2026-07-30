import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "melhores-fones-de-ouvido-gamer-custo-beneficio-2026";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const products = [
  { name: "HyperX Cloud Stinger 2 Core", image: "https://http2.mlstatic.com/D_NQ_NP_870548-MLU77107727488_062024-O.webp", link: "https://meli.la/1Bj3UZc" },
  { name: "Havit FUXI H3", image: "https://cdn.awsli.com.br/800x800/1274/1274364/produto/307895737/284b7d780da8d2ee84dd36797d4b253d-23tcix614o.jpg", link: "https://meli.la/1v5EEui" },
  { name: "Redragon Zeus Pro H510-Pro", image: "https://cdn.awsli.com.br/800x800/1318/1318167/produto/240721080/h510-pro-1-9149-a8e038qcn4.jpg", link: "https://meli.la/1LBwCZs" },
  { name: "HyperX Cloud III", image: "https://hyperx.com/cdn/shop/files/hyperx_cloud_iii_red_66x0049_main_1_8386d747-db43-490b-94bd-aa98ba149169.jpg?v=1784067120", link: "https://meli.la/1gijccH" },
  { name: "Logitech G435 LIGHTSPEED", image: "https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/g435/2025/gallery/g435-3qtr-front-left-angle-black-gallery-1.png", link: "https://meli.la/1v5EEui" },
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
