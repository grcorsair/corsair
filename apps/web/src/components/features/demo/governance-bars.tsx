"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DEMO_DIMENSIONS } from "@/data/demo-data";

function scoreColor(score: number): string {
  if (score >= 80) return "#2ECC71";
  if (score >= 50) return "#D4A853";
  return "#C0392B";
}

function trustTier(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "AUDITOR-VERIFIED", color: "#2ECC71" };
  if (score >= 70) return { label: "AI-VERIFIED", color: "#D4A853" };
  return { label: "SELF-ASSESSED", color: "#9A8F80" };
}

export function GovernanceBars() {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Weighted composite: methodology 0.30, evidence_integrity 0.25, completeness 0.25, bias 0.20
  // Using our 7 dimensions: avg of (methodology*0.30 + coverage*0.25 + reliability*0.25 + consistency*0.20)
  const compositeScore = Math.round(
    DEMO_DIMENSIONS.reduce((sum, d) => sum + d.score, 0) / DEMO_DIMENSIONS.length
  );
  const tier = trustTier(compositeScore);

  return (
    <div className="space-y-6">
      {/* Composite score card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-pixel text-[8px] tracking-widest text-corsair-gold/60">
              QUARTERMASTER GOVERNANCE REVIEW
            </p>
            <p className="mt-2 text-xs text-corsair-text-dim">
              Seven dimensions scored independently. Deterministic rules first, LLM review second.
              Anti-gaming safeguards prevent level inflation.
            </p>
          </div>

          {/* Big score */}
          <div className="text-right">
            <motion.p
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3, type: "spring" }}
              className="font-pixel-display text-4xl font-bold"
              style={{ color: scoreColor(compositeScore) }}
            >
              {compositeScore}
            </motion.p>
            <p className="font-mono text-[10px] text-corsair-text-dim">/ 100</p>
          </div>
        </div>

        {/* Trust tier badge */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5"
          style={{ borderColor: `${tier.color}30`, backgroundColor: `${tier.color}08` }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: tier.color }}
          />
          <span
            className="font-pixel text-[8px] tracking-wider"
            style={{ color: tier.color }}
          >
            {tier.label}
          </span>
        </motion.div>
      </motion.div>

      {/* Dimension bars */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <p className="mb-5 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          SEVEN-DIMENSION ASSURANCE MODEL
        </p>

        <div className="space-y-3">
          {DEMO_DIMENSIONS.map((dim, i) => {
            const isExpanded = expanded === dim.name;
            return (
              <motion.div
                key={dim.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : dim.name)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    {/* Dimension name */}
                    <span className="w-24 flex-shrink-0 text-xs text-corsair-text-dim">
                      {dim.name}
                    </span>

                    {/* Bar */}
                    <div className="flex-1">
                      <div className="h-3 overflow-hidden rounded-full bg-corsair-border/40">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${dim.score}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                          className="h-full rounded-full transition-colors"
                          style={{
                            backgroundColor: scoreColor(dim.score),
                            minWidth: dim.score > 0 ? "4%" : "0%",
                          }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <span
                      className="w-8 text-right font-mono text-xs font-semibold"
                      style={{ color: scoreColor(dim.score) }}
                    >
                      {dim.score}
                    </span>

                    {/* Expand indicator */}
                    <motion.span
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      className="flex-shrink-0 text-corsair-text-dim/40"
                    >
                      ›
                    </motion.span>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="ml-27 mt-2 pl-27 text-xs text-corsair-text-dim" style={{ marginLeft: "6.5rem" }}>
                        {dim.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Safeguard callout */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1 }}
          className="mt-5 flex items-start gap-2 rounded-lg border border-corsair-crimson/20 bg-corsair-crimson/5 px-3 py-2"
        >
          <span className="mt-0.5 text-corsair-crimson">⚠</span>
          <p className="text-xs text-corsair-text-dim">
            <span className="text-corsair-crimson">Freshness: 0/100</span>
            {" "}— Evidence is 468 days old. Safeguard fired: assurance capped at L1 regardless of other dimensions.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
