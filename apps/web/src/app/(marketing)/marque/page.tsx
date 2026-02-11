import type { Metadata } from "next";
import { MarqueVerifier } from "@/components/features/marque-verifier";

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
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
            Verify a CPOE
          </h1>
          <p className="mx-auto max-w-xl text-corsair-text-dim">
            Verify any Certificate of Proof of Operational Effectiveness. Ed25519-signed
            W3C Verifiable Credentials.{" "}
            <span className="font-semibold text-corsair-cyan">
              Signature verified via DID:web
            </span>
            . No account needed.
          </p>
        </div>

        <MarqueVerifier />

        {/* Explainer */}
        <div className="mt-16 space-y-8">
          <div>
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

          <div>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              Assurance Levels
            </h2>
            <div className="space-y-2 text-sm leading-relaxed text-corsair-text-dim">
              <div className="flex gap-3">
                <span className="font-mono text-yellow-400 w-6">L0</span>
                <span><span className="text-corsair-text font-semibold">Documented</span> — Policy exists, self-attestation only</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-corsair-cyan w-6">L1</span>
                <span><span className="text-corsair-text font-semibold">Configured</span> — Automated checks confirm settings are in place</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-corsair-green w-6">L2</span>
                <span><span className="text-corsair-text font-semibold">Demonstrated</span> — Test results prove controls work</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-blue-400 w-6">L3</span>
                <span><span className="text-corsair-text font-semibold">Observed</span> — Continuous monitoring active, re-validated quarterly</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-purple-400 w-6">L4</span>
                <span><span className="text-corsair-text font-semibold">Attested</span> — Independent auditor co-signs the credential</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              How verification works
            </h2>
            <ol className="space-y-2 text-sm leading-relaxed text-corsair-text-dim">
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">1.</span>
                An organization ingests compliance evidence (SOC 2 report, scan
                results) and generates a signed CPOE — a W3C Verifiable
                Credential (JWT-VC) signed with Ed25519.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">2.</span>
                The organization publishes their DID document at{" "}
                <code className="text-corsair-cyan">.well-known/did.json</code>{" "}
                containing their public key.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">3.</span>
                Anyone pastes the CPOE into this verifier. The issuer&apos;s
                DID:web document is resolved to fetch their public key, and the
                Ed25519 signature is verified via the Corsair API.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">4.</span>
                The result shows: signature validity, assurance level,
                evidence provenance, and control pass rate. Questionnaire theater
                replaced with math.
              </li>
            </ol>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              Standards
            </h2>
            <ul className="space-y-2 text-sm leading-relaxed text-corsair-text-dim">
              <li className="flex gap-3">
                <span className="text-corsair-cyan">--</span>
                <span>
                  <span className="font-semibold text-corsair-text">W3C Verifiable Credentials 2.0</span>{" "}
                  — CPOEs as interoperable, standards-compliant attestations
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-corsair-cyan">--</span>
                <span>
                  <span className="font-semibold text-corsair-text">DID:web</span>{" "}
                  — Decentralized identity for issuer key discovery
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-corsair-cyan">--</span>
                <span>
                  <span className="font-semibold text-corsair-text">OpenID SSF / CAEP</span>{" "}
                  — Real-time compliance change notifications via FLAGSHIP
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-corsair-cyan">--</span>
                <span>
                  <span className="font-semibold text-corsair-text">IETF SCITT</span>{" "}
                  — Transparency log for CPOE registration and auditable history
                </span>
              </li>
            </ul>
          </div>

          <div>
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
          </div>
        </div>
      </div>
    </main>
  );
}
