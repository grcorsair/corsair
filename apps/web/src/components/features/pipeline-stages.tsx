"use client";
import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ReconIcon,
  RaidIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
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
  return (
    <div className="flex flex-col gap-6">
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

    </div>
  );
}
