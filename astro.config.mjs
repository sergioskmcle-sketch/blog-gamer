import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://sergioskmcle-sketch.github.io",
  base: "/blog-gamer",
  output: "static",
  build: {
    assets: "_assets",
  },
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes("/admin/"),
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
});
