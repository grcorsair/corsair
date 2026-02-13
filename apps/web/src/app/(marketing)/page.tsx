import { HeroSection } from "@/components/features/hero-section";
import { PipelineStages } from "@/components/features/pipeline-stages";
import { PrimitivesInAction } from "@/components/features/primitives-in-action";
import { FrameworkGrid } from "@/components/features/framework-grid";
import { QuickStart } from "@/components/features/quick-start";
import { DisruptionSection } from "@/components/features/disruption-section";
import { ComplianceTimeline } from "@/components/features/compliance-timeline";
import { ProjectStats } from "@/components/features/project-stats";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export default function Home() {
  return (
    <main>
      <HeroSection />

      {/* Project Stats Strip */}
      <ProjectStats />

      {/* Pipeline Visualization */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              THE PIPELINE
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Three Layers. One Protocol.
            </h2>
            <p className="mb-4 text-center text-corsair-text-dim">
              From tool output to signed, traceable, real-time proof — then intelligence and automated decisions on top.
            </p>
            <div className="mb-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-xs">
              <span className="text-corsair-gold">L1 Infrastructure</span>
              <span className="text-corsair-border">&rarr;</span>
              <span className="text-corsair-turquoise">L2 Intelligence</span>
              <span className="text-corsair-border">&rarr;</span>
              <span className="text-corsair-green">L3 Decision</span>
            </div>
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
              Layer 1 handles the infrastructure — sign, verify, diff, log, signal. Layer 2 adds intelligence — evidence quality scoring, normalization, and the Quartermaster. Layer 3 automates decisions — continuous certification, TPRM, and multi-agent audit. Together they replace the compliance trust stack that doesn&apos;t exist today.
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
              $8.57B in TPRM spend. Built on trust. Not verification. Corsair replaces it with cryptographic proof (Layer 1), evidence quality scoring like FICO for compliance (Layer 2), and automated TPRM decisions with continuous certification (Layer 3).
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
              Optional enrichment via CHART maps controls across frameworks using CTID and SCF crosswalk data.
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
              Sign tool output. Verify any CPOE. Diff over time. Log everything. Signal changes. Score evidence quality. Automate TPRM decisions. No API keys needed.
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
