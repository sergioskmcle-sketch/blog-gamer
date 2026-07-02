import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIGOS_DIR = path.resolve(__dirname, '..', 'src', 'content', 'artigos');
const IMAGES_DIR = path.resolve(__dirname, '..', 'public', 'images', 'produtos');
const BASE = '/blog-gamer';

fs.mkdirSync(IMAGES_DIR, { recursive: true });

function isPlaceholderGif(buffer) {
  return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}

async function download(url, savePath) {
  if (fs.existsSync(savePath)) {
    const stats = fs.statSync(savePath);
    console.log(`  [SKIP] ${savePath} (${stats.size} bytes)`);
    return true;
  }
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/webp,image/*,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!res.ok) {
    console.log(`  [FAIL] HTTP ${res.status}: ${url}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (isPlaceholderGif(buf)) {
    console.log(`  [BLOCKED] ML placeholder: ${url.split('/').pop()}`);
    return false;
  }
  fs.writeFileSync(savePath, buf);
  console.log(`  [OK] ${savePath} (${buf.length} bytes)`);
  return true;
}

async function getOgImage(productUrl) {
  try {
    const res = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
    if (og) return og[1];
    const ld = html.match(/"image"\s*:\s*"([^"]+)"/);
    if (ld) return ld[1].replace(/\\u002F/g, '/');
    return null;
  } catch {
    return null;
  }
}

function stripQuery(url) {
  return url.split('?')[0];
}

function extFromUrl(url) {
  const clean = stripQuery(url);
  const ext = path.extname(clean) || '.jpg';
  return ext;
}

async function processArticle(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const filename = path.basename(filePath);
  console.log(`\n=== ${filename} ===`);

  // --- Frontmatter image ---
  const fmMatch = content.match(/^image:\s*"(https?:\/\/http2\.mlstatic\.com[^"]*)"/m);
  if (fmMatch) {
    const url = fmMatch[1];
    const ogMetaMatch = content.match(/^og_image:\s*"(https?:\/\/http2\.mlstatic\.com[^"]*)"/m);
    const effectiveUrl = ogMetaMatch ? ogMetaMatch[1] : url;
    const parsed = new URL(effectiveUrl);
    const baseName = parsed.pathname.split('/').pop();
    const savePath = path.join(IMAGES_DIR, baseName);
    const ok = await download(effectiveUrl, savePath);
    if (ok) {
      const localUrl = `${BASE}/images/produtos/${baseName}`;
      content = content.replace(
        new RegExp(`image:\\s*"${escapeRegex(url)}"`),
        `image: "${localUrl}"`
      );
      console.log(`  Frontmatter image replaced -> ${localUrl}`);
    }
  }

  // --- Product images in content ---
  // Find all img tags with ML URLs paired with nearest meli.la link
  const sections = content.split(/(?=###\s)/);
  for (let si = 0; si < sections.length; si++) {
    let section = sections[si];
    if (!section.includes('http2.mlstatic.com')) continue;

    const imgRegex = /<img[^>]*src="(https?:\/\/http2\.mlstatic\.com[^"]*)"[^>]*>/g;
    let match;
    while ((match = imgRegex.exec(section)) !== null) {
      const imgUrl = match[1];
      const parsed = new URL(imgUrl);
      const baseName = parsed.pathname.split('/').pop();
      const savePath = path.join(IMAGES_DIR, baseName);

      let ok = await download(imgUrl, savePath);

      // If blocked, try to get OG image from affiliate link in the same section
      if (!ok) {
        const affiliateMatch = section.match(/<a[^>]*href="(https?:\/\/meli\.la\/[^"]+)"[^>]*>/);
        if (affiliateMatch) {
          console.log(`  Following affiliate link for OG image...`);
          const ogUrl = await getOgImage(affiliateMatch[1]);
          if (ogUrl) {
            const ogParsed = new URL(ogUrl);
            const ogBaseName = ogParsed.pathname.split('/').pop();
            const ogSavePath = path.join(IMAGES_DIR, ogBaseName);
            const ogOk = await download(ogUrl, ogSavePath);
            if (ogOk) {
              const localUrl = `${BASE}/images/produtos/${ogBaseName}`;
              section = section.replace(imgUrl, localUrl);
              sections[si] = section;
              console.log(`  Replaced with OG image -> ${localUrl}`);
              ok = true;
            }
          }
        }
      }

      if (ok) {
        const localUrl = `${BASE}/images/produtos/${baseName}`;
        section = section.replace(imgUrl, localUrl);
        sections[si] = section;
      }
    }
  }

  // --- Handle Xbox Series S (missing image) ---
  // Find the Xbox Series S section and add an img tag before the affiliate link
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    if (section.includes('Xbox Series S') && section.includes('meli.la/1bAzcod') && !section.includes('<img')) {
      const ogUrl = await getOgImage('https://meli.la/1bAzcod');
      if (ogUrl) {
        const ogParsed = new URL(ogUrl);
        const ogBaseName = ogParsed.pathname.split('/').pop();
        const ogSavePath = path.join(IMAGES_DIR, ogBaseName);
        const ogOk = await download(ogUrl, ogSavePath);
        if (ogOk) {
          const localUrl = `${BASE}/images/produtos/${ogBaseName}`;
          const imgTag = `<img src="${localUrl}" alt="Xbox Series S" class="product-image">\n`;
          sections[si] = section.replace('meli.la/1bAzcod', 'DUMMY_PLACEHOLDER');
          sections[si] = sections[si].replace('DUMMY_PLACEHOLDER', 'meli.la/1bAzcod');
          // Add img tag before the button
          sections[si] = sections[si].replace(
            /(<a href="https:\/\/meli\.la\/1bAzcod")/,
            `${imgTag}$1`
          );
          console.log(`  Added missing Xbox Series S image -> ${localUrl}`);
        }
      }
    }
  }

  content = sections.join('');
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  => Updated ${filename}`);
  } else {
    console.log(`  => No changes needed`);
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main
const files = fs.readdirSync(ARTIGOS_DIR).filter(f => f.endsWith('.md'));
for (const file of files) {
  await processArticle(path.join(ARTIGOS_DIR, file));
}

console.log('\n=== All done ===');
