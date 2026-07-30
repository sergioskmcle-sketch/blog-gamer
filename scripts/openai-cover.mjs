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

function buildPromptFromProducts(products, category) {
  if (!products || products.length === 0) {
    return COVER_PROMPTS[category] || COVER_PROMPTS.promocao;
  }

  const typeCounts = {};
  products.forEach(p => {
    const t = (p.title || "").toLowerCase();
    if (t.includes("cadeira")) typeCounts.cadeira = (typeCounts.cadeira || 0) + 1;
    if (t.includes("headset") || t.includes("fone")) typeCounts.headset = (typeCounts.headset || 0) + 1;
    if (t.includes("monitor")) typeCounts.monitor = (typeCounts.monitor || 0) + 1;
    if (t.includes("teclado")) typeCounts.teclado = (typeCounts.teclado || 0) + 1;
    if (t.includes("mouse")) typeCounts.mouse = (typeCounts.mouse || 0) + 1;
    if (t.includes("console") || t.includes("ps5") || t.includes("xbox") || t.includes("nintendo") || t.includes("switch")) typeCounts.console = (typeCounts.console || 0) + 1;
  });

  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  let sceneDescription;
  switch (dominantType) {
    case "cadeira":
      sceneDescription = "a premium gaming chair with high-back racing design and thick padding. The chair is prominently displayed in a gaming room with ambient RGB lighting, a desk and monitor visible in the softly blurred background with bokeh effect. The chair dominates the frame.";
      break;
    case "headset":
      sceneDescription = "a premium gaming headset with cushioned ear cups and subtle RGB lighting, resting on a clean desk. Warm ambient glow from a monitor setup in the softly blurred background with bokeh. The headset is sharp, large and dominates the frame.";
      break;
    case "monitor":
      sceneDescription = "a sleek gaming monitor with slim bezels on a modern desk. A subtle vibrant game scene appears on the screen. RGB keyboard lighting in the foreground, soft bokeh background. The monitor dominates the frame.";
      break;
    case "teclado":
      sceneDescription = "a mechanical gaming keyboard with per-key RGB backlighting on a dark wooden desk. Close-up view, keys sharply in focus. Monitor glow in the softly blurred background with bokeh. The keyboard dominates the frame.";
      break;
    case "mouse":
      sceneDescription = "a precision gaming mouse with RGB lighting on a smooth mouse pad. Soft natural window lighting, keyboard and monitor blurred in background with bokeh effect. The mouse is large, sharp and dominates the frame.";
      break;
    case "console":
      sceneDescription = "a modern video game console with sleek design, placed on an entertainment center. A large TV or monitor display visible in the background with vibrant game lighting. Soft ambient LED glow. The console dominates the frame.";
      break;
    default:
      sceneDescription = "assorted gaming products arranged on a clean wooden desk. Warm ambient lighting, gaming room background with soft bokeh effect. Products are large and dominate the frame.";
  }

  const productNames = products.slice(0, 4).map(p => p.title?.split(" ").slice(0, 8).join(" ") || "gaming product").join(", ");

  return `Professional close-up product photograph of ${sceneDescription} Products shown: ${productNames}. Photorealistic, high detail, professional gaming catalog photography style. Natural lighting, realistic shadows. No text, no watermarks.`;
}

export async function gerarCapaOpenAI({ mlProducts, category, slug }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("INFO", "OPENAI_API_KEY nao configurada — pulando capa AI");
    return null;
  }

  const fullPrompt = buildPromptFromProducts(mlProducts, category);

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
