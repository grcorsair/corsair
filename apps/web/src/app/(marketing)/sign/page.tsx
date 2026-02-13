import type { Metadata } from "next";
import { SignWizard } from "@/components/features/sign-wizard";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export const metadata: Metadata = {
  title: "Sign Evidence",
  description:
    "Sign security tool output as a CPOE (Certificate of Proof of Operational Effectiveness). Upload evidence, configure signing options, and get a cryptographically signed JWT-VC.",
};

export default function SignPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              SIGN
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              sign
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Sign security tool output as a{" "}
              <span className="font-semibold text-corsair-gold">CPOE</span>.
              Upload or paste evidence from any of 8 supported formats, configure your signing
              options, and get a cryptographically signed JWT-VC.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-corsair-text-dim/60">
              Requires an API key. Evidence is signed server-side with Ed25519.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <SignWizard />
        </FadeIn>

        <PixelDivider variant="diamond" className="my-16" />

        {/* CLI alternative */}
        <FadeIn>
          <div>
            <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              PREFER THE CLI?
            </p>
            <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
              Sign from the command line
            </h2>
            <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
              <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
                <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
                <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
                  TERMINAL
                </span>
              </div>
              <div className="space-y-2 p-5 font-mono text-[12px] text-corsair-text-dim sm:text-[13px]">
                <div>
                  <span className="text-corsair-text-dim/40"># Install Corsair</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> git clone https://github.com/Arudjreis/corsair.git &amp;&amp; cd corsair &amp;&amp; bun install
                </div>
                <div className="mt-4">
                  <span className="text-corsair-text-dim/40"># Generate signing keys</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> bun run corsair.ts keygen
                </div>
                <div className="mt-4">
                  <span className="text-corsair-text-dim/40"># Sign tool output</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> bun run corsair.ts sign --file prowler-findings.json --output cpoe.jwt
                </div>
                <div className="mt-4">
                  <span className="text-corsair-text-dim/40"># Verify the CPOE</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> bun run corsair.ts verify cpoe.jwt
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
