"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";

const frameworks = [
  { name: "MITRE ATT&CK", source: "CTID" },
  { name: "NIST 800-53", source: "CTID" },
  { name: "NIST CSF", source: "SCF Crosswalk" },
  { name: "SOC 2", source: "CHART Engine" },
  { name: "ISO 27001", source: "CHART Engine" },
  { name: "CIS Controls", source: "CHART Engine" },
  { name: "PCI-DSS", source: "CHART Engine" },
  { name: "HIPAA", source: "SCF Crosswalk" },
  { name: "GDPR", source: "SCF Crosswalk" },
  { name: "CMMC", source: "SCF Crosswalk" },
  { name: "FedRAMP", source: "SCF Crosswalk" },
  { name: "SOX", source: "SCF Crosswalk" },
  { name: "COBIT", source: "SCF Crosswalk" },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export function FrameworkGrid() {
  return (
    <motion.div
      className="flex flex-wrap justify-center gap-3"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {frameworks.map((fw) => (
        <motion.div key={fw.name} variants={itemVariants}>
          <Badge
            variant="outline"
            className="pixel-card-hover cursor-default rounded-lg border-corsair-border bg-corsair-surface px-4 py-3 font-mono text-sm font-semibold text-corsair-text transition-all hover:border-corsair-gold hover:text-corsair-gold"
            style={{ "--glow-color": "rgba(212,168,83,0.12)" } as React.CSSProperties}
          >
            {fw.name}
          </Badge>
        </motion.div>
      ))}
    </motion.div>
  );
}
