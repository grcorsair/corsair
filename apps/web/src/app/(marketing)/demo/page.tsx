import type { Metadata } from "next";
import { TerminalDemo } from "@/components/features/terminal-demo";
import { DemoRecording } from "@/components/features/demo-recording";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import {
  ReconIcon,
  MarqueIcon,
  ChartIcon,
} from "@/components/pixel-art/pixel-icons";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "See how compliance documents become cryptographically verifiable CPOEs. From ingestion to signed proof.",
};

const demoScenarios = [
  {
    title: "SOC 2 Report Ingestion",
    description:
      "Upload a SOC 2 Type II report. Corsair extracts controls, maps to frameworks, and generates a signed CPOE.",
    badge: "INGEST",
    icon: <ReconIcon size={28} />,
    glowColor: "rgba(0,207,255,0.15)",
    labelColor: "text-corsair-cyan",
  },
  {
    title: "CPOE Verification",
    description:
      "Paste any JWT-VC CPOE and verify it in-browser. Resolves did:web, checks Ed25519 signature, displays results.",
    badge: "VERIFY",
    icon: <MarqueIcon size={28} />,
    glowColor: "rgba(46,204,113,0.15)",
    labelColor: "text-corsair-green",
  },
  {
    title: "Framework Mapping",
    description:
      "See how controls map across SOC 2, NIST 800-53, ISO 27001, and 12+ frameworks via CTID/SCF data.",
    badge: "CHART",
    icon: <ChartIcon size={28} />,
    glowColor: "rgba(212,168,83,0.15)",
    labelColor: "text-corsair-gold",
  },
];

const sampleOutputs = [
  { name: "CPOE (JWT-VC)", description: "W3C Verifiable Credential signed with Ed25519", format: "JWT" },
  { name: "OSCAL Assessment Results", description: "NIST SP 800-53A compliant machine-readable output", format: "JSON" },
  { name: "Evidence Chain (JSONL)", description: "SHA-256 hash chain with tamper-proof integrity", format: "JSONL" },
  { name: "HTML Report", description: "Self-contained executive summary with findings", format: "HTML" },
];

export default function DemoPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              LIVE DEMO
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              in action
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              See how compliance documents become cryptographically verifiable
              CPOEs. No API keys needed — runs against sample data.
            </p>
          </div>
        </FadeIn>

        {/* Animated terminal demo */}
        <FadeIn delay={0.2}>
          <div className="mb-8">
            <p className="mb-4 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              QUICK PREVIEW
            </p>
            <TerminalDemo />
          </div>
        </FadeIn>

        {/* Full asciinema recording */}
        <FadeIn delay={0.3}>
          <div className="mb-8">
            <p className="mb-4 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              FULL RECORDING
            </p>
            <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A] shadow-2xl shadow-corsair-cyan/5">
              <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-corsair-crimson/80" />
                <div className="h-3 w-3 rounded-full bg-corsair-gold/80" />
                <div className="h-3 w-3 rounded-full bg-corsair-green/80" />
                <span className="ml-3 font-mono text-xs text-corsair-text-dim">
                  parley — full pipeline
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
          </div>
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* Demo scenarios */}
        <FadeIn>
          <div className="mb-8 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              PIPELINE
            </p>
            <h2 className="font-display text-2xl font-bold text-corsair-text">
              Pipeline Stages
            </h2>
          </div>
        </FadeIn>
        <StaggerChildren className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoScenarios.map((scenario) => (
            <StaggerItem key={scenario.title}>
              <Card
                className="pixel-card-hover h-full bg-corsair-surface transition-all"
                style={{ "--glow-color": scenario.glowColor } as React.CSSProperties}
              >
                <CardContent className="p-5">
                  <div className="mb-3">{scenario.icon}</div>
                  <span className={`font-pixel text-[7px] tracking-wider ${scenario.labelColor}`}>
                    {scenario.badge}
                  </span>
                  <p className="mt-1 font-display text-lg font-bold text-corsair-text">
                    {scenario.title}
                  </p>
                  <p className="mt-2 text-sm text-corsair-text-dim">
                    {scenario.description}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerChildren>

        <PixelDivider variant="diamond" className="my-16" />

        {/* Sample outputs */}
        <FadeIn>
          <div className="mb-8 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-green/60">
              OUTPUTS
            </p>
            <h2 className="font-display text-2xl font-bold text-corsair-text">
              Output Formats
            </h2>
          </div>
        </FadeIn>
        <StaggerChildren className="grid gap-4 sm:grid-cols-2">
          {sampleOutputs.map((output) => (
            <StaggerItem key={output.name}>
              <Card className="bg-corsair-surface">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] font-pixel text-[8px] font-bold text-corsair-gold">
                    {output.format}
                  </div>
                  <div>
                    <div className="font-display text-sm font-bold text-corsair-text">
                      {output.name}
                    </div>
                    <div className="text-xs text-corsair-text-dim">
                      {output.description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerChildren>

        {/* CTA */}
        <FadeIn>
          <div className="mt-16 text-center">
            <p className="mb-6 text-corsair-text-dim">
              Ready to issue your first CPOE?
            </p>
            <Button size="lg" className="font-display font-semibold shadow-[0_0_20px_rgba(212,168,83,0.15)]" asChild>
              <a
                href="https://github.com/Arudjreis/corsair"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Started on GitHub
              </a>
            </Button>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
