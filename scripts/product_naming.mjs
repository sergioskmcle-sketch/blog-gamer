// Limpeza e normalizacao de nomes de produto vindos do Mercado Livre, Shopee,
// Google Shopping ou monitor remoto. Os titulos brutos carregam ruido de
// vendedor ("Enviado por", "| Loja Oficial", "12x de R$ ..."), ano de promocao
// e tokens-lixo (ex.: "1pcsk1"). Este modulo reune as funcoes puras usadas pelo
// pipeline para montar um nome de produto curto, padrao e legivel:
//   Categoria + Marca + Modelo + (ate 3) especificacoes.
// As funcoes sao puras. A saída preserva acentos (Title Case brasileiro);
// a normalizacao "sem acento" e usada apenas internamente para MATCHING,
// mantendo as posicoes de cada caractere (1:1) para remover trechos no texto
// original. O codigo evita acentos em identificadores e comentarios.

// ---------------------------------------------------------------------------
// Constantes publicas (tambem usadas por testes e pelo gerador).
// ---------------------------------------------------------------------------

// Tabela de categorias de produto (PLANO §5.1). Cada entrada tem label de
// exibicao e listas de regex include/exclude. A matching e sempre feita sobre
// texto normalizado (minusculo, sem acento).
export const PRODUCT_CATEGORIES = {
  teclado:  { label: "Teclado",  include: [/\bteclado\b/, /\bkeyboard\b/], exclude: [/\bmouse\b/, /\bheadset\b/, /\bfone\b/, /\bmonitor\b/, /\bcadeira\b/, /\bmousepad\b/, /\bcombo\b/, /\bkit\b/] },
  mouse:    { label: "Mouse",    include: [/\bmouse\b/], exclude: [/\bteclado\b/, /\bheadset\b/, /\bfone\b/, /\bmousepad\b/, /\bmonitor\b/, /\bkit\b/, /\bcombo\b/] },
  mousepad: { label: "Mousepad", include: [/\bmousepad\b/, /\bmouse pad\b/], exclude: [/\bteclado\b/, /\bmonitor\b/] },
  headset:  { label: "Headset",  include: [/\bheadset\b/, /\bfone (de )?ouvido\b/, /\bheadphone\b/], exclude: [/\bteclado\b/, /\bmouse\b/, /\bmonitor\b/, /\bkit\b/, /\bcombo\b/] },
  monitor:  { label: "Monitor",  include: [/\bmonitor\b/], exclude: [/\bteclado\b/, /\bmouse\b/, /\bsuporte\b/, /\bcabo\b/] },
  cadeira:  { label: "Cadeira",  include: [/\bcadeira\b/], exclude: [/\bcapa\b/, /\balmofada\b/] },
  placa_video: { label: "Placa de Vídeo", include: [/\bplaca de v[ií]deo\b/, /\brtx\s?\d{4}\b/, /\brx\s?\d{4}\b/, /\bgeforce\b/, /\bradeon\b/], exclude: [/\bsuporte\b/, /\bcooler\b/, /\bcabo\b/] },
  processador: { label: "Processador", include: [/\bprocessador\b/, /\bryzen\b/, /\bcore i[3579]\b/], exclude: [/\bplaca m[aã]e\b/, /\bcooler\b/] },
  console:  { label: "Console",  include: [/\bplaystation\b/, /\bps5\b/, /\bxbox\b/, /\bnintendo switch\b/, /\bconsole\b/], exclude: [/\bcontrole\b/, /\bcapa\b/, /\bsuporte\b/, /\bjogo\b/] },
  controle: { label: "Controle", include: [/\bcontrole\b/, /\bgamepad\b/, /\bjoystick\b/, /\bdualsense\b/], exclude: [/\bsuporte\b/, /\bcarregador\b/, /\bgrip\b/] },
  notebook: { label: "Notebook", include: [/\bnotebook\b/, /\blaptop\b/], exclude: [/\bsuporte\b/, /\bcapa\b/, /\bmochila\b/] },
  webcam:   { label: "Webcam",   include: [/\bwebcam\b/, /\bc[aâ]mera web\b/], exclude: [] },
  microfone:{ label: "Microfone",include: [/\bmicrofone\b/, /\bmic\b/], exclude: [/\bsuporte\b/, /\bbra[çc]o\b/, /\bpop filter\b/] },
  gabinete: { label: "Gabinete", include: [/\bgabinete\b/], exclude: [/\bfonte\b/, /\bcooler\b/] },
  cooler:   { label: "Cooler",   include: [/\bcooler\b/, /\bwater ?cooler\b/, /\bair ?cooler\b/], exclude: [] },
  fonte:    { label: "Fonte",    include: [/\bfonte\b/, /\b\d{3,4}w\b.*\b80 ?plus\b/], exclude: [/\bcarregador\b/] },
  ssd:      { label: "SSD",      include: [/\bssd\b/, /\bnvme\b/, /\bm\.2\b/], exclude: [/\bgaveta\b/, /\bcase\b/] },
  memoria:  { label: "Memória RAM", include: [/\bmem[oó]ria ram\b/, /\bddr[45]\b/], exclude: [] },
};

