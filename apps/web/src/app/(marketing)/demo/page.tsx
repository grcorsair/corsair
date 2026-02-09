import type { Metadata } from "next";
import { TerminalDemo } from "@/components/features/terminal-demo";
import { DemoRecording } from "@/components/features/demo-recording";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

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
    badgeColor:
      "bg-corsair-cyan/10 text-corsair-cyan border-corsair-cyan/30",
  },
  {
    title: "CPOE Verification",
    description:
      "Paste any JWT-VC CPOE and verify it in-browser. Resolves did:web, checks Ed25519 signature, displays results.",
    badge: "VERIFY",
    badgeColor:
      "bg-corsair-green/10 text-corsair-green border-corsair-green/30",
  },
  {
    title: "Framework Mapping",
    description:
      "See how controls map across SOC 2, NIST 800-53, ISO 27001, and 12+ frameworks via CTID/SCF data.",
    badge: "CHART",
    badgeColor:
      "bg-corsair-gold/10 text-corsair-gold border-corsair-gold/30",
  },
];

const sampleOutputs = [
  {
    name: "CPOE (JWT-VC)",
    description: "W3C Verifiable Credential signed with Ed25519",
    format: "JWT",
  },
  {
    name: "OSCAL Assessment Results",
    description: "NIST SP 800-53A compliant machine-readable output",
    format: "JSON",
  },
  {
    name: "Evidence Chain (JSONL)",
    description: "SHA-256 hash chain with tamper-proof integrity",
    format: "JSONL",
  },
  {
    name: "HTML Report",
    description: "Self-contained executive summary with findings",
    format: "HTML",
  },
];

export default function DemoPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-cyan/60">
              LIVE DEMO
            </p>
            <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
              Watch Corsair in Action
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
            <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
              Quick Preview
            </h2>
            <TerminalDemo />
          </div>
        </FadeIn>

        {/* Full asciinema recording */}
        <FadeIn delay={0.3}>
          <div className="mb-16">
            <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
              Full Pipeline Recording
            </h2>
            <p className="mb-4 text-sm text-corsair-text-dim">
              Scrub through the full pipeline output. Copy any line.
            </p>
            <DemoRecording
              castFile="/demo/corsair-cognito-demo.cast"
              cols={120}
              rows={30}
              speed={1.5}
            />
          </div>
        </FadeIn>

        {/* Demo scenarios */}
        <FadeIn>
          <h2 className="mb-6 font-display text-2xl font-bold text-corsair-text">
            Pipeline Stages
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {demoScenarios.map((scenario) => (
              <Card
                key={scenario.title}
                className="bg-corsair-surface transition-all hover:border-corsair-cyan/40"
              >
                <CardContent className="p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-lg font-bold text-corsair-text">
                      {scenario.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${scenario.badgeColor}`}
                    >
                      {scenario.badge}
                    </Badge>
                  </div>
                  <p className="text-sm text-corsair-text-dim">
                    {scenario.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </FadeIn>

        {/* Sample outputs */}
        <FadeIn>
          <h2 className="mb-6 font-display text-2xl font-bold text-corsair-text">
            Output Formats
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="grid gap-4 sm:grid-cols-2">
            {sampleOutputs.map((output) => (
              <Card key={output.name} className="bg-corsair-surface">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-corsair-deep font-mono text-xs font-bold text-corsair-cyan">
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
            ))}
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn>
          <div className="mt-16 text-center">
            <p className="mb-6 text-corsair-text-dim">
              Ready to issue your first CPOE?
            </p>
            <Button size="lg" className="font-display font-semibold shadow-[0_0_20px_rgba(0,207,255,0.2)]" asChild>
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
