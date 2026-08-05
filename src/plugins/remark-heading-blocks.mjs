/**
 * remark-heading-blocks
 *
 * Corrige o parse de artigos onde uma linha <img> (HTML block) engole a
 * linha `## heading` que vem logo em seguida (sem linha em branco),
 * fazendo o titulo virar texto literal.
 *
 * Divide o node `html` em: nodes `html` (imagens) + nodes `heading`.
 */

const ATX = /^(#{1,6})\s+(.+)$/;

export default function remarkHeadingBlocks() {
  return (tree) => {
    walk(tree);
  };
}

function walk(node) {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) return;

  const next = [];
  for (const child of node.children) {
    if (child.type === "html" && typeof child.value === "string" && child.value.includes("\n")) {
      next.push(...splitHtmlBlock(child));
    } else {
      next.push(child);
    }
  }
  node.children = next;

  for (const child of node.children) {
    if (child.type !== "html") walk(child);
  }
}

function splitHtmlBlock(node) {
  const lines = node.value.split(/\r?\n/);
  const out = [];
  let buf = [];

  const flush = () => {
    if (buf.length) {
      out.push({ type: "html", value: buf.join("\n") });
      buf = [];
    }
  };

  for (const line of lines) {
    const m = line.match(ATX);
    if (m) {
      flush();
      out.push(buildHeading(m[1].length, m[2]));
    } else {
      buf.push(line);
    }
  }
  flush();

  return out;
}

function buildHeading(depth, content) {
  const anchor = content.match(/^\s*<a\s+id="([^"]+)"[^>]*>\s*<\/a>\s*(.*)$/);
  const children = [];
  if (anchor) {
    children.push({ type: "html", value: `<a id="${anchor[1]}"></a>` });
    if (anchor[2]) children.push({ type: "text", value: anchor[2] });
  } else {
    children.push({ type: "text", value: content });
  }
  return { type: "heading", depth, children };
}
