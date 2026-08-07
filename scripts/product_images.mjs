// TAREFA 4 — imagens dos produtos: presenca, tamanho e qualidade.
// Utilitarios puros (upgrade de URL, leitura de dimensoes, validacao de
// minimo) + busca de imagem no Google Images via Serper (usa o mesmo
// SERPER_API_KEY do Google Shopping). Nenhuma funcao aqui depende do gerador;
// os testes em test-injecao.mjs cobrem as funcoes puras.
import { downloadImage } from "./openai-cover.mjs";

// Lado minimo (px) para uma imagem de produto ser aceita.
export const MIN_IMAGE_SIZE = 500;

// Bytes minimos para sequer tentar validar (evita payloads invalidos).
const MIN_IMAGE_BYTES = 8192;

// Troca a URL original por uma variante de maior resolucao, quando a loja
// expoe o padrao:
//   - Mercado Livre: D_NQ_NP_ -> D_NQ_NP_2X_ e sufixo de tamanho (-O/-I/-V)
//     vira -F (o original em altissima resolucao);
//   - Shopee: remove o sufixo de redimensionamento _tn;
//   - Serper/Google: ajusta os parametros de largura para 1200.
export function upgradeImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  let u = url;
  u = u.replace(/D_NQ_NP_(?!2X_)/, "D_NQ_NP_2X_");
  u = u.replace(/-[OIVSMN](\.(jpg|jpeg|png|webp))(\?.*)?$/i, "-F$1");
  u = u.replace(/_tn(\.[a-z0-9]+)?$/i, "$1");
  u = u.replace(/([?&])(w|width)=\d+/gi, "$1$2=1200");
  return u;
}

// Le { width, height } direto do header binario de PNG, JPEG e WebP.
// Devolve null quando o formato nao e reconhecido ou nao consegue decodificar
// (quem chama trata null como "nao avaliar" para nao descartar imagem boa).
export function imageDimensions(buf) {
  if (!buf || buf.length < 8) return null;

  // PNG: assinatura 8 bytes, IHDR a partir do offset 8.
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    if (buf.length < 24) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: FFD8 e, depois, marcadores SOF carregam as dimensoes.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2;
        continue;
      }
      const len = buf.readUInt16BE(off + 2);
      if (len < 2) return null;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
      }
      off += 2 + len;
    }
    return null;
  }

  // WebP: RIFF....WEBP + chunk (VP8X/VP8L/VP8).
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    const fourcc = buf.slice(12, 16).toString("ascii");
    if (fourcc === "VP8X" && buf.length >= 30) {
      const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
      const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
      return { width: w + 1, height: h + 1 };
    }
    if (fourcc === "VP8L" && buf.length >= 25) {
      const bits = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (fourcc === "VP8 " && buf.length >= 30) {
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return w && h ? { width: w, height: h } : null;
    }
    return null;
  }

  return null;
}

// Validacao usada na cadeia de fallback: bytes minimos + dimensao minima.
// Dimensao nao decodificada (dim null) NAO reprova — evita descartar imagem
// boa por limite do parser, como manda a TAREFA 4.2.
export function isImageUsable(buf) {
  if (!buf || buf.length < MIN_IMAGE_BYTES) return false;
  const dim = imageDimensions(buf);
  if (!dim) return true;
  return dim.width >= MIN_IMAGE_SIZE && dim.height >= MIN_IMAGE_SIZE;
}

// Busca de imagem no Google Images via Serper. Testa cada resultado ate achar
// um que passe na validacao. Usa raw_title quando possivel: o titulo completo
// acha o produto certo mesmo com thumbnail ausente.
export async function searchSerperImage(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || !query) return null;
  try {
    const res = await fetch("https://google.serper.dev/images", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: 5 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const urls = (data.images || []).map((it) => it.imageUrl).filter(Boolean);
    for (const url of urls) {
      try {
        const buf = await downloadImage(url);
        if (buf && isImageUsable(buf)) return buf;
      } catch {}
    }
  } catch {}
  return null;
}
