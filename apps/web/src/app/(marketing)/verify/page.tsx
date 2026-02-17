import type { Metadata } from "next";
import { MarqueVerifierLazy } from "@/components/features/marque-verifier-lazy";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Verify CPOE",
  description:
    "Verify any CPOE (Certificate of Proof of Operational Effectiveness). Ed25519 signature verified via DID:web resolution. No account needed.",
};

export default function VerifyPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-green/60">
              VERIFICATION
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              verify
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Verify any Certificate of Proof of Operational Effectiveness. Ed25519-signed
              W3C Verifiable Credentials.{" "}
              <span className="font-semibold text-corsair-gold">
                Signature verified via DID:web
              </span>
              . No account needed.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-corsair-text-dim/60">
              First time? Click{" "}
              <span className="font-semibold text-corsair-gold/80">&ldquo;Try with Sample&rdquo;</span>
              {" "}below to see a live CPOE verification in action.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <MarqueVerifierLazy />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* Explainer */}
        <div className="space-y-12">
          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
                OVERVIEW
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                What is a CPOE?
              </h2>
              <p className="text-sm leading-relaxed text-corsair-text-dim">
                A{" "}
                <span className="text-corsair-gold">
                  CPOE (Certificate of Proof of Operational Effectiveness)
                </span>{" "}
                is a cryptographically signed credential that proves security
                controls were assessed and the results are tamper-proof. Each
                CPOE carries{" "}
                <span className="text-corsair-gold">provenance metadata</span>{" "}
                identifying who produced the underlying evidence (self, tool, or
                auditor), plus a summary of controls tested and passed.
              </p>
            </div>
          </FadeIn>

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
                PROVENANCE
              </p>
              <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
                Evidence Provenance
              </h2>
              <p className="mb-4 text-sm text-corsair-text-dim">
                Every CPOE records where the evidence came from. Corsair does not judge — it records provenance and lets the buyer decide what&apos;s sufficient.
              </p>
              <div className="space-y-2">
                {[
                  { source: "self", name: "Self-Assessed", desc: "Organization self-attests without automated evidence", color: "text-corsair-text-dim", barWidth: "33%", barColor: "bg-corsair-text-dim/40" },
                  { source: "tool", name: "Tool-Generated", desc: "Security tool (Prowler, InSpec, Trivy) produced the evidence", color: "text-corsair-green", barWidth: "66%", barColor: "bg-corsair-green/40" },
                  { source: "auditor", name: "Auditor-Verified", desc: "Independent third party reviewed and verified the assessment", color: "text-corsair-gold", barWidth: "100%", barColor: "bg-corsair-gold/40" },
                ].map((item) => (
                  <div key={item.source} className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-12 font-mono text-sm font-bold ${item.color}`}>{item.source}</span>
                      <span className="font-display text-sm font-semibold text-corsair-text">{item.name}</span>
                      <span className="ml-auto text-xs text-corsair-text-dim">{item.desc}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-corsair-deep">
                      <div className={`h-full rounded-full ${item.barColor}`} style={{ width: item.barWidth }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <PixelDivider variant="diamond" />

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-green/60">
                FLOW
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                How verification works
              </h2>
              <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
                <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
                  <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
                    VERIFICATION FLOW
                  </span>
                </div>
                <ol className="space-y-3 p-5 font-mono text-[12px] leading-relaxed text-corsair-text-dim sm:text-[13px]">
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">1.</span>
                    Organization runs security tools (Prowler, InSpec, Trivy) and signs evidence into a CPOE via{" "}
                    <code className="text-corsair-cyan">corsair sign</code> — JWT-VC with Ed25519.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">2.</span>
                    Organization publishes DID document at{" "}
                    <code className="text-corsair-cyan">.well-known/did.json</code>{" "}
                    with their public key.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">3.</span>
                    Anyone pastes the CPOE here. DID:web resolved, Ed25519 signature verified via Corsair API.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">4.</span>
                    Result: signature validity, provenance, controls summary, pass rate. Math replaces trust.
                  </li>
                </ol>
              </div>
            </div>
          </FadeIn>

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-turquoise/60">
                STANDARDS
              </p>
              <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
                Standards
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { name: "W3C Verifiable Credentials 2.0", desc: "CPOEs as interoperable, standards-compliant attestations" },
                  { name: "DID:web", desc: "Decentralized identity for issuer key discovery" },
                  { name: "OpenID SSF / CAEP", desc: "Real-time compliance change notifications via FLAGSHIP" },
                  { name: "IETF SCITT", desc: "Transparency log for CPOE registration and auditable history" },
                  { name: "IETF SD-JWT", desc: "Selective disclosure — prove claims without revealing the full CPOE" },
                ].map((std) => (
                  <div
                    key={std.name}
                    className="rounded-lg border border-corsair-border bg-corsair-surface p-4"
                  >
                    <p className="font-display text-sm font-semibold text-corsair-text">{std.name}</p>
                    <p className="mt-1 text-xs text-corsair-text-dim">{std.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-crimson/60">
                DISRUPTION
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                Why this replaces questionnaires
              </h2>
              <p className="text-sm leading-relaxed text-corsair-text-dim">
                Traditional vendor risk reviews rely on self-attested questionnaires — 300+
                questions answered by vendors who have every incentive to
                overstate their security posture. Trust Centers store compliance
                data but can&apos;t share it interoperably — Vanta&apos;s Trust
                Center can&apos;t verify Drata&apos;s output, and vice versa.
                CPOE is the universal format. A CPOE replaces trust with
                verification: the evidence was assessed, the results were
                recorded with provenance metadata, and the credential is
                cryptographically signed. You don&apos;t have to trust the
                vendor or the platform. You verify the proof.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="font-pixel text-[7px] text-corsair-gold border-corsair-gold/30">
                  ED25519
                </Badge>
                <Badge variant="outline" className="font-pixel text-[7px] text-corsair-cyan border-corsair-cyan/30">
                  JWT-VC
                </Badge>
                <Badge variant="outline" className="font-pixel text-[7px] text-corsair-green border-corsair-green/30">
                  DID:WEB
                </Badge>
                <Badge variant="outline" className="font-pixel text-[7px] text-corsair-crimson border-corsair-crimson/30">
                  SCITT
                </Badge>
              </div>
            </div>
          </FadeIn>

          <PixelDivider variant="diamond" className="my-8" />

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
                SIX PRIMITIVES
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                Verification is one of six primitives
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-corsair-text-dim">
                Corsair gives you six operations for compliance trust — like git
                for security attestations.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                  <p className="font-mono text-sm font-bold text-corsair-gold">corsair sign</p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    Sign tool output into a CPOE with Ed25519
                  </p>
                </div>
                <div className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                  <p className="font-mono text-sm font-bold text-corsair-turquoise">corsair diff</p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    Compare two CPOEs — see regressions and improvements
                  </p>
                </div>
                <div className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                  <p className="font-mono text-sm font-bold text-corsair-cyan">corsair log</p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    Browse the SCITT transparency log for any issuer
                  </p>
                </div>
                <div className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                  <p className="font-mono text-sm font-bold text-corsair-green">corsair publish</p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    Generate your compliance.txt discovery file
                  </p>
                </div>
                <div className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                  <p className="font-mono text-sm font-bold text-corsair-crimson">corsair signal generate</p>
                  <p className="mt-1 text-xs text-corsair-text-dim">
                    Subscribe to FLAGSHIP real-time compliance change notifications
                  </p>
                </div>
              </div>
              <p className="mt-4 text-center">
                <a
                  href="/how-it-works"
                  className="font-mono text-xs text-corsair-gold transition-colors hover:text-corsair-gold/80"
                >
                  See how it works &rarr;
                </a>
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </main>
  );
}
