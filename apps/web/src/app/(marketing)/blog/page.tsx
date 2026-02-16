import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts } from "@/lib/mdx";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Thought leadership on compliance proof infrastructure, trust exchange protocols, and the future of vendor verification.",
};

export default function BlogPage() {
  const posts = getBlogPosts();

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              DISPATCHES
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              blog
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Thought leadership on compliance proof infrastructure, trust
              exchange protocols, and the future of trust verification.
            </p>
          </div>
        </FadeIn>

        {/* Posts */}
        <div className="space-y-6">
          {posts.map((post, i) => (
            <FadeIn key={post.slug} delay={i * 0.1}>
              <Link href={`/blog/${post.slug}`}>
                <article
                  className="pixel-card-hover group rounded-xl border border-corsair-border bg-corsair-surface p-6 transition-all"
                  style={{ "--glow-color": "rgba(212,168,83,0.12)" } as React.CSSProperties}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="font-pixel text-[7px] tracking-wider text-corsair-cyan">
                      {post.tag}
                    </span>
                    <time className="font-mono text-xs text-corsair-text-dim">
                      {new Date(post.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    <span className="font-mono text-xs text-corsair-text-dim/60">
                      by {post.author}
                    </span>
                  </div>
                  <h2 className="mb-2 font-display text-xl font-bold text-corsair-text group-hover:text-corsair-gold">
                    {post.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-corsair-text-dim">
                    {post.description}
                  </p>
                  <span className="mt-4 inline-block font-mono text-xs text-corsair-gold">
                    Read more &rarr;
                  </span>
                </article>
              </Link>
            </FadeIn>
          ))}
        </div>

        <PixelDivider variant="diamond" className="my-12" />

        {/* GRC Engineer CTA */}
        <FadeIn>
          <div className="mb-8 rounded-xl border border-corsair-gold/20 bg-corsair-surface p-6 text-center">
            <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              GRC ENGINEERING
            </p>
            <p className="mb-3 text-sm text-corsair-text-dim">
              For more on GRC engineering, compliance automation, and the future of trust —
              read Ayoub Fandi&apos;s newsletter.
            </p>
            <a
              href="https://grcengineer.com/subscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md border border-corsair-gold/30 px-6 py-2 font-display text-sm font-semibold text-corsair-text-dim transition-all hover:border-corsair-gold hover:text-corsair-gold"
            >
              Subscribe to GRC Engineer &rarr;
            </a>
          </div>
        </FadeIn>

        {/* RSS */}
        <FadeIn>
          <div className="text-center">
            <a
              href="/blog/rss.xml"
              className="font-mono text-xs text-corsair-text-dim transition-colors hover:text-corsair-gold"
            >
              Subscribe via RSS &rarr;
            </a>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
