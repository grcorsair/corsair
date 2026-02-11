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

const stages = [
  {
    name: "INGEST",
    description: "Extract compliance data from SOC 2 reports, pentest results, and audit documents using Claude AI",
    icon: <ReconIcon size={40} />,
    color: "text-corsair-cyan",
    glowColor: "rgba(0,207,255,0.15)",
  },
  {
    name: "CLASSIFY",
    description: "Assign L0–L4 assurance levels to every control based on evidence type, source, and methodology",
    icon: <RaidIcon size={40} />,
    color: "text-corsair-green",
    glowColor: "rgba(46,204,113,0.15)",
  },
  {
    name: "CHART",
    description: "Automatically map extracted controls to 13+ compliance frameworks via CTID/SCF crosswalk",
    icon: <ChartIcon size={40} />,
    color: "text-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.15)",
  },
  {
    name: "QUARTER",
    description: "AI governance review evaluates evidence quality, methodology, and completeness",
    icon: <QuarterIcon size={40} />,
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
  },
  {
    name: "MARQUE",
    description: "Sign as JWT-VC (Ed25519, did:web) — a cryptographically verifiable CPOE",
    icon: <MarqueIcon size={40} />,
    color: "text-corsair-crimson",
    glowColor: "rgba(192,57,43,0.15)",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export function PipelineStages() {
  return (
    <motion.div
      className="grid grid-cols-2 gap-6 sm:grid-cols-5"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {stages.map((stage, i) => (
        <motion.div
          key={stage.name}
          variants={itemVariants}
          className="group flex flex-col items-center"
        >
          <Card
            className="pixel-card-hover mb-3 flex h-20 w-20 items-center justify-center bg-corsair-surface transition-all"
            style={{ "--glow-color": stage.glowColor } as React.CSSProperties}
          >
            <CardContent className="p-0">
              {stage.icon}
            </CardContent>
          </Card>

          <Badge
            variant="outline"
            className={`mb-1 border-transparent font-pixel text-[9px] tracking-wider ${stage.color}`}
          >
            {stage.name}
          </Badge>

          <span className="text-center text-sm text-corsair-text-dim">
            {stage.description}
          </span>

          {/* Connector arrow (desktop only, not on last) */}
          {i < stages.length - 1 && (
            <span className="mt-2 hidden font-pixel text-[8px] text-corsair-border sm:block">
              &gt;
            </span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
