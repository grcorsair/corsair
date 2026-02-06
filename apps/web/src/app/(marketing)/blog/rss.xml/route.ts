import RSS from "rss";
import { getBlogPosts } from "@/lib/mdx";

export async function GET() {
  const feed = new RSS({
    title: "CORSAIR Blog",
    description:
      "Thought leadership on GRC chaos engineering, offensive compliance testing, and the future of TPRM.",
    site_url: "https://grcorsair.com",
    feed_url: "https://grcorsair.com/blog/rss.xml",
    language: "en",
    pubDate: new Date(),
    copyright: `${new Date().getFullYear()} CORSAIR`,
  });

  const posts = getBlogPosts();

  for (const post of posts) {
    feed.item({
      title: post.title,
      description: post.description,
      url: `https://grcorsair.com/blog/${post.slug}`,
      date: new Date(post.date),
      categories: [post.tag],
    });
  }

  return new Response(feed.xml({ indent: true }), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
