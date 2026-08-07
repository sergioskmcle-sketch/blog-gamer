import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "xbox-game-pass-julho-2026-10-jogos-forza-6-e-cloud-gaming";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const games = [
  { name: "Forza Horizon 6", image: "https://media.rawg.io/media/crop/600/400/games/d74/d744a3b0f6f0f0bc63f5ceb9b5e63230.jpeg", link: "https://www.xbox.com/game-pass" },
  { name: "Gears of War: Reloaded", image: "https://media.rawg.io/media/crop/600/400/games/213/213248f2ede0b914431446123b291cc0.jpg", link: "https://www.xbox.com/game-pass" },
  { name: "Tony Hawk's Pro Skater 1+2", image: "", link: "https://www.xbox.com/game-pass" },
  { name: "Palworld 1.0", image: "", link: "https://www.xbox.com/game-pass" },
  { name: "The Planet Crafter", image: "", link: "https://www.xbox.com/game-pass" },
  { name: "Xbox Cloud Gaming", image: "https://assets.play.xbox.com/playxbox/static/media/CloudGaming_LetterBox.scale-200.ef909bf4.png", link: "https://www.xbox.com/cloud-gaming" },
  { name: "Xbox Series X", image: "https://m.media-amazon.com/images/I/71aBXvHYUpL.jpg", link: "https://www.xbox.com/consoles" },
];

async function main() {
  console.log("Regenerando capa para:", SLUG);

  const result = await gerarCapaOpenAI({
    mlProducts: games,
    category: "promocao",
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
