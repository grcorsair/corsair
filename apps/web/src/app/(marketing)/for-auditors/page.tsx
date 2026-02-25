import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For Auditors - Independent Assurance With Verifiable Evidence",
  description:
    "Corsair delivers signed, scoped evidence so audits start with verified inputs instead of screenshots and portals.",
};

const outcomes = [
  {
    title: "Less evidence chasing",
    body: "Start with cryptographically signed evidence that can be verified in seconds.",
  },
  {
    title: "Clear population + scope",
    body: "Scope metadata defines what was actually tested and when, making sampling defensible.",
  },
  {
    title: "Stronger audit trail",
    body: "Signed proofs and optional transparency logs provide a tamper-evident record.",
  },
];

const fit = [
  {
    title: "Keeps your methodology",
    body: "Corsair doesn&apos;t change how you audit. It makes the evidence verifiable and portable.",
  },
  {
    title: "Independent by design",
    body: "You can verify proofs without trusting the vendor or any platform account.",
  },
  {
    title: "Repeatable across clients",
    body: "Standardized evidence lets you apply consistent procedures across engagements.",
  },
];

const steps = [
  {
    title: "Receive signed proofs",
    body: "Vendors or platforms share CPOEs that represent tool outputs or exports.",
  },
  {
    title: "Verify + evaluate scope",
    body: "Confirm signatures and review scope coverage before selecting samples.",
  },
  {
    title: "Document procedures",
    body: "Perform testing and link results to the verified evidence you reviewed.",
  },
];

export default function ForAuditorsPage() {
  return (
    <main className="pb-20">
      <section className="relative flex min-h-[55dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-cyan/[0.05] blur-[130px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-cyan/70">
            FOR AUDITORS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            assurance you can verify
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Corsair turns evidence into signed, scoped proofs so audits begin with verified inputs, not screenshots and portals.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="font-mono text-xs text-corsair-cyan border-corsair-border">
              Verifiable inputs
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-cyan border-corsair-border">
              Scope-aware sampling
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-cyan border-corsair-border">
              Stronger workpapers
            </Badge>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href="/verify">Verify a CPOE</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs/concepts/pipeline">CPOE lifecycle</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-cyan/70">
              OUTCOMES
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              What changes for audit teams
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
              Simple, defensible, repeatable
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
              It respects independence
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
                Start with verification, not trust
              </h2>
              <p className="mx-auto mb-6 max-w-2xl text-sm text-corsair-text-dim">
                Corsair doesn&apos;t replace audit procedures. It gives you verifiable evidence inputs and clear scope so your testing is faster and more defensible.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="sm">
                  <Link href="/verify">Verify a proof</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/docs/concepts/policy">Policy evaluation</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
