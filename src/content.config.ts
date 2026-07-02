import { z, defineCollection } from "astro:content";

const artigosCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()),
    image: z.string().optional(),
    category: z.string(),
    affiliate: z.boolean().default(false),
  }),
});

export const collections = {
  artigos: artigosCollection,
};
