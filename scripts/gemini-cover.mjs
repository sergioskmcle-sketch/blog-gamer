// Reserva de capa: gera a imagem via Gemini quando a OpenAI nao consegue.
//
// Por que existe: ate 09/09/2026 a capa dependia 100% da OpenAI. O
// stability-cover.mjs era chamado como fallback, mas a STABILITY_API_KEY nunca
// foi cadastrada nos secrets do GitHub — ou seja, a rede nunca existiu de fato.
// Quando os creditos da OpenAI acabaram, o blog parou por completo.
//
// Este modulo NAO duplica o preparo de referencias e prompts: reusa os mesmos
// construtores do openai-cover.mjs, para a capa sair com a mesma direcao de arte
// independente de quem gerou.
//
// Ordem na cadeia: OpenAI -> Gemini (aqui) -> Stability -> fallbacks gratuitos.
import fs from "fs";
import path from "path";
import {
  downloadImage,
  saveImage,
  buildEditPrompt,
  buildPromptFromProducts,
  analyzeProductBrightness,
} from "./openai-cover.mjs";

// Modelos confirmados como disponiveis na chave do projeto em 09/09/2026
// (consultados via /v1beta/models). Do mais novo para o mais estavel.
const MODELOS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PUBLIC_DIR = path.resolve("public");

function log(nivel, msg) {
  const hora = new Date().toTimeString().slice(0, 8);
  console.log(`[${hora}] [gemini-cover] [${nivel}] ${msg}`);
}

function mimeDoArquivo(arquivo) {
  const ext = path.extname(arquivo).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

// Coleta as imagens de referencia. Como a capa passou a ser gerada DEPOIS do
// download das fotos dos produtos, na maioria dos casos elas ja estao em disco
// e nao ha nova requisicao de rede.
async function coletarReferencias({ mlProducts, gameRefs, contentType }) {
  const refs = [];

  if (contentType === "game") {
    for (const url of gameRefs || []) {
      try {
        const buf = await downloadImage(url);
        if (buf) refs.push({ buffer: buf, mime: "image/jpeg" });
      } catch (e) {
        log("WARN", `Referencia de jogo falhou: ${e.message}`);
      }
    }
    return refs;
  }

  for (const produto of mlProducts || []) {
    // 1) arquivo local ja baixado pelo ensureProductImages
    const local = produto.local_thumbnail;
    if (local && !local.includes("_placeholder")) {
      const caminho = path.join(PUBLIC_DIR, local.replace(/^\//, ""));
      try {
        if (fs.existsSync(caminho)) {
          refs.push({ buffer: fs.readFileSync(caminho), mime: mimeDoArquivo(caminho) });
          continue;
        }
      } catch (e) {
        log("WARN", `Nao consegui ler ${caminho}: ${e.message}`);
      }
    }
    // 2) so entao a URL remota
    const url = produto.image || produto.thumbnail;
    if (!url) continue;
    try {
      const buf = await downloadImage(url);
      if (buf) refs.push({ buffer: buf, mime: "image/jpeg" });
    } catch (e) {
      log("WARN", `Referencia remota falhou: ${e.message}`);
    }
  }
  return refs;
}

// Extrai a imagem da resposta. O Gemini devolve as partes em camelCase
// (inlineData) na REST v1beta, mas aceita snake_case no envio — trato os dois
// para nao quebrar se a forma mudar.
function extrairImagem(data) {
  const partes = data?.candidates?.[0]?.content?.parts || [];
  for (const parte of partes) {
    const inline = parte.inlineData || parte.inline_data;
    if (inline?.data) return inline.data;
  }
  return null;
}

async function chamarModelo(modelo, apiKey, prompt, refs) {
  const parts = [{ text: prompt }];
  for (const ref of refs) {
    parts.push({
      inline_data: { mime_type: ref.mime, data: ref.buffer.toString("base64") },
    });
  }

  const inicio = Date.now();
  const res = await fetch(`${API_BASE}/${modelo}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  if (!res.ok) {
    const corpo = await res.text().catch(() => "(sem corpo)");
    // 429 aqui e cota do free tier, que reseta — nao e falha permanente.
    const rotulo = res.status === 429 ? "cota esgotada" : `HTTP ${res.status}`;
    log("WARN", `${modelo}: ${rotulo} em ${segundos}s — ${corpo.slice(0, 160)}`);
    return null;
  }

  const data = await res.json();
  const b64 = extrairImagem(data);
  if (!b64) {
    const motivo = data?.candidates?.[0]?.finishReason || "sem finishReason";
    log("WARN", `${modelo}: respondeu em ${segundos}s sem imagem (${motivo})`);
    return null;
  }
  log("INFO", `${modelo}: imagem gerada em ${segundos}s`);
  return b64;
}

export async function gerarCapaGemini({ mlProducts, category, slug, contentType, context, gameRefs }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    log("INFO", "GEMINI_API_KEY nao configurada — pulando reserva de capa");
    return null;
  }

  const refs = await coletarReferencias({ mlProducts, gameRefs, contentType });
  log("INFO", `Reserva de capa: ${refs.length} referencia(s), categoria ${category}`);

  // Mesma direcao de arte da capa principal: os prompts vem do openai-cover.
  let backgroundTone = null;
  try {
    backgroundTone = await analyzeProductBrightness(refs.map((r) => r.buffer));
  } catch (e) {
    log("WARN", `Analise de luminosidade falhou: ${e.message}`);
  }

  const produtosParaPrompt = contentType === "game"
    ? (mlProducts || [])
    : (mlProducts || []).slice(0, refs.length || undefined);

  const prompt = refs.length > 0
    ? buildEditPrompt(produtosParaPrompt, category, backgroundTone, contentType, context)
    : buildPromptFromProducts(produtosParaPrompt, category, backgroundTone, contentType, context);

  for (const modelo of MODELOS) {
    try {
      const b64 = await chamarModelo(modelo, apiKey, prompt, refs);
      if (b64) return saveImage(b64, slug);
    } catch (e) {
      log("WARN", `${modelo}: excecao — ${e.message}`);
    }
  }

  log("WARN", "Reserva de capa (Gemini) nao produziu imagem");
  return null;
}

export default gerarCapaGemini;
