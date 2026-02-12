"use client";

import { motion } from "motion/react";
import {
  RULE_TRACE_EXAMPLE,
  SAFEGUARDS,
  BINARY_CHECKS,
  DORA_METRICS,
  type RuleTraceEntry,
} from "@/data/protocol-data";

const traceColors: Record<RuleTraceEntry["type"], { text: string; dot: string }> = {
  RULE: { text: "text-corsair-turquoise", dot: "bg-corsair-turquoise" },
  OVERRIDE: { text: "text-corsair-gold", dot: "bg-corsair-gold" },
  SAFEGUARD: { text: "text-corsair-crimson", dot: "bg-corsair-crimson" },
  ENFORCED: { text: "text-corsair-crimson", dot: "bg-corsair-crimson" },
  RESULT: { text: "text-corsair-green", dot: "bg-corsair-green" },
};

export function RuleTraceViewer() {
  return (
    <div className="space-y-8">
      {/* Decision trace */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          DECISION TRACE — ACME CORP PROWLER SCAN
        </p>
        <div className="space-y-0">
          {RULE_TRACE_EXAMPLE.map((entry, i) => {
            const colors = traceColors[entry.type];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="group flex items-start gap-3 py-1.5"
              >
                {/* Vertical line + dot */}
                <div className="relative flex flex-col items-center">
                  <div className={`h-2 w-2 rounded-full ${colors.dot} flex-shrink-0 mt-1`} />
                  {i < RULE_TRACE_EXAMPLE.length - 1 && (
                    <div className="w-px flex-1 bg-corsair-border/50 min-h-[16px]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-pixel text-[7px] tracking-wider ${colors.text} flex-shrink-0`}>
                      {entry.type}
                    </span>
                    <span className="font-mono text-[11px] text-corsair-text-dim truncate">
                      {entry.text}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="mt-0.5 text-[10px] text-corsair-text-dim/60 italic">
                      {entry.detail}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Anti-gaming safeguards */}
      <SafeguardGates />

      {/* Binary checks + DORA side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BinaryChecklist />
        <DORAMetrics />
      </div>
    </div>
  );
}

function SafeguardGates() {
  return (
    <div>
      <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
        ANTI-GAMING SAFEGUARDS — 5 DETERMINISTIC GATES
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SAFEGUARDS.map((sg, i) => (
          <motion.div
            key={sg.id}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className={`rounded-xl border p-4 ${
              sg.triggered
                ? "border-corsair-crimson/40 bg-corsair-crimson/5"
                : "border-corsair-border bg-[#0A0A0A]"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`font-mono text-[11px] font-bold ${
                  sg.triggered ? "text-corsair-crimson" : "text-corsair-green"
                }`}
              >
                {sg.triggered ? "TRIGGERED" : "PASS"}
              </span>
            </div>
            <p className="text-sm font-medium text-corsair-text">{sg.name}</p>
            <p className="mt-1 text-[11px] text-corsair-text-dim">
              {sg.description}
            </p>
            <div className="mt-2 rounded-md bg-corsair-surface px-2 py-1">
              <p className="font-mono text-[10px] text-corsair-text-dim">
                {sg.trigger}
              </p>
            </div>
            {sg.triggered && (
              <p className="mt-2 font-mono text-[10px] text-corsair-crimson">
                {sg.result}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BinaryChecklist() {
  const categories = ["evidence", "provenance", "integrity", "scope"] as const;
  const categoryLabels = {
    evidence: "Evidence Quality",
    provenance: "Provenance",
    integrity: "Integrity",
    scope: "Scope",
  };

  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
      <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
        16-POINT BINARY CHECKLIST (CIS-STYLE)
      </p>
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
              {categoryLabels[cat].toUpperCase()}
            </p>
            <div className="space-y-1">
              {BINARY_CHECKS.filter((c) => c.category === cat).map((check) => (
                <div
                  key={check.id}
                  className="flex items-center gap-2 py-0.5"
                >
                  <span
                    className={`flex-shrink-0 font-mono text-[11px] ${
                      check.passed ? "text-corsair-green" : "text-corsair-crimson"
                    }`}
                  >
                    {check.passed ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-xs text-corsair-text-dim">
                    {check.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-corsair-border pt-3">
        <p className="font-mono text-xs text-corsair-text-dim">
          <span className="text-corsair-green">14</span> /{" "}
          <span className="text-corsair-text">16</span> passed
        </p>
      </div>
    </div>
  );
}

function DORAMetrics() {
  const metrics = DORA_METRICS;
  const pairs = [
    { a: "freshness", b: "reproducibility", label: "Freshness + Reproducibility" },
    { a: "specificity", b: "independence", label: "Specificity + Independence" },
  ] as const;

  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
      <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
        DORA-STYLE PAIRED METRICS
      </p>
      <p className="mb-4 text-xs text-corsair-text-dim">
        Four metrics in two pairs. Divergence &gt;40 points between paired metrics flags potential gaming.
      </p>

      <div className="space-y-5">
        {pairs.map(({ a, b, label }) => {
          const metricA = metrics[a];
          const metricB = metrics[b];
          const flagged = metricA.flagged;

          return (
            <div key={a} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-corsair-text">{label}</span>
                {flagged && (
                  <span className="font-pixel text-[7px] tracking-wider text-corsair-crimson">
                    DIVERGENCE {metricA.divergence}pts
                  </span>
                )}
              </div>

              {/* Metric A */}
              <div className="flex items-center gap-3">
                <span className="w-28 text-[11px] text-corsair-text-dim capitalize">
                  {a}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-corsair-surface">
                  <motion.div
                    className={`h-full rounded-full ${flagged ? "bg-corsair-crimson" : "bg-corsair-gold"}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${metricA.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-corsair-text-dim">
                  {metricA.value}
                </span>
              </div>

              {/* Metric B */}
              <div className="flex items-center gap-3">
                <span className="w-28 text-[11px] text-corsair-text-dim capitalize">
                  {b}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-corsair-surface">
                  <motion.div
                    className={`h-full rounded-full ${flagged ? "bg-corsair-crimson" : "bg-corsair-gold"}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${metricB.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-corsair-text-dim">
                  {metricB.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-corsair-border pt-3">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[8px] tracking-wider text-corsair-text-dim">
            OVERALL BAND:
          </span>
          <span className="font-pixel text-[9px] tracking-wider text-corsair-crimson uppercase">
            {metrics.band}
          </span>
        </div>
      </div>
    </div>
  );
}
