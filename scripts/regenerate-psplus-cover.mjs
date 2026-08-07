import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "playstation-julho-2026-guia-de-jogos-ps-plus-e-acessorios";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const games = [
  { name: "Call of Duty Modern Warfare 3 PS5", image: "", link: "https://www.playstation.com/ps-plus/" },
  { name: "For the King II PS5", image: "", link: "https://www.playstation.com/ps-plus/" },
  { name: "CrossCode PS5", image: "", link: "https://www.playstation.com/ps-plus/" },
  { name: "Black Desert 2025 PS5", image: "", link: "https://www.playstation.com/ps-plus/" },
  { name: "Blades of Fire PS5", image: "", link: "https://www.playstation.com/ps-plus/" },
  { name: "Farming Simulator 25 PS5", image: "", link: "https://www.playstation.com/ps-plus/" },
];

async function main() {
  console.log("Regenerando capa para:", SLUG);

  const result = await gerarCapaOpenAI({
    mlProducts: games,
    category: "guia",
    slug: SLUG,
    contentType: "game",
  });

  if (!result) {
    console.error("Falha ao gerar capa");
    process.exit(1);
  }

  console.log("Nova capa gerada:", result);

  let imagePath = result;

  let artigo = fs.readFileSync(ARTIGO_PATH, "utf-8");
  artigo = artigo.replace(/^image:\s*.+$/m, `image: "${imagePath}"`);
  fs.writeFileSync(ARTIGO_PATH, artigo, "utf-8");

  console.log("Frontmatter atualizado!");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
