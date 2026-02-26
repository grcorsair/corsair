import type { Metadata } from "next";
import { RoastLab } from "@/components/features/roast/roast-lab";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Roast My Trust Center — Compliance Discovery Scanner",
  description:
    "Scan any domain's trust center and get a scored roast across discoverability, verifiability, freshness, machine-readability, and transparency.",
  openGraph: {
    title: "Roast My Trust Center — Compliance Discovery Scanner",
    description:
      "Scan any domain's trust center and get a scored roast across discoverability, verifiability, freshness, machine-readability, and transparency.",
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
      "Scan any domain's trust center and get a scored roast across discoverability, verifiability, freshness, machine-readability, and transparency.",
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
              Enter a domain and Corsair will score its machine-verifiable trust posture. This is a
              compliance scanner, not a vibes checker.
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
              <li>Discoverability checks trust.txt and delegation paths.</li>
              <li>Verifiability checks whether published CPOEs cryptographically verify.</li>
              <li>Freshness checks issuance recency and expiry posture.</li>
              <li>Machine readability checks catalog and structured metadata availability.</li>
              <li>Transparency checks SCITT visibility and provenance hints.</li>
            </ul>
          </section>
        </FadeIn>
      </div>
    </main>
  );
}