// Acessorios/partes que nao sao o produto em si (PLANO §5.1).
const ACCESSORY_NOISE = [/\bsuporte\b/, /\bcapa\b/, /\bcabo\b/, /\badaptador\b/, /\bpel[ií]cula\b/, /\bskin\b/, /\badesivo\b/, /\bkeycap/, /\bcase\b/, /\bbolsa\b/, /\bcarregador\b/];

// Ruido de vendedor/promocao (PLANO §1.1.2) + extras genericos de marketplace
// (parcelas/preco e cauda de vendedor). Sempre aplicados em texto normalizado.
export const NOISE_PATTERNS = [
  /frete gr[áa]tis/gi,
  /envio r[áa]pido/gi,
  /promo[çc][ãa]o/gi,
  /oferta/gi,
  /original/gi,
  /lacrado/gi,
  /novo na caixa/gi,
  /pronta entrega/gi,
  /garantia \d+ (meses|anos)/gi,
  /nota fiscal/gi,
  /nf-?e/gi,
  /\+ brinde/gi,
  /brinde/gi,
  /kit \d+/gi,
  /combo/gi,
  /\d+ ?(un|pcs|pçs|peças)\b/gi,
  /com [ñn]\b/gi,
  /\bimportado\b/gi,
  /\bbarato\b/gi,
  /\bnacional\b/gi,
  /super/gi,
  /top de linha/gi,
  /melhor pre[çc]o/gi,
  /\bp\/\b/gi,
  /para pc notebook/gi,
  /12x sem juros/gi,
  // Extras genericos (parcela/preco/cauda de vendedor) — nao sao artigo-especificos.
  /r\$\s*[\d.,]+/gi,
  /\b(?:parcelad[oa])\b/gi,
  /\|\s*(?:enviado|vendido|oferecido|loja)[^|]*/gi,
  /\b(?:enviado|vendido|oferecido)\s+por[\s\S]*$/gi,
  /\bloja\s+oficial\b/gi,
  /\boem\b/gi,
];

// Marcas reconhecidas (PLANO §1.1): alias (minusculo) -> forma de exibicao.
// A ordem importa: para aliases de uma palavra vale a ordem de definicao.
export const KNOWN_BRANDS = {
  redragon: "Redragon",
  logitech: "Logitech",
  "logitech g": "Logitech G",
  razer: "Razer",
  corsair: "Corsair",
  hyperx: "HyperX",
  steelseries: "SteelSeries",
  aoc: "AOC",
  agon: "AGON",
  lg: "LG",
  samsung: "Samsung",
  dell: "Dell",
  alienware: "Alienware",
  asus: "Asus",
  rog: "ROG",
  acer: "Acer",
  predator: "Predator",
  gigabyte: "Gigabyte",
  aorus: "Aorus",
  msi: "MSI",
  benq: "BenQ",
  zowie: "Zowie",
  philips: "Philips",
  xiaomi: "Xiaomi",
  redmi: "Redmi",
  husky: "Husky",
  fortrek: "Fortrek",
  multilaser: "Multilaser",
  warrior: "Warrior",
  motospeed: "Motospeed",
  akko: "Akko",
  keychron: "Keychron",
  glorious: "Glorious",
  pichau: "Pichau",
  "rise mode": "Rise Mode",
  dt3: "DT3",
  kabum: "Kabum",
  intel: "Intel",
  amd: "AMD",
  nvidia: "NVIDIA",
  sony: "Sony",
  microsoft: "Microsoft",
  nintendo: "Nintendo",
  xbox: "Xbox",
  playstation: "PlayStation",
  thermaltake: "Thermaltake",
  "cooler master": "Cooler Master",
  dazz: "Dazz",
  mancer: "Mancer",
  vinik: "Vinik",
  tgt: "TGT",
  sades: "Sades",
  jbl: "JBL",
  edifier: "Edifier",
  havit: "Havit",
  machenike: "Machenike",
  evga: "EVGA",
  zotac: "Zotac",
  pcyes: "PCYES",
  duex: "Duex",
  elgato: "Elgato",
  blue: "Blue",
  hator: "Hator",
  trust: "Trust",
  marvo: "Marvo",
  "t-dagger": "T-Dagger",
  bloody: "Bloody",
  a4tech: "A4Tech",
  forcegamer: "ForceGamer",
};

