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

  const product = mlProducts[0];
  const thumbUrl = product.thumbnail;
  if (!thumbUrl || !thumbUrl.startsWith("http")) {
    log("WARN", "Produto sem thumbnail valida — pulando capa AI");
    return null;
  }

  const prompt = BG_PROMPTS[category] || BG_PROMPTS.guia;
  const contrastHint = "Use bright, light-toned background colors to create contrast with the product.";
  const fullPrompt = `${prompt} ${contrastHint}`.trim();

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

  let productBuffer;
  try {
    const thumbRes = await fetch(thumbUrl, { timeout: 10000 });
    if (!thumbRes.ok) {
      log("WARN", `Falha ao baixar thumbnail (${thumbRes.status}) — usando fundo sem produto`);
      return saveImage(bgBuffer, slug);
    }
    productBuffer = Buffer.from(await thumbRes.arrayBuffer());
    log("INFO", `Thumbnail baixada (${(productBuffer.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    log("WARN", `Falha ao baixar thumbnail: ${err.message} — usando fundo sem produto`);
    return saveImage(bgBuffer, slug);
  }

  try {
    const result = await compositeProduct(bgBuffer, productBuffer);
    return saveImage(result, slug);
  } catch (err) {
    log("WARN", `Composicao falhou: ${err.message} — salvando fundo sem produto`);
    return saveImage(bgBuffer, slug);
  }
}

async function compositeProduct(bgBuffer, productBuffer) {
  const bg = sharp(bgBuffer);
  const bgMeta = await bg.metadata();
  const bgW = bgMeta.width;
  const bgH = bgMeta.height;

  const product = sharp(productBuffer);
  const prodMeta = await product.metadata();

  const targetProdW = Math.round(bgW * 0.38);
  const targetProdH = Math.round(targetProdW * (prodMeta.height / prodMeta.width));
  const maxProdH = Math.round(bgH * 0.55);
  const finalProdH = Math.min(targetProdH, maxProdH);
  const finalProdW = Math.round(finalProdH * (prodMeta.width / prodMeta.height));

  const resizedProduct = await product
    .resize(finalProdW, finalProdH, { fit: "fill", withoutEnlargement: true })
    .png()
    .toBuffer();

  const padX = Math.round(bgW * 0.05);
  const padBottom = Math.round(bgH * 0.08);
  const prodLeft = bgW - finalProdW - padX;
  const prodTop = bgH - finalProdH - padBottom;

  const shadowSize = 4;
  const shadow = await sharp({
    create: {
      width: finalProdW + shadowSize * 2,
      height: finalProdH + shadowSize * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.25 },
    },
  })
    .blur(8)
    .png()
    .toBuffer();

  return bg
    .composite([
      {
        input: shadow,
        top: prodTop - shadowSize + 4,
        left: prodLeft - shadowSize,
      },
      {
        input: resizedProduct,
        top: Math.round(prodTop),
        left: Math.round(prodLeft),
      },
    ])
    .png()
    .toBuffer();
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
