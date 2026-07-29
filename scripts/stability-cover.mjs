import fs from "fs";
import path from "path";
import sharp from "sharp";

const COVER_DIR = path.resolve("public/images/capas");

const BG_PROMPTS = {
  guia: "Blurred cozy gaming room background with wooden desk, RGB keyboard, monitor showing a game menu, soft LED strip lighting, warm ambient tones. Photorealistic, soft bokeh effect, no products, no text, no watermarks.",
  review: "Close-up shot of a wooden gaming desk surface with soft natural window lighting, subtle RGB reflections, blurred monitor in background with warm ambient glow. Photorealistic bokeh background, no products, no text, no watermarks.",
  lista: "Modern shelving unit or display gondola background with soft overhead lighting, blurred gaming room ambiance in the distance, warm inviting tones, shallow depth of field. No products, no text, no watermarks.",
  noticia: "Living room or entertainment center background with a large TV screen showing a game splash screen, warm ambient lighting, blurred furniture, cozy gaming atmosphere. No products, no text, no watermarks.",
  promocao: "Bright clean display surface background, light wood or white surface, soft diffused lighting, blurred store or gaming room ambiance, energetic warm tones, shallow depth of field. No products, no text, no watermarks.",
};

const REFINE_PROMPTS = {
  guia: "Gaming products on a desk with keyboard and monitor background, professional product photography, realistic shadows and reflections, seamless lighting integration, high detail, photorealistic",
  review: "Gaming product on a wooden desk with soft natural lighting, professional review-style product photo, realistic shadows and reflections, seamless integration with background, high detail",
  lista: "Multiple gaming products on a display shelf, professional retail product photography, realistic shadows and reflections, seamless lighting integration, high detail, photorealistic",
  noticia: "Gaming products in a living room entertainment setup, professional editorial photography, realistic lighting and shadows, seamless integration with room environment",
  promocao: "Gaming products on a bright clean display surface, professional promotional product photography, realistic shadows and reflections, seamless lighting integration, high detail, photorealistic",
};

const PLACEHOLDER_PATTERNS = [
  "img-not-available", "no-image", "placeholder", "not-found", "nao-disponivel",
];

function isPlaceholder(url) {
  return PLACEHOLDER_PATTERNS.some(p => url.toLowerCase().includes(p));
}

async function downloadImage(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2048) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function validateImage(buf) {
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) return null;
    return meta;
  } catch {
    return null;
  }
}

async function createShadow(w, h, blur) {
  return sharp({
    create: {
      width: w + blur * 2,
      height: h + blur * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.3 },
    },
  })
    .blur(blur * 2)
    .png()
    .toBuffer();
}

async function compositeProducts(bgBuffer, products) {
  const bg = sharp(bgBuffer);
  const bgMeta = await bg.metadata();
  const bgW = bgMeta.width;
  const bgH = bgMeta.height;

  const composites = [];
  const main = products[0];
  const others = products.slice(1);

  if (main) {
    const pct = 0.38;
    const targetW = Math.round(bgW * pct);
    const targetH = Math.round(targetW * (main.meta.height / main.meta.width));
    const maxH = Math.round(bgH * 0.55);
    const finalH = Math.min(targetH, maxH);
    const finalW = Math.round(finalH * (main.meta.width / main.meta.height));

    const resized = await sharp(main.buffer)
      .resize(finalW, finalH, { fit: "fill", withoutEnlargement: false })
      .png()
      .toBuffer();

    const padX = Math.round(bgW * 0.05);
    const padBottom = Math.round(bgH * 0.08);
    const left = bgW - finalW - padX;
    const top = bgH - finalH - padBottom;

    const shadowBuf = await createShadow(finalW, finalH, 6);
    composites.push({ input: shadowBuf, top: top - 4, left: left - 4 });
    composites.push({ input: resized, top: Math.round(top), left: Math.round(left) });
  }

  if (others.length > 0) {
    const pct = 0.18;
    const gap = Math.round(bgW * 0.02);
    const padLeft = Math.round(bgW * 0.05);
    const padBottom = Math.round(bgH * 0.08);

    let cursorX = padLeft;
    for (const p of others) {
      const targetW = Math.round(bgW * pct);
      const targetH = Math.round(targetW * (p.meta.height / p.meta.width));
      const maxH = Math.round(bgH * 0.25);
      const finalH = Math.min(targetH, maxH);
      const finalW = Math.round(finalH * (p.meta.width / p.meta.height));

      const resized = await sharp(p.buffer)
        .resize(finalW, finalH, { fit: "fill", withoutEnlargement: false })
        .png()
        .toBuffer();

      const top = bgH - finalH - padBottom;

      const shadowBuf = await createShadow(finalW, finalH, 4);
      composites.push({ input: shadowBuf, top: top - 2, left: cursorX - 2 });
      composites.push({ input: resized, top: Math.round(top), left: Math.round(cursorX) });

      cursorX += finalW + gap;
    }
  }

  return bg.composite(composites).png().toBuffer();
}

