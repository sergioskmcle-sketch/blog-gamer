import fs from "fs";
import path from "path";

const COVER_DIR = path.resolve("public/images/capas");

const COVER_PROMPTS = {
  guia: `Professional close-up product photograph of gaming products arranged on a clean wooden gaming desk. The products are LARGE and dominate the frame. Background is a warm gaming room with subtle RGB lighting and a monitor, softly blurred with bokeh effect. Soft natural lighting creating realistic shadows. Photorealistic, high detail, professional gaming catalog style. No text, no watermarks.`,
  review: `Professional close-up product photograph of a gaming product on a wooden desk. Soft natural window lighting, warm ambient glow from a monitor background, subtle RGB reflections on the desk surface. The product is sharp and detailed, background softly blurred with bokeh. Photorealistic, professional review photography style. No text, no watermarks.`,
  lista: `Professional product photograph of multiple gaming products arranged on a modern display shelf. Warm overhead lighting, clean organized display like a premium electronics store. Background has a cozy gaming room atmosphere with soft bokeh. Products are sharp and detailed. Photorealistic, professional catalog style. No text, no watermarks.`,
  noticia: `Professional gaming lifestyle photograph. A gaming scene in a modern room with a large TV or monitor, gaming chair, ambient LED lighting. Clean and inviting composition, warm natural tones, photorealistic editorial style. No text, no watermarks.`,
  promocao: `Professional promotional product photograph of gaming products on a bright clean display surface. Energetic warm lighting, soft shadows on a light wood background. Background has a soft blurred gaming room ambiance. Products are large, sharp and highly detailed. Photorealistic, professional promotional photography. No text, no watermarks.`,
};

export async function gerarCapaOpenAI({ mlProducts, category, slug }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("INFO", "OPENAI_API_KEY nao configurada — pulando capa AI");
    return null;
  }

  const basePrompt = COVER_PROMPTS[category] || COVER_PROMPTS.promocao;

  // Build prompt with product descriptions to help AI generate them
  let productDescriptions = "";
  if (mlProducts && mlProducts.length > 0) {
    const names = mlProducts.slice(0, 4).map(p => p.title?.split(" ").slice(0, 6).join(" ") || "gaming product");
    productDescriptions = ` Include these products prominently: ${names.join(", ")}.`;
  }

  const fullPrompt = `${basePrompt}${productDescriptions} Use a bright, light-toned background for strong contrast with the products.`.trim();

  log("INFO", `Gerando capa OpenAI (category: ${category})...`);

  const t0 = Date.now();
  let result;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt: fullPrompt,
        n: 1,
        size: "1536x1024",
        quality: "auto",
      }),
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log("INFO", `OpenAI respondeu em ${elapsed}s (status ${res.status})`);

    if (!res.ok) {
      const errBody = await res.text();
      log("WARN", `OpenAI erro: ${errBody.slice(0, 300)}`);
      return null;
    }

    result = await res.json();
  } catch (err) {
    log("WARN", `OpenAI requisicao falhou: ${err.message}`);
    return null;
  }

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    log("WARN", "OpenAI nao retornou imagem");
    return null;
  }

  const buf = Buffer.from(b64, "base64");
  if (!fs.existsSync(COVER_DIR)) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
  }
  const outPath = path.join(COVER_DIR, `${slug}.png`);
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  log("INFO", `Capa AI salva: ${slug}.png (${kb} KB)`);
  return `/images/capas/${slug}.png`;
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [openai-cover] [${level}] ${msg}`);
}

export default gerarCapaOpenAI;
