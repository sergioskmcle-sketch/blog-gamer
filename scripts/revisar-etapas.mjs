import fs from "fs";
import path from "path";

const SQUAD_REVIEWS_DIR = path.resolve(
  "squads", "marketing", "conteudo-digital", "blog-gamer", "output", "reviews"
);
const SQUAD_OUTPUT_DIR = path.resolve(
  "squads", "marketing", "conteudo-digital", "blog-gamer", "output"
);
const OCORRENCIAS_PATH = path.join(SQUAD_OUTPUT_DIR, "ocorrencias.jsonl");

export const ETAPAS = [
  { id: "pesquisa", agente: "pesquisadora", nome: "Pesquisa e Fontes", rotulo: "Ana Pesquisadora" },
  { id: "sourcing", agente: "comprador", nome: "Sourcing de Produtos", rotulo: "Marcos Comprador" },
  { id: "redacao", agente: "redator", nome: "Redacao e Persona", rotulo: "Carlos Redator" },
  { id: "seo", agente: "otimizador-seo", nome: "SEO On-Page", rotulo: "Felipe Otimizador" },
  { id: "design", agente: "designer", nome: "Design e Layout", rotulo: "Lucas Designer" },
  { id: "revisao", agente: "revisora", nome: "Qualidade e Precisao", rotulo: "Juliana Revisora" },
  { id: "publicacao", agente: "publicadora", nome: "Pipeline e Publicacao", rotulo: "Rafaela Publicadora" },
];

const WHITELIST_DOMAINS = [
  "ign.com", "games.gg", "purexbox.com", "pushsquare.com", "trueachievements.com",
  "gematsu.com", "gamespot.com", "gamerant.com", "rtings.com", "tecmundo.com.br",
  "adrenaline.com.br", "chipart.com.br", "olhardigital.com.br", "vzone.com.br",
  "exame.com", "tecnoblog.com.br",
];

const BLACKLIST_DOMAINS = ["yadavgames.com", "sunstrikestudios.com", "juegostudio.com"];

const ABERTURAS_PROIBIDAS = [
  "neste artigo vamos", "hoje vamos falar", "neste conteudo",
];

const ANTI_PADROES_IA = [
  "aqui estao alguns", "aqui esta um ranking", "introducao ao mundo",
  "confira", "descubra", "saiba mais",
];

const GENERICAS = ["jogos", "consoles", "novidades", "games", "dicas"];

const IMAGEM_FRAGIL = /lookaside\.(fbsbx|instagram)\.com|tiktok\.com\/api\/img/;

const MIN_WORDS_SEO = { noticia: 600, review: 800, guia: 1000, lista: 800, promocao: 600 };

function dominioDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(body) {
  return String(body || "").split(/\s+/).filter(Boolean).length;
}

function novoRelatorio(etapa) {
  const meta = ETAPAS.find((e) => e.id === etapa) || { id: etapa, agente: etapa, nome: etapa, rotulo: etapa };
  return {
    etapa: meta.id,
    agente: meta.agente,
    rotulo: meta.rotulo,
    nome: meta.nome,
    status: "aprovado",
    score: 10,
    problemas: [],
    checklist: [],
    parecer: null,
  };
}

function concluir(rel, pesos = { P0: 3, P1: 2, P2: 1, P3: 0.5 }) {
  const p0 = rel.problemas.some((p) => p.severidade === "P0");
  const p1 = rel.problemas.some((p) => p.severidade === "P1");
  const p2 = rel.problemas.some((p) => p.severidade === "P2");
  let score = 10;
  for (const p of rel.problemas) score -= pesos[p.severidade] || 0;
  rel.score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  rel.status = p0 || p1 ? "reprovado" : p2 ? "ressalvas" : "aprovado";
  return rel;
}

function item(rel, criterio, ok, severidade, mensagem, evidencia = "") {
  rel.checklist.push({ criterio, ok });
  if (!ok) rel.problemas.push({ severidade, mensagem, evidencia });
}

