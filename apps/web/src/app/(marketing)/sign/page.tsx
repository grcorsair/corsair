import type { Metadata } from "next";
import { SignWizard } from "@/components/features/sign-wizard";
import { PlaygroundEditor } from "@/components/features/playground-editor";
import { PlaygroundRecording } from "@/components/features/playground-recording";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Sign Evidence — Create Verifiable Compliance Proofs",
  description:
    "Sign security tool output as a CPOE (Certificate of Proof of Operational Effectiveness). Try the signing flow, then sign with an API key or OIDC token for production use.",
};

export default function SignPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
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
              Turn security tool output into a{" "}
              <span className="font-semibold text-corsair-gold">CPOE</span>. Try the signing flow
              below using demo keys, then sign with an API key or OIDC token when you&apos;re ready for production.
            </p>
          </div>
        </FadeIn>

        {/* Playground */}
        <FadeIn>
          <div className="mb-6 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
              TRY IT FIRST
            </p>
            <h2 className="mb-3 font-display text-2xl font-bold text-corsair-text">
              See signing in action
            </h2>
            <p className="mx-auto max-w-xl text-sm text-corsair-text-dim">
              Paste JSON evidence or tool output and sign a demo CPOE.
              This is a real JWT-VC signed with a public demo keypair.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "Generic JSON",
                "Mapping Packs",
                "Evidence-Only",
                "Assessment Context",
              ].map((fmt) => (
                <Badge
                  key={fmt}
                  variant="outline"
                  className="border-corsair-border font-mono text-[10px] text-corsair-text-dim"
                >
                  {fmt}
                </Badge>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <PlaygroundRecording castFile="/recordings/sign.cast" className="mb-8" />
        </FadeIn>

        <FadeIn delay={0.2}>
          <PlaygroundEditor />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* Production signing */}
        <FadeIn>
          <div className="mb-10 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              PRODUCTION
            </p>
            <h2 className="mb-3 font-display text-2xl font-bold text-corsair-text">
              Sign with an API key or OIDC token
            </h2>
            <p className="mx-auto max-w-xl text-sm text-corsair-text-dim">
              Use the signing API to generate verifiable CPOEs for your organization.
              Evidence is signed server-side with Ed25519.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
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
                  <span className="text-corsair-text-dim/40"># Install Corsair (pick one)</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> brew install grcorsair/corsair/corsair
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> npm install -g @grcorsair/cli
                </div>
                <div>
                  <span className="text-corsair-text-dim/40"># Bun is required to run the CLI (Homebrew installs it via oven-sh/bun)</span>
                </div>
                <div className="mt-4">
                  <span className="text-corsair-text-dim/40"># Initialize (generates keys + example evidence)</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> corsair init
                </div>
                <div className="mt-4">
                  <span className="text-corsair-text-dim/40"># Sign tool output</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> corsair sign --file tool-output.json --mapping ./mappings/toolx.json --output cpoe.jwt
                </div>
                <div className="mt-4">
                  <span className="text-corsair-text-dim/40"># Verify the CPOE</span>
                </div>
                <div>
                  <span className="text-corsair-cyan">$</span> corsair verify --file cpoe.jwt
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
