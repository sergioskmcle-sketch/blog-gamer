import "dotenv/config";
import fs from "fs";
import path from "path";
import { gerarCapaStability } from "./stability-cover.mjs";
import { gerarCapaOpenAI } from "./openai-cover.mjs";

const SLUG = "oferta-no-xbox-summer-sale-2026-5-jogos-impossiveis-de-ignorar";
const ARTIGO_PATH = path.resolve(`src/content/artigos/${SLUG}.md`);

const mlProducts = [
  {
    title: "Console Xbox Series X 1TB",
    price: 4399,
    thumbnail: "https://cdn-dynmedia-1.microsoft.com/is/image/microsoftcorp/6048892_Image-Buy-Box-0_2000x2000-1?wid=1253&hei=705&fmt=jpg",
    permalink: "https://www.mercadolivre.com.br/console-xbox-series-x-1tb-standard-cor-preto/p/MLB37335939",
    affiliate_link: "https://www.mercadolivre.com.br/console-xbox-series-x-1tb-standard-cor-preto/p/MLB37335939",
  },
  {
    title: "Console Sony PlayStation 5 Slim 1TB",
    price: 4499,
    thumbnail: "https://store.sony.com.au/dw/image/v2/ABBC_PRD/on/demandware.static/-/Sites-sony-master-catalog/default/dwf11f74b4/images/PLAYSTATION5WSLIM/PLAYSTATION5WSLIM.png",
    permalink: "https://www.mercadolivre.com.br/console-sony-playstation-5-edico-slim-disk-1tb-branco-controle-sem-fio-dualsense-ps5-branco/p/MLB52897777",
    affiliate_link: "https://www.mercadolivre.com.br/console-sony-playstation-5-edico-slim-disk-1tb-branco-controle-sem-fio-dualsense-ps5-branco/p/MLB52897777",
  },
  {
    title: "Console Nintendo Switch 2",
    price: 3299,
    thumbnail: "https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto:best/f_auto/dpr_2.0/ncom/My%20Nintendo%20Store/EN-US/Nintendo%20Switch%202/Hardware/123669-nintendo-switch-2-package-front-2000x2000",
    permalink: "https://www.mercadolivre.com.br/nintendo-switch-2/p/MLB41884906",
    affiliate_link: "https://www.mercadolivre.com.br/nintendo-switch-2/p/MLB41884906",
  },
  {
    title: "Controle Sem Fio DualSense PS5",
    price: 429,
    thumbnail: "https://gmedia.playstation.com/is/image/SIEPDC/dualsense-controller-product-thumbnail-01-en-14sep21",
    permalink: "https://www.mercadolivre.com.br/controle-sem-fio-sony-dualsense-ps5-com-cabo-de-carregamento-usb-cor-branco/p/MLB26725576",
    affiliate_link: "https://www.mercadolivre.com.br/controle-sem-fio-sony-dualsense-ps5-com-cabo-de-carregamento-usb-cor-branco/p/MLB26725576",
  },
];

let result = await gerarCapaStability({
  mlProducts,
  category: "promocao",
  slug: SLUG,
});
if (!result) {
  console.log("Stability sem creditos — tentando OpenAI...");
  result = await gerarCapaOpenAI({
    mlProducts,
    category: "promocao",
    slug: SLUG,
  });
}

if (result) {
  console.log("\nNova capa gerada:", result);

  let artigo = fs.readFileSync(ARTIGO_PATH, "utf-8");
  artigo = artigo.replace(/^coverImage:\s*.+$/m, `coverImage: "${result}"`);
  fs.writeFileSync(ARTIGO_PATH, artigo);
  console.log("Frontmatter atualizado!");
} else {
  console.log("\nFalha ao gerar capa");
}
