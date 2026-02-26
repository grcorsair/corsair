import type { Metadata } from "next";
import { GrcTranslatorLab } from "@/components/features/grc-translator/grc-translator-lab";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Funny GRC JSON Translator — Multi-Model Comparison",
  description:
    "Paste GRC JSON and compare funny, high-signal interpretations across multiple low-cost models. Then convert narrative into deterministic Corsair proof.",
  openGraph: {
    title: "Funny GRC JSON Translator — Multi-Model Comparison",
    description:
      "Paste GRC JSON and compare funny, high-signal interpretations across multiple low-cost models. Then convert narrative into deterministic Corsair proof.",
    url: "/translate",
    type: "website",
  },
};

export default function TranslatePage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-crimson/70">
              GRC INTERPRETATION LAB
            </p>
            <h1 className="mb-4 font-pixel-display text-4xl font-bold text-corsair-text sm:text-6xl">
              funny grc json translator
            </h1>
            <p className="mx-auto max-w-3xl text-corsair-text-dim">
              Paste one JSON evidence blob and watch multiple models interpret it side-by-side. Useful for fast narrative
              analysis. Then use Corsair to sign and verify deterministic proof.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["Quick mode", "Compare mode", "Redaction", "No persistence", "Proof handoff"].map((tag) => (
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

        <FadeIn delay={0.1}>
          <GrcTranslatorLab />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        <FadeIn>
          <section className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
            <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">SECURITY NOTE</p>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">Interpretation is not verification</h2>
            <ul className="space-y-2 text-sm text-corsair-text-dim">
              <li>This tool provides model commentary, not compliance truth.</li>
              <li>Use redaction mode for sensitive fields before sending payloads.</li>
              <li>Use Corsair SIGN/VERIFY/PUBLISH to generate verifiable trust evidence.</li>
            </ul>
          </section>
        </FadeIn>
      </div>
    </main>
  );
}
