import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Signal — FLAGSHIP Real-Time Compliance Notifications",
  description:
    "Subscribe to FLAGSHIP compliance change notifications. Real-time SSF/SET/CAEP events for compliance posture changes.",
};

export default function SignalPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-crimson/60">
              SIGNAL
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              signal
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Subscribe to FLAGSHIP compliance change notifications. Real-time SSF/SET/CAEP events
              pushed to your webhook when compliance posture changes.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
            <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-corsair-crimson/60" />
              <span className="font-pixel text-[7px] tracking-wider text-corsair-crimson">
                TERMINAL
              </span>
            </div>
            <div className="space-y-1 p-5 font-mono text-[12px] leading-relaxed text-corsair-text-dim sm:text-[13px]">
              <div>
                <span className="text-corsair-gold">$</span>{" "}
                <span className="text-corsair-text">corsair signal generate</span>{" "}
                <span className="text-corsair-text-dim">--event flagship.json</span>
              </div>
              <div className="h-2" />
              <div className="flex">
                <span className="text-corsair-green">{"  \u2713 "}</span>
                <span className="w-[100px] shrink-0 text-corsair-text-dim">SET</span>
                <span className="text-corsair-text">secevent+jwt issued</span>
              </div>
              <div className="flex">
                <span className="text-corsair-green">{"  \u2713 "}</span>
                <span className="w-[100px] shrink-0 text-corsair-text-dim">Event</span>
                <span className="text-corsair-text">PAPERS_CHANGED</span>
              </div>
              <div className="flex">
                <span className="text-corsair-green">{"  \u2713 "}</span>
                <span className="w-[100px] shrink-0 text-corsair-text-dim">Audience</span>
                <span className="text-corsair-cyan">did:web:buyer.com</span>
              </div>
            </div>
          </div>
        </FadeIn>

        <PixelDivider variant="diamond" className="my-12" />

        <FadeIn>
          <p className="text-center">
            <Link
              href="/how-it-works"
              className="font-mono text-xs text-corsair-gold transition-colors hover:text-corsair-gold/80"
            >
              See how it works &rarr;
            </Link>
          </p>
        </FadeIn>
      </div>
    </main>
  );
}
