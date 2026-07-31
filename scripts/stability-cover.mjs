import fs from "fs";
import path from "path";
import sharp from "sharp";

const COVER_DIR = path.resolve("public/images/capas");

const BG_PROMPTS = {
  guia: "Blurred cozy gaming room background, wooden desk surface with RGB keyboard and monitor in soft focus, warm ambient LED strip lighting, clean and uncluttered composition. Photorealistic, soft bokeh effect, no products, no text, no watermarks.",
  review: "Close-up of a clean wooden gaming desk surface with soft natural window lighting, blurred monitor with warm glow, subtle RGB reflections, uncluttered composition. Photorealistic bokeh, no products, no text, no watermarks.",
  lista: "Modern clean shelving display with soft overhead lighting, blurred gaming ambiance in background, warm inviting tones, uncluttered composition, shallow depth of field. No products, no text, no watermarks.",
  noticia: "Clean living room entertainment center with large TV screen, soft warm ambient lighting, blurred modern furniture, uncluttered cozy gaming atmosphere. No products, no text, no watermarks.",
  promocao: "Clean bright display surface, light wood texture, soft diffused overhead lighting, blurred warm gaming room ambiance, energetic inviting tones, uncluttered composition. No products, no text, no watermarks.",
};

const REFINE_PROMPTS = {
  guia: "Gaming products on a wooden desk with keyboard and monitor, professional product photography, realistic shadows, soft reflections on surface, seamless lighting integration with background, high detail, photorealistic, sharp focus on products",
  review: "Gaming product on wooden desk with soft natural window light, professional product photography, realistic contact shadows, seamless integration with background environment, high detail, photorealistic",
  lista: "Multiple gaming products arranged on a clean display surface, professional retail product photography, realistic shadows on surface, soft reflections, seamless lighting with background, high detail, photorealistic",
  noticia: "Gaming products in a modern living room entertainment setup, professional editorial photography, realistic contact shadows, seamless lighting integration with room environment, high detail",
  promocao: "Gaming products on a bright clean surface, professional promotional product photography, realistic cast shadows on surface, soft reflections, seamless lighting integration with background, high detail, photorealistic",
};

const PLACEHOLDER_PATTERNS = [
  "img-not-available", "no-image", "placeholder", "not-found", "nao-disponivel",
];

// Chroma key: remove solid-color backgrounds from product thumbnails
async function removeBackground(buf) {
  try {
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Sample corner pixels to determine background color
    const cornerSize = Math.min(10, Math.floor(info.width / 10), Math.floor(info.height / 10));
    const corners = sampleCorners(data, info.width, info.height, cornerSize);
    const bgColor = averageColor(corners);

    // Only process if background is light (white, light gray, light blue)
    const bgBrightness = (bgColor.r + bgColor.g + bgColor.b) / 3;
    if (bgBrightness < 200) return buf;

    const tolerance = 40;
    const featherPx = Math.max(4, Math.floor(Math.min(info.width, info.height) * 0.02));

    // Edge detection: find where product meets background
    const edgeMap = detectEdges(data, info.width, info.height, bgColor, tolerance);

    // Feather edges by dilating edge map
    const dilated = dilateEdgeMap(edgeMap, info.width, info.height, featherPx);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const dist = colorDistance(r, g, b, bgColor.r, bgColor.g, bgColor.b);
      const edgeDist = dilated[i / 4];

      if (dist <= tolerance && edgeDist === 0) {
        // Solid background - fully transparent
        data[i + 3] = 0;
      } else if (dist <= tolerance + 20 && edgeDist > 0) {
        // Feather zone - smooth transition
        const feather = Math.max(0, 1 - (dist - tolerance) / 20);
        data[i + 3] = Math.round(data[i + 3] * (1 - feather * (1 - edgeDist / 255)));
      }
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();
  } catch {
    return buf;
  }
}

function sampleCorners(data, w, h, size) {
  const pixels = [];
  // Top-left
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * w + x) * 4;
      pixels.push({ r: data[i], g: data[i+1], b: data[i+2] });
    }
  // Top-right
  for (let y = 0; y < size; y++)
    for (let x = w - size; x < w; x++) {
      const i = (y * w + x) * 4;
      pixels.push({ r: data[i], g: data[i+1], b: data[i+2] });
    }
  // Bottom-left
  for (let y = h - size; y < h; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * w + x) * 4;
      pixels.push({ r: data[i], g: data[i+1], b: data[i+2] });
    }
  // Bottom-right
  for (let y = h - size; y < h; y++)
    for (let x = w - size; x < w; x++) {
      const i = (y * w + x) * 4;
      pixels.push({ r: data[i], g: data[i+1], b: data[i+2] });
    }
  return pixels;
}

function averageColor(pixels) {
  let r = 0, g = 0, b = 0;
  for (const p of pixels) { r += p.r; g += p.g; b += p.b; }
  const n = pixels.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function detectEdges(data, w, h, bgColor, tolerance) {
  const edgeMap = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const dist = colorDistance(r, g, b, bgColor.r, bgColor.g, bgColor.b);

      if (dist <= tolerance + 10) {
        // Check neighbors - if surrounded by bg pixels, it's background
        let bgNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || ny >= h || nx < 0 || nx >= w) { bgNeighbors++; continue; }
            const ni = (ny * w + nx) * 4;
            const nd = colorDistance(data[ni], data[ni+1], data[ni+2], bgColor.r, bgColor.g, bgColor.b);
            if (nd <= tolerance + 20) bgNeighbors++;
          }
        }
        if (bgNeighbors >= 6) {
          edgeMap[y * w + x] = 0; // background
        } else {
          edgeMap[y * w + x] = 255; // edge
        }
      } else {
        edgeMap[y * w + x] = 255; // product
      }
    }
  }
  return edgeMap;
}

