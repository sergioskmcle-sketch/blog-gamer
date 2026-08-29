import fs from "fs";
import path from "path";

// Publica um artigo do blog no Instagram @comproubarato2025 (feed + story).
// Uso: node scripts/publicar-instagram.mjs <slug>
// Env: IG_TOKEN (page_token), IG_LONG_TOKEN (opcional), IG_IG_ID, IG_PAGE_ID,
//      FB_APP_ID, FB_APP_SECRET (renovacao), GITHUB_REPOSITORY (owner/repo).
// Falhas do Instagram NUNCA derrubam o pipeline (sempre exit 0);
// so nao registram o slug no estado, ficando retentaveis.
// Dedup: scripts/.ig-posted.json (committado, compartilhado entre runs).

const STATE_FILE = path.resolve("scripts/.ig-posted.json");
const CONFIG_FILE = path.resolve("scripts/.ig-config.json");
const GRAPH = "https://graph.facebook.com/v21.0";
const INTERVAL_MIN_SEG = 90;

function now() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
function log(level, msg) {
  console.log(`[${now()}] [ig-publish] [${level}] ${msg}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function loadJSON(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return def;
  }
}
function saveJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function loadConfig() {
  const local = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) : {};
  return {
    token: process.env.IG_TOKEN || local.IG_TOKEN || "",
    longToken: process.env.IG_LONG_TOKEN || local.IG_LONG_TOKEN || "",
    igId: process.env.IG_IG_ID || local.IG_IG_ID || "",
    pageId: process.env.IG_PAGE_ID || local.IG_PAGE_ID || "",
    fbAppId: process.env.FB_APP_ID || local.FB_APP_ID || "2196575497750019",
    fbAppSecret: process.env.FB_APP_SECRET || local.FB_APP_SECRET || "",
    repo: process.env.GITHUB_REPOSITORY || local.REPO || "",
  };
}

async function refreshToken(cfg) {
  if (!cfg.fbAppSecret || !cfg.longToken) {
    log("WARN", "FB_APP_SECRET/IG_LONG_TOKEN ausentes - usando token atual");
    return cfg.token;
  }
  try {
    const p = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: cfg.fbAppId,
      client_secret: cfg.fbAppSecret,
      fb_exchange_token: cfg.longToken,
    });
    const r1 = await fetch(`${GRAPH}/oauth/access_token?${p}`, { signal: AbortSignal.timeout(20000) });
    const d1 = await r1.json().catch(() => ({}));
    if (!d1.access_token) {
      log("WARN", `renovacao do long token falhou: ${JSON.stringify(d1).slice(0, 200)}`);
      return cfg.token;
    }
    const r2 = await fetch(
      `${GRAPH}/${cfg.pageId}?fields=access_token&access_token=${encodeURIComponent(d1.access_token)}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const d2 = await r2.json().catch(() => ({}));
    if (!d2.access_token) {
      log("WARN", `page token novo nao obtido: ${JSON.stringify(d2).slice(0, 200)}`);
      return cfg.token;
    }
    log("OK", "token renovado via FB exchange (fb_exchange_token)");
    return d2.access_token;
  } catch (e) {
    log("WARN", `excecao ao renovar token: ${e.message}`);
    return cfg.token;
  }
}

