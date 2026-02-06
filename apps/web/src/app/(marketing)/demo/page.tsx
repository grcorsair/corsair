import type { Metadata } from "next";
import { TerminalDemo } from "@/components/features/terminal-demo";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Watch Corsair autonomously attack and assess security controls. Full pipeline demonstration from RECON to MARQUE.",
};

const demoScenarios = [
  {
    provider: "AWS Cognito",
    description: "MFA bypass, password spray, session hijack assessment",
    findings: "4 threats, 2 CRITICAL",
  },
  {
    provider: "AWS S3",
    description: "Public access, encryption, versioning controls",
    findings: "3 threats, 1 CRITICAL",
  },
  {
    provider: "AWS IAM",
    description: "Privilege escalation, policy drift, unused credentials",
    findings: "5 threats, 3 HIGH",
  },
  {
    provider: "AWS Lambda",
    description: "Runtime security, environment variable exposure",
    findings: "2 threats, 1 HIGH",
  },
  {
    provider: "AWS RDS",
    description: "Encryption at rest, public accessibility, backup retention",
    findings: "3 threats, 1 CRITICAL",
  },
  {
    provider: "GitLab",
    description: "Branch protection, secret scanning, merge request rules",
    findings: "4 threats, 2 HIGH",
  },
];

const sampleOutputs = [
  {
    name: "Evidence Chain (JSONL)",
    description: "SHA-256 hash chain with 12 evidence records",
    format: "JSONL",
  },
  {
    name: "OSCAL Assessment Results",
    description: "NIST SP 800-53A compliant machine-readable output",
    format: "JSON",
  },
  {
    name: "HTML Report",
    description: "Self-contained executive summary with findings",
    format: "HTML",
  },
  {
    name: "Marque Document",
    description: "Ed25519-signed attestation (CPOE)",
    format: "JSON",
  },
];

export default function DemoPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
              Watch Corsair in Action
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Full autonomous mission against a demo Cognito user pool. No API
              keys needed — runs against fixture data.
            </p>
          </div>
        </FadeIn>

        {/* Live terminal demo */}
        <FadeIn delay={0.2}>
          <div className="mb-16">
            <TerminalDemo />
          </div>
        </FadeIn>

        {/* Provider scenarios */}
        <FadeIn>
          <h2 className="mb-6 font-display text-2xl font-bold text-corsair-text">
            Supported Providers
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {demoScenarios.map((scenario) => (
              <div
                key={scenario.provider}
                className="rounded-xl border border-corsair-border bg-corsair-surface p-5 transition-all hover:border-corsair-cyan/40"
              >
                <div className="mb-2 font-display text-lg font-bold text-corsair-text">
                  {scenario.provider}
                </div>
                <p className="mb-3 text-sm text-corsair-text-dim">
                  {scenario.description}
                </p>
                <div className="font-mono text-xs text-corsair-crimson">
                  {scenario.findings}
                </div>
              </div>
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
              <div
                key={output.name}
                className="flex items-center gap-4 rounded-xl border border-corsair-border bg-corsair-surface p-5"
              >
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
              </div>
            ))}
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn>
          <div className="mt-16 text-center">
            <p className="mb-6 text-corsair-text-dim">
              Ready to run your own mission?
            </p>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-corsair-cyan px-8 py-3 font-display text-sm font-semibold text-corsair-deep transition-all hover:shadow-[0_0_30px_rgba(0,207,255,0.3)]"
            >
              Get Started on GitHub
            </a>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
