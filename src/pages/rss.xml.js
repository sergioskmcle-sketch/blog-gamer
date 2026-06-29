const artigos = Object.entries(import.meta.glob("../content/artigos/*.md", { eager: true })).map(
  ([path, mod]) => ({
    title: mod.frontmatter.title,
    pubDate: mod.frontmatter.pubDate,
    description: mod.frontmatter.description,
    slug: path.split("/").pop()?.replace(".md", "") || "",
  })
).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

export async function GET() {
  const site = "https://sergioskmcle-sketch.github.io/blog-gamer";

  const items = artigos
    .map(
      (a) => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <description><![CDATA[${a.description}]]></description>
      <link>${site}/${a.slug}/</link>
      <guid>${site}/${a.slug}/</guid>
      <pubDate>${new Date(a.pubDate).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Gamer</title>
    <description>Notícias, reviews e guias do mundo dos games</description>
    <link>${site}/</link>
    <language>pt-br</language>
    <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`,
    {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    }
  );
}