function dilateEdgeMap(edgeMap, w, h, radius) {
  const result = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          const val = edgeMap[ny * w + nx];
          if (val > maxVal) maxVal = val;
        }
      }
      result[y * w + x] = maxVal;
    }
  }
  return result;
}

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

async function createDropShadow(w, h, blur, offsetX, offsetY, opacity) {
  const pad = blur + Math.max(Math.abs(offsetX), Math.abs(offsetY));
  const sw = w + pad * 2;
  const sh = h + pad * 2;
  const alpha = Math.round(opacity * 255);

  // Create black rectangle at the size of the product
  const rect = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha } },
  }).png().toBuffer();

  // Create transparent canvas, position rectangle with offset, blur
  const shadow = await sharp({
    create: { width: sw, height: sh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: rect, top: pad + offsetY, left: pad + offsetX }])
    .blur(blur)
    .png()
    .toBuffer();

  return { buffer: shadow, offsetLeft: pad, offsetTop: pad };
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
    const maxH = Math.round(bgH * 0.55);
    const targetW = Math.round(bgW * pct);
    const targetH = Math.round(targetW * (main.meta.height / main.meta.width));
    const finalH = Math.min(targetH, maxH);
    const finalW = Math.round(finalH * (main.meta.width / main.meta.height));

    const resized = await sharp(main.buffer)
      .resize(finalW, finalH, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();

    const resizedMeta = await sharp(resized).metadata();
    const rw = resizedMeta.width;
    const rh = resizedMeta.height;

    const padX = Math.round(bgW * 0.05);
    const padBottom = Math.round(bgH * 0.08);
    const left = bgW - rw - padX;
    const top = bgH - rh - padBottom;

    const shadow = await createDropShadow(rw, rh, 8, 5, 5, 0.25);
    composites.push({ input: shadow.buffer, top: top - shadow.offsetTop, left: left - shadow.offsetLeft });
    composites.push({ input: resized, top: Math.round(top), left: Math.round(left) });
  }

  if (others.length > 0) {
    const pct = 0.18;
    const gap = Math.round(bgW * 0.02);
    const padLeft = Math.round(bgW * 0.05);
    const padBottom = Math.round(bgH * 0.08);
    const maxH = Math.round(bgH * 0.25);

    let cursorX = padLeft;
    for (const p of others) {
      const targetW = Math.round(bgW * pct);
      const targetH = Math.round(targetW * (p.meta.height / p.meta.width));
      const finalH = Math.min(targetH, maxH);
      const finalW = Math.round(finalH * (p.meta.width / p.meta.height));

      const resized = await sharp(p.buffer)
        .resize(finalW, finalH, { fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer();

      const resizedMeta = await sharp(resized).metadata();
      const rw = resizedMeta.width;
      const rh = resizedMeta.height;

      const top = bgH - rh - padBottom;

      const shadow = await createDropShadow(rw, rh, 5, 3, 3, 0.2);
      composites.push({ input: shadow.buffer, top: top - shadow.offsetTop, left: cursorX - shadow.offsetLeft });
      composites.push({ input: resized, top: Math.round(top), left: Math.round(cursorX) });

      cursorX += rw + gap;
    }
  }

  return bg.composite(composites).png().toBuffer();
}

async function refineComposite(compositeBuffer, category, context) {
  const refinePrompt = REFINE_PROMPTS[category] || REFINE_PROMPTS.promocao;
  const contextLine = context ? ` Scene context: ${context}.` : "";

  const fd = new FormData();
  const blob = new Blob([compositeBuffer], { type: "image/png" });
  fd.append("image", blob, "composite.png");
  fd.append("prompt", `${refinePrompt}${contextLine} The products must look naturally integrated into the scene, with realistic shadows and lighting as if photographed in place.`);
  fd.append("strength", "0.55");
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

export async function gerarCapaStability({ mlProducts, category, slug, context, gameRefs }) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    log("INFO", "STABILITY_API_KEY nao configurada — pulando capa AI");
    return null;
  }

  const prompt = BG_PROMPTS[category] || BG_PROMPTS.guia;
  const contextLine = context ? ` The scene should evoke: ${context}.` : "";
  const fullPrompt = `${prompt}${contextLine} Use bright, light-toned background colors.`.trim();

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

  if (!mlProducts || mlProducts.length === 0) {
    log("INFO", "Sem produtos para compor — salvando fundo tematico gerado por IA");
    return saveImage(bgBuffer, slug);
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

    // Remove white/light background from product image for cleaner composite
    const cleanBuf = await removeBackground(buf);
    const cleanMeta = cleanBuf !== buf ? await validateImage(cleanBuf) : meta;

    loaded.push({ buffer: cleanBuf, meta: cleanMeta || meta });
  }

  if (loaded.length === 0) {
    log("WARN", "Nenhum produto valido para composicao — salvando fundo sem produto");
    return saveImage(bgBuffer, slug);
  }

  try {
    const composite = await compositeProducts(bgBuffer, loaded);
    log("INFO", `Composite gerado (${(composite.length / 1024).toFixed(1)} KB)`);

    const refined = await refineComposite(composite, category, context);
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
