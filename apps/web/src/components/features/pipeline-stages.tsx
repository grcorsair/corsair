"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ReconIcon,
  RaidIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
  SpyglassIcon,
  PlunderIcon,
  MarkIcon,
} from "@/components/pixel-art/pixel-icons";

/* ─── Stage definitions ──────────────────────────────────── */

interface Stage {
  name: string;
  description: string;
  analogy: string;
  icon: React.ReactNode;
}

const primitives: Stage[] = [
  {
    name: "SIGN",
    description:
      "Parse tool output, record provenance, sign as a JWT-VC (Ed25519, did:web)",
    analogy: "like git commit",
    icon: <MarqueIcon size={36} />,
  },
  {
    name: "LOG",
    description:
      "Register in an append-only SCITT transparency log with COSE receipts",
    analogy: "like git log",
    icon: <ChartIcon size={36} />,
  },
  {
    name: "VERIFY",
    description:
      "Anyone verifies a CPOE using standard JWT libraries and DID:web — free, no account",
    analogy: "like git verify-commit",
    icon: <QuarterIcon size={36} />,
  },
  {
    name: "DIFF",
    description:
      "Compare CPOEs to detect compliance regressions over time",
    analogy: "like git diff",
    icon: <RaidIcon size={36} />,
  },
  {
    name: "SIGNAL",
    description:
      "Real-time compliance change notifications via FLAGSHIP (SSF/CAEP)",
    analogy: "like git webhooks",
    icon: <ReconIcon size={36} />,
  },
];

/* ─── Advanced features (L2-L3, collapsed by default) ───── */

interface AdvancedFeature {
  name: string;
  description: string;
  flag: string;
}

const advancedFeatures: AdvancedFeature[] = [
  {
    name: "Evidence Quality Score",
    description: "7-dimension evidence quality assessment — like FICO for compliance",
    flag: "--score",
  },
  {
    name: "Compliance Audit",
    description: "Multi-file audit with scoring and governance checks",
    flag: "corsair audit",
  },
  {
    name: "Continuous Certification",
    description: "Policy-based compliance monitoring with auto-renewal",
    flag: "corsair cert",
  },
  {
    name: "Vendor Risk (TPRM)",
    description: "Automated third-party assessment from signed CPOEs",
    flag: "corsair tprm",
  },
];

/* ─── Animation variants ─────────────────────────────────── */

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const stageVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

/* ─── Main component ─────────────────────────────────────── */

export function PipelineStages() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Core primitives */}
      <div
        className="rounded-xl border p-5 sm:p-6"
        style={{
          borderColor: "rgba(212,168,83,0.3)",
          backgroundColor: "rgba(212,168,83,0.04)",
        }}
      >
        <div className="mb-5 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Badge
            variant="outline"
            className="shrink-0 border-transparent font-pixel text-[8px] tracking-widest text-corsair-gold"
          >
            PROTOCOL
          </Badge>
          <span className="font-display text-sm font-semibold tracking-wide text-corsair-gold sm:text-base">
            Five Primitives
          </span>
          <span className="hidden text-xs text-corsair-text-dim sm:inline">
            Ed25519 signing, SCITT transparency, DID:web identity, SSF/CAEP signals
          </span>
        </div>

        <motion.div
          className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {primitives.map((stage) => (
            <motion.div
              key={stage.name}
              variants={stageVariants}
              className="group flex flex-col items-center text-center"
            >
              <Card
                className="pixel-card-hover mb-2 flex h-16 w-16 items-center justify-center bg-corsair-surface transition-all"
                style={
                  {
                    "--glow-color": "rgba(212,168,83,0.15)",
                  } as React.CSSProperties
                }
              >
                <CardContent className="p-0">{stage.icon}</CardContent>
              </Card>

              <Badge
                variant="outline"
                className="mb-1 border-transparent font-pixel text-[8px] tracking-wider text-corsair-gold"
              >
                {stage.name}
              </Badge>

              <span className="text-xs leading-snug text-corsair-text-dim">
                {stage.description}
              </span>

              <span className="mt-1 text-[10px] italic text-corsair-text-dim/50">
                {stage.analogy}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Advanced features toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-2 rounded-lg border border-corsair-border/50 px-4 py-2 text-xs text-corsair-text-dim transition-colors hover:border-corsair-gold/30 hover:text-corsair-gold"
        >
          <span>{showAdvanced ? "Hide" : "Show"} Advanced Features</span>
          <span className="text-[10px]">{showAdvanced ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Advanced features (collapsed) */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-corsair-border/30 bg-corsair-surface/50 p-5"
        >
          <p className="mb-4 text-center text-xs text-corsair-text-dim">
            Built on the five primitives. Available via CLI flags and dedicated commands.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {advancedFeatures.map((feature) => (
              <div
                key={feature.name}
                className="rounded-lg border border-corsair-border/20 p-3"
              >
                <p className="text-sm font-medium text-corsair-text">
                  {feature.name}
                </p>
                <p className="mt-1 text-xs text-corsair-text-dim">
                  {feature.description}
                </p>
                <code className="mt-2 block text-[10px] text-corsair-cyan">
                  {feature.flag}
                </code>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
