"use client";

import { motion } from "motion/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ReconIcon,
  QuarterIcon,
  MarqueIcon,
} from "@/components/pixel-art/pixel-icons";

const props = [
  {
    title: "Ingest Existing Evidence",
    description:
      "INGEST extracts compliance data from SOC 2 reports, pentest results, and audit documents. CHART maps controls to 12+ frameworks automatically. No new data collection required.",
    accent: "border-t-corsair-cyan",
    glowColor: "rgba(0,207,255,0.15)",
    icon: <ReconIcon size={36} />,
    label: "INGEST",
    labelColor: "text-corsair-cyan",
  },
  {
    title: "AI-Powered Evidence Review",
    description:
      "QUARTERMASTER evaluates evidence quality, methodology rigor, and completeness before any credential is signed. Not a checkbox — a governance gate with deterministic and LLM verification.",
    accent: "border-t-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
    icon: <QuarterIcon size={36} />,
    label: "QUARTER",
    labelColor: "text-corsair-gold",
  },
  {
    title: "Cryptographic Proof Anyone Can Verify",
    description:
      "MARQUE generates Ed25519-signed W3C Verifiable Credentials (JWT-VC). Anyone with a public key can verify a CPOE — no vendor lock-in, no trust assumptions. Open. Verifiable. Interoperable.",
    accent: "border-t-corsair-crimson",
    glowColor: "rgba(192,57,43,0.15)",
    icon: <MarqueIcon size={36} />,
    label: "MARQUE",
    labelColor: "text-corsair-crimson",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function ValueProps() {
  return (
    <motion.div
      className="grid gap-6 md:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {props.map((prop) => (
        <motion.div key={prop.title} variants={itemVariants}>
          <Card
            className={`pixel-card-hover h-full border-t-2 ${prop.accent} bg-corsair-surface transition-all`}
            style={{ "--glow-color": prop.glowColor } as React.CSSProperties}
          >
            <CardHeader>
              <div className="mb-3">{prop.icon}</div>
              <span className={`font-pixel text-[7px] tracking-wider ${prop.labelColor}`}>
                {prop.label}
              </span>
              <CardTitle className="font-display text-xl text-corsair-text">
                {prop.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-relaxed text-corsair-text-dim">
                {prop.description}
              </CardDescription>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
