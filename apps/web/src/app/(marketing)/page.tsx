import Link from "next/link";
import { HeroSection } from "@/components/features/hero-section";
import { HeroTerminal } from "@/components/features/hero-terminal";
import { QuickStart } from "@/components/features/quick-start";
import { FadeIn, BlurIn, ScaleReveal, SlideIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

const primitives = [
  { name: "sign", desc: "Evidence → CPOE", href: "/sign", color: "text-corsair-gold", borderColor: "hover:border-corsair-gold/40" },
  { name: "log", desc: "Register in SCITT", href: "/log", color: "text-corsair-cyan", borderColor: "hover:border-corsair-cyan/40" },
  { name: "publish", desc: "Generate compliance.txt", href: "/publish", color: "text-corsair-green", borderColor: "hover:border-corsair-green/40" },
  { name: "verify", desc: "Check CPOE signature", href: "/verify", color: "text-corsair-green", borderColor: "hover:border-corsair-green/40" },
  { name: "diff", desc: "Compare two CPOEs", href: "/diff", color: "text-corsair-turquoise", borderColor: "hover:border-corsair-turquoise/40" },
  { name: "signal", desc: "Push change events", href: "/signal", color: "text-corsair-crimson", borderColor: "hover:border-corsair-crimson/40" },
];

export default function Home() {
  return (
    <main>
      <HeroSection />

      <ScaleReveal>
        <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />
      </ScaleReveal>

      {/* Terminal Demo */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <BlurIn>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              See It In Action
            </h2>
            <p className="mb-10 text-center text-corsair-text-dim">
              Six primitives. One protocol.
            </p>
          </BlurIn>
          <ScaleReveal delay={0.2}>
            <HeroTerminal />
          </ScaleReveal>
        </div>
      </section>

      <ScaleReveal>
        <PixelDivider variant="diamond" className="mx-auto max-w-5xl px-6" />
      </ScaleReveal>

      {/* Six Primitives Grid */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <h2 className="mb-2 text-center font-display text-3xl font-bold text-corsair-text">
              The Protocol
            </h2>
            <p className="mb-10 text-center text-corsair-text-dim">
              Like git for compliance. Each primitive does one thing.
            </p>
          </FadeIn>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {primitives.map((p, i) => (
              <FadeIn key={p.name} delay={i * 0.08}>
                <Link
                  href={p.href}
                  className={`group block rounded-lg border border-corsair-border bg-corsair-surface p-4 transition-all duration-200 ${p.borderColor} hover:shadow-lg hover:shadow-black/20`}
                >
                  <p className={`font-mono text-sm font-bold ${p.color}`}>
                    corsair {p.name}
                  </p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    {p.desc}
                  </p>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <ScaleReveal>
        <PixelDivider variant="swords" className="mx-auto max-w-3xl px-6" />
      </ScaleReveal>

      {/* Quick Start */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Quick Start
            </h2>
            <p className="mb-8 text-center text-corsair-text-dim">
              Sign tool output. Verify any CPOE. Diff over time. Log everything. No API keys needed to get started.
            </p>
          </FadeIn>
          <SlideIn from="right" delay={0.2}>
            <QuickStart />
          </SlideIn>
        </div>
      </section>
    </main>
  );
}
