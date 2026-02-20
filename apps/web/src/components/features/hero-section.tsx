"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { HeroVerifier } from "./hero-verifier";
import { HeroRouteSelector } from "./hero-route-selector";

const FEATURES = [
  { label: "6 Primitives", desc: "Sign · Log · Verify · Diff · Signal · Publish" },
  { label: "Ed25519 Signed", desc: "Cryptographic proof of compliance" },
  { label: "1 Dependency", desc: "jose — nothing else at runtime" },
  { label: "Open Protocol", desc: "Apache 2.0 · No lock-in" },
] as const;

export function HeroSection() {
  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      {/* Primary gold glow — breathing */}
      <motion.div
        animate={{ opacity: [0.06, 0.14, 0.06] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/4 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/10 blur-[120px]"
      />

      {/* Secondary cyan accent — slower breathe, offset */}
      <motion.div
        animate={{ opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="pointer-events-none absolute right-1/4 top-1/2 h-[300px] w-[400px] rounded-full bg-corsair-cyan/[0.06] blur-[100px]"
      />

      {/* Main content — two columns on lg */}
      <div className="relative flex flex-1 items-center px-6 sm:px-10 lg:px-16">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center lg:gap-16">
          {/* LEFT: Brand + tagline + CTAs */}
          <div>
            {/* Giant brand name */}
            <motion.div
              initial={{ opacity: 0, filter: "blur(12px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <h1
                className="text-[18vw] font-bold leading-[0.85] tracking-tighter text-corsair-text sm:text-[14vw] lg:text-[10vw] xl:text-[9vw]"
                style={{ fontFamily: "var(--font-pixel-display)" }}
              >
                corsair
              </h1>
            </motion.div>

            {/* Tagline — two lines */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 sm:mt-8"
            >
              <p className="font-display text-lg font-medium leading-snug text-corsair-text sm:text-xl lg:text-2xl">
                HTTPS proved websites are real.
              </p>
              <p className="font-display text-lg font-medium leading-snug text-corsair-gold sm:text-xl lg:text-2xl">
                Corsair proves compliance is real.
              </p>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-4 max-w-lg text-base text-corsair-text-dim sm:text-lg"
            >
              Your security tools already know if controls work. Corsair signs that into a cryptographic proof anyone can verify.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Link
                href="/sign"
                className="btn-glow inline-flex items-center rounded-lg bg-corsair-gold px-6 py-3 font-display text-sm font-semibold text-corsair-deep transition-all hover:bg-corsair-gold/90"
              >
                Get started
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center rounded-lg border border-corsair-border/60 px-6 py-3 font-display text-sm font-semibold text-corsair-text-dim transition-all hover:border-corsair-gold hover:text-corsair-gold"
              >
                Read the docs &rarr;
              </Link>
              <Link
                href="/for-grc"
                className="inline-flex items-center rounded-lg border border-corsair-border/60 px-6 py-3 font-display text-sm font-semibold text-corsair-text-dim transition-all hover:border-corsair-green hover:text-corsair-green"
              >
                For GRC leaders
              </Link>
            </motion.div>

            {/* Route selector */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-6"
            >
              <HeroRouteSelector />
            </motion.div>

            {/* Attribution */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-6 text-sm text-corsair-text-dim/60"
            >
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
                GRC Engineer
              </a>
            </motion.p>
          </div>

          {/* RIGHT: HeroVerifier */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <HeroVerifier />
          </motion.div>
        </div>
      </div>

      {/* Bottom feature bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="relative border-t border-corsair-border/30 px-6 py-5 sm:px-10 lg:px-16"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-corsair-border/30">
          {FEATURES.map((f, i) => (
            <div key={i} className="px-0 sm:px-6 first:sm:pl-0 last:sm:pr-0">
              <p className="font-display text-sm font-semibold text-corsair-text">
                {f.label}
              </p>
              <p className="text-xs text-corsair-text-dim/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
