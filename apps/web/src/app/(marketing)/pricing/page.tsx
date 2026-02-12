import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Verify any CPOE for free. Sign with Corsair starting at $49/CPOE. Platform API for tool and GRC platform integration.",
};

const tiers = [
  {
    name: "Verify",
    price: "Free",
    period: "forever",
    description: "Verify any CPOE. No account needed.",
    color: "text-corsair-green",
    borderColor: "border-corsair-green/30",
    features: [
      "Verify any CPOE signature",
      "DID:web key resolution",
      "Provenance + summary display",
      "Web verifier + CLI + any JWT library",
      "No account required",
    ],
    cta: "Verify Now",
    ctaHref: "/marque",
    ctaStyle:
      "bg-corsair-green/10 text-corsair-green border border-corsair-green/30 hover:bg-corsair-green/20",
    badge: null,
  },
  {
    name: "Sign",
    price: "$49",
    period: "per CPOE",
    description:
      "Corsair-signed CPOEs. Ed25519 attestation with did:web:grcorsair.com.",
    color: "text-corsair-gold",
    borderColor: "border-corsair-gold/30",
    features: [
      "Everything in Verify",
      "Corsair-signed JWT-VC (did:web:grcorsair.com)",
      "SCITT transparency log registration",
      "Provenance recording (self / tool / auditor)",
      "Optional enrichment: CHART + QUARTER (--enrich)",
      "CLI: corsair sign + corsair diff",
    ],
    cta: "Coming Soon",
    ctaHref: null,
    ctaStyle:
      "bg-corsair-gold text-corsair-deep hover:bg-corsair-gold/90",
    badge: "MOST POPULAR",
  },
  {
    name: "Platform",
    price: "$499",
    period: "per month",
    description:
      "HTTP API for tool and GRC platform integration. Programmatic CPOE signing at scale.",
    color: "text-corsair-turquoise",
    borderColor: "border-corsair-turquoise/30",
    features: [
      "Everything in Sign",
      "REST API: /api/v1/sign + /api/v1/verify",
      "Tool adapters: Prowler, InSpec, Trivy",
      "Platform adapters: CISO Assistant, Eramba",
      "FLAGSHIP real-time compliance signals",
      "Bulk signing + webhook notifications",
      "Dedicated support",
    ],
    cta: "Coming Soon",
    ctaHref: null,
    ctaStyle:
      "bg-corsair-turquoise/10 text-corsair-turquoise border border-corsair-turquoise/30 hover:bg-corsair-turquoise/20",
    badge: null,
  },
];

export default function PricingPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-16 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              PRICING
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              pricing
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Verification is free. Always.{" "}
              <span className="font-semibold text-corsair-gold">
                Signing is the product.
              </span>{" "}
              Self-sign for free (L0) or get Corsair-attested CPOEs starting at
              $49.
            </p>
          </div>
        </FadeIn>

        {/* Pricing cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <FadeIn key={tier.name} delay={i * 0.15}>
              <div
                className={`relative flex h-full flex-col rounded-xl border ${tier.borderColor} bg-corsair-surface p-6`}
              >
                {tier.badge && (
                  <Badge className="absolute -top-2.5 left-6 bg-corsair-gold text-corsair-deep font-pixel text-[7px]">
                    {tier.badge}
                  </Badge>
                )}

                {/* Tier header */}
                <div className="mb-6">
                  <h2
                    className={`font-display text-xl font-bold ${tier.color}`}
                  >
                    {tier.name}
                  </h2>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-pixel-display text-4xl font-bold text-corsair-text">
                      {tier.price}
                    </span>
                    <span className="text-sm text-corsair-text-dim">
                      {tier.period}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-corsair-text-dim">
                    {tier.description}
                  </p>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-corsair-text-dim"
                    >
                      <span className={`mt-0.5 ${tier.color}`}>
                        &#x2713;
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {tier.ctaHref ? (
                  <a
                    href={tier.ctaHref}
                    className={`inline-flex h-10 items-center justify-center rounded-md px-6 font-display text-sm font-semibold transition-colors ${tier.ctaStyle}`}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <span
                    className={`inline-flex h-10 items-center justify-center rounded-md px-6 font-display text-sm font-semibold opacity-60 ${tier.ctaStyle}`}
                  >
                    {tier.cta}
                  </span>
                )}
              </div>
            </FadeIn>
          ))}
        </div>

        <PixelDivider variant="swords" className="my-16" />

        {/* Self-signing callout */}
        <FadeIn>
          <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-8 text-center">
            <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
              SELF-SIGNING
            </p>
            <h3 className="mb-3 font-display text-xl font-bold text-corsair-text">
              Want to sign with your own key?
            </h3>
            <p className="mx-auto mb-4 max-w-lg text-sm text-corsair-text-dim">
              Generate an Ed25519 keypair, publish your DID document, and sign
              CPOEs with your own identity. Free forever. The CPOE displays as
              &ldquo;Self-Signed&rdquo; on verification — valid signature, your
              key, your domain.
            </p>
            <code className="inline-block rounded border border-corsair-border bg-corsair-surface px-4 py-2 font-mono text-sm text-corsair-gold">
              corsair keygen && corsair sign --format prowler --input
              scan.json
            </code>
          </div>
        </FadeIn>

        <PixelDivider variant="diamond" className="my-16" />

        {/* FAQ */}
        <FadeIn>
          <div className="mx-auto max-w-2xl">
            <p className="mb-2 text-center font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              FAQ
            </p>
            <h3 className="mb-8 text-center font-display text-2xl font-bold text-corsair-text">
              Common questions
            </h3>
            <div className="space-y-6">
              {[
                {
                  q: "Is verification really free?",
                  a: "Yes. Verification is free forever, for any CPOE, from any issuer. No account needed. This is the network effect — the more people who can verify, the more valuable CPOEs become.",
                },
                {
                  q: "What's the difference between self-signed and Corsair-signed?",
                  a: "A self-signed CPOE uses your own Ed25519 key and DID. A Corsair-signed CPOE is signed by did:web:grcorsair.com and registered in the SCITT transparency log. Verifiers see \"Corsair Verified\" vs \"Self-Signed Valid\".",
                },
                {
                  q: "What about assurance levels (L0-L4)?",
                  a: "Assurance scoring is available as optional enrichment via the --enrich flag. The default signing path records provenance (self/tool/auditor) and lets buyers decide what's sufficient.",
                },
                {
                  q: "Can I use the API without a web account?",
                  a: "Platform tier provides API keys for programmatic access. The CLI works standalone with no account for self-signing and verification.",
                },
              ].map((faq) => (
                <div key={faq.q}>
                  <p className="font-display text-sm font-semibold text-corsair-text">
                    {faq.q}
                  </p>
                  <p className="mt-1 text-sm text-corsair-text-dim">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