export function revisarPesquisa({ topic, researchSources = [], cobertura = {}, topicDomain, familiaRepetida = false, temaProibido = false, subQueries = [] }) {
  const rel = novoRelatorio("pesquisa");
  const hint = topic?.hint || "";

  item(rel, "Tema proibido", !temaProibido, "P0", "Tema proibido detectado (apostas, cassino)", hint);
  item(rel, "Dominio unico (games ou hardware)", topicDomain !== "mixed", "P0", "Tema mistura games e hardware", hint);
  item(rel, "Familia nao repetida nos ultimos artigos", !familiaRepetida, "P0", "Tema da mesma familia ja coberto recentemente", hint);

  const fontes = researchSources || [];
  const semUrl = fontes.filter((f) => !f.url);
  const blacklist = fontes.filter((f) => BLACKLIST_DOMAINS.includes(f.domain));
  const whitelistCount = fontes.filter((f) => WHITELIST_DOMAINS.includes(f.domain)).length;

  item(rel, "Minimo de 3 fontes", fontes.length >= 3, "P2", `Apenas ${fontes.length} fonte(s) pesquisadas`, `${fontes.length} fontes`);
  item(rel, "Fontes sem URL", semUrl.length === 0, "P1", `${semUrl.length} fonte(s) sem URL clicavel`, semUrl.map((f) => f.title).join("; "));
  item(rel, "Blacklist de fontes respeitada", blacklist.length === 0, "P0", `${blacklist.length} fonte(s) da blacklist`, blacklist.map((f) => f.domain).join("; "));
  item(rel, "Pelo menos 1 fonte de dominio reconhecido", whitelistCount > 0, "P2", "Nenhuma fonte de dominio reconhecido (IGN, RTINGS, TecMundo...)", `${whitelistCount} reconhecidas`);

  const claims = cobertura.claims || 0;
  const claimsSemFonte = cobertura.claimsSemFonte || 0;
  if (claims > 0) {
    item(rel, "Fatos verificados com fonte", claimsSemFonte === 0, "P2", `${claimsSemFonte} claim(s) sem fonte`, `${claims} claims, ${claimsSemFonte} sem fonte`);
  }
  if (subQueries.length > 1 && fontes.length < 3) {
    item(rel, "Sub-queries geraram fontes suficientes", false, "P2", `Pesquisa em ${subQueries.length} sub-queries retornou poucas fontes`, `${subQueries.length} sub-queries`);
  }
  if (fontes.length === 0) {
    item(rel, "Pesquisa disponivel", false, "P1", "Artigo seguiu sem fontes pesquisadas", "");
  }
  return concluir(rel);
}

