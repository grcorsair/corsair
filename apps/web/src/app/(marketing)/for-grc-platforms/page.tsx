import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For GRC Platforms - Standardize Evidence Exchange",
  description:
    "Corsair lets GRC platforms ingest and verify signed evidence with no lock-in, enabling a true trust exchange layer.",
};

const outcomes = [
  {
    title: "Standardized ingestion",
    body: "Accept cryptographically signed proofs from any tool or vendor without custom integrations.",
  },
  {
    title: "Higher trust, less dispute",
    body: "Proofs can be verified independently, reducing back-and-forth on evidence quality.",
  },
  {
    title: "Interoperable by default",
    body: "Evidence travels across platforms while your product remains the system of record.",
  },
];

const fit = [
  {
    title: "No lock-in required",
    body: "Corsair is a neutral protocol. You can verify proofs without a Corsair account.",
  },
  {
    title: "Composable with your workflows",
    body: "Use CPOEs as artifacts in your existing evidence and assessment flows.",
  },
  {
    title: "Better integrations, faster",
    body: "One evidence format replaces dozens of brittle point integrations.",
  },
];

const steps = [
  {
    title: "Ingest signed evidence",
    body: "Vendors or tools submit CPOEs instead of PDFs or screenshots.",
  },
  {
    title: "Verify + enforce policy",
    body: "Confirm signatures, scope, and freshness before using the evidence.",
  },
  {
    title: "Automate exchange",
    body: "Use trust.txt discovery (/.well-known or delegated DNS) to keep evidence flows current and machine-readable.",
  },
];

export default function ForGrcPlatformsPage() {
  return (
    <main className="pb-20">
      <section className="relative flex min-h-[55dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.05] blur-[130px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/70">
            FOR GRC PLATFORMS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            evidence you can trust
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Corsair standardizes evidence exchange so your platform can verify proofs without portals, lock-in, or custom glue.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-border">
              Standardized inputs
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-border">
              Policy-driven
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-border">
              Interoperable
            </Badge>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href="/docs/integrations/api">REST API</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs/integrations/sdk">TypeScript SDK</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/70">
              OUTCOMES
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              What changes for platforms
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
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-cyan/60">
              THE FLOW
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              Plug into your existing system
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
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-green/60">
              WHY IT FITS
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              It scales with your product
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
                Turn evidence exchange into a feature
              </h2>
              <p className="mx-auto mb-6 max-w-2xl text-sm text-corsair-text-dim">
                Corsair lets your platform verify proofs in a portable, standards-based format. Your customers get trust without lock-in.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="sm">
                  <Link href="/docs/integrations/sdk">Use the SDK</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/docs/integrations/api">REST API</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
