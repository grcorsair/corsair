"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { TerminalDemo } from "./terminal-demo";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-corsair-navy/20 via-corsair-deep to-corsair-deep" />

      {/* Subtle glow behind logo */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-corsair-cyan/5 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 flex justify-center"
        >
          <Image
            src="/assets/corsair-logo.png"
            alt="CORSAIR — Open compliance trust exchange protocol"
            width={280}
            height={280}
            priority
            className="drop-shadow-[0_0_40px_rgba(0,207,255,0.12)]"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-4 font-display text-4xl font-bold leading-tight tracking-tight text-corsair-text sm:text-5xl lg:text-6xl"
        >
          Compliance claims are everywhere.
          <br />
          <span className="bg-gradient-to-r from-corsair-cyan to-corsair-turquoise bg-clip-text text-transparent">
            Cryptographic proof is not.
          </span>
        </motion.h1>

        {/* Version badge — pixel font accent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-4 flex justify-center"
        >
          <span className="inline-block rounded border border-corsair-cyan/30 bg-corsair-cyan/5 px-3 py-1 font-pixel text-[8px] tracking-wider text-corsair-cyan">
            v0.3.0 &middot; OPEN PROTOCOL
          </span>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mx-auto mb-8 max-w-2xl text-lg text-corsair-text-dim"
        >
          Open protocol for machine-readable, cryptographically verifiable
          compliance attestations. Verify trust. Don&apos;t assume it.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mb-16 flex flex-wrap justify-center gap-4"
        >
          <Button size="lg" className="font-display font-semibold shadow-[0_0_20px_rgba(0,207,255,0.2)] hover:shadow-[0_0_30px_rgba(0,207,255,0.3)]" asChild>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started
            </a>
          </Button>
          <Button variant="outline" size="lg" className="font-display font-semibold hover:border-corsair-gold hover:text-corsair-gold" asChild>
            <a href="#demo">Watch Demo</a>
          </Button>
          <Button variant="secondary" size="lg" className="font-display font-semibold gap-2" asChild>
            <a
              href="https://github.com/Arudjreis/corsair"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Star on GitHub
            </a>
          </Button>
        </motion.div>

        {/* Terminal Demo */}
        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <TerminalDemo />
        </motion.div>
      </div>
    </section>
  );
}
