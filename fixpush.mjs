import { Octokit } from "@octokit/rest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

const token = process.env.GH_TOKEN;
if (!token) { console.error("missing GH_TOKEN"); process.exit(1); }

const OWNER = "sergioskmcle-sketch";
const REPO = "blog-gamer";
const octokit = new Octokit({ auth: token, request: { fetch } });

const EXCLUDE = [/node_modules/, /\.git/, /\.astro/, /dist/, /\.env/, /stitch-output/, /ml_cookies\.json/, /venv/, /__pycache__/, /\.DS_Store/, /\.local/];
// Files/paths that contain secrets - skip them
const SKIP = [/README\.md$/, /CREDENCIAIS\.md$/i, /automation/, /docs\//, /^docs\//, /\.env/, /projeto-blog$/, /PROMPT_CONEXAO/, /^deploy.*\.mjs$/, /^check.*\.mjs$/, /^nojekyll\.mjs$/, /^wait\.mjs$/, /^runs\.mjs$/, /^status\.mjs$/];

function shouldSkip(rel) {
  return EXCLUDE.some(p => p.test(rel)) || SKIP.some(p => p.test(rel));
}

function walkDir(dir, base) {
  base = base || "";
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const rel = base ? base + "/" + entry : entry;
    if (shouldSkip(rel)) { process.stdout.write("  skip " + rel + "\n"); continue; }
    if (statSync(full).isDirectory()) files.push(...walkDir(full, rel));
    else files.push(rel);
  }
  return files;
}

// compute hash to find new files
async function main() {
  const files = walkDir(resolve("."));
  process.stdout.write("\nTotal files: " + files.length + "\n");

  // get current main commit
  const { data: ref } = await octokit.rest.git.getRef({ owner: OWNER, repo: REPO, ref: "heads/main" });
  const { data: baseCommit } = await octokit.rest.git.getCommit({ owner: OWNER, repo: REPO, commit_sha: ref.object.sha });
  process.stdout.write("Current main: " + ref.object.sha + " tree: " + baseCommit.tree.sha + "\n");

  // get current tree to compare
  const { data: currentTree } = await octokit.rest.git.getTree({ owner: OWNER, repo: REPO, tree_sha: baseCommit.tree.sha, recursive: "1" });
  const existingPaths = new Set(currentTree.tree.filter(f => f.type === "blob").map(f => f.path));
  process.stdout.write("Existing files on main: " + existingPaths.size + "\n");

  // filter to only new/modified files
  const changed = [];
  for (const file of files) {
    if (existingPaths.has(file)) {
      const localContent = readFileSync(resolve(file));
      // get sha of existing file
      const existing = currentTree.tree.find(f => f.path === file);
      if (existing) {
        const { data: blob } = await octokit.rest.git.getBlob({ owner: OWNER, repo: REPO, file_sha: existing.sha });
        const existingContent = Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf-8");
        if (localContent.equals(existingContent)) {
          continue; // unchanged
        }
      }
    }
    changed.push(file);
  }

  process.stdout.write("Changed files: " + changed.length + "\n");
  for (const f of changed) process.stdout.write("  " + f + "\n");

  if (changed.length === 0) { process.stdout.write("Nothing to update.\n"); return; }

  // create blobs for changed files
  const items = [];
  for (let i = 0; i < changed.length; i += 20) {
    const results = await Promise.all(changed.slice(i, i+20).map(async (file) => {
      const content = readFileSync(resolve(file));
      const { data } = await octokit.rest.git.createBlob({ owner: OWNER, repo: REPO, content: content.toString("base64"), encoding: "base64" });
      return { path: file, mode: "100644", type: "blob", sha: data.sha };
    }));
    items.push(...results);
  }

  // create tree with base_tree
  const { data: tree } = await octokit.rest.git.createTree({ owner: OWNER, repo: REPO, tree: items, base_tree: baseCommit.tree.sha });
  process.stdout.write("Tree: " + tree.sha + "\n");

  // commit
  const { data: commit } = await octokit.rest.git.createCommit({ owner: OWNER, repo: REPO, message: "fix: push updated Stitch source files", tree: tree.sha, parents: [ref.object.sha] });
  process.stdout.write("Commit: " + commit.sha + "\n");

  await octokit.rest.git.updateRef({ owner: OWNER, repo: REPO, ref: "heads/main", sha: commit.sha });
  process.stdout.write("main updated!\n");
}

main().catch(e => { console.error(e); process.exit(1); });
