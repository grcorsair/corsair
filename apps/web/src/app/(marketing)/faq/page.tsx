import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export const metadata: Metadata = {
  title: "FAQ — Corsair Privacy Architecture & Verification",
  description:
    "Frequently asked questions about SCITT transparency, Ed25519 signing, SD-JWT selective disclosure, and the Corsair privacy architecture.",
};

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  id: string;
  label: string;
  labelColor: string;
  title: string;
  items: FAQItem[];
}

const sections: FAQSection[] = [
  {
    id: "scitt-transparency",
    label: "SCITT",
    labelColor: "text-corsair-cyan",
    title: "SCITT Transparency",
    items: [
      {
        q: "What data is stored in the SCITT transparency log?",
        a: "By default, the full signed CPOE is registered. In proof-only mode (proofOnly: true), only the SHA-256 hash and COSE receipt are stored \u2014 proving the CPOE was registered without exposing the credential itself. The Merkle tree integrity is identical in both modes.",
      },
      {
        q: "Is the transparency log public?",
        a: "The SCITT log is append-only and auditable. Organizations choose whether to register full CPOEs (public verifiability) or proof-only entries (bilateral sharing with public proof of existence).",
      },
    ],
  },
  {
    id: "ed25519-cryptography",
    label: "CRYPTOGRAPHY",
    labelColor: "text-corsair-gold",
    title: "Ed25519 Cryptography",
    items: [
      {
        q: "Why Ed25519?",
        a: "Ed25519 has no weak keys (unlike RSA), produces compact 64-byte signatures, and is fast to verify. It\u2019s the same curve used by SSH, Signal, and many blockchain protocols. Every CPOE and FLAGSHIP signal uses Ed25519 via the DID:web resolution flow.",
      },
    ],
  },
  {
    id: "selective-disclosure",
    label: "SD-JWT",
    labelColor: "text-corsair-turquoise",
    title: "SD-JWT Selective Disclosure",
    items: [
      {
        q: "What is SD-JWT?",
        a: "SD-JWT (IETF draft-ietf-oauth-selective-disclosure-jwt) allows a CPOE holder to prove specific claims \u2014 like \u201Cwe passed SOC 2 access controls\u201D \u2014 without revealing the full assessment. Undisclosed claims appear as SHA-256 hashes in the JWT. The signature covers all claims, disclosed or not.",
      },
      {
        q: "How do I use SD-JWT with Corsair?",
        a: "Pass --sd-jwt to the sign command. Optionally specify which fields are disclosable with --sd-fields. Example: corsair sign --file evidence.json --sd-jwt --sd-fields summary,frameworks",
      },
    ],
  },
  {
    id: "privacy-architecture",
    label: "PRIVACY",
    labelColor: "text-corsair-green",
    title: "Privacy Architecture",
    items: [
      {
        q: "How does Corsair protect sensitive control data?",
        a: "Three layers: (1) Summary-only CPOEs \u2014 aggregate pass/fail counts, not raw evidence. (2) Evidence sanitization \u2014 ARNs, IPs, file paths, account IDs, and API keys are stripped recursively before signing. (3) SD-JWT selective disclosure \u2014 holders choose which claims to reveal per verifier.",
      },
      {
        q: "Can companies use Corsair without exposing detailed control data?",
        a: "Yes. The combination of summary-only CPOEs, proof-only SCITT registration, and SD-JWT selective disclosure means companies can prove compliance without publishing any detailed control information. The CPOE carries the proof; the holder controls what\u2019s revealed.",
      },
    ],
  },
  {
    id: "trust-centre-comparison",
    label: "COMPARISON",
    labelColor: "text-corsair-gold",
    title: "Trust Centre Comparison",
    items: [
      {
        q: "How does Corsair compare to SafeBase, Whistic, or Conveyor?",
        a: "Trust centers store and share compliance documents, but they can\u2019t solve the disclosure fear problem \u2014 companies are legally liable for detailed control data. Corsair is different: it signs cryptographic proofs of compliance results (not the raw data), supports selective disclosure, and allows proof-only SCITT registration. Share proof, not secrets.",
      },
    ],
  },
  {
    id: "verification",
    label: "VERIFY",
    labelColor: "text-corsair-cyan",
    title: "Verification",
    items: [
      {
        q: "Is verification free?",
        a: "Yes, always. Verification requires no account, no API key, no payment. Decode the JWT, resolve the DID, check the Ed25519 signature. Four steps with any JWT library.",
      },
      {
        q: "Can I verify a CPOE without Corsair?",
        a: "Yes. A CPOE is a standard JWT-VC with an Ed25519 signature. You can verify it with jose (TypeScript), PyJWT (Python), or any JWT library that supports EdDSA.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              FREQUENTLY ASKED QUESTIONS
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              faq
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Technical answers about{" "}
              <span className="font-semibold text-corsair-gold">SCITT transparency</span>,{" "}
              <span className="font-semibold text-corsair-cyan">Ed25519 signing</span>,{" "}
              <span className="font-semibold text-corsair-turquoise">selective disclosure</span>,
              and the Corsair privacy architecture.
            </p>
          </div>
        </FadeIn>

        <PixelDivider variant="swords" className="mb-12" />

        {/* FAQ Sections */}
        <div className="space-y-12">
          {sections.map((section, sectionIdx) => (
            <FadeIn key={section.id} delay={0.1 * sectionIdx}>
              <section id={section.id}>
                <p
                  className={`mb-2 font-pixel text-[7px] tracking-wider ${section.labelColor}/60`}
                >
                  {section.label}
                </p>
                <h2 className="mb-6 font-display text-xl font-bold text-corsair-text">
                  {section.title}
                </h2>

                <div className="space-y-3">
                  {section.items.map((item, itemIdx) => (
                    <details
                      key={itemIdx}
                      className="group rounded-xl border border-corsair-border bg-corsair-surface transition-all hover:border-corsair-gold/30 open:border-corsair-gold/20 open:shadow-[0_0_20px_rgba(212,168,83,0.04)]"
                    >
                      <summary className="cursor-pointer select-none px-5 py-4 font-display text-sm font-semibold text-corsair-text transition-colors group-open:text-corsair-gold [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                        <span className="flex items-center justify-between">
                          <span>{item.q}</span>
                          <span className="ml-4 flex-shrink-0 font-mono text-xs text-corsair-text-dim transition-transform group-open:rotate-45">
                            +
                          </span>
                        </span>
                      </summary>
                      <div className="border-t border-corsair-border px-5 py-4 text-sm leading-relaxed text-corsair-text-dim">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            </FadeIn>
          ))}
        </div>

        <PixelDivider variant="diamond" className="my-16" />

        {/* CTA */}
        <FadeIn>
          <div className="text-center">
            <p className="mb-6 text-corsair-text-dim">
              Have a question not covered here? Check the documentation or open an issue.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/docs"
                className="inline-block rounded-lg border border-corsair-gold/30 bg-corsair-surface px-8 py-4 font-display text-sm font-semibold text-corsair-text transition-all hover:border-corsair-gold hover:text-corsair-gold hover:shadow-[0_0_20px_rgba(212,168,83,0.1)]"
              >
                Read the Docs &rarr;
              </a>
              <a
                href="https://github.com/Arudjreis/corsair/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg border border-corsair-border bg-corsair-surface px-8 py-4 font-display text-sm font-semibold text-corsair-text-dim transition-all hover:border-corsair-cyan/40 hover:text-corsair-cyan"
              >
                Open an Issue
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
