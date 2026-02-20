import type { Metadata } from "next";
import Link from "next/link";
import { getDocPages } from "@/lib/mdx";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export const metadata: Metadata = {
  title: "Documentation — Getting Started with CORSAIR",
  description:
    "Get started with Corsair. Learn about the CPOE lifecycle, Parley protocol, provenance model, and how to integrate with your GRC workflow.",
};

const sections = [
  { id: "getting-started", title: "Getting Started", label: "ONBOARD", labelColor: "text-corsair-cyan" },
  { id: "concepts", title: "Core Concepts", label: "CONCEPTS", labelColor: "text-corsair-gold" },
  { id: "protocol", title: "Protocol", label: "PARLEY", labelColor: "text-corsair-green" },
  { id: "integrations", title: "Integrations", label: "INTEGRATE", labelColor: "text-corsair-turquoise" },
  { id: "reference", title: "Reference", label: "REFERENCE", labelColor: "text-corsair-crimson" },
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
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              DOCUMENTATION
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              docs
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Everything you need to get started with Corsair and integrate it
              into your GRC workflow.
            </p>
          </div>
        </FadeIn>

        {/* Quick start — terminal chrome */}
        <FadeIn delay={0.2}>
          <div className="mb-8">
            <p className="mb-4 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              QUICK START
            </p>
            <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A] shadow-2xl shadow-corsair-cyan/5">
              <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-corsair-crimson/80" />
                <div className="h-3 w-3 rounded-full bg-corsair-gold/80" />
                <div className="h-3 w-3 rounded-full bg-corsair-green/80" />
                <span className="ml-3 font-mono text-xs text-corsair-text-dim">
                  parley &mdash; quick start
                </span>
              </div>
              <div className="space-y-4 p-5 font-mono text-[12px] sm:text-[13px]">
                <div>
                  <span className="text-corsair-text-dim"># Install</span>
                  <div className="text-corsair-cyan">
                    brew install grcorsair/corsair/corsair
                  </div>
                  <div className="text-corsair-cyan">
                    npm install -g @grcorsair/cli
                  </div>
                  <div className="text-corsair-text-dim">
                    # Bun is required to run the CLI (Homebrew installs it via oven-sh/bun)
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Sign tool output into a CPOE
                  </span>
                  <div className="text-corsair-gold">
                    corsair sign --file tool-output.json --mapping ./mappings/toolx.json
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Generate DID + JWKS for did:web verification
                  </span>
                  <div className="text-corsair-cyan">
                    corsair did generate --domain acme.com --output did.json
                  </div>
                  <div className="text-corsair-cyan">
                    corsair did jwks --domain acme.com --output jwks.json
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Verify any CPOE (always free)
                  </span>
                  <div className="text-corsair-gold">
                    corsair verify --file cpoe.jwt
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Diff two CPOEs — see what changed
                  </span>
                  <div className="text-corsair-turquoise">
                    corsair diff --current new-cpoe.jwt --previous old-cpoe.jwt --verify
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # List recent signed CPOEs
                  </span>
                  <div className="text-corsair-cyan">
                    corsair log --last 5
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Publish compliance discovery
                  </span>
                  <div className="text-corsair-gold">
                    corsair trust-txt generate --did did:web:acme.com
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Validate a policy artifact
                  </span>
                  <div className="text-corsair-gold">
                    corsair policy validate --file policy.json
                  </div>
                </div>
                <div>
                  <span className="text-corsair-text-dim">
                    # Generate signing keys
                  </span>
                  <div className="text-corsair-cyan">
                    corsair keygen
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* Documentation sections */}
        <div className="space-y-12">
          {groupedDocs.map((section) => (
            <FadeIn key={section.id}>
              <div id={section.id}>
                <p className={`mb-2 font-pixel text-[7px] tracking-wider ${section.labelColor}/60`}>
                  {section.label}
                </p>
                <h2 className="mb-6 font-display text-2xl font-bold text-corsair-text">
                  {section.title}
                </h2>
                {section.docs.length > 0 ? (
                  <StaggerChildren className="grid gap-4 sm:grid-cols-2">
                    {section.docs.map((doc) => (
                      <StaggerItem key={doc.slug.join("/")}>
                        <Link
                          href={`/docs/${doc.slug.join("/")}`}
                          className="pixel-card-hover group block rounded-xl border border-corsair-border bg-corsair-surface p-5 transition-all"
                          style={{ "--glow-color": "rgba(212,168,83,0.12)" } as React.CSSProperties}
                        >
                          <div className="mb-1 font-display font-bold text-corsair-text group-hover:text-corsair-gold">
                            {doc.title}
                          </div>
                          <div className="text-sm text-corsair-text-dim">
                            {doc.description}
                          </div>
                        </Link>
                      </StaggerItem>
                    ))}
                  </StaggerChildren>
                ) : (
                  <p className="text-sm text-corsair-text-dim">
                    Documentation for this section is coming soon.
                  </p>
                )}
              </div>
            </FadeIn>
          ))}
        </div>

        <PixelDivider variant="diamond" className="my-16" />

        {/* GitHub link */}
        <FadeIn>
          <div className="text-center">
            <p className="mb-6 text-corsair-text-dim">
              Full documentation is available in the GitHub repository.
            </p>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg border border-corsair-gold/30 bg-corsair-surface px-8 py-4 font-display text-sm font-semibold text-corsair-text transition-all hover:border-corsair-gold hover:text-corsair-gold hover:shadow-[0_0_20px_rgba(212,168,83,0.1)]"
            >
              View on GitHub &rarr;
            </a>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
