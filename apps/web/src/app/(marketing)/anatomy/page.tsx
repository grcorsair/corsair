import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  ReconIcon,
  SpyglassIcon,
  ChartIcon,
  QuarterIcon,
} from "@/components/pixel-art/pixel-icons";
import { StageHeader } from "@/components/features/anatomy/stage-header";
import { ExtractionTerminal } from "@/components/features/anatomy/extraction-terminal";
import { FrameworkMap } from "@/components/features/anatomy/framework-map";
import { MarqueAssembly } from "@/components/features/anatomy/marque-assembly";
import { IntegrationTierCard } from "@/components/features/anatomy/integration-tier-card";
import { INTEGRATION_TIERS } from "@/data/anatomy-data";

export const metadata: Metadata = {
  title: "How Signing Works — From Evidence to Proof",
  description:
    "See how Corsair turns tool and platform output into cryptographic proof. Three provenance types, same CPOE format, same Ed25519 signature, same verification.",
};

export default function AnatomyPage() {
  return (
    <main className="pb-20">
      {/* --- HERO --- */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        {/* Subtle gold glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            HOW IT WORKS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            how signing works
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Same CPOE format at every tier. Same Ed25519 signature.
            Same verification. The provenance records where the evidence came from.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex items-center gap-2 rounded-lg border border-corsair-border bg-corsair-surface px-4 py-2.5">
            <div className="h-2 w-2 rounded-full bg-corsair-green animate-pulse" />
            <span className="font-mono text-xs text-corsair-text-dim">
              Evidence flows in.
            </span>
            <span className="font-mono text-xs text-corsair-gold">
              Proof flows out.
            </span>
          </div>
        </FadeIn>

        {/* Three-tier summary strip */}
        <FadeIn delay={0.5}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-corsair-text-dim">
            <span className="text-corsair-gold">LOOKOUT</span>
            <span className="text-corsair-border">&rarr;</span>
            <span className="text-corsair-turquoise">SPYGLASS</span>
            <span className="text-corsair-border">&rarr;</span>
            <span className="text-corsair-green">QUARTERMASTER</span>
            <span className="text-corsair-border">&rarr;</span>
            <span className="text-corsair-crimson">CPOE</span>
          </div>
        </FadeIn>
      </section>

      {/* --- TIER 1: LOOKOUT --- */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={1}
            name="LOOKOUT"
            subtitle="Telemetry from source systems"
            color="text-corsair-gold"
            icon={<ReconIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <IntegrationTierCard tier={INTEGRATION_TIERS[0]} />
          </FadeIn>
        </div>
      </section>

      {/* --- TIER 2: SPYGLASS --- */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={2}
            name="SPYGLASS"
            subtitle="Output from security tools"
            color="text-corsair-turquoise"
            icon={<SpyglassIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <IntegrationTierCard tier={INTEGRATION_TIERS[1]} />
          </FadeIn>

          {/* Live terminal demo — Prowler piped to corsair sign */}
          <FadeIn delay={0.2}>
            <p className="mb-4 mt-10 font-pixel text-[8px] tracking-widest text-corsair-text-dim">
              LIVE DEMO — PROWLER TO CPOE
            </p>
            <ExtractionTerminal />
          </FadeIn>

          {/* Stats strip */}
          <FadeIn delay={0.3}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-center">
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-gold">
                  10
                </p>
                <p className="text-xs text-corsair-text-dim">controls classified</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-green">
                  8
                </p>
                <p className="text-xs text-corsair-text-dim">effective</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-crimson">
                  2
                </p>
                <p className="text-xs text-corsair-text-dim">ineffective</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-text">
                  0.8s
                </p>
                <p className="text-xs text-corsair-text-dim">signing time</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* --- TIER 3: QUARTERMASTER --- */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={3}
            name="QUARTERMASTER"
            subtitle="Results from GRC platforms"
            color="text-corsair-green"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <IntegrationTierCard tier={INTEGRATION_TIERS[2]} />
          </FadeIn>
        </div>
      </section>

      {/* --- UNIVERSAL FORMAT --- */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <div className="mb-10 text-center">
              <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
                UNIVERSAL FORMAT
              </p>
              <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
                Every tier, same CPOE
              </h2>
              <p className="mx-auto max-w-2xl text-corsair-text-dim">
                Whether the evidence comes from a CloudTrail log, a Prowler scan,
                or a Vanta export — the output is a single JWT-VC signed with Ed25519.
                The evidence source determines the assurance level. The format is universal.
              </p>
            </div>
          </FadeIn>

          <MarqueAssembly />
        </div>
      </section>

      {/* --- CHART (Optional Enrichment) --- */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={4}
            name="CHART"
            subtitle="Optional enrichment — map controls across frameworks"
            color="text-corsair-turquoise"
            icon={<ChartIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              CHART automatically maps classified controls to 13+ compliance frameworks
              using CTID (ATT&amp;CK to NIST) and SCF (NIST to everything else) crosswalk
              data. One tool scan, every framework.
            </p>
          </FadeIn>

          <FrameworkMap />
        </div>
      </section>

      {/* --- FINAL CTA --- */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              VERIFY TRUST
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
              See it for yourself
            </h2>
            <p className="mb-8 text-corsair-text-dim">
              Every CPOE is free to verify. Paste a token, check the signature,
              read the results. No account, no paywall, no trust assumptions.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/marque"
                className="inline-flex h-10 items-center rounded-md bg-corsair-gold px-6 font-display text-sm font-semibold text-corsair-deep transition-colors hover:bg-corsair-gold/90"
              >
                Verify a CPOE
              </a>
              <a
                href="/docs"
                className="inline-flex h-10 items-center rounded-md border border-corsair-gold/30 px-6 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-gold hover:text-corsair-gold"
              >
                Read the Spec &rarr;
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