async function checkQuota(igId, token) {
  try {
    const r = await fetch(
      `${GRAPH}/${igId}/content_publishing_limit?fields=config,quota_usage&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) {
      log("WARN", `content_publishing_limit HTTP ${r.status} - prosseguindo sem checagem`);
      return { ok: true };
    }
    const data = await r.json();
    const item = Array.isArray(data) ? data[0] : data;
    const limit = item?.config?.quota_total ?? 50;
    const usage = item?.quota_usage ?? 0;
    log("INFO", `cota IG: ${usage}/${limit} posts nas ultimas 24h`);
    if (usage >= limit) return { ok: false, reason: `quota_exhausted (${usage}/${limit})` };
    return { ok: true, limit, usage };
  } catch (e) {
    log("WARN", `erro ao checar cota: ${e.message}`);
    return { ok: true };
  }
}

function isTransient(status, body) {
  if ([500, 502, 503].includes(status)) return true;
  const code = body?.error?.code;
  if (code === 2) return true;
  if (code === 9004 || code === 9007001 || code === 9007) return true;
  return false;
}

async function publishMedia(igId, token, imageUrl, caption, mediaType, label) {
  const payload = { image_url: imageUrl, access_token: token };
  if (mediaType === "STORIES") payload.media_type = "STORIES";
  if (caption) payload.caption = caption;

  let lastErr = "erro desconhecido";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${GRAPH}/${igId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        lastErr = `HTTP ${r.status} ${JSON.stringify(d).slice(0, 220)}`;
        log("ERROR", `${label}: criar container falhou (${lastErr})`);
        if (isTransient(r.status, d)) {
          await sleep(15000 * (attempt + 1));
          continue;
        }
        return { ok: false, error: lastErr };
      }
      const containerId = d.id;
      log("INFO", `${label}: container criado ${containerId}`);
      await sleep(4000);

      const r2 = await fetch(`${GRAPH}/${igId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId, access_token: token }),
        signal: AbortSignal.timeout(45000),
      });
      const d2 = await r2.json().catch(() => ({}));
      if (!r2.ok) {
        lastErr = `HTTP ${r2.status} ${JSON.stringify(d2).slice(0, 220)}`;
        log("ERROR", `${label}: publicar falhou (${lastErr})`);
        if (isTransient(r2.status, d2)) {
          await sleep(15000 * (attempt + 1));
          continue;
        }
        return { ok: false, error: lastErr };
      }
      log("OK", `${label} publicado! media_id=${d2.id}`);
      return { ok: true, id: d2.id };
    } catch (e) {
      lastErr = e.name === "TimeoutError" ? "timeout" : e.message;
      log("WARN", `${label}: tentativa ${attempt + 1}/3 erro (${lastErr})`);
      await sleep(10000 * (attempt + 1));
    }
  }
  return { ok: false, error: lastErr };
}

