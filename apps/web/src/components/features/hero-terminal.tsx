"use client";

import { motion } from "motion/react";

const verifyLines = [
  { label: "Signature", value: "Ed25519 valid", color: "text-corsair-green" },
  { label: "Issuer", value: "did:web:grcorsair.com", color: "text-corsair-text" },
  { label: "Assurance", value: "L2 — Demonstrated", color: "text-corsair-gold" },
  { label: "Controls", value: "24 tested, 22 passed", color: "text-corsair-text" },
  { label: "Frameworks", value: "SOC 2, NIST 800-53", color: "text-corsair-text" },
  { label: "SCITT", value: "Registered (#a7f3e2…)", color: "text-corsair-text" },
  { label: "Expires", value: "2026-05-09", color: "text-corsair-text-dim" },
];

export function HeroTerminal() {
  const baseDelay = 1.2;
  const lineStagger = 0.15;
  const resultDelay = baseDelay + verifyLines.length * lineStagger + 0.3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className="w-full overflow-hidden rounded-lg border border-corsair-border bg-corsair-surface shadow-2xl shadow-black/50"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <span className="ml-2 font-mono text-[11px] text-corsair-text-dim">
          corsair-verify
        </span>
      </div>

      {/* Terminal body */}
      <div className="p-4 font-mono text-[13px] leading-relaxed sm:p-5">
        {/* Command */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.9 }}
        >
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">corsair verify</span>{" "}
          <span className="text-corsair-text-dim">cpoe.jwt</span>
        </motion.div>

        {/* Blank line */}
        <div className="h-4" />

        {/* Verification results */}
        {verifyLines.map((line, i) => (
          <motion.div
            key={line.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.25,
              delay: baseDelay + i * lineStagger,
            }}
            className="flex"
          >
            <span className="text-corsair-green">{"  ✓ "}</span>
            <span className="w-[100px] shrink-0 text-corsair-text-dim">
              {line.label}
            </span>
            <span className={line.color}>{line.value}</span>
          </motion.div>
        ))}

        {/* Blank line */}
        <div className="h-4" />

        {/* Result */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: resultDelay }}
          className="flex items-center gap-2"
        >
          <span className="font-semibold text-corsair-green">
            {"  VALID"}
          </span>
          <span className="text-corsair-text-dim">—</span>
          <span className="text-corsair-gold">Corsair Verified</span>
          <span className="text-corsair-green">✓</span>
        </motion.div>

        {/* Cursor */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: resultDelay + 0.3 }}
          className="mt-3"
        >
          <span className="text-corsair-gold">$</span>
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
            className="ml-1 inline-block h-4 w-[7px] translate-y-[2px] bg-corsair-text-dim"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
