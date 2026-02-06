import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts } from "@/lib/mdx";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Thought leadership on GRC chaos engineering, offensive compliance testing, and the future of TPRM.",
};

export default function BlogPage() {
  const posts = getBlogPosts();

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12">
            <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
              Blog
            </h1>
            <p className="text-corsair-text-dim">
              Thought leadership on GRC chaos engineering, offensive compliance,
              and the future of trust verification.
            </p>
          </div>
        </FadeIn>

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((post, i) => (
            <FadeIn key={post.slug} delay={i * 0.1}>
              <Link href={`/blog/${post.slug}`}>
                <article className="group rounded-xl border border-corsair-border bg-corsair-surface p-6 transition-all hover:border-corsair-cyan/40">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="rounded-full bg-corsair-cyan/10 px-3 py-1 font-mono text-xs font-semibold text-corsair-cyan">
                      {post.tag}
                    </span>
                    <time className="font-mono text-xs text-corsair-text-dim">
                      {new Date(post.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <h2 className="mb-2 font-display text-xl font-bold text-corsair-text group-hover:text-corsair-cyan">
                    {post.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-corsair-text-dim">
                    {post.description}
                  </p>
                  <span className="mt-4 inline-block font-mono text-xs text-corsair-gold">
                    Read more →
                  </span>
                </article>
              </Link>
            </FadeIn>
          ))}
        </div>

        {/* RSS */}
        <div className="mt-12 text-center">
          <a
            href="/blog/rss.xml"
            className="font-mono text-xs text-corsair-text-dim transition-colors hover:text-corsair-cyan"
          >
            Subscribe via RSS →
          </a>
        </div>
      </div>
    </main>
  );
}