async function refineComposite(compositeBuffer, category) {
  const refinePrompt = REFINE_PROMPTS[category] || REFINE_PROMPTS.promocao;

  const fd = new FormData();
  const blob = new Blob([compositeBuffer], { type: "image/png" });
  fd.append("image", blob, "composite.png");
  fd.append("prompt", refinePrompt);
  fd.append("strength", "0.35");
  fd.append("mode", "image-to-image");
  fd.append("output_format", "png");

  const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
      Accept: "image/*",
    },
    body: fd,
  });

  if (!res.ok) {
    const errBody = await res.text();
    log("WARN", `Refinamento Stability falhou (${res.status}): ${errBody.slice(0, 200)}`);
    return null;
  }

  const refined = Buffer.from(await res.arrayBuffer());
  log("INFO", `Imagem refinada pelo Stability (${(refined.length / 1024).toFixed(1)} KB)`);
  return refined;
}

export async function gerarCapaStability({ mlProducts, category, slug }) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    log("INFO", "STABILITY_API_KEY nao configurada — pulando capa AI");
    return null;
  }

  if (!mlProducts || mlProducts.length === 0) {
    log("INFO", "Sem produtos ML — pulando capa AI");
    return null;
  }

  const prompt = BG_PROMPTS[category] || BG_PROMPTS.guia;
  const fullPrompt = `${prompt} Use bright, light-toned background colors to create contrast with the product.`.trim();

  log("INFO", `Gerando fundo Stability AI (category: ${category})...`);

  const t0 = Date.now();
  let bgBuffer;
  try {
    const fd = new FormData();
    fd.append("prompt", fullPrompt);
    fd.append("aspect_ratio", "16:9");
    fd.append("output_format", "png");
    fd.append("model", "sd3.5-medium");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: fd,
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log("INFO", `Stability AI respondeu em ${elapsed}s (status ${res.status})`);

    if (!res.ok) {
      const errBody = await res.text();
      log("WARN", `Stability AI erro: ${errBody.slice(0, 300)}`);
      return null;
    }

    bgBuffer = Buffer.from(await res.arrayBuffer());
    log("INFO", `Fundo gerado (${(bgBuffer.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    log("WARN", `Stability AI requisicao falhou: ${err.message}`);
    return null;
  }

  const loaded = [];
  for (let i = 0; i < mlProducts.length; i++) {
    const p = mlProducts[i];
    let url = p.thumbnail;
    if (!url || !url.startsWith("http")) {
      log("WARN", `[${i}] ${p.title?.slice(0, 30)} — sem thumbnail URL`);
      continue;
    }
    if (isPlaceholder(url)) {
      log("WARN", `[${i}] ${p.title?.slice(0, 30)} — thumbnail redirecionada para placeholder, pulando`);
      continue;
    }

    const buf = await downloadImage(url);
    if (!buf) {
      log("WARN", `[${i}] ${p.title?.slice(0, 30)} — falha ao baixar thumbnail`);
      continue;
    }

    const meta = await validateImage(buf);
    if (!meta) {
      log("WARN", `[${i}] ${p.title?.slice(0, 30)} — imagem invalida (muito pequena)`);
      continue;
    }

    log("INFO", `[${i}] ${p.title?.slice(0, 30)} — ${meta.width}x${meta.height} ${(buf.length / 1024).toFixed(1)} KB`);
    loaded.push({ buffer: buf, meta });
  }

  if (loaded.length === 0) {
    log("WARN", "Nenhum produto valido para composicao — salvando fundo sem produto");
    return saveImage(bgBuffer, slug);
  }

  try {
    const composite = await compositeProducts(bgBuffer, loaded);
    log("INFO", `Composite gerado (${(composite.length / 1024).toFixed(1)} KB)`);

    const refined = await refineComposite(composite, category);
    if (refined) {
      return saveImage(refined, slug);
    }

    log("WARN", "Refinamento nao disponivel — salvando composite puro");
    return saveImage(composite, slug);
  } catch (err) {
    log("WARN", `Composicao falhou: ${err.message} — salvando fundo sem produto`);
    return saveImage(bgBuffer, slug);
  }
}

function saveImage(buf, slug) {
  if (!fs.existsSync(COVER_DIR)) {
    fs.mkdirSync(COVER_DIR, { recursive: true });
  }
  const outPath = path.join(COVER_DIR, `${slug}.png`);
  fs.writeFileSync(outPath, buf);
  const kb = (buf.length / 1024).toFixed(1);
  log("INFO", `Capa salva: ${slug}.png (${kb} KB)`);
  return `/images/capas/${slug}.png`;
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [stability-cover] [${level}] ${msg}`);
}

export default gerarCapaStability;
