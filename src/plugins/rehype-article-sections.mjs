/**
 * rehype-article-sections
 *
 * Hierarquia visual dos artigos:
 *   - <h2> abre uma secao-topico <section class="article-section">.
 *   - <h3> abre um sub-card <section class="article-subsection"> aninhado
 *     no topico atual (itens de lista, perguntas de FAQ, dicas, etc).
 *
 * Todo heading recebe um id, garantindo que os links do TOC sempre
 * apontem para um alvo real:
 *   - heading com ancora manual <a id="X">: o id e migrado para o proprio
 *     heading e a ancora e removida (evita id duplicado quando o Astro
 *     gera o id automatico via github-slugger apos este plugin);
 *   - heading sem ancora: id automatico ASCII derivado do texto (mesma
 *     regra de src/lib/slug.ts).
 *
 * Quando um <img> aparece logo antes de um heading (formato antigo, imagem
 * antes do titulo), a imagem e movida para logo APOS o heading, garantindo
 * a ordem "titulo -> imagem -> texto" em qualquer formato de artigo.
 */

const isHeading = (node, tag) => node.type === "element" && node.tagName === tag;
const isImg = (node) => node.type === "element" && node.tagName === "img";
const isMeaningful = (node) => node.type !== "text" || node.value.trim() !== "";

function headingText(node) {
  let text = "";
  const collect = (n) => {
    if (n.type === "text") text += n.value;
    else if (n.children) n.children.forEach(collect);
  };
  collect(node);
  return text;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findAnchorId(node) {
  if (!node.children) return null;
  for (const child of node.children) {
    if (
      child.type === "element" &&
      child.tagName === "a" &&
      child.properties &&
      child.properties.id
    ) {
      return { id: child.properties.id, child };
    }
    if (
      (child.type === "raw" || child.type === "html") &&
      typeof child.value === "string" &&
      /<a\b[^>]*\bid="/i.test(child.value)
    ) {
      const m = /<a\b[^>]*\bid="([^"]+)"/i.exec(child.value);
      if (m && m[1]) return { id: m[1], child };
    }
  }
  return null;
}

function registerId(id, usedIds) {
  let candidate = id;
  let n = 2;
  while (usedIds.has(candidate)) candidate = `${id}-${n++}`;
  usedIds.add(candidate);
  return candidate;
}

function ensureHeadingId(node, usedIds) {
  if (!node.properties) return;
  const anchor = findAnchorId(node);
  if (anchor) {
    node.properties.id = registerId(anchor.id, usedIds);
    node.children.splice(node.children.indexOf(anchor.child), 1);
    return;
  }
  node.properties.id = registerId(slugify(headingText(node)), usedIds);
}

function ensureNestedHeadingIds(node, usedIds) {
  if (!node.children) return;
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (/^h[1-6]$/.test(child.tagName)) {
      if (typeof child.properties?.id === "string") {
        usedIds.add(child.properties.id);
      } else {
        child.properties = child.properties || {};
        child.properties.id = registerId(slugify(headingText(child)), usedIds);
      }
    } else if (child.children) {
      ensureNestedHeadingIds(child, usedIds);
    }
  }
}

function lastMeaningfulChild(container) {
  for (let i = container.children.length - 1; i >= 0; i--) {
    if (isMeaningful(container.children[i])) return container.children[i];
  }
  return null;
}

function takeTrailingImg(container) {
  const last = lastMeaningfulChild(container);
  if (last && isImg(last)) {
    container.children.splice(container.children.indexOf(last), 1);
    return last;
  }
  return null;
}

export default function rehypeArticleSections() {
  return (tree) => {
    const usedIds = new Set();
    const out = [];
    let section = null;
    let subsection = null;
    let intro = null;

    const isFaqSection = (s) => {
      const h2 = s && s.children && s.children.find((c) => c.type === "element" && c.tagName === "h2");
      return h2 ? /^(faq|perguntas frequentes)/i.test(headingText(h2).trim()) : false;
    };

    for (const node of tree.children) {
      if (isHeading(node, "h2")) {
        ensureHeadingId(node, usedIds);
        subsection = null;

        const prev = out[out.length - 1];
        let lifted = null;
        if (intro && intro.children.length > 0) {
          lifted = takeTrailingImg(intro);
        } else if (prev) {
          if (prev.type === "element" && prev.tagName === "section") {
            lifted = takeTrailingImg(prev);
          } else if (isImg(prev)) {
            out.pop();
            lifted = prev;
          }
        }
        section = {
          type: "element",
          tagName: "section",
          properties: { className: ["article-section"] },
          children: [node],
        };
        if (lifted) section.children.push(lifted);

        out.push(section);
      } else if (isHeading(node, "h3")) {
        ensureHeadingId(node, usedIds);
        if (section && isFaqSection(section)) {
          // TAREFA 3.3: FAQ vira acordeao — cada pergunta e um <details>.
          subsection = {
            type: "element",
            tagName: "details",
            properties: { className: ["faq-item"] },
            children: [
              { type: "element", tagName: "summary", properties: {}, children: [node] },
            ],
          };
          section.children.push(subsection);
        } else {
          subsection = {
            type: "element",
            tagName: "section",
            properties: { className: ["article-subsection"] },
            children: [node],
          };

          if (section) {
            const lifted = takeTrailingImg(section);
            if (lifted) subsection.children.push(lifted);
            section.children.push(subsection);
          } else {
            out.push(subsection);
            section = subsection;
          }
        }
      } else if (subsection) {
        subsection.children.push(node);
      } else if (section) {
        section.children.push(node);
      } else {
        // TAREFA 3.2: o que vem antes do primeiro H2 e a introducao — ganha um
        // container proprio com a ancora usada pelo item "Introducao" do TOC.
        // O titulo "<h2>Introdução</h2>" e injetado para a introducao ter o
        // mesmo aspecto das demais secoes; a ancora fica no proprio h2 (o
        // id da section e removido para nao duplicar).
        if (!intro) {
          intro = {
            type: "element",
            tagName: "section",
            properties: {
              className: ["article-section", "article-intro"],
            },
            children: [
              {
                type: "element",
                tagName: "h2",
                properties: { id: "introducao" },
                children: [{ type: "text", value: "Introdução" }],
              },
            ],
          };
        }
        intro.children.push(node);
      }
    }

    if (intro && intro.children.length > 0) out.unshift(intro);

    tree.children = out;
    ensureNestedHeadingIds(tree, usedIds);
  };
}
