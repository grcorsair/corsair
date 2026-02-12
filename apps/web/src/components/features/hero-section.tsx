"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HeroTerminal } from "./hero-terminal";

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
                Compliance trust exchange protocol.
              </p>
              <p className="mt-1 text-lg font-medium text-corsair-gold sm:text-xl lg:text-2xl">
                Verify proof. Not promises.
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
              <Button
                size="lg"
                className="font-display text-base font-semibold"
                asChild
              >
                <Link href="/marque">Verify a CPOE</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="font-display text-base font-semibold border-corsair-gold/30 text-corsair-text-dim hover:border-corsair-gold hover:text-corsair-gold"
                asChild
              >
                <Link href="/docs">
                  View Documentation
                  <span className="ml-1">&rarr;</span>
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Right — Terminal */}
          <div className="max-lg:mt-4">
            <HeroTerminal />
          </div>
        </div>
      </div>

      {/* Feature strip at bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute bottom-0 left-0 right-0 border-t border-corsair-border"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
          <FeatureItem
            title="Ed25519 signed"
            description="Cryptographic proof"
          />
          <FeatureItem
            title="13+ frameworks"
            description="SOC 2, NIST, ISO..."
            className="border-l border-corsair-border"
          />
          <FeatureItem
            title="Machine-readable"
            description="JWT-VC format"
            className="border-l border-corsair-border max-lg:border-l-0 max-lg:border-t"
          />
          <FeatureItem
            title="Free to verify"
            description="No account needed"
            className="border-l border-corsair-border max-lg:border-t"
          />
        </div>
      </motion.div>
    </section>
  );
}

function FeatureItem({
  title,
  description,
  className = "",
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`px-6 py-5 ${className}`}>
      <p className="text-sm font-medium text-corsair-text">{title}</p>
      <p className="mt-0.5 text-xs text-corsair-text-dim">{description}</p>
    </div>
  );
}
