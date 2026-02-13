import type { Metadata } from "next";
import { PlaygroundEditor } from "@/components/features/playground-editor";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Try Corsair SIGN with real evidence formats. Paste or select from 8 supported formats, preview the CPOE, and get the CLI command to sign for real.",
};

export default function PlaygroundPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              PLAYGROUND
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              try it
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Explore all{" "}
              <span className="font-semibold text-corsair-gold">8 supported evidence formats</span>.
              Select an example, see how Corsair parses it into a CPOE, and get the CLI
              command to sign for real.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["Generic", "Prowler", "SecurityHub", "InSpec", "Trivy", "GitLab", "CISO Assistant"].map((fmt) => (
                <Badge key={fmt} variant="outline" className="font-mono text-[10px] text-corsair-text-dim border-corsair-border">
                  {fmt}
                </Badge>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <PlaygroundEditor />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* How it works */}
        <FadeIn>
          <div className="space-y-8">
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
                HOW IT WORKS
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                From tool output to signed CPOE
              </h2>
              <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
                <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
                  <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
                    SIGN PIPELINE
                  </span>
                </div>
                <ol className="space-y-3 p-5 font-mono text-[12px] leading-relaxed text-corsair-text-dim sm:text-[13px]">
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">1.</span>
                    Run your security tool (Prowler, InSpec, Trivy, etc.) and export JSON output.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">2.</span>
                    <code className="text-corsair-cyan">corsair sign --file output.json</code> — Corsair auto-detects the format, parses controls, records provenance.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">3.</span>
                    Output: a JWT-VC signed with Ed25519 — the CPOE. Machine-readable, cryptographically verifiable.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">4.</span>
                    Anyone verifies at{" "}
                    <a href="/marque" className="text-corsair-gold hover:underline">grcorsair.com/marque</a>
                    {" "}— no account needed.
                  </li>
                </ol>
              </div>
            </div>

            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-green/60">
                SUPPORTED FORMATS
              </p>
              <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
                8 formats, auto-detected
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { name: "Generic", desc: "Simple JSON with metadata + controls array" },
                  { name: "Prowler", desc: "AWS cloud security scanner (OCSF format)" },
                  { name: "SecurityHub", desc: "AWS SecurityHub findings (ASFF format)" },
                  { name: "InSpec", desc: "Chef InSpec compliance profiles" },
                  { name: "Trivy", desc: "Container vulnerability scanning" },
                  { name: "GitLab SAST", desc: "GitLab CI/CD security scanning" },
                  { name: "CISO Assistant API", desc: "Open-source GRC platform (API)" },
                  { name: "CISO Assistant Export", desc: "Open-source GRC platform (export)" },
                ].map((fmt) => (
                  <div
                    key={fmt.name}
                    className="rounded-lg border border-corsair-border bg-corsair-surface p-3"
                  >
                    <p className="font-mono text-sm font-bold text-corsair-gold">{fmt.name}</p>
                    <p className="mt-1 text-xs text-corsair-text-dim">{fmt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
