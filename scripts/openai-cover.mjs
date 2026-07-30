import fs from "fs";
import path from "path";
import sharp from "sharp";

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
    const t = (p.title || p.name || "").toLowerCase();
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

  const productNames = products.slice(0, 4).map(p => p.title || p.name || "gaming product").join(", ");

  return `Professional close-up product photograph of ${sceneDescription} Products shown: ${productNames}. Photorealistic, high detail, professional gaming catalog photography style. Natural lighting, realistic shadows. No text, no watermarks.`;
}

function buildEditPrompt(products, category) {
  if (!products || products.length === 0) {
    return "Create a professional banner with gaming products on a gaming room background. Photorealistic, high detail. No text, no watermarks.";
  }

  const typeCounts = {};
  products.forEach(p => {
    const t = (p.title || p.name || "").toLowerCase();
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
      sceneDescription = "a gaming room setup with ambient RGB lighting. The chairs should be arranged to highlight their design, padding, and ergonomic features.";
      break;
    case "headset":
      sceneDescription = "a clean desk setup with RGB lighting. The headsets should be displayed prominently showing their cushioned ear cups and design.";
      break;
    case "monitor":
      sceneDescription = "a modern gaming desk with ambient lighting. The monitors should be displayed showing their screens and sleek bezel-less design.";
      break;
    case "teclado":
      sceneDescription = "a dark gaming desk with per-key RGB backlighting. The keyboards should be displayed showing their layout, switches, and lighting.";
      break;
    case "mouse":
      sceneDescription = "a smooth desk surface with RGB lighting. The mice should be displayed showing their ergonomic shape and design.";
      break;
    case "console":
      sceneDescription = "an entertainment center with ambient LED glow. The consoles should be displayed showing their sleek design and modern aesthetic.";
      break;
    default:
      sceneDescription = "a gaming room with ambient RGB lighting. The products should be arranged in an attractive and professional layout.";
  }

  const productNames = products.slice(0, 4).map(p => p.title || p.name || "gaming product").join(", ");

  return `Create a professional banner featuring the following gaming product(s) from the reference images: ${productNames}. Arrange them in a visually appealing layout on ${sceneDescription} Each product should be clearly visible, well-lit, and professionally presented. Photorealistic, high detail, professional catalog quality. No text, no watermarks.`;
}

async function downloadImage(url) {
  if (!url) return null;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: "https://www.mercadolivre.com.br/",
    },
  });
  if (!res.ok) {
    log("WARN", `downloadImage status ${res.status} para ${url.slice(0, 80)}`);
    return null;
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return null;
  return buf;
}

async function searchTavilyImage(productName) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: productName,
        search_depth: "basic",
        include_images: true,
        max_results: 5,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.images || data.images.length === 0) return null;

    for (const imgUrl of data.images) {
      try {
        const buf = await downloadImage(imgUrl);
        if (buf) return buf;
      } catch {}
    }
  } catch {}

  return null;
}

async function toPng(buffer) {
  try {
    return await sharp(buffer).png().toBuffer();
  } catch {
    return buffer;
  }
}

async function generateWithEdits(apiKey, images, prompt) {
  const modelsToTry = ["gpt-image-2", "gpt-image-1"];

  for (const model of modelsToTry) {
    try {
      const formData = new FormData();
      formData.append("model", model);
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", "1536x1024");
      formData.append("quality", "auto");

      for (const img of images) {
        const pngBuf = await toPng(img.buffer);
        const sanitizedName = (img.name || "product").replace(/[^a-zA-Z0-9_-]/g, "_") + ".png";
        const blob = new Blob([pngBuf], { type: "image/png" });
        formData.append("image[]", blob, sanitizedName);
      }

      const t0 = Date.now();
      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      log("INFO", `OpenAI edits (${model}) respondeu em ${elapsed}s (status ${res.status})`);

      if (res.ok) {
        const result = await res.json();
        const b64 = result.data?.[0]?.b64_json;
        if (b64) return b64;
      }

      const errBody = await res.text();
      if (res.status === 404 && errBody.includes("model")) {
        log("WARN", `Modelo ${model} nao disponivel para edits, tentando proximo...`);
        continue;
      }

      log("WARN", `OpenAI edits ${model} erro: ${errBody.slice(0, 250)}`);
    } catch (e) {
      log("WARN", `OpenAI edits ${model} excecao: ${e.message}`);
    }
  }

  return null;
}

async function generateWithGenerations(apiKey, prompt) {
  const t0 = Date.now();

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt,
        n: 1,
        size: "1536x1024",
        quality: "auto",
      }),
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log("INFO", `OpenAI generations respondeu em ${elapsed}s (status ${res.status})`);

    if (!res.ok) {
      const errBody = await res.text();
      log("WARN", `OpenAI generations erro: ${errBody.slice(0, 300)}`);
      return null;
    }

    const result = await res.json();
    return result.data?.[0]?.b64_json || null;
  } catch (err) {
    log("WARN", `OpenAI generations requisicao falhou: ${err.message}`);
    return null;
  }
}

function saveImage(b64, slug) {
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

export async function gerarCapaOpenAI({ mlProducts, category, slug }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("INFO", "OPENAI_API_KEY nao configurada — pulando capa AI");
    return null;
  }

  log("INFO", `Gerando capa OpenAI (category: ${category}, ${mlProducts?.length || 0} produtos)...`);

  const images = [];
  const validProducts = [];

  for (const product of (mlProducts || [])) {
    let buf = null;

    if (product.image) {
      try {
        buf = await downloadImage(product.image);
      } catch (e) {
        log("WARN", `Erro ao baixar ${product.name || product.title}: ${e.message}`);
      }
    }

    if (!buf) {
      log("WARN", `URL direta falhou, buscando imagem de ${product.name || product.title} na web...`);
      try {
        buf = await searchTavilyImage(product.name || product.title);
      } catch (e) {
        log("WARN", `Busca web falhou para ${product.name || product.title}: ${e.message}`);
      }
    }

    if (buf) {
      images.push({ buffer: buf, name: product.name || product.title || "product" });
      validProducts.push(product);
      log("INFO", `Imagem OK: ${product.name || product.title} (${(buf.length / 1024).toFixed(1)} KB)`);
    } else {
      log("WARN", `Falha ao obter imagem: ${product.name || product.title}`);
    }
  }

  if (images.length > 0) {
    const editPrompt = buildEditPrompt(validProducts, category);
    log("INFO", `Tentando edits com ${images.length} imagem(ns) de referencia...`);
    const b64 = await generateWithEdits(apiKey, images, editPrompt);
    if (b64) return saveImage(b64, slug);
    log("WARN", "Edits falhou, tentando fallback para generations...");
  } else {
    log("INFO", "Nenhuma imagem baixada, usando generations via prompt textual...");
  }

  const textPrompt = buildPromptFromProducts(mlProducts, category);
  const b64 = await generateWithGenerations(apiKey, textPrompt);
  if (b64) return saveImage(b64, slug);

  log("WARN", "Todas as tentativas de geracao de capa falharam");
  return null;
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [openai-cover] [${level}] ${msg}`);
}

export default gerarCapaOpenAI;
