import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getDocPage, getDocPages } from "@/lib/mdx";
import remarkGfm from "remark-gfm";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  const docs = getDocPages();
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocPage(slug);
  if (!doc) return {};

  return {
    title: doc.meta.title,
    description: doc.meta.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = getDocPage(slug);
  if (!doc) notFound();

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 font-mono text-xs text-corsair-text-dim">
          <Link
            href="/docs"
            className="transition-colors hover:text-corsair-cyan"
          >
            Docs
          </Link>
          {slug.map((part, i) => (
            <span key={part} className="flex items-center gap-2">
              <span>/</span>
              {i === slug.length - 1 ? (
                <span className="text-corsair-text">{doc.meta.title}</span>
              ) : (
                <span className="capitalize">{part.replace(/-/g, " ")}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Doc header */}
        <header className="mb-12">
          <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
            {doc.meta.title}
          </h1>
          {doc.meta.description && (
            <p className="text-lg text-corsair-text-dim">
              {doc.meta.description}
            </p>
          )}
        </header>

        {/* Doc content */}
        <article className="mdx-content">
          <MDXRemote
            source={doc.content}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </article>

        {/* Navigation */}
        <div className="mt-16 border-t border-corsair-border pt-8">
          <Link
            href="/docs"
            className="font-mono text-xs text-corsair-text-dim transition-colors hover:text-corsair-cyan"
          >
            ← Back to documentation
          </Link>
        </div>
      </div>
    </main>
  );
}
