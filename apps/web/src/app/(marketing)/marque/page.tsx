import type { Metadata } from "next";
import { MarqueVerifier } from "@/components/features/marque-verifier";

export const metadata: Metadata = {
  title: "Marque Verifier",
  description:
    "Verify any Corsair CPOE attestation. Ed25519-signed W3C Verifiable Credentials verified entirely in your browser. No data leaves your machine.",
};

export default function MarquePage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-display text-4xl font-bold text-corsair-text">
            Marque Verifier
          </h1>
          <p className="mx-auto max-w-xl text-corsair-text-dim">
            Verify any Corsair CPOE attestation. Ed25519-signed W3C Verifiable
            Credentials.{" "}
            <span className="font-semibold text-corsair-cyan">
              Runs entirely in your browser
            </span>
            . No data leaves your machine.
          </p>
        </div>

        <MarqueVerifier />

        {/* Explainer */}
        <div className="mt-16 space-y-8">
          <div>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              What is a Marque?
            </h2>
            <p className="text-sm leading-relaxed text-corsair-text-dim">
              A Marque is a{" "}
              <span className="text-corsair-gold">
                Certificate of Proof of Operational Effectiveness (CPOE)
              </span>{" "}
              — a cryptographically signed document that proves security
              controls were adversarially tested and the results are
              tamper-proof. Named after the historical Letter of Marque that
              authorized privateers, a Corsair Marque authorizes trust through
              proof rather than promises.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              How verification works
            </h2>
            <ol className="space-y-2 text-sm leading-relaxed text-corsair-text-dim">
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">1.</span>
                The Corsair CLI runs an adversarial assessment and generates a
                Marque — a W3C Verifiable Credential (JWT-VC) signed with
                Ed25519.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">2.</span>
                The vendor shares the Marque (JWT) and their public key with
                the requesting organization.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">3.</span>
                The requestor pastes both into this verifier. The Web Crypto
                API verifies the Ed25519 signature entirely client-side.
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-corsair-cyan">4.</span>
                If valid: cryptographic proof that the assessment results
                haven&apos;t been tampered with. Questionnaire theater replaced
                with math.
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
                  — The credential data model for CPOEs as interoperable attestations
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-corsair-cyan">--</span>
                <span>
                  <span className="font-semibold text-corsair-text">OpenID SSF / CAEP</span>{" "}
                  — Real-time compliance change notifications via the FLAGSHIP event system
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
              overstate their security posture. A Marque replaces trust with
              verification: the controls were attacked, the results were
              recorded, and the evidence is cryptographically signed. You
              don&apos;t have to trust the vendor. You verify the proof.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
