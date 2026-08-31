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
const FONT = "Kalam";

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
// Formato do modelo: destaque em Kalam dourado grande + apoio em Kalam
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

// Chamada unica a LLM com fallback em cadeia (Gemini -> Groq -> OpenAI).
// Valida o tamanho do resultado e retorna null se todas falharem.
async function chamarLLM(sys, user, { minLen = 8, maxLen = 80, maxTokens = 120, rotulo = "texto" } = {}) {
  const tryGemini = async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("sem GEMINI_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  };

  const tryGroq = async () => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("sem GROQ_API_KEY");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  };

  const tryOpenAI = async () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("sem OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  };

  for (const fn of [tryGemini, tryGroq, tryOpenAI]) {
    try {
      const texto = await fn();
      if (texto.length >= minLen && texto.length <= maxLen) {
        return texto;
      }
      log("WARN", `${rotulo} via ${fn.name} fora do esperado (${texto.length} chars) — tentando proximo`);
    } catch (e) {
      log("WARN", `${rotulo} via ${fn.name} falhou: ${e.message}`);
    }
  }
  return null;
}

// Titulo enxuto para a arte. Fallback para o titulo original quando a IA falha.
function gerarTituloCurto(title, description) {
  const sys =
    "Voce escreve titulos curtos e impactantes para a arte de um post de Instagram de um blog gamer. Recebe o titulo original de uma materia e devolve uma versao enxuta, com NO MAXIMO 50 caracteres, mantendo o assunto principal. Sem emojis, sem hashtags, sem aspas e sem ponto final. Responda APENAS com o titulo curto.";
  const user = `Titulo original: ${title}\nDescricao: ${description || ""}`;
  return chamarLLM(sys, user, { maxLen: 60, rotulo: "Titulo curto" });
}

// Subtitulo (linha de apoio) enxuto para a arte, a partir da description.
function gerarSubtituloCurto(description) {
  const sys =
    "Voce resume a descricao de uma materia de um blog gamer para a linha de apoio da arte de um post de Instagram. Devolva UMA frase enxuta, com NO MAXIMO 90 caracteres, destacando o ponto principal. Sem emojis, sem hashtags, sem aspas. Responda APENAS com a frase.";
  const user = `Descricao original: ${description}`;
  return chamarLLM(sys, user, { minLen: 10, maxLen: 100, maxTokens: 160, rotulo: "Subtitulo curto" });
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

  // Titulo enxuto para a arte (texto menor, nao fonte menor). Fallback para o
  // titulo original quando a IA falha.
  const shortTitle = (await gerarTituloCurto(title, description)) || title;
  if (shortTitle !== title) log("INFO", `Titulo curto (IA): ${shortTitle}`);

  // Subtitulo (linha de apoio) enxuto a partir da description. Fallback para a
  // description original quando a IA falha.
  const shortSub = description ? (await gerarSubtituloCurto(description)) || description : "";
  if (shortSub && shortSub !== description) log("INFO", `Subtitulo curto (IA): ${shortSub}`);

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

    // tamanho da fonte conforme o titulo (Kalam ~0.66em/letra)
    const maxW = Math.round(c.outW * 0.78);

    const titleFsRaw = kind === "feed" ? 66 : 66;
    const titleFs = shortTitle.length > 60 ? Math.round(titleFsRaw * 0.85) : shortTitle.length > 40 ? Math.round(titleFsRaw * 0.9) : titleFsRaw;
    const titleLines = limitLines(wrapText(shortTitle, Math.floor(maxW / (0.66 * titleFs))), kind === "feed" ? 3 : 4);

    // subtitulo (linha de apoio) em branco, mesma fonte Kalam, tamanho menor
    const subFs = kind === "feed" ? 27 : 27;
    const subMaxW = Math.round(c.outW * 0.84);
    const subLines = shortSub
      ? limitLines(wrapText(shortSub, Math.floor(subMaxW / (0.66 * subFs))), 3)
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
