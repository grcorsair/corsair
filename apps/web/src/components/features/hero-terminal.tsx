"use client";

import { motion } from "motion/react";

const signLines = [
  { label: "Source", value: "Prowler v3.1", color: "text-corsair-text" },
  { label: "Controls", value: "22 found, 20 passed", color: "text-corsair-text" },
  { label: "Provenance", value: "tool (automated scan)", color: "text-corsair-text" },
  { label: "Signed", value: "Ed25519 → cpoe.jwt", color: "text-corsair-green" },
];

const diffLines = [
  { text: "  + CC7.2  Audit logging       pass → pass  (fixed)", color: "text-corsair-green" },
  { text: "  - CC6.6  Network segmentation NEW FAILURE", color: "text-corsair-crimson" },
];

const logLines = [
  { text: "  #4  2026-02-13  cpoe-acme-v2.jwt    L1  did:web:grcorsair.com", color: "text-corsair-text" },
  { text: "  #3  2026-02-09  cpoe-acme-v1.jwt    L1  did:web:grcorsair.com", color: "text-corsair-text-dim" },
  { text: "  #2  2026-01-15  cpoe-globex.jwt     L2  did:web:grcorsair.com", color: "text-corsair-text-dim" },
];

const verifyLines = [
  { label: "Signature", value: "Ed25519 valid", color: "text-corsair-green" },
  { label: "Issuer", value: "did:web:grcorsair.com", color: "text-corsair-text" },
  { label: "Provenance", value: "tool — Prowler v3.1", color: "text-corsair-text" },
];

export function HeroTerminal() {
  const signStart = 1.2;
  const signStagger = 0.13;
  const signEnd = signStart + signLines.length * signStagger + 0.2;

  const diffStart = signEnd + 0.4;
  const diffStagger = 0.15;
  const diffEnd = diffStart + diffLines.length * diffStagger + 0.2;

  const logStart = diffEnd + 0.4;
  const logStagger = 0.12;
  const logEnd = logStart + logLines.length * logStagger + 0.2;

  const verifyStart = logEnd + 0.4;
  const verifyStagger = 0.13;
  const verifyEnd = verifyStart + verifyLines.length * verifyStagger + 0.2;

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
          corsair — sign / diff / log / verify
        </span>
      </div>

      {/* Terminal body */}
      <div className="p-4 font-mono text-[12px] leading-relaxed sm:p-5 sm:text-[13px]">
        {/* Step 1: corsair sign */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.9 }}
        >
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">prowler scan</span>{" "}
          <span className="text-corsair-text-dim">|</span>{" "}
          <span className="text-corsair-text">corsair sign</span>
        </motion.div>

        <div className="h-2" />

        {signLines.map((line, i) => (
          <motion.div
            key={line.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: signStart + i * signStagger }}
            className="flex"
          >
            <span className="text-corsair-green">{"  \u2713 "}</span>
            <span className="w-[100px] shrink-0 text-corsair-text-dim">{line.label}</span>
            <span className={line.color}>{line.value}</span>
          </motion.div>
        ))}

        <div className="h-4" />

        {/* Step 2: corsair diff */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: diffStart - 0.2 }}
        >
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">corsair diff</span>{" "}
          <span className="text-corsair-text-dim">--current cpoe-v2.jwt --previous cpoe-v1.jwt</span>
        </motion.div>

        <div className="h-2" />

        {diffLines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: diffStart + i * diffStagger }}
            className={line.color}
          >
            {line.text}
          </motion.div>
        ))}

        <div className="h-4" />

        {/* Step 3: corsair log */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: logStart - 0.2 }}
        >
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">corsair log</span>{" "}
          <span className="text-corsair-text-dim">--last 3</span>
        </motion.div>

        <div className="h-2" />

        {logLines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: logStart + i * logStagger }}
            className={line.color}
          >
            {line.text}
          </motion.div>
        ))}

        <div className="h-4" />

        {/* Step 4: corsair verify */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: verifyStart - 0.2 }}
        >
          <span className="text-corsair-gold">$</span>{" "}
          <span className="text-corsair-text">corsair verify</span>{" "}
          <span className="text-corsair-text-dim">cpoe-v2.jwt</span>
        </motion.div>

        <div className="h-2" />

        {verifyLines.map((line, i) => (
          <motion.div
            key={line.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: verifyStart + i * verifyStagger }}
            className="flex"
          >
            <span className="text-corsair-green">{"  \u2713 "}</span>
            <span className="w-[100px] shrink-0 text-corsair-text-dim">{line.label}</span>
            <span className={line.color}>{line.value}</span>
          </motion.div>
        ))}

        {/* Result */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: verifyEnd }}
          className="mt-2 flex items-center gap-2"
        >
          <span className="font-semibold text-corsair-green">
            {"  VALID"}
          </span>
          <span className="text-corsair-text-dim">&mdash;</span>
          <span className="text-corsair-gold">Corsair Verified</span>
          <span className="text-corsair-green">{"\u2713"}</span>
        </motion.div>

        {/* Cursor */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: verifyEnd + 0.3 }}
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
