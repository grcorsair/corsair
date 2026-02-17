import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Diff CPOEs",
  description:
    "Compare two CPOEs to see regressions and improvements in your compliance posture over time.",
};

export default function DiffPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <div className="mb-12 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-turquoise/60">
              DIFF
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              diff
            </h1>
            <p className="mx-auto max-w-xl text-corsair-text-dim">
              Compare two CPOEs. See regressions and improvements in your compliance posture over time.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]">
            <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-corsair-turquoise/60" />
              <span className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">
                TERMINAL
              </span>
            </div>
            <div className="space-y-1 p-5 font-mono text-[12px] leading-relaxed text-corsair-text-dim sm:text-[13px]">
              <div>
                <span className="text-corsair-gold">$</span>{" "}
                <span className="text-corsair-text">corsair diff</span>{" "}
                <span className="text-corsair-text-dim">--current cpoe-v2.jwt --previous cpoe-v1.jwt</span>
              </div>
              <div className="h-2" />
              <div className="text-corsair-green">  + CC7.2  Audit logging       pass → pass  (fixed)</div>
              <div className="text-corsair-green">  + CC8.1  Change management   fail → pass  (resolved)</div>
              <div className="text-corsair-crimson">  - CC6.6  Network segmentation NEW FAILURE</div>
              <div className="h-2" />
              <div className="text-corsair-text-dim">  Summary: 2 improved, 1 regressed, 19 unchanged</div>
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
