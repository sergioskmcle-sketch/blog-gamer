import sharp from "sharp";
import fs from "fs";
import path from "path";

const PUBLIC = path.resolve("public/images");

const banners = [
  "banner-grupo.png",
  "banner-grupo-9x16-2.png",
];

for (const file of banners) {
  const src = path.join(PUBLIC, file);
  const dest = path.join(PUBLIC, file.replace(".png", ".webp"));

  if (!fs.existsSync(src)) {
    console.log(`[SKIP] ${file} not found`);
    continue;
  }

  const before = fs.statSync(src).size;
  await sharp(src)
    .webp({ quality: 85 })
    .toFile(dest);
  const after = fs.statSync(dest).size;
  const savings = ((1 - after / before) * 100).toFixed(1);
  console.log(`[OK] ${file} → ${path.basename(dest)}`);
  console.log(`     ${(before/1024).toFixed(0)} KB → ${(after/1024).toFixed(0)} KB (${savings}% menor)`);
}

console.log("\nDone. Keep original PNGs as fallback or delete them.");
