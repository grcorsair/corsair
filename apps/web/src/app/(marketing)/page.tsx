import { HeroSection } from "@/components/features/hero-section";
import { PipelineStages } from "@/components/features/pipeline-stages";
import { PrimitivesInAction } from "@/components/features/primitives-in-action";
import { FrameworkGrid } from "@/components/features/framework-grid";
import { QuickStart } from "@/components/features/quick-start";
import { DisruptionSection } from "@/components/features/disruption-section";
import { ComplianceTimeline } from "@/components/features/compliance-timeline";
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
              THE PIPELINE
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Sign. Verify. Diff. Log. Signal.
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              From tool output to signed, traceable, real-time proof.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <PipelineStages />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />

      {/* Primitives in Action */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              PRIMITIVES IN ACTION
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              See What Each Primitive Does
            </h2>
            <p className="mb-8 text-center text-corsair-text-dim">
              Five operations. Each one is boring. Each one is invisible. Together they&apos;re the compliance infrastructure layer that doesn&apos;t exist today.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <PrimitivesInAction />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="diamond" className="mx-auto max-w-5xl px-6" />

      {/* Compliance Timeline */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-green/60">
              COMPLIANCE HISTORY
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Track Compliance Like Code
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Every CPOE is a signed commit. Every diff is a changelog. Every log entry is immutable.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <ComplianceTimeline />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />

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

      <PixelDivider variant="diamond" className="mx-auto max-w-5xl px-6" />

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

      <PixelDivider variant="swords" className="mx-auto max-w-5xl px-6" />

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
              Sign tool output. Verify any CPOE. Diff over time. Log everything. Signal changes. No API keys needed.
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
