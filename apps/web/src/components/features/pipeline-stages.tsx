"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ReconIcon,
  SpyglassIcon,
  MarkIcon,
  RaidIcon,
  PlunderIcon,
  ChartIcon,
  QuarterIcon,
  MarqueIcon,
} from "@/components/pixel-art/pixel-icons";

const stages = [
  {
    name: "RECON",
    description: "Scout target configuration",
    icon: <ReconIcon size={40} />,
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
  },
  {
    name: "SPYGLASS",
    description: "STRIDE threat modeling",
    icon: <SpyglassIcon size={40} />,
    color: "text-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.15)",
  },
  {
    name: "MARK",
    description: "Drift detection",
    icon: <MarkIcon size={40} />,
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
  },
  {
    name: "RAID",
    description: "Attack simulation",
    icon: <RaidIcon size={40} />,
    color: "text-corsair-cyan",
    glowColor: "rgba(0,207,255,0.15)",
  },
  {
    name: "PLUNDER",
    description: "Evidence extraction",
    icon: <PlunderIcon size={40} />,
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
  },
  {
    name: "CHART",
    description: "Framework mapping",
    icon: <ChartIcon size={40} />,
    color: "text-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.15)",
  },
  {
    name: "QUARTER",
    description: "Governance review",
    icon: <QuarterIcon size={40} />,
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
  },
  {
    name: "MARQUE",
    description: "Verifiable Credential (JWT-VC)",
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
      className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8"
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
            <span className="mt-2 hidden font-pixel text-[8px] text-corsair-border lg:block">
              &gt;
            </span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
