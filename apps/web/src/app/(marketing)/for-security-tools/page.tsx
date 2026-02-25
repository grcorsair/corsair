import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For Security Tools - Portable, Verifiable Outputs",
  description:
    "Turn your tool output into signed, verifiable proofs that vendors and relying parties can trust anywhere.",
};

const outcomes = [
  {
    title: "Make findings portable",
    body: "Export signed CPOEs that can be verified with any standard JWT library.",
  },
  {
    title: "Reduce buyer friction",
    body: "Give customers proof they can verify without portals, screenshots, or vendor lock-in.",
  },
  {
    title: "Differentiate your product",
    body: "Cryptographic proof elevates your outputs from reports to verifiable evidence.",
  },
];

const fit = [
  {
    title: "No new UI",
    body: "Keep your current exports. Corsair signs the output you already generate.",
  },
  {
    title: "Works in CI/CD",
    body: "Automate signing after each run, then publish or share proofs instantly.",
  },
  {
    title: "Neutral protocol",
    body: "No platform dependency. Evidence is portable across any workflow.",
  },
];

const steps = [
  {
    title: "Run your tool",
    body: "Generate the same JSON you already output today.",
  },
  {
    title: "Sign the output",
    body: "Corsair signs it into a CPOE (JWT-VC) with provenance metadata.",
  },
  {
    title: "Share or publish",
    body: "Distribute directly or publish via trust.txt (/.well-known or delegated DNS) for discovery.",
  },
];

export default function ForSecurityToolsPage() {
  return (
    <main className="pb-20">
      <section className="relative flex min-h-[55dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-green/[0.05] blur-[130px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-green/70">
            FOR SECURITY TOOLS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            verifiable outputs
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Corsair turns your tool output into a cryptographic proof that buyers, auditors, and platforms can verify anywhere.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="font-mono text-xs text-corsair-green border-corsair-border">
              Portable proofs
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-green border-corsair-border">
              No lock-in
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-green border-corsair-border">
              CI-ready
            </Badge>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href="/sign">Sign tool output</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs/integrations/api">Integration guide</Link>
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
              What changes for tool builders
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
              Drop-in, no re-platforming
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
              It expands your reach
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
                Make your outputs verifiable by default
              </h2>
              <p className="mx-auto mb-6 max-w-2xl text-sm text-corsair-text-dim">
                Corsair lets your customers verify your findings without trusting a portal or PDF. It&apos;s proof they can take anywhere.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="sm">
                  <Link href="/sign">Sign tool output</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/docs/integrations/api">Read the API docs</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
