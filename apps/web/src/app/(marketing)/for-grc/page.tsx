import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For GRC Leaders - Trust You Can Verify",
  description:
    "A practical, non-technical explanation of how Corsair turns compliance evidence into cryptographic proof for faster vendor trust.",
};

const outcomes = [
  {
    title: "Faster vendor reviews",
    body: "Verify proofs in seconds instead of chasing PDFs, screenshots, and portals.",
  },
  {
    title: "Continuous assurance",
    body: "Evidence isn’t a point-in-time report. It’s signed and refreshable.",
  },
  {
    title: "Audit-ready trail",
    body: "Every proof is cryptographically signed and linked to provenance.",
  },
];

const fit = [
  {
    title: "Use what you already have",
    body: "Sign tool outputs and reports you already collect. No new scanners required.",
  },
  {
    title: "No lock-in",
    body: "Proofs are portable JWT-VCs. Verify without a Corsair account.",
  },
  {
    title: "Policy-driven trust",
    body: "Relying parties set their own acceptance criteria. Corsair stays opinion-free.",
  },
];

const steps = [
  {
    title: "Collect evidence",
    body: "Pull telemetry or exports from your tools or GRC platform.",
  },
  {
    title: "Sign a CPOE",
    body: "Corsair signs the evidence as a verifiable credential (JWT-VC).",
  },
  {
    title: "Publish or share",
    body: "Share directly or publish via trust.txt for automated discovery.",
  },
];

export default function ForGrcPage() {
  return (
    <main className="pb-20">
      <section className="relative flex min-h-[55dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-green/[0.04] blur-[130px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-green/70">
            FOR GRC LEADERS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            trust you can verify
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Corsair turns evidence into cryptographic proof so you can verify vendors without
            portals, PDFs, or guesswork.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="font-mono text-xs text-corsair-green border-corsair-border">
              Proof over PDFs
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-green border-corsair-border">
              Policy-driven decisions
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-green border-corsair-border">
              Verifiable in seconds
            </Badge>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href="/docs/getting-started/quick-start">Start in 5 minutes</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-green/70">
              OUTCOMES
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              What changes for your program
            </h2>
          </FadeIn>
          <div className="grid gap-4 md:grid-cols-3">
            {outcomes.map((item, idx) => (
              <FadeIn key={item.title} delay={0.1 * idx}>
                <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                  <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                    {item.title}
                  </h3>
                  <p className="text-sm text-corsair-text-dim">{item.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <PixelDivider variant="diamond" className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              THE FLOW
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              Simple, auditable, non-technical
            </h2>
          </FadeIn>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, idx) => (
              <FadeIn key={step.title} delay={0.1 * idx}>
                <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                  <p className="mb-2 font-mono text-xs text-corsair-gold">0{idx + 1}</p>
                  <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                    {step.title}
                  </h3>
                  <p className="text-sm text-corsair-text-dim">{step.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <PixelDivider variant="swords" className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-cyan/60">
              WHY IT FITS
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              It slots into existing programs
            </h2>
          </FadeIn>
          <div className="grid gap-4 md:grid-cols-3">
            {fit.map((item, idx) => (
              <FadeIn key={item.title} delay={0.1 * idx}>
                <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                  <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                    {item.title}
                  </h3>
                  <p className="text-sm text-corsair-text-dim">{item.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <PixelDivider className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <div className="rounded-2xl border border-corsair-border bg-corsair-surface p-8 text-center">
              <h2 className="mb-3 font-display text-2xl font-bold text-corsair-text">
                Start with direct share, then automate discovery
              </h2>
              <p className="mx-auto mb-6 max-w-2xl text-sm text-corsair-text-dim">
                You can share signed proofs directly today. When you&apos;re ready, publish trust.txt
                under a delegated subdomain to make verification agent-friendly and automatic.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="sm">
                  <Link href="/docs/getting-started/quick-start">Quick start</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/publish">Publish trust.txt</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
