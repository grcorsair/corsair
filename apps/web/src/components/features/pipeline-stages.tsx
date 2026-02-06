"use client";

import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stages = [
  {
    name: "RECON",
    description: "Scout target configuration",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-cyan",
    glowColor: "rgba(0,207,255,0.2)",
  },
  {
    name: "SPYGLASS",
    description: "STRIDE threat modeling",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.2)",
  },
  {
    name: "MARK",
    description: "Drift detection",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.2)",
  },
  {
    name: "RAID",
    description: "Attack simulation",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-crimson",
    glowColor: "rgba(192,57,43,0.2)",
  },
  {
    name: "PLUNDER",
    description: "Evidence extraction",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-cyan",
    glowColor: "rgba(0,207,255,0.2)",
  },
  {
    name: "CHART",
    description: "Framework mapping",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-turquoise",
    glowColor: "rgba(127,219,202,0.2)",
  },
  {
    name: "QUARTER",
    description: "Governance review",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-gold",
    glowColor: "rgba(212,168,83,0.2)",
  },
  {
    name: "MARQUE",
    description: "Signed proof (Ed25519)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={1.5}>
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: "text-corsair-green",
    glowColor: "rgba(46,204,113,0.2)",
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
          <Card className="mb-3 flex h-14 w-14 items-center justify-center bg-corsair-surface transition-all group-hover:border-corsair-cyan group-hover:shadow-[0_0_15px_rgba(0,207,255,0.15)]">
            <CardContent className={`p-0 ${stage.color}`}>
              {stage.icon}
            </CardContent>
          </Card>

          <Badge
            variant="outline"
            className={`mb-1 border-transparent font-mono text-xs font-bold ${stage.color}`}
          >
            {stage.name}
          </Badge>

          <span className="text-center text-xs text-corsair-text-dim">
            {stage.description}
          </span>

          {/* Connector arrow (desktop only, not on last) */}
          {i < stages.length - 1 && (
            <span className="mt-2 hidden text-corsair-border lg:block">
              →
            </span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
