import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  ReconIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
  RaidIcon,
  PlunderIcon,
} from "@/components/pixel-art/pixel-icons";
import { StageHeader } from "@/components/features/anatomy/stage-header";
import { TerminalDemo } from "@/components/features/terminal-demo";
import { DemoRecording } from "@/components/features/demo-recording";
import { PipelineFlow } from "@/components/features/demo/pipeline-flow";
import { ClassifyAnimation } from "@/components/features/demo/classify-animation";
import { ChartCascade } from "@/components/features/demo/chart-cascade";
import { GovernanceBars } from "@/components/features/demo/governance-bars";
import { CPOEForge } from "@/components/features/demo/cpoe-forge";
import { OutputGallery } from "@/components/features/demo/output-gallery";
import { DEMO_DOCUMENT } from "@/data/demo-data";

export const metadata: Metadata = {
  title: "Demo — Watch the Pipeline",
  description:
    "Watch a SOC 2 report transform into a cryptographically verifiable CPOE. From document extraction to Ed25519-signed proof — every stage, every decision, every output.",
};

export default function DemoPage() {
  return (
    <main className="pb-20">
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        {/* Subtle gold glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            LIVE DEMO
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            in action
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Watch a compliance document become cryptographic proof.
            Every stage visible, every decision traceable.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex items-center gap-2 rounded-lg border border-corsair-border bg-corsair-surface px-4 py-2.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-corsair-green" />
            <span className="font-mono text-xs text-corsair-text-dim">
              Processing:
            </span>
            <span className="font-mono text-xs text-corsair-gold">
              {DEMO_DOCUMENT.file}
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.5}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-corsair-text-dim">
            <span>{DEMO_DOCUMENT.pages} pages</span>
            <span className="text-corsair-border">|</span>
            <span>{DEMO_DOCUMENT.size}</span>
            <span className="text-corsair-border">|</span>
            <span>Auditor: {DEMO_DOCUMENT.auditor}</span>
            <span className="text-corsair-border">|</span>
            <span>{DEMO_DOCUMENT.period}</span>
          </div>
        </FadeIn>
      </section>

      {/* ═══ PIPELINE OVERVIEW ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={0}
            name="PIPELINE"
            subtitle="Five stages, one document, one proof"
            color="text-corsair-gold"
            icon={<PlunderIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              A SOC 2 report enters the pipeline as a PDF. Five stages extract, classify,
              map, review, and sign — producing a W3C Verifiable Credential that anyone can
              verify with standard libraries. Total time: 7.7 seconds.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <PipelineFlow />
          </FadeIn>
        </div>
      </section>

      {/* ═══ STAGE 1: INGEST ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={1}
            name="INGEST"
            subtitle="Extract controls from the document"
            color="text-corsair-gold"
            icon={<ReconIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Claude AI reads the full {DEMO_DOCUMENT.pages}-page report, identifies every security control,
              extracts evidence, and classifies effectiveness. No templates, no manual mapping —
              the document speaks for itself.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <TerminalDemo />
          </FadeIn>

          {/* Stats strip */}
          <FadeIn delay={0.3}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-center">
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-gold">
                  {DEMO_DOCUMENT.totalControls}
                </p>
                <p className="text-xs text-corsair-text-dim">controls extracted</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-green">
                  {DEMO_DOCUMENT.effective}
                </p>
                <p className="text-xs text-corsair-text-dim">effective</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-crimson">
                  {DEMO_DOCUMENT.ineffective}
                </p>
                <p className="text-xs text-corsair-text-dim">ineffective</p>
              </div>
              <div>
                <p className="font-pixel-display text-2xl font-bold text-corsair-text">
                  {DEMO_DOCUMENT.extractionTime}
                </p>
                <p className="text-xs text-corsair-text-dim">extraction time</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ STAGE 2: CLASSIFY ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
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
              based on evidence type and source. Policy-only evidence stays L0. Config
              exports reach L1. Test results earn L2. The CPOE&apos;s declared level is the
              minimum across all controls.
            </p>
          </FadeIn>

          <ClassifyAnimation />
        </div>
      </section>

      {/* ═══ STAGE 3: CHART ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={3}
            name="CHART"
            subtitle="Map controls across compliance frameworks"
            color="text-corsair-turquoise"
            icon={<ChartIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              CHART automatically maps extracted controls to 7+ compliance frameworks
              using CTID (ATT&amp;CK to NIST) and SCF (NIST to everything else) crosswalk
              data. One ingestion covers every framework a buyer might ask about.
            </p>
          </FadeIn>

          <ChartCascade />
        </div>
      </section>

      {/* ═══ STAGE 4: QUARTER ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={4}
            name="QUARTER"
            subtitle="AI governance review of evidence quality"
            color="text-corsair-gold"
            icon={<QuarterIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              The Quartermaster evaluates evidence across 7 dimensions. Deterministic rules
              run first, then LLM review scores methodology rigor, coverage, reliability,
              and independence. Anti-gaming safeguards prevent level inflation.
            </p>
          </FadeIn>

          <GovernanceBars />
        </div>
      </section>

      {/* ═══ STAGE 5: MARQUE ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={5}
            name="MARQUE"
            subtitle="Sign the cryptographic proof"
            color="text-corsair-green"
            icon={<MarqueIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              Everything converges into a single JWT-VC: the W3C Verifiable Credential
              signed with Ed25519. Three segments — header, payload, signature — carrying
              compliance claims that anyone can verify. No Corsair account needed.
            </p>
          </FadeIn>

          <CPOEForge />
        </div>
      </section>

      {/* ═══ FULL RECORDING ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <StageHeader
            number={6}
            name="RECORDING"
            subtitle="Watch the full pipeline run in your terminal"
            color="text-corsair-turquoise"
            icon={<PlunderIcon size={32} />}
          />

          <FadeIn delay={0.1}>
            <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
              The full pipeline run captured as a terminal recording. Every command,
              every output, every file generated — from <code className="text-corsair-gold">corsair ingest</code> to
              the final signed CPOE.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A] shadow-2xl shadow-corsair-gold/5">
              <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-corsair-crimson/80" />
                <div className="h-3 w-3 rounded-full bg-corsair-gold/80" />
                <div className="h-3 w-3 rounded-full bg-corsair-green/80" />
                <span className="ml-3 font-mono text-xs text-corsair-text-dim">
                  parley — full pipeline run
                </span>
              </div>
              <div className="p-1">
                <DemoRecording
                  castFile="/demo/corsair-cognito-demo.cast"
                  cols={120}
                  rows={30}
                  speed={1.5}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ OUTPUT GALLERY ═══ */}
      <PixelDivider variant="diamond" className="my-4" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-green/60">
              OUTPUTS
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              What you get
            </h2>
            <p className="mb-8 text-center text-corsair-text-dim">
              Every pipeline run produces four machine-readable artifacts.
              No PDFs. No screenshots. No trust assumptions.
            </p>
          </FadeIn>

          <OutputGallery />
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <PixelDivider className="my-4" />
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <FadeIn>
            <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              TRY IT YOURSELF
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
              From document to proof
            </h2>
            <p className="mb-8 text-corsair-text-dim">
              Verify an existing CPOE for free, explore the protocol deep-dive,
              or clone the repo and run the pipeline yourself.
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
                href="/protocol"
                className="inline-flex h-10 items-center rounded-md border border-corsair-gold/30 px-6 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-gold hover:text-corsair-gold"
              >
                Protocol Deep-Dive &rarr;
              </a>
              <a
                href="https://github.com/Arudjreis/corsair"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center rounded-md border border-corsair-border px-6 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-text-dim hover:text-corsair-text"
              >
                GitHub
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
