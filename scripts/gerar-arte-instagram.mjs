import "dotenv/config";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// Arte do Instagram a partir de mockups prontos (feed 4:5 e story 9:16).
// O mockup ja tem o buraco transparente para a capa e o chip LINK NA BIO.
// Aqui so: (1) encaixa a capa do artigo no placeholder, (2) escreve o titulo
// no espaco vazio abaixo do placeholder e acima do chip, (3) redimensiona
// para o padrao do Instagram.
// Uso: node scripts/gerar-arte-instagram.mjs <slug>
// Saida: public/images/instagram/<slug>.png (feed 1080x1350) e <slug>-story.png (1080x1920)

const OURO = "#FFCE00";
const BRANCO = "#FFFFFF";
const MOCKUP_FEED = "mockup/feed-4x5.png";
const MOCKUP_STORY = "mockup/story-9x16.png";
const FONT = "Bungee";

// Posicoes no tamanho nativo dos mockups (px) — medidas via analise de alpha.
const NATIVE = {
  feed: { mockup: MOCKUP_FEED, outW: 1080, outH: 1350, hole: { x: 55, y: 78, w: 1012, h: 733 }, chipTop: 1272 },
  story: { mockup: MOCKUP_STORY, outW: 1080, outH: 1920, hole: { x: 59, y: 59, w: 824, h: 824 }, chipTop: 1516 },
};

