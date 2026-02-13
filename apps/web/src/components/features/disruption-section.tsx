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

const layerVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
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
              &ldquo;Trust us, we&rsquo;re compliant.&rdquo;
            </h3>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-corsair-text-dim">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                SOC 2 PDFs emailed quarterly &mdash; machine-unreadable, stale on arrival
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                300-question SIG questionnaires, self-attested with no verification
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                Screenshots and spreadsheets as &ldquo;evidence&rdquo; &mdash; manual, fragile, unfalsifiable
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                Annual point-in-time audits that are outdated the day they ship
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-corsair-crimson">&#x2717;</span>
                Vendor trust assumed, never verified &mdash; checkbox theater that proves nothing
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
              &ldquo;Prove it. Cryptographically.&rdquo;
            </h3>
          </CardHeader>
          <CardContent>
            <motion.div
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {/* Layer 1 */}
              <motion.div variants={layerVariants}>
                <p className="mb-2 font-mono text-xs font-semibold text-corsair-gold">
                  Layer 1 &mdash; Cryptographic Proof
                </p>
                <ul className="space-y-2 text-sm text-corsair-text-dim">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair sign</code> &mdash; tools generate evidence, Corsair signs it into Ed25519 verifiable credentials
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair verify</code> &mdash; four-step DID:web verification, free forever, no account needed
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair log</code> &mdash; SCITT transparency log with Merkle proofs and COSE receipts
                    </span>
                  </li>
                </ul>
              </motion.div>

              {/* Layer 2 */}
              <motion.div variants={layerVariants}>
                <p className="mb-2 font-mono text-xs font-semibold text-corsair-turquoise">
                  Layer 2 &mdash; Evidence Intelligence
                </p>
                <ul className="space-y-2 text-sm text-corsair-text-dim">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair sign --score</code> &mdash; 7-dimension evidence quality scoring, a FICO score for compliance
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      Normalized evidence from 8+ tools into a canonical format &mdash; Prowler, InSpec, Trivy, SecurityHub, and more
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      Quartermaster governance review &mdash; methodology, integrity, completeness, and bias across every attestation
                    </span>
                  </li>
                </ul>
              </motion.div>

              {/* Layer 3 */}
              <motion.div variants={layerVariants}>
                <p className="mb-2 font-mono text-xs font-semibold text-corsair-green">
                  Layer 3 &mdash; Automated Decisions
                </p>
                <ul className="space-y-2 text-sm text-corsair-text-dim">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair cert</code> &mdash; continuous certification with lifecycle tracking, renewal, suspension, and revocation
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair tprm</code> &mdash; vendor risk assessment from signed scores &mdash; approve, conditional, or reject
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-corsair-green">&#x2713;</span>
                    <span>
                      <code className="text-corsair-cyan">corsair signal</code> &mdash; FLAGSHIP real-time notifications for drift, tier changes, and revocations
                    </span>
                  </li>
                </ul>
              </motion.div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
