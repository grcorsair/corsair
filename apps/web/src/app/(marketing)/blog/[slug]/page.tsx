import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getBlogPost, getBlogPosts } from "@/lib/mdx";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.meta.title,
    description: post.meta.description,
    authors: [{ name: post.meta.author, url: "https://grcengineer.com" }],
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      type: "article",
      publishedTime: post.meta.date,
      authors: [post.meta.author],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <FadeIn>
          <Link
            href="/blog"
            className="mb-8 inline-block font-mono text-xs text-corsair-text-dim transition-colors hover:text-corsair-gold"
          >
            &larr; Back to blog
          </Link>
        </FadeIn>

        {/* Post header */}
        <FadeIn delay={0.1}>
          <header className="mb-12">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="font-pixel text-[7px] tracking-wider text-corsair-cyan">
                {post.meta.tag}
              </span>
              <time className="font-mono text-xs text-corsair-text-dim">
                {new Date(post.meta.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span className="font-mono text-xs text-corsair-text-dim">
                by{" "}
                <a
                  href="https://grcengineer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-corsair-gold/80 transition-colors hover:text-corsair-gold"
                >
                  {post.meta.author}
                </a>
              </span>
            </div>
            <h1 className="mb-4 font-display text-4xl font-bold leading-tight text-corsair-text">
              {post.meta.title}
            </h1>
            <p className="text-lg text-corsair-text-dim">
              {post.meta.description}
            </p>
          </header>
        </FadeIn>

        <PixelDivider variant="swords" className="mb-12" />

        {/* Post content */}
        <FadeIn delay={0.2}>
          <article className="mdx-content">
            <MDXRemote
              source={post.content}
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </article>
        </FadeIn>

        <PixelDivider variant="diamond" className="my-12" />

        {/* Further Reading from GRC Engineer */}
        <FadeIn delay={0.3}>
          <div className="rounded-xl border border-corsair-border bg-corsair-surface p-6">
            <p className="mb-1 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              FROM GRC ENGINEERING
            </p>
            <p className="mb-4 text-sm text-corsair-text-dim">
              More from{" "}
              <a
                href="https://grcengineer.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-corsair-gold/80 transition-colors hover:text-corsair-gold"
              >
                Ayoub Fandi
              </a>
              &apos;s GRC engineering practice:
            </p>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://grcengineer.com/p/compliance-as-cope-how-grc-engineering-automated-the-wrong-thing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
                >
                  Compliance as Cope: How GRC Engineering Automated the Wrong Thing &rarr;
                </a>
              </li>
              <li>
                <a
                  href="https://grcengineer.com/p/are-you-building-for-auditors-or-attackers-the-grc-engineering-shift"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
                >
                  Are You Building for Auditors or Attackers? The GRC Engineering Shift &rarr;
                </a>
              </li>
              <li>
                <a
                  href="https://grcengineer.com/p/ai-agents-as-the-next-grc-frontier"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-corsair-text-dim transition-colors hover:text-corsair-gold"
                >
                  AI Agents as the Next GRC Frontier &rarr;
                </a>
              </li>
            </ul>
            <p className="mt-4">
              <a
                href="https://grcengineer.com/subscribe"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-corsair-gold transition-colors hover:text-corsair-gold/80"
              >
                Subscribe to the GRC Engineer newsletter &rarr;
              </a>
            </p>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
