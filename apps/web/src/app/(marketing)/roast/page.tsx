import type { Metadata } from "next";
import Link from "next/link";
import { RoastLab } from "@/components/features/roast/roast-lab";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Roast My Trust Center — Compliance Discovery Scanner",
  description:
    "Scrape public trust-center pages for any domain and get a scored roast across discoverability, verifiability, freshness, machine-readability, and transparency.",
  openGraph: {
    title: "Roast My Trust Center — Compliance Discovery Scanner",
    description:
      "Scrape public trust-center pages for any domain and get a scored roast across discoverability, verifiability, freshness, machine-readability, and transparency.",
    url: "/roast",
    type: "website",
    images: [
      {
        url: "/roast/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Roast My Trust Center",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Roast My Trust Center — Compliance Discovery Scanner",
    description:
      "Scrape public trust-center pages for any domain and get a scored roast across discoverability, verifiability, freshness, machine-readability, and transparency.",
    images: ["/roast/opengraph-image"],
  },
};

export default function RoastPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-crimson/70">
              TRUST CENTER INTELLIGENCE
            </p>
            <h1 className="mb-4 font-pixel-display text-4xl font-bold text-corsair-text sm:text-6xl">
              roast my trust center
            </h1>
            <p className="mx-auto max-w-2xl text-corsair-text-dim">
              Enter a trust-center domain (for example <span className="text-corsair-gold">trust.gitlab.com</span>) and Corsair
              will scrape public pages, score the posture, and generate a funny but evidence-backed roast. Then use the fix
              path to publish `trust.txt` and verifiable proof artifacts.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "Discoverability",
                "Verifiability",
                "Freshness",
                "Machine Readability",
                "Transparency",
              ].map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-corsair-border font-mono text-[10px] text-corsair-text-dim"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <RoastLab />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        <FadeIn>
          <section className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
            <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              HOW IT SCORES
            </p>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              Deterministic checks, not subjective grading
            </h2>
            <ul className="space-y-2 text-sm text-corsair-text-dim">
              <li>Discoverability checks crawlability of trust/security/compliance pages and optional trust.txt.</li>
              <li>Verifiability checks cryptographic artifacts first, then trust claims found on pages.</li>
              <li>Freshness checks recent timestamps and publication recency from scraped content.</li>
              <li>Machine readability checks for JSON/API artifacts versus PDF-only patterns.</li>
              <li>Transparency checks for status, incident, and disclosure signals.</li>
            </ul>
          </section>
        </FadeIn>

        <FadeIn delay={0.1}>
          <section className="mt-6 rounded-xl border border-corsair-gold/25 bg-corsair-surface p-5">
            <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/70">ROAST FLYWHEEL</p>
            <h2 className="mb-2 font-display text-xl font-bold text-corsair-text">Get roasted, then ship trust signals</h2>
            <p className="text-sm text-corsair-text-dim">
              The loop is simple: run a roast, share the report, fix gaps with Corsair onboarding, and publish `trust.txt` so
              buyers and agents can verify your evidence.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="font-mono text-[10px]">
                <Link href="/publish">Generate trust.txt</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="font-mono text-[10px]">
                <Link href="/setup">Hosted setup</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="font-mono text-[10px]">
                <Link href="/docs/integrations/api">API integration</Link>
              </Button>
            </div>
          </section>
        </FadeIn>
      </div>
    </main>
  );
}