// 3 marcas conhecidas por categoria — usadas nas queries de retry (PLANO §5.4).
export const CATEGORY_BRANDS = {
  teclado: ["Redragon", "Logitech", "Razer"],
  mouse: ["Logitech", "Razer", "Redragon"],
  mousepad: ["Redragon", "Logitech", "Razer"],
  headset: ["HyperX", "Logitech", "Razer"],
  monitor: ["AOC", "LG", "Samsung"],
  cadeira: ["DT3", "Husky", "Fortrek"],
  placa_video: ["NVIDIA", "AMD", "Asus"],
  processador: ["Intel", "AMD", "Asus"],
  console: ["Sony", "Microsoft", "Nintendo"],
  controle: ["Microsoft", "Sony", "Logitech"],
  notebook: ["Asus", "Acer", "Dell"],
  webcam: ["Logitech", "Razer", "Elgato"],
  microfone: ["Blue", "HyperX", "Razer"],
  gabinete: ["Pichau", "Rise Mode", "Cooler Master"],
  cooler: ["Cooler Master", "Corsair", "Thermaltake"],
  fonte: ["Corsair", "EVGA", "Cooler Master"],
  ssd: ["Samsung", "Gigabyte", "Corsair"],
  memoria: ["Corsair", "Gigabyte", "Samsung"],
};

// ---------------------------------------------------------------------------
// Helpers internos.
// ---------------------------------------------------------------------------

function collapse(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// Remove acentos mantendo 1:1 por caractere (base na mesma posicao).
function alignAscii(s) {
  return Array.from(String(s || ""))
    .map((ch) => {
      const d = ch.normalize("NFD");
      return d[0];
    })
    .join("");
}

function escapeRe(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cap(s) {
  const v = String(s || "").trim();
  if (!v) return v;
  return v[0].toUpperCase() + v.slice(1).toLowerCase();
}

function unitCase(s) {
  return String(s || "")
    .replace(/\b(\d+(?:[.,]\d+)?\s*(?:[kmgt])?)hz\b/gi, (m, n) => n + "Hz")
    .replace(/\b(\d+(?:[.,]\d+)?)ms\b/gi, "$1ms")
    .replace(/\b(\d)k\b/gi, "$1K")
    .replace(/\b(\d)(gb|tb|mb)\b/gi, (m, n, u) => n + u.toUpperCase());
}

const LOWER_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na",
  "com", "para", "por", "um", "uma", "nas", "nos", "entre", "ate", "ao", "aos",
]);

const UPPER_WORDS = new Set([
  "rtx", "gtx", "rx", "ips", "va", "oled", "usb", "hdmi", "ddr", "rgb", "led",
  "ssd", "nvme", "cpu", "gpu", "vga", "lcd", "hdr", "fhd", "qhd", "uhd",
  "mhz", "ghz", "hz", "gb", "tb", "mb", "dpi", "tkl", "w", "m2", "ps5", "xbox",
]);

