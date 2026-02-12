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
  MarqueIcon,
  QuarterIcon,
  SpyglassIcon,
} from "@/components/pixel-art/pixel-icons";

const props = [
  {
    title: "One Command, Signed Proof",
    description:
      "corsair sign — Ed25519 JWT-VC, one command, any evidence source. Prowler scans, InSpec profiles, Trivy reports, SecurityHub exports. Your tools already have the data. MARQUE signs it into a CPOE.",
    accent: "border-t-corsair-crimson",
    glowColor: "rgba(192,57,43,0.15)",
    icon: <MarqueIcon size={36} />,
    label: "MARQUE",
    labelColor: "text-corsair-crimson",
  },
  {
    title: "Governance Gate, Not a Checkbox",
    description:
      "QUARTERMASTER evaluates evidence quality across seven dimensions — methodology, integrity, completeness, bias, and more. Deterministic checks plus AI review before any credential is signed.",
    accent: "border-t-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
    icon: <QuarterIcon size={36} />,
    label: "QUARTER",
    labelColor: "text-corsair-gold",
  },
  {
    title: "Real-Time Compliance Signals",
    description:
      "FLAGSHIP streams compliance state changes via SSF/CAEP — drift detected, assurance tier changed, CPOE revoked. Continuous proof that controls are operating, not just a point-in-time snapshot.",
    accent: "border-t-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.15)",
    icon: <SpyglassIcon size={36} />,
    label: "FLAGSHIP",
    labelColor: "text-corsair-turquoise",
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
