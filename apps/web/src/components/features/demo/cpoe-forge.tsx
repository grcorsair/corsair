"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { MarqueIcon } from "@/components/pixel-art/pixel-icons";

const jwtHeader = `{
  "alg": "EdDSA",
  "typ": "vc+jwt",
  "kid": "did:web:grcorsair.com#key-1"
}`;

const jwtPayload = `{
  "iss": "did:web:grcorsair.com",
  "sub": "marque-a1b2c3d4-e5f6-7890",
  "iat": 1739059200,
  "exp": 1739664000,
  "parley": "2.0",
  "vc": {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    "type": ["VerifiableCredential", "CorsairCPOE"],
    "credentialSubject": {
      "scope": "SOC 2 Type II — Acme Corp",
      "assurance": {
        "declared": 0,
        "verified": true,
        "method": "self-assessed",
        "breakdown": { "0": 6, "1": 73, "2": 3 }
      },
      "summary": {
        "controlsTested": 82,
        "controlsPassed": 76,
        "overallScore": 94
      }
    }
  }
}`;

const signatureHex = "Ed25519...a7f3c9b2d1e8f4a6b0c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7";

const segments = [
  {
    label: "HEADER",
    labelColor: "#D4A853",
    dotColor: "bg-corsair-gold/60",
    code: jwtHeader,
    description: "Algorithm (Ed25519) + key reference (DID URL)",
  },
  {
    label: "PAYLOAD",
    labelColor: "#D4A853",
    dotColor: "bg-corsair-gold/60",
    code: jwtPayload,
    description: "W3C VC with CPOE claims — scope, assurance, controls, score",
  },
  {
    label: "SIGNATURE",
    labelColor: "#2ECC71",
    dotColor: "bg-corsair-green/60",
    code: null,
    description: "Ed25519 signature over header + payload",
  },
];

export function CPOEForge() {
  return (
    <div className="space-y-6">
      {/* JWT segments */}
      <div className="space-y-3">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.label}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
          >
            {/* Segment header */}
            <div className="flex items-center justify-between border-b border-corsair-border px-4 py-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${seg.dotColor}`} />
                <span
                  className="font-pixel text-[7px] tracking-wider"
                  style={{ color: seg.labelColor }}
                >
                  {seg.label}
                </span>
              </div>
              <span className="text-[10px] text-corsair-text-dim/50">
                {seg.description}
              </span>
            </div>

            {/* Content */}
            {seg.code ? (
              <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
                {seg.code}
              </pre>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
                >
                  <MarqueIcon size={28} />
                </motion.div>
                <div>
                  <p className="font-mono text-[11px] text-corsair-green">
                    Ed25519 signature verified
                  </p>
                  <p className="font-mono text-[10px] text-corsair-text-dim/60">
                    {signatureHex}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Assembled token preview */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-4"
      >
        <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          ASSEMBLED JWT-VC
        </p>
        <div className="overflow-x-auto rounded-lg bg-corsair-surface p-3">
          <p className="font-mono text-[10px] leading-relaxed">
            <span className="text-corsair-gold">eyJhbGciOiJFZERTQSIs...</span>
            <span className="text-corsair-text-dim">.</span>
            <span className="text-corsair-turquoise">eyJpc3MiOiJkaWQ6d2Vi...</span>
            <span className="text-corsair-text-dim">.</span>
            <span className="text-corsair-green">a7f3c9b2d1e8f4a6b0c5...</span>
          </p>
        </div>
        <p className="mt-2 text-[10px] text-corsair-text-dim/60">
          Three base64url-encoded segments: <span className="text-corsair-gold">header</span>.
          <span className="text-corsair-turquoise">payload</span>.
          <span className="text-corsair-green">signature</span>
        </p>
      </motion.div>

      {/* Final CPOE issued card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="rounded-xl border-2 border-corsair-gold/30 bg-corsair-surface p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6, type: "spring" }}
            >
              <MarqueIcon size={36} />
            </motion.div>
            <div>
              <p className="font-display text-lg font-bold text-corsair-text">
                CPOE Issued
              </p>
              <p className="text-sm text-corsair-text-dim">
                Acme Corp SOC 2 Type II
              </p>
            </div>
          </div>
          <Badge className="border-transparent bg-corsair-text-dim/20 font-pixel text-[9px] text-corsair-text-dim">
            L0 — Documented
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">SIGNED BY</p>
            <p className="mt-1 font-mono text-xs text-corsair-gold">did:web:grcorsair.com</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">CONTROLS</p>
            <p className="mt-1 text-sm text-corsair-text">82 tested, 76 passed</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">SCORE</p>
            <p className="mt-1 text-sm text-corsair-green">94%</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">FRAMEWORKS</p>
            <p className="mt-1 text-sm text-corsair-text">7 mapped</p>
          </div>
        </div>

        {/* Verification hint */}
        <div className="mt-4 border-t border-corsair-border pt-4">
          <p className="text-xs text-corsair-text-dim">
            Anyone can verify this CPOE. Resolve{" "}
            <code className="text-corsair-gold">did:web:grcorsair.com</code>
            {" "}→ fetch public key → verify Ed25519 signature. No account needed.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
