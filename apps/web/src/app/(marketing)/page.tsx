import { HeroSection } from "@/components/features/hero-section";
import { WeaponsSection } from "@/components/features/weapons-section";
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

      {/* Three Weapons */}
      <section id="weapons" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              THE WEAPONS
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              The Three Weapons to Ship Corsair
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

      {/* Compliance Timeline */}
      <section id="diff-demo" className="px-6 py-20">
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
              $8.57B in TPRM spend. Built on trust. Not verification. Corsair replaces it with cryptographic proof — signed tool output that anyone can verify. No questionnaires. No PDFs. No trust required.
            </p>
          </FadeIn>
          <DisruptionSection />
        </div>
      </section>

      {/* Privacy by Design */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              PRIVACY BY DESIGN
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Share Proof, Not Secrets
            </h2>
            <p className="mb-12 text-center text-corsair-text-dim">
              Companies fear publishing detailed control data. Corsair solves this with three privacy layers — so you can prove compliance without exposing raw evidence.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Summary-Only CPOEs",
                  desc: "Aggregate pass/fail counts and provenance metadata. No raw evidence, no control details, no sensitive configuration data.",
                },
                {
                  title: "Evidence Sanitization",
                  desc: "ARNs, IP addresses, file paths, account IDs, and API keys are stripped recursively before signing. Defense in depth.",
                },
                {
                  title: "SD-JWT Selective Disclosure",
                  desc: "Holders choose which claims to reveal per verifier. Prove you passed SOC 2 without showing which controls were tested.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-corsair-border bg-corsair-surface p-5"
                >
                  <p className="mb-2 font-display text-sm font-semibold text-corsair-text">
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed text-corsair-text-dim">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>
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
              Sign tool output. Verify any CPOE. Diff over time. Log everything. No API keys needed to get started.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <QuickStart />
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="diamond" className="mx-auto max-w-5xl px-6" />

      {/* Protocol Depth */}
      <section id="protocol-depth" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              PROTOCOL DEPTH
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              Five Primitives Under the Hood
            </h2>
            <p className="mb-10 text-center text-corsair-text-dim">
              Built on sign, verify, diff, log, and signal. The deep protocol layer powers the weapons.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <PipelineStages />
          </FadeIn>
          <div className="mt-12">
            <FadeIn delay={0.3}>
              <PrimitivesInAction />
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
