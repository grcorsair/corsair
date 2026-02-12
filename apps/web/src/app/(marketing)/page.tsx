import { HeroSection } from "@/components/features/hero-section";
import { PipelineStages } from "@/components/features/pipeline-stages";
import { ValueProps } from "@/components/features/value-props";
import { FrameworkGrid } from "@/components/features/framework-grid";
import { QuickStart } from "@/components/features/quick-start";
import { DisruptionSection } from "@/components/features/disruption-section";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export default function Home() {
  return (
    <main>
      <HeroSection />

      {/* Pipeline Visualization */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              THE PROTOCOL
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              The Parley Protocol
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Five stages. From tool output to signed proof.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <PipelineStages />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />

      {/* Value Props */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              WHY CORSAIR
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Three Pillars of Trust
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Sign. Verify. Signal. The three pillars of the Parley protocol.
            </p>
          </FadeIn>
          <ValueProps />
        </div>
      </section>

      <PixelDivider variant="diamond" className="mx-auto max-w-5xl px-6" />

      {/* Disruption */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-crimson/60">
              DISRUPTION
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Questionnaires Are Dead
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              $8.57B in TPRM spend. Built on trust. Not verification.
            </p>
          </FadeIn>
          <DisruptionSection />
        </div>
      </section>

      <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />

      {/* Framework Grid */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              FRAMEWORKS
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              13+ Compliance Frameworks
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Controls auto-map to every framework via CHART. You sign. The mappings happen.
            </p>
          </FadeIn>
          <FrameworkGrid />
        </div>
      </section>

      <PixelDivider variant="diamond" className="mx-auto max-w-5xl px-6" />

      {/* Quick Start */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-green/60">
              GET STARTED
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Quick Start
            </h2>
            <p className="mb-8 text-center text-corsair-text-dim">
              Sign tool output. Verify any CPOE. No API keys needed.
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
