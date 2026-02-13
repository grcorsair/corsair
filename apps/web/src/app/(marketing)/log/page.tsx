import type { Metadata } from "next";
import { SCITTFeed } from "@/components/features/scitt-feed";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";

export const metadata: Metadata = {
  title: "Transparency Log",
  description:
    "Public, real-time feed of CPOEs registered in the SCITT transparency log. Browse, filter, and verify compliance attestations.",
};

export default function LogPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              TRANSPARENCY LOG
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              log
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Every signed CPOE is registered in the{" "}
              <span className="font-semibold text-corsair-gold">SCITT transparency log</span>.
              Append-only, tamper-evident, publicly auditable. Browse the full history below.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-corsair-text-dim/60">
              Like Certificate Transparency for TLS, but for compliance attestations.
            </p>
          </div>
        </FadeIn>

        <PixelDivider variant="swords" className="mb-12" />

        {/* Feed */}
        <FadeIn delay={0.2}>
          <SCITTFeed />
        </FadeIn>

        <PixelDivider variant="swords" className="my-16" />

        {/* About SCITT */}
        <FadeIn>
          <div className="space-y-6">
            <div>
              <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-cyan/60">
                ABOUT
              </p>
              <h2 className="mb-3 font-display text-xl font-bold text-corsair-text">
                What is the SCITT Transparency Log?
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
              <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
                <div className="h-2 w-2 rounded-full bg-corsair-cyan/60" />
                <span className="font-pixel text-[7px] tracking-wider text-corsair-cyan">
                  SCITT (IETF)
                </span>
              </div>
              <div className="space-y-3 p-5 text-sm leading-relaxed text-corsair-text-dim">
                <p>
                  <strong className="text-corsair-text">Supply Chain Integrity, Transparency, and Trust (SCITT)</strong>{" "}
                  is an IETF standard for append-only transparency logs. Once a CPOE is registered, it cannot be
                  modified or deleted.
                </p>
                <p>
                  Each registration produces a <strong className="text-corsair-text">COSE receipt</strong> — a
                  cryptographic proof that the entry exists in the log at a specific position. Receipts include Merkle
                  inclusion proofs for tamper-evidence.
                </p>
                <p>
                  This is the same model as{" "}
                  <strong className="text-corsair-text">Certificate Transparency (CT)</strong> for TLS certificates:
                  public logs that anyone can audit, ensuring no CPOE is issued in secret.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Append-Only",
                  desc: "Entries cannot be modified or deleted after registration. Database constraints enforce immutability.",
                },
                {
                  title: "COSE Receipts",
                  desc: "Every registration returns a signed receipt with Merkle inclusion proof for tamper-evidence.",
                },
                {
                  title: "Public Audit",
                  desc: "Anyone can query the log, verify receipts, and audit the full history. No account required.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-corsair-border bg-corsair-surface p-4"
                >
                  <p className="font-mono text-sm font-bold text-corsair-gold">{item.title}</p>
                  <p className="mt-1 text-xs text-corsair-text-dim">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </main>
  );
}