function articleInfo(slug) {
  const p = path.resolve("src/content/artigos", `${slug}.md`);
  if (!fs.existsSync(p)) return null;
  const content = fs.readFileSync(p, "utf8");
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || "";
  const title = (fm.match(/^title:\s*"?(.+?)"?\s*$/m)?.[1] || "").replace(/\\"/g, '"').trim();
  // corpo do artigo (sem frontmatter) para alimentar o gerador de legenda
  const body = content.replace(/^---[\s\S]*?---\r?\n/, "").trim();
  return { title, body };
}

// Gera a legenda do feed com resumo estruturado (paragrafo + topicos) por LLM.
// Tolerante: qualquer falha cai numa legenda base com o titulo.
async function gerarDescricaoEstruturada(info) {
  const sys =
    "Voce e um social media do blog gamer Promo Gamer. Escreva UMA legenda de post do feed Instagram, em portugues do Brasil, sobre a materia abaixo. Estruture em: (1) 1 paragrafo de engajamento (2-3 frases), (2) 3 a 5 topicos curto com bullets no inicio, cobrindo os pontos-chave da materia. Seja direto, com tom gamer, SEM hashtags. No final, adicione exatamente a linha \"Toque no link da bio para ler a materia completa\". Responda APENAS com a legenda.";
  const user = `Titulo: ${info.title}\n\nMateria:\n${String(info.body || "").slice(0, 6000)}`;

  const envKeys = {
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };

  const tryGemini = async () => {
    if (!envKeys.gemini) throw new Error("sem GEMINI_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${envKeys.gemini}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  };

  const tryGroq = async () => {
    if (!envKeys.groq) throw new Error("sem GROQ_API_KEY");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${envKeys.groq}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.7,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  };

  const tryOpenAI = async () => {
    if (!envKeys.openai) throw new Error("sem OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${envKeys.openai}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.7,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  };

  for (const fn of [tryGemini, tryGroq, tryOpenAI]) {
    try {
      const texto = (await fn()).trim();
      if (texto.length > 40) {
        log("INFO", `Legenda estruturada gerada via ${fn.name} (${texto.length} chars)`);
        return texto;
      }
    } catch (e) {
      log("WARN", `Legenda via ${fn.name} falhou: ${e.message}`);
    }
  }
  return null;
}

function buildCaption(info, slug) {
  const rodo = `promogamer.com.br/blog/${slug}
🔗 link na bio

#promogamer #promocoes #games #gamer #ofertas #videogame #game`;
  const corpo = info.legenda?.trim() || info.title;
  return `${corpo}

${rodo}`;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    log("ERROR", "uso: node scripts/publicar-instagram.mjs <slug>");
    process.exit(1);
  }

  const state = loadJSON(STATE_FILE, { posts: [], last_publish_at: 0 });
  if (state.posts.some((p) => p.slug === slug)) {
    log("SKIP", `${slug} ja publicado (dedup)`);
    process.exit(0);
  }

  const info = articleInfo(slug);
  if (!info) {
    log("SKIP", `artigo ${slug} nao encontrado`);
    process.exit(0);
  }

  const cfg = loadConfig();
  if (!cfg.token || !cfg.igId || !cfg.repo) {
    log("WARN", "configuracao incompleta (IG_TOKEN/IG_IG_ID/REPO) - pulando publicacao");
    process.exit(0);
  }

  const feedArt = path.resolve("public/images/instagram", `${slug}.png`);
  const storyArt = path.resolve("public/images/instagram", `${slug}-story.png`);
  if (!fs.existsSync(feedArt)) {
    log("SKIP", "arte do feed nao encontrada - pulando publicacao");
    process.exit(0);
  }

  const ago = Date.now() - (state.last_publish_at || 0);
  if (state.last_publish_at && ago < INTERVAL_MIN_SEG * 1000) {
    log("SKIP", `intervalo minimo de ${INTERVAL_MIN_SEG}s nao respeitado (${Math.round(ago / 1000)}s)`);
    process.exit(0);
  }

  const token = await refreshToken(cfg);
  const quota = await checkQuota(cfg.igId, token);
  if (!quota.ok) {
    log("SKIP", `cota IG esgotada (${quota.reason})`);
    process.exit(0);
  }

  const base = `https://raw.githubusercontent.com/${cfg.repo}/main/public/images/instagram/`;
  const feedUrl = `${base}${slug}.png`;
  const storyUrl = `${base}${slug}-story.png`;

  // Legenda estruturada (paragrafo + topicos) gerada por LLM, se possivel.
  const legenda = await gerarDescricaoEstruturada(info);
  if (legenda) info.legenda = legenda;
  const caption = buildCaption(info, slug);

  const feed = await publishMedia(cfg.igId, token, feedUrl, caption, "IMAGE", "feed");
  await sleep(12000);

  let story = { ok: true, skipped: true };
  if (fs.existsSync(storyArt)) {
    story = await publishMedia(cfg.igId, token, storyUrl, "", "STORIES", "story");
  }

  if (feed.ok) {
    state.posts.push({
      slug,
      feed_id: feed.id,
      story_id: story.ok && !story.skipped ? story.id : null,
      date: new Date().toISOString(),
    });
    state.last_publish_at = Date.now();
    saveJSON(STATE_FILE, state);
    log("OK", `slug registrado no estado (${state.posts.length} posts)`);
  } else {
    log("WARN", "publicacao falhou - slug NAO registrado (retentavel)");
  }
  process.exit(0);
}

main().catch((e) => {
  log("ERROR", e.message);
  process.exit(0);
});
