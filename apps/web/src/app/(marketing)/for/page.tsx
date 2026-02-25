import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "What's In It For Me - Stakeholder Paths",
  description:
    "Choose your role and see how Corsair delivers verifiable, portable compliance proofs across the ecosystem.",
};

const roles = [
  {
    label: "Auditors",
    title: "Independent assurance on verifiable evidence",
    body: "Start with signed, scoped CPOEs instead of screenshots. Reduce evidence chasing and improve audit traceability.",
    href: "/for-auditors",
  },
  {
    label: "GRC leaders",
    title: "Faster vendor reviews, fewer portals",
    body: "Verify vendor claims in seconds, automate discovery with trust.txt (/.well-known or delegated DNS), and keep proof portable across programs.",
    href: "/for-grc",
  },
  {
    label: "Security tools",
    title: "Make your findings portable and verifiable",
    body: "Export your outputs as cryptographic proofs that vendors and relying parties can verify anywhere.",
    href: "/for-security-tools",
  },
  {
    label: "GRC platforms",
    title: "Standardize evidence exchange",
    body: "Ingest and verify signed proofs without lock-in. Make your platform the trust exchange layer.",
    href: "/for-grc-platforms",
  },
];

export default function ForYouPage() {
  return (
    <main className="pb-20">
      <section className="relative flex min-h-[55dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.05] blur-[130px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/70">
            WHAT&apos;S IN IT FOR ME?
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            choose your path
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Corsair is a protocol, not a platform. Pick your role to see the concrete value and how it fits into your existing workflow.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href="/how-it-works">How it works</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/docs/getting-started/quick-start">Quick start</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-green/70">
              STAKEHOLDERS
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              Built to serve every side of the exchange
            </h2>
          </FadeIn>
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role, idx) => (
              <FadeIn key={role.href} delay={0.1 * idx}>
                <div className="rounded-xl border border-corsair-border bg-corsair-surface p-6">
                  <p className="mb-2 font-mono text-xs uppercase tracking-wider text-corsair-green/70">
                    {role.label}
                  </p>
                  <h3 className="mb-2 font-display text-xl font-semibold text-corsair-text">
                    {role.title}
                  </h3>
                  <p className="mb-5 text-sm text-corsair-text-dim">
                    {role.body}
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={role.href}>See details</Link>
                  </Button>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