export function revisarSourcing({ categoria = "", noticia = false, minProdutos = 3, rodadas = [], comAfiliado = 0, final = 0, abortado = false, gateAtingido = false, queriesUsadas = [] }) {
  const rel = novoRelatorio("sourcing");
  const temCategoria = Boolean(categoria);
  const medirFunil = temCategoria && !noticia;
  const ultima = rodadas[rodadas.length - 1] || {};
  const totalBruto = Number(ultima.bruto) || 0;
  const aposCategoria = Number.isFinite(Number(ultima.aposCategoria)) ? Number(ultima.aposCategoria) : totalBruto;
  const aposDedup = Number.isFinite(Number(ultima.aposDedup)) ? Number(ultima.aposDedup) : aposCategoria;
  const aposPiso = Number.isFinite(Number(ultima.aposPiso)) ? Number(ultima.aposPiso) : aposDedup;

  item(rel, "Gate de categoria atingido (MIN_PRODUCTS)", !medirFunil || gateAtingido, "P0", `Menos de ${minProdutos} produtos da categoria "${categoria}" apos o funil`, `${final}/${minProdutos}`);
  item(rel, "Candidatos brutos encontrados", !medirFunil || totalBruto > 0, "P2", "Nenhum candidato bruto encontrado na busca", `${totalBruto} brutos`);
  item(rel, "Categoria manteve candidatos", !medirFunil || aposCategoria > 0, "P2", `Filtro de categoria zerou a lista (${totalBruto} brutos -> 0)`, `${aposCategoria} apos categoria`);
  item(rel, "Dedup preservou candidatos", !medirFunil || aposDedup > 0, "P3", `Dedup zerou a lista`, `${aposDedup} apos dedup`);
  item(rel, "Piso de qualidade preservou candidatos", !medirFunil || aposPiso > 0, "P2", `Piso de qualidade zerou a lista (${aposDedup} -> 0)`, `${aposPiso} apos piso`);
  item(rel, "Produtos com link de afiliado", !medirFunil || comAfiliado > 0, "P1", "Nenhum produto com link de afiliado resolvido", `${comAfiliado} com afiliado`);
  item(rel, "Abortado com motivo registrado", !abortado, "P1", "Sourcing abortou apos as rodadas de retry", `rodadas: ${rodadas.length}`);
  item(rel, "Rodadas de retry executadas", !medirFunil || rodadas.length > 0, "P3", "Nenhuma rodada de retry registrada", `${rodadas.length} rodada(s)`);
  item(rel, "Queries de busca executadas", !medirFunil || queriesUsadas.length > 0, "P3", "Nenhuma query de busca registrada", `${queriesUsadas.length} query(s): ${queriesUsadas.slice(0, 5).join(" | ")}`);

  if (rodadas.length > 0) {
    item(rel, "Funil de perdas registrado por rodada", true, "P3", "", rodadas.map((r) => `${r.bruto}->${r.aposCategoria}->${r.aposDedup}->${r.aposPiso}`).join(" | "));
  }
  return concluir(rel);
}

