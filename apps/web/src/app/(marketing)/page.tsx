import { HeroSection } from "@/components/features/hero-section";
import { WeaponsSection } from "@/components/features/weapons-section";
import { QuickStart } from "@/components/features/quick-start";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export default function Home() {
  return (
    <main>
      <HeroSection />

      {/* Three Weapons */}
      <section id="weapons" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Three Primitives
            </h2>
            <p className="mb-10 text-center text-corsair-text-dim">
              compliance.txt for discovery, 4-line verification for instant trust, and diff for drift.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <WeaponsSection />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />

      {/* Quick Start */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Quick Start
            </h2>
            <p className="mb-8 text-center text-corsair-text-dim">
              Sign tool output. Verify any CPOE. Diff over time. Log everything. No API keys needed to get started.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <QuickStart />
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
