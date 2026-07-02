import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://sergioskmcle-sketch.github.io",
  base: "/blog-gamer",
  output: "static",
  build: {
    assets: "_assets",
  },
});
