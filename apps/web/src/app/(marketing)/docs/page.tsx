import type { Metadata } from "next";
import Link from "next/link";
import { getDocPages } from "@/lib/mdx";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Get started with Corsair. Learn about the CPOE lifecycle, Parley protocol, assurance levels, and how to integrate with your GRC workflow.",
};

const sections = [
  { id: "getting-started", title: "Getting Started" },
  { id: "concepts", title: "Core Concepts" },
  { id: "protocol", title: "Protocol" },
  { id: "integrations", title: "Integrations" },
];

export default function DocsPage() {
  const allDocs = getDocPages();

  const groupedDocs = sections.map((section) => ({
    ...section,
    docs: allDocs.filter((d) => d.section === section.id),
  }));

  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12">
            <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
              Documentation
            </h1>
            <p className="max-w-xl text-corsair-text-dim">
              Everything you need to get started with Corsair and integrate it
              into your GRC workflow.
            </p>
          </div>
        </FadeIn>

        {/* Quick start inline */}
        <FadeIn>
          <div className="mb-16 rounded-xl border border-corsair-cyan/20 bg-corsair-surface p-8">
            <h2 className="mb-4 font-display text-2xl font-bold text-corsair-text">
              Quick Start
            </h2>
            <div className="space-y-4 font-mono text-sm">
              <div>
                <span className="text-corsair-text-dim"># Install Bun</span>
                <div className="text-corsair-cyan">
                  curl -fsSL https://bun.sh/install | bash
                </div>
              </div>
              <div>
                <span className="text-corsair-text-dim">
                  # Clone and install
                </span>
                <div className="text-corsair-cyan">
                  git clone https://github.com/Arudjreis/corsair.git
                </div>
                <div className="text-corsair-cyan">
                  cd corsair && bun install
                </div>
              </div>
              <div>
                <span className="text-corsair-text-dim">
                  # Run demo mission (no API keys needed)
                </span>
                <div className="text-corsair-gold">
                  bun corsair.ts --target demo --service cognito --format html
                </div>
              </div>
              <div>
                <span className="text-corsair-text-dim">
                  # Run against real AWS (requires credentials)
                </span>
                <div className="text-corsair-gold">
                  bun corsair.ts --target us-west-2_ABC123 --service cognito
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Documentation sections */}
        <div className="space-y-12">
          {groupedDocs.map((section) => (
            <FadeIn key={section.id}>
              <div>
                <h2 className="mb-6 font-display text-2xl font-bold text-corsair-text">
                  {section.title}
                </h2>
                {section.docs.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {section.docs.map((doc) => (
                      <Link
                        key={doc.slug.join("/")}
                        href={`/docs/${doc.slug.join("/")}`}
                        className="group rounded-xl border border-corsair-border bg-corsair-surface p-5 transition-all hover:border-corsair-cyan/40"
                      >
                        <div className="mb-1 font-display font-bold text-corsair-text group-hover:text-corsair-cyan">
                          {doc.title}
                        </div>
                        <div className="text-sm text-corsair-text-dim">
                          {doc.description}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-corsair-text-dim">
                    Documentation for this section is coming soon.
                  </p>
                )}
              </div>
            </FadeIn>
          ))}
        </div>

        {/* GitHub link */}
        <FadeIn>
          <div className="mt-16 rounded-xl border border-corsair-border bg-corsair-surface p-8 text-center">
            <p className="mb-4 text-corsair-text-dim">
              Full documentation is available in the GitHub repository.
            </p>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg border border-corsair-border bg-corsair-deep px-6 py-3 font-display text-sm font-semibold text-corsair-text transition-colors hover:border-corsair-cyan hover:text-corsair-cyan"
            >
              View on GitHub
            </a>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
