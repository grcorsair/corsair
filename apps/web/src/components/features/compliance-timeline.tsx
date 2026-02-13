"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/card";

const commits = [
  {
    hash: "a7f3e2",
    date: "2026-02-12",
    tool: "Prowler v3.1",
    scope: "AWS Production",
    score: 91,
    controls: { passed: 20, failed: 2, total: 22 },
    provenance: "tool",
    diff: null,
    signal: null,
  },
  {
    hash: "c4d1b8",
    date: "2026-01-15",
    tool: "InSpec 5.22",
    scope: "AWS Production",
    score: 86,
    controls: { passed: 19, failed: 3, total: 22 },
    provenance: "tool",
    diff: { regressions: 0, improvements: 1, note: "+1 control fixed (CC7.2)" },
    signal: null,
  },
  {
    hash: "e9f2a1",
    date: "2025-12-01",
    tool: "Prowler v3.0",
    scope: "AWS Production",
    score: 82,
    controls: { passed: 18, failed: 4, total: 22 },
    provenance: "tool",
    diff: { regressions: 1, improvements: 0, note: "CC6.6 regressed (VPC change)" },
    signal: { type: "FLEET_ALERT", note: "Drift detected — CC6.6 VPC config changed" },
  },
  {
    hash: "b3c7d5",
    date: "2025-10-15",
    tool: "Self-assessment",
    scope: "AWS Production",
    score: 75,
    controls: { passed: 15, failed: 5, total: 20 },
    provenance: "self",
    diff: null,
    signal: null,
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 90
      ? "bg-corsair-green"
      : score >= 80
        ? "bg-corsair-gold"
        : "bg-corsair-crimson";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-corsair-border">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-xs text-corsair-text-dim">{score}%</span>
    </div>
  );
}

function ProvenanceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    tool: "border-corsair-green/30 text-corsair-green",
    self: "border-corsair-gold/30 text-corsair-gold",
    auditor: "border-corsair-cyan/30 text-corsair-cyan",
  };

  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${styles[source] ?? styles.self}`}
    >
      {source}
    </span>
  );
}

export function ComplianceTimeline() {
  return (
    <motion.div
      className="relative"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {/* Vertical commit line */}
      <div className="absolute left-[23px] top-4 bottom-4 w-px bg-corsair-border sm:left-[27px]" />

      <div className="space-y-4">
        {commits.map((commit, i) => (
          <motion.div key={commit.hash} variants={itemVariants}>
            <Card className="relative ml-12 bg-corsair-surface p-4 sm:ml-14 sm:p-5">
              {/* Commit dot */}
              <div
                className={`absolute -left-[33px] top-5 h-3 w-3 rounded-full border-2 sm:-left-[37px] ${
                  i === 0
                    ? "border-corsair-green bg-corsair-green"
                    : "border-corsair-border bg-corsair-bg"
                }`}
              />

              {/* Header row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-medium text-corsair-gold">
                  {commit.hash}
                </span>
                <span className="text-xs text-corsair-text-dim">
                  {commit.date}
                </span>
                <ProvenanceBadge source={commit.provenance} />
                <span className="text-xs text-corsair-text-dim">
                  via {commit.tool}
                </span>
              </div>

              {/* Stats row */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <ScoreBar score={commit.score} />
                <span className="text-xs text-corsair-text-dim">
                  <span className="text-corsair-green">{commit.controls.passed}</span>
                  {" / "}
                  <span className="text-corsair-text">{commit.controls.total}</span>
                  {" controls"}
                </span>
                {commit.controls.failed > 0 && (
                  <span className="text-xs text-corsair-crimson">
                    {commit.controls.failed} failed
                  </span>
                )}
              </div>

              {/* Diff note */}
              {commit.diff && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {commit.diff.regressions > 0 && (
                    <span className="text-corsair-crimson">
                      -{commit.diff.regressions} regression
                    </span>
                  )}
                  {commit.diff.improvements > 0 && (
                    <span className="text-corsair-green">
                      +{commit.diff.improvements} improvement
                    </span>
                  )}
                  <span className="text-corsair-text-dim">
                    {commit.diff.note}
                  </span>
                </div>
              )}

              {/* FLAGSHIP signal indicator */}
              {commit.signal && (
                <div className="mt-2 flex items-center gap-2 rounded border border-corsair-crimson/20 bg-corsair-crimson/5 px-2 py-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-corsair-crimson animate-pulse" />
                  <span className="font-mono font-bold text-corsair-crimson">
                    {commit.signal.type}
                  </span>
                  <span className="text-corsair-text-dim">
                    {commit.signal.note}
                  </span>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
