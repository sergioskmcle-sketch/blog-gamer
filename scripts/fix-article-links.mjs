import "dotenv/config";
import fs from "fs";
import path from "path";

const ARTIGOS_DIR = path.resolve("src/content/artigos");
const SLUG = "oferta-no-xbox-summer-sale-2026-5-jogos-impossiveis-de-ignorar";
const filePath = path.join(ARTIGOS_DIR, `${SLUG}.md`);

// Use the WORKING cookie file from the other project
const COOKIE_PATH = path.resolve("C:/Users/sismais/Documents/Projetos Pessoais/monitor-telegram/ml_cookies_fresh.json");

const { generateAffiliateLink } = await import("./ml_affiliate.mjs");

let content = fs.readFileSync(filePath, "utf-8");

// Product URLs to fix
const productUrls = [
  ["https://www.mercadolivre.com.br/console-xbox-series-x-1tb-standard-cor-preto/p/MLB37335939", "Xbox Series X"],
  ["https://www.mercadolivre.com.br/console-sony-playstation-5-edico-slim-disk-1tb-branco-controle-sem-fio-dualsense-ps5-branco/p/MLB52897777", "PS5 Slim"],
  ["https://www.mercadolivre.com.br/console-nintendo-switch-2-modelo-nacional-de-tomada/p/MLB49200061", "Switch 2"],
  ["https://www.mercadolivre.com.br/controle-joystick-sem-fio-sony-playstation-dualsense-branco/p/MLB33997846", "DualSense"],
];

for (const [url, name] of productUrls) {
  console.log(`\n${name}: ${url.slice(0, 60)}...`);
  try {
    const result = await generateAffiliateLink(url, COOKIE_PATH);
    const newUrl = result?.short_url || result?.link || result?.url;
    if (newUrl && newUrl !== url && newUrl.includes("meli.la")) {
      content = content.replaceAll(url, newUrl);
      console.log(`  OK -> ${newUrl}`);
    } else {
      console.log(`  FAIL - result: ${JSON.stringify(result).slice(0, 100)}`);
    }
  } catch (e) {
    console.log(`  ERRO: ${e.message}`);
  }
}

fs.writeFileSync(filePath, content);
console.log("\nArtigo atualizado!");
