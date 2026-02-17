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
  RaidIcon,
  ChartIcon,
  SpyglassIcon,
} from "@/components/pixel-art/pixel-icons";

const props = [
  {
    title: "Sign (like git commit)",
    description:
      "corsair sign — record provenance and sign as a JWT-VC with Ed25519. Your tools already have the data. Corsair records where it came from and signs it into a CPOE anyone can verify.",
    accent: "border-t-corsair-crimson",
    glowColor: "rgba(192,57,43,0.15)",
    icon: <MarqueIcon size={36} />,
    label: "SIGN",
    labelColor: "text-corsair-crimson",
  },
  {
    title: "Verify (like HTTPS)",
    description:
      "corsair verify — four steps with any JWT library. Decode the JWT, resolve the issuer's DID:web, extract the public key, verify the Ed25519 signature. Free forever. No account needed.",
    accent: "border-t-corsair-gold",
    glowColor: "rgba(212,168,83,0.15)",
    icon: <QuarterIcon size={36} />,
    label: "VERIFY",
    labelColor: "text-corsair-gold",
  },
  {
    title: "Diff (like git diff)",
    description:
      "corsair diff — compare two CPOEs to detect regressions, improvements, and scope changes over time. Track compliance history the way you track code history. Evidence fingerprinting catches drift.",
    accent: "border-t-corsair-green",
    glowColor: "rgba(46,204,113,0.15)",
    icon: <RaidIcon size={36} />,
    label: "DIFF",
    labelColor: "text-corsair-green",
  },
  {
    title: "Log (like git log)",
    description:
      "corsair log — every CPOE registered in an append-only SCITT transparency log. Tamper-evident. Merkle-proofed. COSE receipts. Anyone can audit the full history of every attestation ever issued.",
    accent: "border-t-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.15)",
    icon: <ChartIcon size={36} />,
    label: "LOG",
    labelColor: "text-corsair-turquoise",
  },
  {
    title: "Signal (like git webhooks)",
    description:
      "corsair signal generate — real-time compliance change notifications via FLAGSHIP. Drift detected, tier changed, credential revoked — subscribers know instantly via SSF/CAEP signed events.",
    accent: "border-t-corsair-cyan",
    glowColor: "rgba(0,207,255,0.15)",
    icon: <SpyglassIcon size={36} />,
    label: "SIGNAL",
    labelColor: "text-corsair-cyan",
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
      className="flex flex-wrap justify-center gap-6"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {props.map((prop) => (
        <motion.div key={prop.title} variants={itemVariants} className="w-full md:w-[calc(33.333%-1rem)]">
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
