import { HeroSection } from "@/components/features/hero-section";
import { PipelineStages } from "@/components/features/pipeline-stages";
import { ValueProps } from "@/components/features/value-props";
import { FrameworkGrid } from "@/components/features/framework-grid";
import { QuickStart } from "@/components/features/quick-start";
import { DisruptionSection } from "@/components/features/disruption-section";
import { FadeIn } from "@/components/motion/fade-in";

export default function Home() {
  return (
    <main>
      <HeroSection />

      {/* Pipeline Visualization */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-corsair-gold/60">
              The Protocol
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              The Parley Protocol
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Four stages. From document to signed proof.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <PipelineStages />
          </FadeIn>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t border-corsair-border px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <ValueProps />
          </FadeIn>
        </div>
      </section>

      {/* Disruption */}
      <section className="border-t border-corsair-border px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <DisruptionSection />
          </FadeIn>
        </div>
      </section>

      {/* Framework Grid */}
      <section className="border-t border-corsair-border px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-corsair-gold/60">
              Frameworks
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              13+ Compliance Frameworks
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Evidence auto-maps to every framework. You ingest. The mappings
              happen.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <FrameworkGrid />
          </FadeIn>
        </div>
      </section>

      {/* Quick Start */}
      <section className="border-t border-corsair-border px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-widest text-corsair-green/60">
              Get Started
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Quick Start
            </h2>
            <p className="mb-8 text-center text-corsair-text-dim">
              No API keys needed for demo mode.
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