function toTitleCasePT(s) {
  const out = String(s || "")
    .split(/(\s+)/)
    .map((w, idx) => {
      if (/^\s+$/.test(w)) return w;
      const low = w.toLowerCase();
      if (UPPER_WORDS.has(low)) return low.toUpperCase();
      if (/\d/.test(w)) return unitCase(w);
      if (LOWER_WORDS.has(low) && idx > 0) return low;
      return cap(w);
    })
    .join("");
  return out.replace(/\s+/g, " ").trim();
}

function truncate60(s) {
  const v = String(s || "").trim();
  if (v.length <= 60) return v;
  const cut = v.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return (space > 20 ? cut.slice(0, space) : cut).replace(/\s+$/, "");
}

// Palavras que nunca devem voltar como "cauda" do titulo.
const TAIL_STOP = new Set([
  ...LOWER_WORDS,
  "sem", "gamer", "gamers", "layout", "tamanho", "modelo", "design", "cor", "cores",
  "produto", "novo", "usado", "seminovo", "oficial", "promocao", "promo", "oferta",
  "ofertas", "frete", "envio", "garantia", "nota", "fiscal", "brinde", "kit", "combo",
  "nacional", "importado", "original", "lacrado", "barato", "marca", "base",
  "ajustavel", "acabamento", "acessorios", "acessorio", "tampa",
  "teclado", "keyboard", "mouse", "mousepad", "headset", "fone", "ouvido",
  "headphone", "monitor", "cadeira", "placa", "video", "processador", "console",
  "controle", "gamepad", "joystick", "notebook", "laptop", "webcam", "camera",
  "microfone", "gabinete", "cooler", "fonte", "ssd", "nvme", "memoria", "ram",
  ...Object.keys(KNOWN_BRANDS),
]);

// Siglas de hardware sem vogal (ou com digito) que NAO sao lixo.
const NO_VOWEL_KEEP = new Set([
  "rtx", "gtx", "rgb", "led", "ssd", "hz", "usb", "hdmi", "ips", "va", "oled",
  "ddr", "ddr4", "ddr5", "ram", "nvme", "pcie", "cpu", "gpu", "fps", "xbox",
  "ps5", "pro", "vr", "hd", "4k", "2k", "8k", "gb", "tb", "mb", "mhz", "ghz",
  "ms", "vga", "lcd", "hdr", "vrr", "dp", "dc", "ac", "bt", "oem", "tkl", "m2",
  "dpi", "qhd", "fhd", "uhd",
]);

// Token-lixo: tem letra E digito, <= 8 chars, todo minusculo no original
// (PLANO §1.1.4). Numeros puros ("104") nao sao lixo.
const JUNK_RE = /^(?=[a-z]*\d)(?=[0-9]*[a-z])[a-z0-9]{1,8}$/;

const MODEL_STOP_PREFIX = new Set([
  "HDR", "IPS", "OLED", "RGB", "LED", "USB", "HDMI", "DP", "VA", "DDR", "NVME",
  "SSD", "CPU", "GPU", "QHD", "FHD", "UHD", "LCD", "VGA", "GSYNC", "FREESYNC",
]);

// Specs na ordem de prioridade do PLANO §1.1 regra 6.
const SPEC_PATTERNS = [
  /\b\d{2}"|\b\d{2}\s?pol\b/i,
  /\b(?:4K|2K|QHD|FHD|UltraWide|1440p|1080p)\b/i,
  /\b\d{2,3}\s?Hz\b/i,
  /Switch (?:Blue|Red|Brown|Outemu|Gateron)/i,
  /\b\d{3,5}\s?DPI\b/i,
  /\b(?:Wireless|Bluetooth|Sem Fio|TKL|RGB)\b/i,
  /\b\d+\s?(?:GB|TB)\b/i,
];

// ---------------------------------------------------------------------------
// Deteccao de categoria.
// ---------------------------------------------------------------------------

function normForMatch(text) {
  return alignAscii(text).toLowerCase();
}

// Variantes de plural para o matching de categoria: hints de artigo vem no
// plural ("melhores teclados gamer", "monitores 144hz") enquanto os includes
// do PLANO §5.1 sao singulares. So o MATCHING usa as variantes — o titulo e a
// categoria retornada nao mudam.
function matchVariants(title) {
  const base = normForMatch(collapse(title));
  const variants = new Set([base]);
  variants.add(base.replace(/\b([a-z\u00E0-\u00FF]{2,})s\b/g, "$1"));
  variants.add(base.replace(/\b([a-z\u00E0-\u00FF]{2,})es\b/g, "$1"));
  return [...variants].map((v) => ` ${v} `);
}