function now() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
function log(level, msg) {
  console.log(`[${now()}] [ig-arte] [${level}] ${msg}`);
}
function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Quebra o titulo em linhas respeitando uma largura maxima aproximada.
function wrapText(text, maxChars) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxChars) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
      while (current.length > maxChars) {
        lines.push(current.slice(0, maxChars - 1) + "-");
        current = current.slice(maxChars - 1);
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function limitLines(lines, max) {
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  out[max - 1] = (out[max - 1] || "") + "…";
  return out;
}

// Encosta a capa do artigo no buraco transparente do mockup, recortada (cover).
async function coverLayer(coverBuf, hole, outW, outH, scale) {
  const hx = Math.round(hole.x * scale);
  const hy = Math.round(hole.y * scale);
  const hw = Math.round(hole.w * scale);
  const hh = Math.round(hole.h * scale);
  const resizedPng = await sharp(coverBuf).resize(hw, hh, { fit: "cover", position: "centre" }).png().toBuffer();
  const base = sharp({ create: { width: outW, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  return base.composite([{ input: resizedPng, left: hx, top: hy }]).png().toBuffer();
}

// Texto centralizado (titulo dourado + subtitulo branco) no espaço vazio.
// Formato do modelo: destaque em Bungee dourado grande + apoio em Geist
// branco menor logo abaixo.
function textOverlay({ W, H, titleLines, titleFs, subLines, subFs, bandTop, bandBottom }) {
  const titleH = Math.round(titleLines.length * titleFs * 1.14);
  const subH = subLines.length > 0 ? Math.round(subLines.length * subFs * 1.16) : 0;
  const gap = subLines.length > 0 ? Math.round(subFs * 0.75) : 0;
  const totalH = titleH + gap + subH;

  // centro vertical do bloco dentro da banda disponivel
  let y0 = bandTop + Math.max(0, Math.floor((bandBottom - bandTop - totalH) / 2));
  if (y0 < bandTop) y0 = bandTop;

  const titleTspan = titleLines
    .map((line, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : titleFs * 1.14}">${xmlEscape(line)}</tspan>`)
    .join("");
  const titleBase = y0 + titleFs;

  const subTspan = subLines
    .map((line, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : subFs * 1.16}">${xmlEscape(line)}</tspan>`)
    .join("");
  // baseline da 1a linha do subtitulo: logo apos o bloco do titulo + gap
  const subBase = y0 + titleH + gap + subFs;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${W / 2}" y="${titleBase}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${titleFs}" fill="${OURO}" letter-spacing="-0.01em">
    ${titleTspan}
  </text>
  ${
    subLines.length > 0
      ? `<text x="${W / 2}" y="${subBase}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${subFs}" fill="${BRANCO}" letter-spacing="-0.01em">
    ${subTspan}
  </text>`
      : ""
  }
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function loadCover(src) {
  if (/^https?:\/\//i.test(src)) {
    log("INFO", `Baixando capa remota: ${src.slice(0, 90)}...`);
    const res = await fetch(src, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`download da capa falhou (HTTP ${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const rel = String(src).replace(/^\//, "");
  const candidatos = [path.resolve("public", rel), path.resolve(rel)];
  for (const p of candidatos) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  throw new Error(`capa nao encontrada: ${candidatos[0]}`);
}

async function generateArt(slug) {
  const artigoPath = path.resolve("src/content/artigos", `${slug}.md`);
  if (!fs.existsSync(artigoPath)) {
    log("ERROR", `Artigo nao encontrado: ${artigoPath}`);
    return false;
  }
  const content = fs.readFileSync(artigoPath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    log("ERROR", "Frontmatter invalido no artigo");
    return false;
  }
  const fm = fmMatch[1];
  const title = (fm.match(/^title:\s*"?(.+?)"?\s*$/m)?.[1] || "").replace(/\\"/g, '"').trim();
  const description = (fm.match(/^description:\s*"?(.+?)"?\s*$/m)?.[1] || "").replace(/\\"/g, '"').trim();
  const cover = (fm.match(/^image:\s*(.+)$/m)?.[1] || "").replace(/^["']|["']$/g, "").trim();
  if (!title || !cover) {
    log("ERROR", `Faltando titulo ou imagem de capa (title="${title}" cover="${cover}")`);
    return false;
  }
  log("INFO", `Artigo: ${slug}`);
  log("INFO", `Titulo: ${title}`);
  log("INFO", `Descricao: ${description}`);
  log("INFO", `Capa: ${cover}`);

  const coverBuf = await loadCover(cover);
  const outDir = path.resolve("public/images/instagram");
  fs.mkdirSync(outDir, { recursive: true });

  for (const kind of ["feed", "story"]) {
    const c = NATIVE[kind];
    const mockupBuf = fs.readFileSync(c.mockup);
    const mockupMeta = await sharp(mockupBuf).metadata();
    const sc = c.outW / mockupMeta.width;

    // 1) fundo = mockup (com buraco transparente) no tamanho de saida
    const bg = await sharp(mockupBuf).resize(c.outW, c.outH, { fit: "fill" }).png().toBuffer();

    // 2) capa encaixada no buraco
    const coverLayerBuf = await coverLayer(coverBuf, c.hole, c.outW, c.outH, sc);

    // 3) banda de texto = do fim do buraco ate o topo do chip (escala de saida)
    const holeBottom = Math.round((c.hole.y + c.hole.h) * sc);
    const chipTop = Math.round(c.chipTop * sc);

    // tamanho da fonte conforme o titulo (Bungee ~0.66em/letra)
    const maxW = Math.round(c.outW * 0.78);

    const titleFsRaw = kind === "feed" ? 54 : 54;
    const titleFs = title.length > 60 ? Math.round(titleFsRaw * 0.85) : title.length > 40 ? Math.round(titleFsRaw * 0.9) : titleFsRaw;
    const titleLines = limitLines(wrapText(title, Math.floor(maxW / (0.66 * titleFs))), kind === "feed" ? 3 : 4);

    // subtitulo (description) em branco, mesma fonte Bungee, tamanho menor
    const subFs = kind === "feed" ? 27 : 27;
    const subMaxW = Math.round(c.outW * 0.84);
    const subLines = description
      ? limitLines(wrapText(description, Math.floor(subMaxW / (0.66 * subFs))), 3)
      : [];

    const textOverlayBuf = await textOverlay({
      W: c.outW,
      H: c.outH,
      titleLines,
      titleFs,
      subLines,
      subFs,
      bandTop: Math.round(holeBottom + (chipTop - holeBottom) * 0.06),
      bandBottom: chipTop - Math.round((chipTop - holeBottom) * 0.08),
    });

    const outPath = path.join(outDir, kind === "feed" ? `${slug}.png` : `${slug}-story.png`);
    await sharp(coverLayerBuf)
      .composite([
        { input: bg },
        { input: textOverlayBuf },
      ])
      .png({ quality: 95, compressionLevel: 9 })
      .toFile(outPath);
    const meta = await sharp(outPath).metadata();
    log("OK", `${kind}: ${outPath} (${meta.width}x${meta.height})`);
  }
  return true;
}

const slug = process.argv[2];
if (!slug) {
  console.error("Uso: node scripts/gerar-arte-instagram.mjs <slug>");
  process.exit(1);
}

generateArt(slug)
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((e) => {
    log("ERROR", e.message);
    process.exit(1);
  });
