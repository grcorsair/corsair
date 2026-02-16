"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HeroProofSnippet } from "./hero-proof-snippet";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-6">
      {/* Subtle gold glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/[0.03] blur-[150px]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left — Brand + CTA */}
          <div>
            {/* Massive brand name */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="font-pixel-display text-[15vw] font-bold leading-[0.9] tracking-tighter text-corsair-text sm:text-[13vw] lg:text-[7vw]"
            >
              corsair
            </motion.h1>

            {/* Subtitle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 max-w-2xl sm:mt-8"
            >
              <p className="text-lg text-corsair-text-dim sm:text-xl lg:text-2xl">
                Git for Compliance.
              </p>
              <p className="mt-1 text-lg font-medium text-corsair-gold sm:text-xl lg:text-2xl">
                compliance.txt, 4-line verification, and compliance diffs.
              </p>
              <p className="mt-3 text-sm text-corsair-text-dim/80 leading-relaxed sm:text-base">
                Publish a discovery file, verify proofs in seconds, and diff drift over time. Cryptographic compliance, not PDFs.
              </p>
              <p className="mt-3 text-sm text-corsair-text-dim/60">
                by{" "}
                <a
                  href="https://grcengineer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-corsair-gold"
                >
                  Ayoub Fandi
                </a>
                {" "}&middot;{" "}
                <a
                  href="https://grcengineer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-corsair-gold"
                >
                  GRC Engineering
                </a>
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 flex flex-wrap gap-4 sm:mt-10"
            >
              <Button size="lg" className="font-display text-base font-semibold" asChild>
                <Link href="/generate">Generate compliance.txt</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="font-display text-base font-semibold border-corsair-gold/30 text-corsair-text-dim hover:border-corsair-gold hover:text-corsair-gold"
                asChild
              >
                <Link href="/marque">Verify a CPOE</Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="font-display text-base font-semibold text-corsair-text-dim hover:text-corsair-gold"
                asChild
              >
                <Link href="#diff-demo">See diff demo</Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="mt-6 text-xs text-corsair-text-dim/70"
            >
              Protocol depth below: sign, verify, diff, log, signal.
            </motion.div>
          </div>

          {/* Right — Proof Snippet */}
          <div className="max-lg:mt-4">
            <HeroProofSnippet />
          </div>
        </div>
      </div>
    </section>
  );
}