// Retorna a chave da categoria ("teclado", "mouse", ...) ou null.
// Conte quantos include batem; a categoria com mais acertos vence (PLANO §5.1).
export function detectCategory(title) {
  const t = matchVariants(title);
  let best = null;
  let bestCount = 0;
  for (const [key, cat] of Object.entries(PRODUCT_CATEGORIES)) {
    let count = 0;
    for (const re of cat.include) {
      if (t.some((variant) => re.test(variant))) count++;
    }
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

// true somente se (a) algum include bater e (b) nenhum exclude bater e
// (c) nenhum ACCESSORY_NOISE bater (PLANO §5.1).
export function productMatchesCategory(title, categoryKey) {
  const cat = PRODUCT_CATEGORIES[categoryKey];
  if (!cat) return false;
  const t = matchVariants(title);
  if (!t.some((variant) => cat.include.some((re) => re.test(variant)))) return false;
  if (t.some((variant) => cat.exclude.some((re) => re.test(variant)))) return false;
  if (t.some((variant) => ACCESSORY_NOISE.some((re) => re.test(variant)))) return false;
  return true;
}

// Categoria do ARTIGO a partir do topic (PLANO §5.2): hint, ml_query,
// trending_keywords[] e o titulo gerado (se existir).
export function detectArticleCategory(topic) {
  if (!topic || typeof topic !== "object") return null;
  const src = [
    topic.hint,
    topic.ml_query,
    Array.isArray(topic.trending_keywords) ? topic.trending_keywords.join(" ") : "",
    topic.title,
  ].filter(Boolean).join(" ");
  if (!src.trim()) return null;
  return detectCategory(src);
}

// ---------------------------------------------------------------------------
// Deteccao de marca, modelo e specs.
// ---------------------------------------------------------------------------

function findBrand(text) {
  const src = normForMatch(collapse(text)).replace(
    /\bswitch\s+(?:blue|red|brown|green|purple|orange|yellow)\b/g,
    " "
  );
  const aliases = Object.entries(KNOWN_BRANDS).map(([alias, display]) => ({
    alias,
    display,
    multi: /\s/.test(alias),
  }));
  // Multi-palavra primeiro ("logitech g", "rise mode"); simples seguem a ordem.
  aliases.sort((a, b) => (b.multi ? 1 : 0) - (a.multi ? 1 : 0));
  for (const c of aliases) {
    const re = new RegExp("\\b" + escapeRe(c.alias) + "\\b", "i");
    if (re.test(src)) return c;
  }
  return null;
}

// Retorna a forma de exibicao da marca ("Redragon", "Logitech", ...) ou "".
export function detectBrand(title) {
  const found = findBrand(title);
  return found ? found.display : "";
}

const SERIE_RE = /\b(?:ryzen\s?\d\s?\d{3,4}[a-z0-9]*|core\s?i[3-9][-\s]?\d{4,5}[a-z0-9]*|rtx\s?\d{3,4}[a-z0-9]*|gtx\s?\d{3,4}[a-z0-9]*|rx\s?\d{3,4}[a-z0-9]*)\b/i;
const CODE_RE = /\b[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\b/g;
const CODE_DIGIT_FIRST_RE = /\b\d{2,}[A-Z][A-Z0-9-]*\b/g;

function isGoodModelCode(m, digitFirst = false) {
  if (!m || m.length < 2 || m.length > 12) return false;
  if (/^\d+$/.test(m)) return false;
  if (!/[a-z]/i.test(m) || !/\d/.test(m)) return false;
  const up = m.toUpperCase();
  for (const p of MODEL_STOP_PREFIX) {
    if (up.startsWith(p)) return false;
  }
  const unitOnly = m.replace(/\d+/g, "");
  // Unidades de medida que aparecem depois do numero (450W, 8GB, 100Hz) nao
  // sao modelo. No caminho letra-primeiro ("K552", "Q27G4F") so unidades
  // multiletras sao rejeitadas — a letra de linha (K) e parte do modelo.
  const unitRe = digitFirst
    ? /^(GB|TB|MB|KB|HZ|GHZ|MHZ|DPI|K|W|V|A|RPM|MS)$/i
    : /^(GB|TB|MB|KB|HZ|GHZ|MHZ|DPI|RPM|MS)$/i;
  if (unitRe.test(unitOnly)) return false;
  const runs = (m.match(/\d+/g) || []).map((r) => r.length);
  if (runs.length > 0 && Math.max(...runs) >= 3) return true;
  if (/[A-Za-z]$/.test(m)) return true; // termina em letra (Q27G4F, 34G600A-B)
  return false;
}

function joinLineName(s, code) {
  const idx = s.indexOf(code);
  if (idx > 0) {
    const before = s.slice(0, idx).trim().split(/\s+/).pop() || "";
    if (/^[A-Z\u00C0-\u00DD][a-z\u00E0-\u00FF]{1,10}$/.test(before)) {
      return before + " " + code;
    }
  }
  return code;
}

// Retorna o modelo ("K552" | "Q27G4F" | "RTX 4060" | ...) ou "".
export function detectModel(title) {
  const s = collapse(title);
  if (!s) return "";
  const serie = s.match(SERIE_RE);
  if (serie) return collapse(serie[0]);

  const codes = [];
  for (const [re, digitFirst] of [[CODE_RE, false], [CODE_DIGIT_FIRST_RE, true]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[0].length === 0) break;
      codes.push({ code: m[0], index: m.index, digitFirst });
    }
  }
  codes.sort((a, b) => a.index - b.index);
  for (const { code, digitFirst } of codes) {
    if (isGoodModelCode(code, digitFirst)) {
      if (/^[A-Z][A-Z0-9]{0,2}\d{2,4}$/.test(code)) return joinLineName(s, code);
      return code;
    }
  }
  return "";
}

// Extrai ate `limit` especificacoes na ordem de prioridade do plano.
export function extractSpecs(title, limit = 3) {
  const { specs } = collectSpecs(title, limit);
  return specs;
}

// Coleta specs e devolve o resto do titulo sem elas (mesma string original).
function collectSpecs(t, limit = 3) {
  let text = collapse(t);
  const specs = [];
  for (const re of SPEC_PATTERNS) {
    if (specs.length >= limit) break;
    re.lastIndex = 0;
    let m = re.exec(text);
    if (!m || m[0].length === 0) continue;
    const val = collapse(m[0]);
    if (!specs.some((x) => x.toLowerCase() === val.toLowerCase())) {
      specs.push(val);
    }
    text = text.slice(0, m.index) + " " + text.slice(m.index + m[0].length);
  }
  return { specs, rest: text };
}

// ---------------------------------------------------------------------------
// Limpeza de ruido (mantendo acentos no texto original).
// ---------------------------------------------------------------------------

function removeNoise(text) {
  let out = String(text || "");
  let aligned = normForMatch(out);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 12) {
    changed = false;
    for (const re of NOISE_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(aligned)) !== null) {
        if (m[0].length === 0) break;
        const start = m.index;
        const end = m.index + m[0].length;
        out = out.slice(0, start) + " " + out.slice(end);
        aligned = normForMatch(out);
        re.lastIndex = start;
        changed = true;
      }
    }
  }
  return collapse(out);
}

