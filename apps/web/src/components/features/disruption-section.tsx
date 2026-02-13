"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function DisruptionSection() {
  return (
    <motion.div
      className="grid gap-8 md:grid-cols-2"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {/* Old way */}
      <motion.div variants={itemVariants}>
        <Card className="h-full bg-corsair-surface">
          <CardHeader>
            <span className="w-fit font-pixel text-[7px] tracking-wider text-corsair-crimson">
              THE OLD WAY
            </span>
            <h3 className="mt-3 font-display text-xl font-bold text-corsair-text">
              &ldquo;Are you compliant?&rdquo;
            </h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-corsair-text-dim">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                300-question SIG questionnaires, self-attested
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                Screenshots of control panels as &ldquo;evidence&rdquo;
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                Annual audits that are stale immediately
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                Checkbox theater that proves nothing
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* Corsair way */}
      <motion.div variants={itemVariants}>
        <Card className="h-full border-corsair-gold/20 bg-gradient-to-br from-corsair-surface to-corsair-gold/[0.03]">
          <CardHeader>
            <span className="w-fit font-pixel text-[7px] tracking-wider text-corsair-green">
              THE CORSAIR WAY
            </span>
            <h3 className="mt-3 font-display text-xl font-bold text-corsair-text">
              &ldquo;Prove it works.&rdquo;
            </h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-corsair-text-dim">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                <code className="text-corsair-cyan">corsair sign</code> — your tools generate evidence, Corsair signs it into verifiable proof
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                <code className="text-corsair-cyan">corsair verify</code> — four-step Ed25519 verification, free forever, no account needed
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                <code className="text-corsair-cyan">corsair diff</code> — compare CPOEs over time, detect regressions like git diff detects code changes
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                <code className="text-corsair-cyan">corsair log</code> — append-only SCITT transparency log with Merkle proofs and COSE receipts
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                <code className="text-corsair-cyan">corsair signal</code> — real-time compliance change notifications via FLAGSHIP. Drift, tier changes, revocations — subscribers know instantly
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
