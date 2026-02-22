import type { Metadata } from "next";
import { TrustTxtGenerator } from "@/components/features/trust-txt-generator";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Publish trust.txt — Compliance Discovery Endpoint",
  description:
    "Generate a trust.txt file for your domain. Like security.txt for compliance proofs — let anyone discover your CPOEs, SCITT log, catalog snapshot, and FLAGSHIP signals.",
};

export default function PublishPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              PUBLISH
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              publish
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Generate your trust.txt — the discovery file for your compliance proofs. Like{" "}
              <code className="text-corsair-cyan">security.txt</code> for
              compliance. Publish at{" "}
              <span className="font-semibold text-corsair-gold">
                /.well-known/trust.txt
              </span>{" "}
              so anyone can discover and verify your compliance posture.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["DID:web", "CPOE", "SCITT", "CATALOG", "FLAGSHIP", "Frameworks"].map(
                (tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="font-mono text-[10px] text-corsair-text-dim border-corsair-border"
                  >
                    {tag}
                  </Badge>
                ),
              )}
            </div>
          </div>
        </FadeIn>

        {/* Generator */}
        <FadeIn delay={0.2}>
          <TrustTxtGenerator />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* How it works */}
        <div className="space-y-12">
          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
                WHY
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                Why trust.txt?
              </h2>
              <p className="text-sm leading-relaxed text-corsair-text-dim">
                <code className="text-corsair-cyan">security.txt</code> gave
                vulnerability researchers a standard place to find contact info.
                CISA made it mandatory for federal agencies.{" "}
                <code className="text-corsair-gold">trust.txt</code> does
                the same for compliance proofs &mdash; a machine-readable
                discovery endpoint that lets buyers, auditors, and AI agents
                find your CPOEs without asking you for a PDF. For large proof
                sets, keep trust.txt minimal and point to a SCITT log and
                catalog snapshot.
              </p>
            </div>
          </FadeIn>

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
                HOW
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                Three steps to publish
              </h2>
              <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
                <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
                  <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
                    SETUP
                  </span>
                </div>
                <ol className="space-y-3 p-5 font-mono text-[12px] leading-relaxed text-corsair-text-dim sm:text-[13px]">
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">1.</span>
                    Fill in the form above with your DID:web, CPOE URLs, and
                    optional SCITT/catalog/FLAGSHIP endpoints.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">2.</span>
                    Download{" "}
                    <code className="text-corsair-cyan">trust.txt</code>{" "}
                    and place it at{" "}
                    <code className="text-corsair-cyan">
                      /.well-known/trust.txt
                    </code>{" "}
                    on your domain.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-corsair-gold">3.</span>
                    Verify it works:{" "}
                    <code className="text-corsair-cyan">
                      corsair trust-txt discover your-domain.com --verify
                    </code>
                  </li>
                </ol>
              </div>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
                API
              </p>
              <h2 className="mb-2 font-display text-xl font-bold text-corsair-text">
                Machine-actionable onboarding
              </h2>
              <p className="text-sm text-corsair-text-dim">
                Prefer an API instead of manual steps? Use{" "}
                <code className="text-corsair-cyan">POST /onboard</code> to
                receive <code className="text-corsair-cyan">did.json</code>,{" "}
                <code className="text-corsair-cyan">jwks.json</code>, and{" "}
                <code className="text-corsair-cyan">trust.txt</code> in one
                machine-readable response.
              </p>
              <div className="mt-3 rounded-lg border border-corsair-border bg-[#0A0A0A] px-4 py-3 font-mono text-[11px] text-corsair-text-dim">
                curl -X POST https://api.grcorsair.com/onboard -H \"Authorization: Bearer
                $AUTH_TOKEN\"
              </div>
            </div>
          </FadeIn>

          <FadeIn>
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-green/60">
                SPEC
              </p>
              <h2 className="mb-4 font-display text-xl font-bold text-corsair-text">
                Field reference
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    name: "DID",
                    desc: "Your DID:web identity for public key resolution",
                    required: true,
                  },
                  {
                    name: "CPOE",
                    desc: "URL to a signed CPOE (JWT-VC). Repeatable for multiple proofs.",
                    required: false,
                  },
                  {
                    name: "SCITT",
                    desc: "SCITT transparency log endpoint for audit trail",
                    required: false,
                  },
                  {
                    name: "CATALOG",
                    desc: "Human-friendly catalog snapshot with per-CPOE metadata",
                    required: false,
                  },
                  {
                    name: "FLAGSHIP",
                    desc: "Real-time compliance signal stream (SSF/CAEP)",
                    required: false,
                  },
                  {
                    name: "Frameworks",
                    desc: "Comma-separated compliance frameworks in scope",
                    required: false,
                  },
                  {
                    name: "Contact",
                    desc: "Email for compliance inquiries",
                    required: false,
                  },
                  {
                    name: "Expires",
                    desc: "ISO 8601 date when this file should be refreshed",
                    required: false,
                  },
                ].map((field) => (
                  <div
                    key={field.name}
                    className="rounded-lg border border-corsair-border bg-corsair-surface p-3"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold text-corsair-gold">
                        {field.name}
                      </p>
                      {field.required && (
                        <Badge
                          variant="outline"
                          className="font-mono text-[8px] text-corsair-crimson border-corsair-crimson/30"
                        >
                          required
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-corsair-text-dim">
                      {field.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <PixelDivider variant="diamond" className="my-8" />

          {/* Next steps */}
          <FadeIn>
            <div className="grid gap-4 sm:grid-cols-2">
              <a
                href="/verify"
                className="group rounded-xl border border-corsair-border bg-corsair-surface p-4 transition-colors hover:border-corsair-green/40"
              >
                <p className="font-mono text-sm font-bold text-corsair-green group-hover:text-corsair-green">
                  Verify a CPOE &rarr;
                </p>
                <p className="mt-1 text-xs text-corsair-text-dim">
                  Paste a JWT-VC to verify its Ed25519 signature via DID:web
                </p>
              </a>
              <a
                href="/sign"
                className="group rounded-xl border border-corsair-border bg-corsair-surface p-4 transition-colors hover:border-corsair-gold/40"
              >
                <p className="font-mono text-sm font-bold text-corsair-gold group-hover:text-corsair-gold">
                  Try signing &rarr;
                </p>
                <p className="mt-1 text-xs text-corsair-text-dim">
                  Sign evidence from 8 supported formats in the playground
                </p>
              </a>
            </div>
          </FadeIn>
        </div>
      </div>
    </main>
  );
}