function removeYear(t) {
  let s = String(t || "").trim();
  s = s.replace(/^(?:201[5-9]|202\d|203[0-5])\b/, " ");
  s = s.replace(/\b(?:201[5-9]|202\d|203[0-5])$/, " ");
  return collapse(s);
}

function cutTrailingNoise(t) {
  let s = String(t || "");
  s = s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ");
  let idx = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "-" && ch !== "–" && ch !== "|" && ch !== "," && ch !== "/") continue;
    const prev = s[i - 1] || "";
    const next = s[i + 1] || "";
    if (/\d/.test(prev) && /\d/.test(next)) continue;
    const hasSpace = /\s/.test(prev) || /\s/.test(next);
    if (!hasSpace) continue;
    idx = i;
    break;
  }
  if (idx !== -1) {
    const after = s.slice(idx + 1).trim();
    const wordCount = after ? after.split(/\s+/).length : 0;
    if (wordCount > 4) s = s.slice(0, idx);
  }
  return s.replace(/[\s,|\-–/]+$/g, " ").replace(/^[\s,|\-–/]+/g, " ");
}

function removeJunkTokens(t) {
  const kept = String(t || "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => {
      const low = tok.toLowerCase();
      if (NO_VOWEL_KEEP.has(low)) return true;
      return !JUNK_RE.test(low);
    });
  return kept.join(" ");
}

