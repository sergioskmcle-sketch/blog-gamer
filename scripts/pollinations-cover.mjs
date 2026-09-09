// Reserva final de capa: Pollinations (gratuito, sem cadastro e sem chave).
//
// Por que existe: em 09/09/2026 as duas reservas de capa estavam inertes — o
// plano gratuito do Gemini tem limite ZERO para imagem e a conta da Stability
// estava com saldo negativo. Sobrava a OpenAI sozinha, e foi assim que a falta
// de credito parou o blog inteiro.
//
// Este modulo NAO reimplementa a capa. Ele so entrega o FUNDO e delega todo o
// resto (recorte das fotos, composicao, refino, gravacao) ao pipeline que ja
// existe no stability-cover.mjs — que exige apenas texto->imagem simples, e nao
// a composicao multi-referencia cara da OpenAI.
//
// Qualidade: inferior a da OpenAI (testado em 09/09 — imagem correta mas
// borrada, sem o capricho de iluminacao pedido). Adequada para o papel de
// ultima reserva, onde a alternativa e o blog nao publicar.
import sharp from "sharp";
import { gerarCapaStability } from "./stability-cover.mjs";

const BASE = "https://image.pollinations.ai/prompt";
const TIMEOUT_MS = 60000;

function log(nivel, msg) {
  const hora = new Date().toTimeString().slice(0, 8);
  console.log(`[${hora}] [pollinations-cover] [${nivel}] ${msg}`);
}

// Assinaturas de arquivo — o servico responde 200 com HTML em caso de erro,
// entao conferir o content-type nao basta.
function pareceImagem(buf) {
  if (!buf || buf.length < 2048) return false;
  const hex = buf.subarray(0, 4).toString("hex");
  return hex.startsWith("ffd8") || hex.startsWith("89504e47") || hex.startsWith("52494646");
}

async function buscarFundo(prompt) {
  // O servico devolveu 1024x576 mesmo pedindo 1536x864 no teste de 09/09.
  // Nao e problema: compositeProducts() redimensiona o fundo, e a proporcao
  // 16:9 e respeitada.
  const url = `${BASE}/${encodeURIComponent(prompt)}?width=1536&height=864&nologo=true&model=flux`;
  const inicio = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
    if (!res.ok) {
      log("WARN", `HTTP ${res.status} em ${segundos}s`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!pareceImagem(buf)) {
      log("WARN", `resposta nao e imagem (${buf.length} bytes) em ${segundos}s`);
      return null;
    }
    // O servico devolve JPEG, mas a capa e gravada como .png — converter aqui
    // evita um arquivo .png que na verdade e JPEG por dentro.
    const png = await sharp(buf).png().toBuffer();
    log("INFO", `fundo obtido em ${segundos}s (${(png.length / 1024).toFixed(1)} KB apos conversao para PNG)`);
    return png;
  } catch (e) {
    log("WARN", `falhou: ${e.message}`);
    return null;
  }
}

export async function gerarCapaPollinations({ mlProducts, category, slug, context, gameRefs }) {
  log("INFO", `Reserva final de capa (categoria: ${category})`);
  return gerarCapaStability({
    mlProducts,
    category,
    slug,
    context,
    gameRefs,
    gerarFundo: buscarFundo,
    rotulo: "Pollinations",
  });
}

export default gerarCapaPollinations;
