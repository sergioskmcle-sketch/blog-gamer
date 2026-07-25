import fs from "fs";
import path from "path";

const COVER_DIR = path.resolve("public/images/capas");

const COVER_PROMPTS = {
  guia: `Professional close-up product photograph of gaming products arranged on a clean display surface. The products are LARGE and dominate the frame, taking up most of the image. Arrange with depth perspective: some in the foreground (closer to camera, appearing larger and very detailed), and others slightly behind them (further from camera, a bit smaller). Create a clear sense of depth and layering. In the background, slightly out of focus with bokeh effect, other gaming peripherals are visible: a gaming mouse, mousepad, monitor, keyboard — adding context and realism. Soft natural lighting from a window or desk lamp creating subtle shadows. Natural, warm color tones. Photorealistic, looks like a real close-up product photo from a professional gaming catalog. No text, no watermarks, no neon lights, no glowing effects, no floating elements, no space theme, no abstract backgrounds. 16:9 landscape format.`,

  review: `Professional close-up photograph of 1-2 gaming products displayed prominently on a wooden gaming desk. The product is the main subject, very large and detailed in the frame. Position it at a slight angle showing its best side. In the background, a cozy gamer room setup is visible but out of focus with bokeh: RGB keyboard, gaming mouse on a mousepad, a monitor showing a game, LED strips providing warm ambient lighting. The product is crisply sharp while the background is softly blurred. Natural warm tones, soft directional lighting creating realistic shadows. Photorealistic, looks like a real review photograph from a gaming publication. No text, no watermarks, no neon, no floating, no space theme. 16:9 landscape format.`,

  lista: `Professional product photograph of multiple gaming products displayed on a modern shelving unit or display gondola. The products are LARGE and fill most of the frame. Arrange with clear depth perspective: 3-4 products in the foreground on the front shelf (closer, larger, very detailed), and 2-3 products on a shelf slightly behind (further, smaller but still clearly visible). In the background, out of focus with bokeh: other gaming peripherals, monitor screens, gaming room ambiance. Clean, organized display like a premium electronics store. Soft overhead lighting with natural shadows. Warm, inviting color tones. Photorealistic, looks like a real store display photo. No text, no watermarks, no neon, no floating, no space theme. 16:9 landscape format.`,

  noticia: `Professional photograph depicting a gaming scene related to gaming culture. A gaming product or console is visible in a realistic room environment — living room, gaming room, or entertainment center. The scene is naturally lit with warm ambient lighting. Background elements are slightly out of focus with bokeh: TV screen, furniture, other gaming accessories. Photorealistic, editorial style, looks like a real press photo or gaming journalism image. No text, no watermarks, no neon, no floating, no space theme. 16:9 landscape format.`,

  promocao: `Professional product photograph of gaming products arranged on a bright display surface, styled like a featured deal or spotlight display. The products are LARGE and dominate the frame. Arrange with depth: some in foreground (larger, very detailed), others slightly behind. Use a bright, inviting background (light wood, clean white surface, or bright shelf) to make the products pop. In the background, out of focus with bokeh: gaming peripherals, store environment or gaming room ambiance. Bright, energetic lighting — slightly more vivid than a standard product photo. Warm tones. Photorealistic, looks like a real promotional photo from a gaming retailer. No text, no watermarks, no neon, no floating, no space theme. 16:9 landscape format.`,
};

const CONTRAST_HINT = {
  dark: "Use a bright, light-toned background (light wood, white wall, bright shelf) to create strong contrast with the dark products.",
  light: "Use a dark background (dark desk, dark wall, dark shelf) to create strong contrast with the light products.",
};

async function fetchThumbnailAsDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const b64 = buf.toString("base64");
    const ext = url.split(".").pop().split("?")[0].toLowerCase();
    const mime =
      ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function analyzeBrightness(dataUrl) {
  try {
    const base64 = dataUrl.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    let total = 0;
    let count = 0;
    for (let i = 0; i < buf.length && i < 50000; i += 4) {
      if (i + 2 < buf.length) {
        total += buf[i] + buf[i + 1] + buf[i + 2];
        count += 3;
      }
    }
    return count > 0 ? total / count : 128;
  } catch {
    return 128;
  }
}

export async function gerarCapaOpenAI({ mlProducts, category, slug }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("INFO", "OPENAI_API_KEY nao configurada — pulando capa AI");
    return null;
  }

  if (!mlProducts || mlProducts.length === 0) {
    log("INFO", "Sem produtos ML — pulando capa AI");
    return null;
  }

  const prompt = COVER_PROMPTS[category];
  if (!prompt) {
    log("INFO", `Categoria '${category}' sem prompt de capa — usando prompt guia`);
  }

  const basePrompt = prompt || COVER_PROMPTS.guia;

  const productsToUse = mlProducts.slice(0, 6);

  log("INFO", "Baixando thumbnails para capa AI...");
  const content = [];

  for (let i = 0; i < productsToUse.length; i++) {
    const p = productsToUse[i];
    const thumbUrl = p.thumbnail || p.permalink;
    if (!thumbUrl) continue;
    const dataUrl = await fetchThumbnailAsDataUrl(thumbUrl);
    if (dataUrl) {
      content.push({ type: "input_image", image_url: dataUrl });
      log("INFO", `  Thumbnail ${i + 1}: OK`);
    } else {
      log("WARN", `  Thumbnail ${i + 1}: falhou`);
    }
  }

  if (content.length === 0) {
    log("WARN", "Nenhuma thumbnail baixada — pulando capa AI");
    return null;
  }

  let contrastHint = CONTRAST_HINT.dark;
  if (content.length > 0) {
    const brightness = analyzeBrightness(content[0].image_url);
    contrastHint = brightness < 128 ? CONTRAST_HINT.dark : CONTRAST_HINT.light;
    log("INFO", `Brilho medio: ${brightness.toFixed(0)} → ${brightness < 128 ? "fundo claro" : "fundo escuro"}`);
  }

  content.push({
    type: "input_text",
    text: basePrompt + " " + contrastHint,
  });

  log("INFO", `Gerando capa AI (${content.length - 1} produtos, category: ${category})...`);

  const t0 = Date.now();
  let data;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: [{ role: "user", content }],
        tools: [{ type: "image_generation", quality: "low", size: "1536x1024" }],
      }),
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log("INFO", `OpenAI respondeu em ${elapsed}s (status ${res.status})`);

    if (!res.ok) {
      const errBody = await res.text();
      log("WARN", `OpenAI erro: ${errBody.slice(0, 200)}`);
      return null;
    }

    data = await res.json();
  } catch (err) {
    log("WARN", `OpenAI requisicao falhou: ${err.message}`);
    return null;
  }

  if (!data.output) {
    log("WARN", "OpenAI sem output");
    return null;
  }

  for (const item of data.output) {
    if (item.type === "image_generation_call" && item.result) {
      const buf = Buffer.from(item.result, "base64");
      if (!fs.existsSync(COVER_DIR)) {
        fs.mkdirSync(COVER_DIR, { recursive: true });
      }
      const outPath = path.join(COVER_DIR, `${slug}.png`);
      fs.writeFileSync(outPath, buf);
      const kb = (buf.length / 1024).toFixed(1);
      log("INFO", `Capa AI salva: ${slug}.png (${kb} KB)`);
      return `/images/capas/${slug}.png`;
    }
  }

  log("WARN", "OpenAI nao retornou imagem");
  return null;
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [openai-cover] [${level}] ${msg}`);
}

export default gerarCapaOpenAI;