export function revisarRedacao({ fm, body, categoria, minWords = 700, mixedDomain = false, primaryKeyword = "" }) {
  const rel = novoRelatorio("redacao");
  const textoSemFM = String(body || "");
  const texto = normalizar(textoSemFM);

  item(rel, "Sem abertura proibida", !ABERTURAS_PROIBIDAS.some((a) => texto.startsWith(a) || texto.includes(a)), "P0", "Abertura proibida detectada", ABERTURAS_PROIBIDAS.find((a) => texto.includes(a)) || "");
  item(rel, "Sem dominio misto", !mixedDomain, "P0", "Corpo mistura games e hardware", "");
  item(rel, "Sem anti-padroes de IA", !ANTI_PADROES_IA.some((p) => texto.includes(p)), "P2", "Anti-padrao de IA detectado", ANTI_PADROES_IA.filter((p) => texto.includes(p)).join("; "));
  item(rel, "Sem emojis", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(textoSemFM), "P2", "Corpo contem emojis (proibido pela identidade)", "");

  const wc = wordCount(textoSemFM);
  item(rel, "Word count acima do minimo", wc >= minWords, "P1", `Conteudo abaixo do minimo: ${wc} palavras (minimo ${minWords})`, `${wc} palavras`);

  const h2 = [...textoSemFM.matchAll(/^##\s+([^\n]+)$/gm)];
  const vazias = [];
  for (let i = 0; i < h2.length; i++) {
    const start = (h2[i].index || 0) + h2[i][0].length;
    const end = h2[i + 1] ? h2[i + 1].index : textoSemFM.length;
    if (!textoSemFM.slice(start, end).trim()) vazias.push(h2[i][1].trim().slice(0, 40));
  }
  item(rel, "Nenhuma secao ## vazia", vazias.length === 0, "P1", `${vazias.length} secao(es) ## vazia(s)`, vazias.join("; "));

  const faq = textoSemFM.match(/^##\s+FAQ\s*$/im);
  if (faq) {
    const faqBlock = textoSemFM.slice(faq.index);
    item(rel, "FAQ usa H3 (###)", /^###\s+.+\?/m.test(faqBlock), "P2", "FAQ sem perguntas em H3", "");
  }

  // Precos legitimos vivem na tabela comparativa (linhas iniciadas com "|")
  // e nos cards de produto; contagem exclui essas regioes.
  const semTabelaCards = textoSemFM
    .split("\n")
    .filter((l) => !l.trim().startsWith("|"))
    .join("\n");
  const precoProsa = [...semTabelaCards.matchAll(/R\$\s*\d[\d.,]*/g)];
  item(rel, "Precos so na tabela comparativa", precoProsa.length <= 2, "P2", `${precoProsa.length} preco(s) em prosa no corpo`, precoProsa.slice(0, 3).join("; "));

  if (fm?.description && fm?.title && normalizar(fm.description) === normalizar(fm.title)) {
    item(rel, "Description nao repete o titulo", false, "P2", "Description identica ao titulo", "");
  }
  return concluir(rel);
}

export function revisarSeo({ fm, body, primaryKeyword = "", internalLinks = 0, fontesComUrl = 0, titleProblems = [] }) {
  const rel = novoRelatorio("seo");
  const title = String(fm?.title || "");
  const description = String(fm?.description || "");
  const tags = Array.isArray(fm?.tags) ? fm.tags : [];
  const cat = String(fm?.category || "");

  for (const tp of titleProblems) {
    const sev = tp.startsWith("title: nao contem a palavra-chave") || tp.startsWith("title: expressao generica")
      ? "P1"
      : tp.startsWith("title: comeca com letra minuscula") ? "P3" : "P2";
    item(rel, "Titulo valido", false, sev, tp, title);
  }

  const kwNorm = normalizar(primaryKeyword);
  if (kwNorm) {
    const idx = normalizar(title).indexOf(kwNorm);
    item(rel, "Keyword nos primeiros 40% do titulo", idx !== -1 && title.length > 0 && idx / title.length <= 0.4, "P2", "Keyword principal fora dos primeiros 40% do titulo", title);
  }

  item(rel, "Description entre 120-160 chars", description.length >= 120 && description.length <= 160, description.length < 120 ? "P1" : "P2", `Description ${description.length} chars (ideal 120-160)`, description.slice(0, 60));
  if (kwNorm && description) {
    item(rel, "Description contem keyword no inicio", normalizar(description).slice(0, 80).includes(kwNorm), "P2", "Keyword principal fora dos primeiros 80 chars da description", description.slice(0, 80));
  }

  item(rel, "Tags entre 3 e 6", tags.length >= 3 && tags.length <= 6, tags.length < 3 ? "P1" : "P2", `${tags.length} tags (ideal 3-6)`, tags.join(", "));
  const genericas = tags.filter((t) => GENERICAS.includes(normalizar(t)));
  item(rel, "Tags especificas", genericas.length === 0, "P2", `Tags genericas: ${genericas.join(", ")}`, genericas.join(", "));
  item(rel, "Categoria valida", ["noticia", "review", "guia", "lista", "promocao"].includes(cat), "P1", `Categoria invalida: ${cat}`, cat);
  item(rel, "Imagem de capa presente", Boolean(fm?.image), "P1", "Artigo sem imagem de capa", "");

  const bodyText = String(body || "");
  const faq = bodyText.match(/^##\s+FAQ\s*$/im);
  if (faq) {
    const faqBlock = bodyText.slice(faq.index);
    item(rel, "FAQ com H3 para featured snippet", /^###\s+.+\?/m.test(faqBlock), "P2", "FAQ sem perguntas em H3", "");
  }

  item(rel, "Minimo 2 links internos", internalLinks >= 2, "P2", `Apenas ${internalLinks} link(s) interno(s)`, `${internalLinks} internos`);
  item(rel, "Minimo 2 fontes externas com URL", fontesComUrl >= 2, "P2", `Apenas ${fontesComUrl} fonte(s) externa(s) com URL`, `${fontesComUrl} fontes`);

  const minSeo = MIN_WORDS_SEO[cat];
  if (minSeo) {
    const wc = wordCount(bodyText);
    item(rel, "Word count acima do minimo da categoria", wc >= minSeo, "P1", `Word count ${wc} abaixo do minimo ${minSeo} da categoria ${cat}`, `${wc} palavras`);
  }
  return concluir(rel);
}

export function revisarDesign({ body, fm, coverImage = "", produtoImagens = [], gameImages = [] }) {
  const rel = novoRelatorio("design");
  const bodyText = String(body || "");

  const base64 = [...bodyText.matchAll(/!\[[^\]]*\]\(data:image[^)]+\)/g)];
  item(rel, "Sem imagens base64", base64.length === 0, "P0", `${base64.length} imagem(ns) data:URI no markdown`, base64.slice(0, 3).map((m) => m[0].slice(0, 50)).join("; "));

  const markers = [...bodyText.matchAll(/\[IMG:[^\]]+\]/g)];
  item(rel, "Sem marcadores [IMG:] visiveis", markers.length === 0, "P0", `${markers.length} marcador(es) [IMG:] nao consumidos`, markers.slice(0, 3).map((m) => m[0]).join("; "));

  const prodMarkers = [...bodyText.matchAll(/\[PRODUTO:\d+\]/g)];
  item(rel, "Sem marcadores [PRODUTO:] visiveis", prodMarkers.length === 0, "P0", `${prodMarkers.length} marcador(es) [PRODUTO:] nao consumidos`, prodMarkers.slice(0, 3).map((m) => m[0]).join("; "));

  const fragil = [...bodyText.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]).filter((u) => IMAGEM_FRAGIL.test(u));
  item(rel, "Sem imagens de redes sociais (frageis)", fragil.length === 0, "P1", `${fragil.length} imagem(ns) de Instagram/Facebook/TikTok`, fragil.slice(0, 3).join("; "));

  const cards = [...bodyText.matchAll(/<div class="product-card[^>]*">/g)];
  item(rel, "Sem product-card HTML legado", cards.length === 0, "P0", `${cards.length} bloco(s) <div class="product-card">`, "");

  item(rel, "Imagem de capa presente", Boolean(coverImage || fm?.image), "P1", "Artigo sem capa", "");
  if (coverImage) {
    item(rel, "Capa nao repete no corpo", !bodyText.includes(coverImage), "P2", "Imagem de capa repetida no corpo", coverImage.slice(0, 60));
  }

  const ausentes = (produtoImagens || []).filter((p) => {
    const url = String(p.path || "");
    if (!url) return false;
    // p.path e uma URL do site (/images/produtos/x.webp), nao caminho de arquivo:
    // resolve contra public/ antes do existsSync.
    if (url.startsWith("/")) return !fs.existsSync(path.resolve("public", url.replace(/^\//, "")));
    return !fs.existsSync(url);
  });
  item(rel, "Imagens locais de produto existem", ausentes.length === 0, "P1", `${ausentes.length} imagem(ns) local(is) de produto inexistente(s)`, ausentes.map((p) => p.path).slice(0, 3).join("; "));

  const imgs = [...bodyText.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
  item(rel, "Imagens com atributos de acessibilidade", imgs.every((_, i) => bodyText.match(/<img[^>]+alt="/g)?.length >= imgs.length || imgs.length === 0), "P3", "Algumas <img> sem atributo alt", "");
  return concluir(rel);
}

export function revisarFinal({ hard = [], soft = [], sourceWarnings = [], wc = 0, minWords = 700, productCount = 0 }) {
  const rel = novoRelatorio("revisao");
  item(rel, "Portao HARD (bloqueantes)", hard.length === 0, "P0", `${hard.length} bloqueante(s)`, hard.join(" | "));
  item(rel, "Portao SOFT (qualidade)", soft.length === 0, "P2", `${soft.length} ressalva(s) de qualidade`, soft.slice(0, 5).join(" | "));
  item(rel, "Cobertura de fontes", sourceWarnings.length === 0, "P1", `${sourceWarnings.length} aviso(s) de cobertura de fontes`, sourceWarnings.slice(0, 5).join(" | "));
  item(rel, "Word count acima do minimo", wc >= minWords, "P1", `Conteudo abaixo do minimo: ${wc} palavras (minimo ${minWords})`, `${wc} palavras`);
  return concluir(rel);
}

export function revisarPublicacao({ slug = "", fm, body, arquivoExiste = true, linksInternos = 0 }) {
  const rel = novoRelatorio("publicacao");
  const bodyText = String(body || "");

  item(rel, "Arquivo salvo", arquivoExiste, "P1", "Artigo nao foi salvo no disco", slug);
  item(rel, "Slug valido (sem acentos/espacos)", Boolean(slug) && slug.length <= 75 && /^[a-z0-9-]+$/.test(slug), "P2", `Slug invalido: "${slug}"`, slug);

  const campos = ["title", "description", "pubDate", "tags", "category", "affiliate", "image"];
  const faltando = campos.filter((c) => fm?.[c] === undefined || fm?.[c] === null || fm?.[c] === "");
  item(rel, "Frontmatter completo", faltando.length === 0, "P1", `Frontmatter sem: ${faltando.join(", ")}`, faltando.join(", "));

  const prodMarkers = [...bodyText.matchAll(/\[PRODUTO:\d+\]/g)];
  item(rel, "Sem marcadores de produto no markdown publicado", prodMarkers.length === 0, "P0", `${prodMarkers.length} marcador(es) [PRODUTO:] publicados`, prodMarkers.slice(0, 3).map((m) => m[0]).join("; "));

  const imgMarkers = [...bodyText.matchAll(/\[IMG:[^\]]+\]/g)];
  item(rel, "Sem marcadores de imagem no markdown publicado", imgMarkers.length === 0, "P0", `${imgMarkers.length} marcador(es) [IMG:] publicados`, imgMarkers.slice(0, 3).map((m) => m[0]).join("; "));

  item(rel, "Secao 'Quer mais ofertas?' com link Telegram", /^##\s+Quer mais ofertas\??\s*$/im.test(bodyText) && /t\.me\//.test(bodyText), "P2", "Secao 'Quer mais ofertas?' ausente ou sem link Telegram", "");

  const continueExplorando = bodyText.match(/^##\s+Continue Explorando\s*$/im);
  if (continueExplorando) {
    const bloco = bodyText.slice(continueExplorando.index);
    const links = [...bloco.matchAll(/\]\((\/blog\/[^)]+)\)/g)].length;
    item(rel, "Continue Explorando com 2 links internos", links >= 2, "P2", `Continue Explorando com ${links} link(s) interno(s)`, `${links} links`);
  } else {
    item(rel, "Secao 'Continue Explorando' presente", false, "P2", "Secao 'Continue Explorando' ausente", "");
  }

  item(rel, "Minimo 2 links internos no total", linksInternos >= 2, "P2", `Apenas ${linksInternos} link(s) interno(s)`, `${linksInternos} internos`);

  const fontes = bodyText.match(/^##\s+Fontes\s*$/im);
  if (fontes) {
    const bloco = bodyText.slice(fontes.index);
    // Fontes sao escritas como URLs cruas ("- https://...") ou links markdown:
    // conta os dois formatos.
    const links = [...bloco.matchAll(/(?:\[[^\]]*\]\()?https?:\/\/[^\s)\]>]+/g)].length;
    item(rel, "Fontes com URLs clicaveis", links >= 2, "P2", `Secao Fontes com ${links} URL(s)`, `${links} urls`);
  } else {
    item(rel, "Secao 'Fontes' presente", false, "P1", "Secao 'Fontes' ausente", "");
  }
  return concluir(rel);
}

export function revisarEtapa(id, fn, args) {
  const rel = fn(args);
  logRevisao(id, rel);
  return rel;
}

export function logRevisao(etapa, rel) {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  const label = idx !== -1 ? `${idx + 1}/6 (${rel.agente})` : rel.agente;
  console.log(`[${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}] [INFO] Revisao etapa ${label}: ${rel.status.toUpperCase()} — score ${rel.score}/10`);
  for (const p of rel.problemas) {
    console.log(`[${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}] [${p.severidade === "P0" ? "ERROR" : "WARN"}] Revisao [${p.severidade}]: ${p.mensagem}${p.evidencia ? ` | ${p.evidencia.slice(0, 80)}` : ""}`);
  }
}

export function statusGeraLLM(rel) {
  return rel.status === "reprovado" || rel.problemas.some((p) => p.severidade === "P0" || p.severidade === "P1");
}

export async function emitirParecer({ etapa, rel, contexto = {}, fetchLLM }) {
  if (!fetchLLM) return null;
  const promptPath = path.resolve("scripts", "prompts", "revisao-por-etapa.md");
  if (!fs.existsSync(promptPath)) return null;
  const meta = ETAPAS.find((e) => e.id === etapa) || { agente: etapa, nome: etapa };
  const template = fs.readFileSync(promptPath, "utf-8");
  const checklist = rel.checklist.map((c) => `- [${c.ok ? "x" : " "}] ${c.criterio}`).join("\n");
  const problemas = rel.problemas.map((p) => `- [${p.severidade}] ${p.mensagem} ${p.evidencia ? `(${p.evidencia})` : ""}`).join("\n");
  const sys = template
    .replace(/{{agente}}/g, meta.agente)
    .replace(/{{nome}}/g, meta.nome)
    .replace(/{{etapa}}/g, etapa);
  const user = `## Checklist executada\n${checklist}\n\n## Problemas encontrados\n${problemas || "Nenhum problema."}\n\n## Contexto do artigo\n${JSON.stringify(contexto).slice(0, 4000)}`;
  try {
    return await fetchLLM(sys, user, 2, { maxTokens: 1200, temperature: 0.3 });
  } catch (e) {
    console.log(`[${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}] [WARN] Parecer LLM (${etapa}) falhou: ${e.message}`);
    return null;
  }
}

export function caminhoRevisoes(slug) {
  return path.join(SQUAD_REVIEWS_DIR, slug);
}

export function salvarRevisoes(slug, revisoes, { cobertura = null } = {}) {
  const dir = caminhoRevisoes(slug);
  fs.mkdirSync(dir, { recursive: true });

  for (const rel of revisoes) {
    const md = relatorioMarkdown(slug, rel);
    fs.writeFileSync(path.join(dir, `${rel.etapa}.md`), md, "utf-8");
  }

  const consolidado = consolidadoMarkdown(slug, revisoes);
  fs.writeFileSync(path.join(dir, "00-consolidado.md"), consolidado, "utf-8");

  fs.writeFileSync(path.join(dir, "revisoes.json"), JSON.stringify(revisoes, null, 2), "utf-8");

  if (cobertura) {
    const coberturaDir = path.resolve("squads", "marketing", "conteudo-digital", "blog-gamer", "output", "cobertura");
    fs.mkdirSync(coberturaDir, { recursive: true });
    fs.writeFileSync(path.join(coberturaDir, `${slug}.json`), JSON.stringify(cobertura, null, 2), "utf-8");
  }
}

export function salvarOcorrencias(slug, revisoes) {
  const hoje = new Date().toISOString().split("T")[0];
  const linhas = [];
  for (const rel of revisoes) {
    for (const p of rel.problemas) {
      linhas.push(JSON.stringify({
        data: hoje,
        artigo: slug,
        etapa: rel.etapa,
        agente: rel.agente,
        severidade: p.severidade,
        problema: p.mensagem,
        evidencia: p.evidencia,
      }));
    }
  }
  if (linhas.length === 0) return;
  fs.mkdirSync(SQUAD_OUTPUT_DIR, { recursive: true });
  fs.appendFileSync(OCORRENCIAS_PATH, linhas.join("\n") + "\n", "utf-8");
}

function relatorioMarkdown(slug, rel) {
  const hoje = new Date().toISOString().split("T")[0];
  const statusLabel = { aprovado: "APROVADO", ressalvas: "APROVADO COM RESSALVAS", reprovado: "REPROVADO" }[rel.status] || rel.status;
  const linhas = [
    `# Revisão — ${rel.nome} (${rel.rotulo})`,
    `## Data: ${hoje}`,
    `## Artigo: ${slug}`,
    "",
    `## Status: **${statusLabel}** | Score: ${rel.score}/10`,
    "",
    "### Checklist",
    "| Criterio | Status |",
    "|---|---|",
  ];
  for (const c of rel.checklist) {
    linhas.push(`| ${c.criterio} | ${c.ok ? "✅" : "❌"} |`);
  }
  linhas.push("", "### Problemas Encontrados", "| Severidade | Problema | Evidencia |", "|---|---|---|");
  if (rel.problemas.length === 0) {
    linhas.push("| — | Nenhum problema encontrado | — |");
  } else {
    for (const p of rel.problemas) {
      linhas.push(`| ${p.severidade} | ${p.mensagem} | ${p.evidencia || "—"} |`);
    }
  }
  if (rel.parecer) {
    linhas.push("", "### Parecer do Agente (LLM)", "", rel.parecer);
  }
  linhas.push("", `*Revisão executada automaticamente pelo pipeline (etapa ${rel.etapa}).*`);
  return linhas.join("\n") + "\n";
}

function consolidadoMarkdown(slug, revisoes) {
  const hoje = new Date().toISOString().split("T")[0];
  const linhas = [
    `# Revisão Consolidada — ${slug}`,
    `## Data: ${hoje}`,
    "",
    "| Etapa | Agente | Status | Score | Problemas |",
    "|---|---|---|---|---|",
  ];
  for (const rel of revisoes) {
    const statusLabel = { aprovado: "APROVADO", ressalvas: "RESSALVAS", reprovado: "REPROVADO" }[rel.status] || rel.status;
    linhas.push(`| ${rel.nome} | ${rel.rotulo} | ${statusLabel} | ${rel.score}/10 | ${rel.problemas.length} |`);
  }
  const totalP0 = revisoes.reduce((n, r) => n + r.problemas.filter((p) => p.severidade === "P0").length, 0);
  const totalP1 = revisoes.reduce((n, r) => n + r.problemas.filter((p) => p.severidade === "P1").length, 0);
  const totalP2 = revisoes.reduce((n, r) => n + r.problemas.filter((p) => p.severidade === "P2").length, 0);
  linhas.push(
    "",
    "## Resumo Executivo",
    "",
    `- **P0 (bloqueantes):** ${totalP0}`,
    `- **P1 (graves):** ${totalP1}`,
    `- **P2 (medias):** ${totalP2}`,
  );
  const reprovados = revisoes.filter((r) => r.status === "reprovado").map((r) => r.etapa);
  if (reprovados.length > 0) {
    linhas.push(`- **Etapas reprovadas:** ${reprovados.join(", ")}`);
    linhas.push("", "> Um plano de melhoria sera gerado automaticamente para as etapas reprovadas.");
  } else {
    linhas.push("- Nenhuma etapa reprovada — artigo dentro dos padroes do squad.");
  }
  return linhas.join("\n") + "\n";
}
