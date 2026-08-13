// Injeta a arte (RAWG com queda progressiva de nome -> Tavily) antes de cada
// subsecao de jogo do artigo da Gamescom que ficou sem imagem na geracao. Uso:
//   node scripts/inserir-imagens-gamescom.mjs
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fetchRAWGImage, progressiveGameQueries } from "./gerar-artigo.mjs";

const ARTICLE = path.resolve("src/content/artigos/gamescom-2026-principais-anuncios-jogos-datas-e-novidades.md");

// Cada secao: texto exato do heading `###` + nome usado na busca + alt.
const SECTIONS = [
  {
    heading: '### <a id="grounded-2-sobrevivencia-em-miniatura"></a>**Grounded 2 — Sobrevivência em Miniatura**',
    search: "Grounded 2 — Sobrevivência em Miniatura",
    alt: "Grounded 2",
  },
  {
    heading: '### <a id="the-legend-of-zelda-ocarina-of-time-remake-nostalgia-em-alta"></a>**The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição**',
    search: "The Legend of Zelda: Ocarina of Time Remake — Nostalgia em Alta Definição",
    alt: "The Legend of Zelda: Ocarina of Time",
  },
  {
    heading: '### <a id="the-witcher-3-songs-of-the-past-a-ultima-aventura-de-geralt"></a>**The Witcher 3: Songs of the Past — A Última Aventura de Geralt**',
    search: "The Witcher 3: Songs of the Past — A Última Aventura de Geralt",
    alt: "The Witcher 3: Songs of the Past",
  },
  {
    heading: '### <a id="final-fantasy-7-revelation-um-novo-capitulo-na-saga"></a>**Final Fantasy 7: Revelation — Um Novo Capítulo na Saga**',
    search: "Final Fantasy 7: Revelation — Um Novo Capítulo na Saga",
    alt: "Final Fantasy 7: Revelation",
  },
  {
    heading: '### <a id="xbox-na-gamescom-2026-lancamentos-em-peso"></a>**Xbox na Gamescom 2026 — Lançamentos em Peso**',
    search: "Gears of War: E-Day",
    alt: "Gears of War: E-Day",
  },
];

const FRAGILE_IMG = /(upload\.wikimedia\.org|instagram\.com|facebook\.com|fbsbx\.com|tiktok\.com|data:image)/i;

function buildTag(url, alt) {
  return `<img src="${url}" alt="${alt}" class="article-game-img" loading="lazy" decoding="async">`;
}

async function headOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

// RAWG fora do ar (HTTP 522/timeout) faz cada busca gastar ~10s por variante.
// Sonda uma vez: se falhar, pula RAWG e vai direto ao Tavily nas demais secoes.
async function rawgDisponivel() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return false;
  try {
    const r = await fetch(
      `https://api.rawg.io/api/games?key=${apiKey}&search=zelda&page_size=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    return r.ok;
  } catch {
    return false;
  }
}

// Fallback web (Tavily) com a mesma queda progressiva do RAWG. Pula URLs
// frágeis (wikimedia/redes sociais) e valida HTTP antes de aceitar.
async function buscaTavily(name, alt) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return "";
  for (const q of progressiveGameQueries(name).slice(0, 4)) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: q + " gaming",
          search_depth: "basic",
          max_results: 5,
          include_images: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const urls = (data.images || [])
        .map((it) => (typeof it === "string" ? it : it?.url))
        .filter((u) => typeof u === "string" && /^https?:/i.test(u) && !FRAGILE_IMG.test(u));
      for (const url of urls) {
        if (await headOk(url)) {
          console.log(`Tavily imagem para "${alt}" -> ${url.slice(0, 72)}`);
          return url;
        }
      }
    } catch {
      continue;
    }
  }
  return "";
}

let body = fs.readFileSync(ARTICLE, "utf-8");
let inseridas = 0;
let semImagem = [];
const usarRawg = await rawgDisponivel();
if (!usarRawg) console.log("RAWG fora do ar — usando Tavily como fonte principal nesta execucao.");

for (const sec of SECTIONS) {
  if (!body.includes(sec.heading)) {
    console.log(`SECAO NAO ENCONTRADA: ${sec.alt}`);
    continue;
  }
  let imgUrl = usarRawg ? await fetchRAWGImage(sec.search) : "";
  if (!imgUrl) {
    console.log(`RAWG sem imagem para "${sec.alt}" — tentando Tavily...`);
    imgUrl = await buscaTavily(sec.search, sec.alt);
  }
  if (!imgUrl) {
    console.log(`SEM IMAGEM: ${sec.alt}`);
    semImagem.push(sec.alt);
    continue;
  }
  body = body.replace(sec.heading, `${buildTag(imgUrl, sec.alt)}\n${sec.heading}`);
  inseridas++;
  console.log(`OK: ${sec.alt} -> ${imgUrl.slice(0, 72)}`);
}

fs.writeFileSync(ARTICLE, body, "utf-8");
console.log(`\nInseridas ${inseridas}/${SECTIONS.length} imagens.`);
if (semImagem.length > 0) console.log(`Sem imagem: ${semImagem.join(", ")}`);
