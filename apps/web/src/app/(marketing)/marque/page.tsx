import type { Metadata } from "next";
import { MarqueVerifier } from "@/components/features/marque-verifier";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Verify CPOE",
  description:
    "Verify any CPOE (Certificate of Proof of Operational Effectiveness). Ed25519 signature verified via DID:web resolution. No account needed.",
};

export default function MarquePage() {
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
          <MarqueVerifier />
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
                CPOE carries an{" "}
                <span className="text-corsair-gold">assurance level (L0-L4)</span>{" "}
                reflecting the depth of evidence, and{" "}
                <span className="text-corsair-gold">provenance metadata</span>{" "}
                identifying who produced the underlying evidence.
              </p>
            </div>
          </FadeIn>

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
                ASSURANCE
              </p>
              <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
                Assurance Levels
              </h2>
              <div className="space-y-2">
                {[
                  { level: "L0", name: "Documented", desc: "Policy exists, self-attestation only", color: "text-corsair-text-dim", barWidth: "20%", barColor: "bg-corsair-text-dim/40" },
                  { level: "L1", name: "Configured", desc: "Automated checks confirm settings are in place", color: "text-corsair-gold", barWidth: "40%", barColor: "bg-corsair-gold/40" },
                  { level: "L2", name: "Demonstrated", desc: "Test results prove controls work", color: "text-corsair-green", barWidth: "60%", barColor: "bg-corsair-green/40" },
                  { level: "L3", name: "Observed", desc: "Continuous monitoring active, re-validated quarterly", color: "text-blue-400", barWidth: "80%", barColor: "bg-blue-400/40" },
                  { level: "L4", name: "Attested", desc: "Independent auditor co-signs the credential", color: "text-purple-400", barWidth: "100%", barColor: "bg-purple-400/40" },
                ].map((item) => (
                  <div key={item.level} className="rounded-lg border border-corsair-border bg-corsair-surface p-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 font-mono text-sm font-bold ${item.color}`}>{item.level}</span>
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
                    Organization ingests evidence (SOC 2, scan results) and signs a CPOE — JWT-VC with Ed25519.
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
                    Result: signature validity, assurance level, provenance, pass rate. Math replaces trust.
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
                Traditional TPRM relies on self-attested questionnaires — 300+
                questions answered by vendors who have every incentive to
                overstate their security posture. A CPOE replaces trust with
                verification: the evidence was assessed, the results were
                recorded at a declared assurance level, and the credential is
                cryptographically signed. You don&apos;t have to trust the
                vendor. You verify the proof.
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
        </div>
      </div>
    </main>
  );
}
