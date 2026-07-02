import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://sergioskmcle-sketch.github.io",
  base: "/blog-gamer",
  output: "static",
  build: {
    assets: "_assets",
  },
  integrations: [tailwind()],
});
