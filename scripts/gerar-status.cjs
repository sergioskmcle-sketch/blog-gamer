const fs = require("fs");
const path = require("path");

const artsDir = path.resolve("src/content/artigos");
const count = fs.existsSync(artsDir) ? fs.readdirSync(artsDir).filter(f => f.endsWith(".md")).length : 0;

let state = {};
try { state = JSON.parse(fs.readFileSync("state.json", "utf-8")); } catch(e) {}

const CATEGORY_ROTATION = ["noticia", "guia", "noticia", "lista", "noticia", "review"];
const hasPos = typeof state.rotation_pos === "number";
const pos = hasPos ? state.rotation_pos : Math.max(0, CATEGORY_ROTATION.indexOf(state.last_category || ""));
const nextIdx = (pos + 1) % CATEGORY_ROTATION.length;

const status = {
  ultimo_artigo: state.last_success || "nunca",
  ultimo_deploy: new Date().toISOString(),
  ultima_categoria: state.last_category || "nenhuma",
  proxima_categoria: CATEGORY_ROTATION[nextIdx],
  artigos_semana: count,
  total_artigos: count,
  erros_recentes: state.last_error ? [state.last_error_date + ": " + state.last_error] : [],
  apis: { groq: "ok", tavily: "ok", rawg: "ok" },
  saudavel: (state.consecutive_failures || 0) === 0
};

const publicDir = path.resolve("public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "status.json"), JSON.stringify(status, null, 2), "utf-8");
console.log("status.json gerado — saudavel:", status.saudavel, "| artigos:", status.total_artigos);
