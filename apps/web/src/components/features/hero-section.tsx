"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { HeroVerifier } from "./hero-verifier";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-6">
      {/* Primary gold glow — breathing */}
      <motion.div
        animate={{ opacity: [0.06, 0.14, 0.06] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-corsair-gold/10 blur-[120px]"
      />

      {/* Secondary cyan accent — slower breathe, offset */}
      <motion.div
        animate={{ opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="pointer-events-none absolute right-1/4 top-1/2 h-[300px] w-[400px] rounded-full bg-corsair-cyan/[0.06] blur-[100px]"
      />

      <div className="relative mx-auto w-full max-w-3xl text-center">
        {/* "Git for Compliance." — blur reveal */}
        <motion.h1
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0, ease: "easeOut" }}
          className="font-display text-5xl font-bold leading-tight text-corsair-text md:text-7xl"
        >
          Git for Compliance.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-4 max-w-xl text-lg text-corsair-text-dim sm:text-xl"
        >
          Cryptographic proof anyone can verify. No PDFs. No portals. No trust required.
        </motion.p>

        {/* Verifier — scales in */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <HeroVerifier />
        </motion.div>

        {/* "corsair" brand */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10"
        >
          <span className="font-pixel-display text-3xl font-bold text-corsair-text">
            corsair
          </span>
        </motion.div>

        {/* Attribution + publish link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-3"
        >
          <p className="text-sm text-corsair-text-dim/60">
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
          <p className="mt-2">
            <Link
              href="/publish"
              className="text-sm text-corsair-gold transition-colors hover:text-corsair-gold/80"
            >
              Publish your compliance.txt &rarr;
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
