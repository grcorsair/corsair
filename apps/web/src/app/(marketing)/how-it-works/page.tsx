import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { SCITTPreview } from "@/components/features/scitt-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "How It Works - Proof, Not PDFs",
  description:
    "A simple, non-technical walkthrough of how Corsair turns evidence into cryptographic proof, and how anyone can verify it.",
};

export default function HowItWorksPage() {
  return (
    <main className="pb-20">
      {/* HERO */}
      <section className="relative flex min-h-[50dvh] flex-col items-center justify-center overflow-hidden px-6 py-20">
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.02] blur-[120px]" />

        <FadeIn>
          <p className="mb-4 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            HOW IT WORKS
          </p>
          <h1 className="mb-4 text-center font-pixel-display text-[10vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[8vw] lg:text-[5vw]">
            proof, not PDFs
          </h1>
          <p className="mx-auto max-w-2xl text-center text-lg text-corsair-text-dim sm:text-xl">
            Corsair turns compliance evidence into a signed proof anyone can verify.
            No portals. No trust centers. Just cryptography.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-border">
              Ed25519 Signed
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-border">
              W3C Verifiable Credential
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-corsair-gold border-corsair-border">
              DID:web Identity
            </Badge>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="sm">
              <Link href="/marque">Verify a CPOE</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/generate">Generate compliance.txt</Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <PixelDivider className="my-4" />

      {/* WHY */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-corsair-border bg-corsair-surface p-6">
                <p className="mb-2 font-pixel text-[8px] tracking-widest text-corsair-crimson/60">
                  THE OLD WAY
                </p>
                <h2 className="mb-3 font-display text-2xl font-bold text-corsair-text">
                  PDFs and trust centers
                </h2>
                <p className="text-sm text-corsair-text-dim">
                  Compliance is shared as static PDFs. You can read them, but you can&apos;t verify them.
                  Every exchange relies on trust.
                </p>
              </div>
              <div className="rounded-xl border border-corsair-border bg-corsair-surface p-6">
                <p className="mb-2 font-pixel text-[8px] tracking-widest text-corsair-green/60">
                  THE NEW WAY
                </p>
                <h2 className="mb-3 font-display text-2xl font-bold text-corsair-text">
                  Signed, verifiable proof
                </h2>
                <p className="text-sm text-corsair-text-dim">
                  Corsair signs evidence as a cryptographic proof (CPOE). Anyone can verify the signature and provenance.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="diamond" className="my-4" />

      {/* FLOW */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              THE FLOW
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              Evidence in. Proof out.
            </h2>
          </FadeIn>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Collect evidence",
                body: "Run your security tools (Prowler, InSpec, Trivy, etc.) and export JSON output.",
              },
              {
                title: "Sign a CPOE",
                body: "Corsair signs the evidence as a JWT-VC with Ed25519 and records provenance.",
              },
              {
                title: "Verify anywhere",
                body: "Anyone can verify the CPOE with a DID:web lookup. No account needed.",
              },
            ].map((step, idx) => (
              <FadeIn key={step.title} delay={0.1 * idx}>
                <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                  <p className="mb-2 font-mono text-xs text-corsair-gold">0{idx + 1}</p>
                  <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                    {step.title}
                  </h3>
                  <p className="text-sm text-corsair-text-dim">{step.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <PixelDivider variant="swords" className="my-4" />

      {/* THREE ACTIONS */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-cyan/60">
              THREE ACTIONS
            </p>
            <h2 className="mb-8 text-center font-display text-3xl font-bold text-corsair-text">
              The launch-ready surface
            </h2>
          </FadeIn>

          <div className="grid gap-4 md:grid-cols-3">
            <FadeIn>
              <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                  compliance.txt
                </h3>
                <p className="text-sm text-corsair-text-dim">
                  A public discovery file for compliance proof. Like security.txt, but for CPOEs.
                </p>
                <Link href="/generate" className="mt-3 inline-block font-mono text-xs text-corsair-gold">
                  Generate &rarr;
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                  4-line verification
                </h3>
                <p className="text-sm text-corsair-text-dim">
                  Verify any CPOE with standard JWT libraries. No account required.
                </p>
                <Link href="/marque" className="mt-3 inline-block font-mono text-xs text-corsair-gold">
                  Verify &rarr;
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
                <h3 className="mb-2 font-display text-lg font-semibold text-corsair-text">
                  Diff over time
                </h3>
                <p className="text-sm text-corsair-text-dim">
                  Compare two CPOEs to see regressions and improvements.
                </p>
                <Link href="/" className="mt-3 inline-block font-mono text-xs text-corsair-gold">
                  See example &rarr;
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <PixelDivider variant="diamond" className="my-4" />

      {/* SCITT PREVIEW */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <p className="mb-3 text-center font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              TRANSPARENCY LOG
            </p>
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-corsair-text">
              What the log looks like in practice
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-corsair-text-dim">
              Every signed CPOE can be registered in an append-only log. It&apos;s the audit trail you can actually verify.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <SCITTPreview />
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-6 text-center">
              <Link href="/log" className="font-mono text-xs text-corsair-gold">
                View the full log &rarr;
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      <PixelDivider variant="swords" className="my-4" />

      {/* CTA */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <FadeIn>
            <h2 className="mb-4 font-display text-3xl font-bold text-corsair-text">
              Ready to try it?
            </h2>
            <p className="mb-6 text-corsair-text-dim">
              Verify a real CPOE, generate compliance.txt, or sign your first proof in minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/marque">Verify</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/generate">Generate</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/sign">Sign</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
