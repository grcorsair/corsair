import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  ReconIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
  RaidIcon,
} from "@/components/pixel-art/pixel-icons";
import { StageHeader } from "@/components/features/anatomy/stage-header";
import { ExtractionTerminal } from "@/components/features/anatomy/extraction-terminal";
import { AssuranceLadder } from "@/components/features/anatomy/assurance-ladder";
import { FrameworkMap } from "@/components/features/anatomy/framework-map";
import { QuartermasterGauge } from "@/components/features/anatomy/quartermaster-gauge";
import { MarqueAssembly } from "@/components/features/anatomy/marque-assembly";
import { ANATOMY_DOCUMENT } from "@/data/anatomy-data";

export const metadata: Metadata = {
  title: "Anatomy of a CPOE",
  description:
    "See how the Parley protocol analyzes a SOC 2 report — from document extraction to cryptographic proof. Every stage, every decision, every assurance level.",
};

export default function AnatomyPage() {
  return (
    <main className="pb-20">
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        {/* Subtle gold glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            HOW IT WORKS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            anatomy
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Watch the Parley protocol dissect a compliance report
            into cryptographic proof.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex items-center gap-2 rounded-lg border border-corsair-border bg-corsair-surface px-4 py-2.5">
            <div className="h-2 w-2 rounded-full bg-corsair-green animate-pulse" />
            <span className="font-mono text-xs text-corsair-text-dim">
              Analyzing:
            </span>
            <span className="font-mono text-xs text-corsair-gold">
              {ANATOMY_DOCUMENT.name}
            </span>
          </div>
        </FadeIn>

        {/* Document metadata strip */}
        <FadeIn delay={0.5}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-corsair-text-dim">
            <span>{ANATOMY_DOCUMENT.pages} pages</span>
            <span className="text-corsair-border">|</span>
            <span>Auditor: {ANATOMY_DOCUMENT.auditor}</span>
            <span className="text-corsair-border">|</span>
            <span>{ANATOMY_DOCUMENT.scope}</span>
          </div>
        </FadeIn>
      </section>

      {/* ═══ STAGE 1: INGEST ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={1}
            name="INGEST"
            subtitle="Extract controls from the document"
            color="text-corsair-gold"
            icon={<ReconIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Claude AI reads the full {ANATOMY_DOCUMENT.pages}-page report, identifies every security control,
              extracts evidence, and classifies effectiveness. No templates, no manual mapping —
              the document speaks for itself.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <ExtractionTerminal />
          </FadeIn>

          {/* Stats strip */}
          <FadeIn delay={0.3}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-center">
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-gold">
                  {ANATOMY_DOCUMENT.totalControls}
                </p>
                <p className="text-xs text-corsair-text-dim">controls extracted</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-green">
                  {ANATOMY_DOCUMENT.effective}
                </p>
                <p className="text-xs text-corsair-text-dim">effective</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-crimson">
                  {ANATOMY_DOCUMENT.ineffective}
                </p>
                <p className="text-xs text-corsair-text-dim">ineffective</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-text">
                  {ANATOMY_DOCUMENT.extractionTime}
                </p>
                <p className="text-xs text-corsair-text-dim">extraction time</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ STAGE 2: CLASSIFY ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={2}
            name="CLASSIFY"
            subtitle="Assign assurance levels to every control"
            color="text-corsair-gold"
            icon={<RaidIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Each control gets an assurance level from L0 (Documented) to L4 (Attested)
              based on evidence type, source, and methodology. Click any control to see
              the exact classification logic.
            </p>
          </FadeIn>

          <AssuranceLadder />
        </div>
      </section>

      {/* ═══ STAGE 3: CHART ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={3}
            name="CHART"
            subtitle="Map controls across compliance frameworks"
            color="text-corsair-turquoise"
            icon={<ChartIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              CHART automatically maps extracted controls to 13+ compliance frameworks
              using CTID (ATT&amp;CK to NIST) and SCF (NIST to everything else) crosswalk
              data. One ingestion, every framework.
            </p>
          </FadeIn>

          <FrameworkMap />
        </div>
      </section>

      {/* ═══ STAGE 4: QUARTER ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={4}
            name="QUARTER"
            subtitle="AI-powered evidence review of quality and rigor"
            color="text-corsair-gold"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              The Quartermaster evaluates evidence across 7 dimensions — not a checkbox,
              but a deterministic + LLM governance gate that scores methodology rigor,
              coverage, reliability, and independence.
            </p>
          </FadeIn>

          <QuartermasterGauge />
        </div>
      </section>

      {/* ═══ STAGE 5: MARQUE ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <StageHeader
            number={5}
            name="MARQUE"
            subtitle="Sign the cryptographic proof"
            color="text-corsair-crimson"
            icon={<MarqueIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Everything converges into a single JWT-VC: the W3C Verifiable Credential
              signed with Ed25519. Three segments — header, payload, signature — anyone can
              verify with standard libraries. No Corsair account needed.
            </p>
          </FadeIn>

          <MarqueAssembly />
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
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