function tailWords(t) {
  const kept = [];
  for (const tok of String(t || "").split(/\s+/).filter(Boolean)) {
    if (kept.length >= 2) break;
    const cleaned = tok.replace(/^[^A-Za-z0-9\u00C0-\u00FF]+|[^A-Za-z0-9\u00C0-\u00FF]+$/g, "");
    if (!cleaned) continue;
    const low = cleaned.toLowerCase();
    if (TAIL_STOP.has(low)) continue;
    if (JUNK_RE.test(low)) continue;
    if (cleaned.length < 2) continue;
    kept.push(cleaned);
  }
  return kept;
}

// Remove a(s) ocorrencia(s) do substantivo da categoria (o primeiro include
// que casar sem padrao numerico — "RTX \d{4}" e modelo, nao categoria).
function removeCategoryNoun(t, categoryKey) {
  const cat = PRODUCT_CATEGORIES[categoryKey];
  if (!cat) return t;
  let out = String(t || "");
  const aligned = normForMatch(out);
  for (const re of cat.include) {
    if (/\d/.test(re.source)) continue;
    re.lastIndex = 0;
    const m = re.exec(aligned);
    if (m && m[0].length > 0) {
      out = out.replace(new RegExp(escapeRe(m[0]), "gi"), " ");
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Funcao principal: titulo limpo no formato
//   Categoria + Marca + Modelo + (ate 3) specs + (cauda curta)
// PLanco maximo: 8 palavras / 60 caracteres.
// ---------------------------------------------------------------------------
export function cleanProductTitle(rawTitle, opts = {}) {
  if (rawTitle == null || typeof rawTitle !== "string") return "";
  let t = collapse(rawTitle);
  if (!t) return "";
  // Aspas duplas soltas (o simbolo de polegada apos digito e preservado).
  t = t.replace(/(?<!\d)"/g, " ");
  t = removeNoise(t);
  t = removeYear(t);
  t = cutTrailingNoise(t);
  t = collapse(t);
  const fallback = truncate60(t);
  if (!fallback) return "";

  const cat = detectCategory(t);
  const categoryKey = opts.category && PRODUCT_CATEGORIES[opts.category] ? opts.category : cat;
  if (cat) t = removeCategoryNoun(t, cat);

  // "Gamer" so polui; a categoria ja implica o publico (PLANO §1.1.6).
  t = t.replace(/\bgamers?\b/gi, " ");

  let brand = "";
  const brandHit = findBrand(t);
  if (brandHit) {
    brand = brandHit.display;
    t = t.replace(new RegExp("\\b" + escapeRe(brandHit.alias) + "\\b", "gi"), " ");
  }

  const { specs, rest: afterSpecs } = collectSpecs(t, 3);
  t = afterSpecs;

  let model = "";
  const modelText = detectModel(t);
  if (modelText) {
    model = modelText;
    t = t.replace(new RegExp("\\b" + escapeRe(modelText) + "\\b", "i"), " ");
  }

  t = removeJunkTokens(t);

  const partStrings = [];
  const label = opts.category && PRODUCT_CATEGORIES[opts.category]
    ? PRODUCT_CATEGORIES[opts.category].label
    : (cat ? PRODUCT_CATEGORIES[cat].label : null);
  if (label) partStrings.push(label);
  if (brand) partStrings.push(brand);
  if (model) partStrings.push(model);
  partStrings.push(...specs.map(toTitleCasePT));
  if (partStrings.length < 4) {
    partStrings.push(...tailWords(t).map(toTitleCasePT));
  }

  let result = partStrings.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const words = result ? result.split(/\s+/) : [];
  if (words.length > 8) result = words.slice(0, 8).join(" ");
  result = truncate60(result);

  const hasCategory = Boolean(cat || opts.category);
  if (!hasCategory || result.length < 3) return fallback;
  return result;
}
