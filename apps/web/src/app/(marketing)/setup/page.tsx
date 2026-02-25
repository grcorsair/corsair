import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { PixelDivider } from "@/components/pixel-art/pixel-divider";
import { HostedTrustTxtWizard } from "@/components/features/hosted-trust-txt-wizard";

export const metadata: Metadata = {
  title: "Hosted trust.txt setup — 60 second publish",
  description:
    "Create a hosted trust.txt and delegate via DNS. One URL, one TXT record, zero CLI.",
};

export default function SetupPage() {
  return (
    <main className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10 text-center">
            <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
              SETUP
            </p>
            <h1 className="mb-4 font-pixel-display text-5xl font-bold text-corsair-text sm:text-6xl">
              host trust.txt
            </h1>
            <p className="mx-auto max-w-2xl text-corsair-text-dim">
              Publish trust.txt in minutes. Corsair hosts the file, you add one DNS record,
              and every buyer can discover your compliance proofs instantly.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <HostedTrustTxtWizard />
        </FadeIn>

        <PixelDivider variant="diamond" className="my-16" />
      </div>
    </main>
  );
}
