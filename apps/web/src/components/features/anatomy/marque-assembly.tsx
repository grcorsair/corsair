"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarqueIcon } from "@/components/pixel-art/pixel-icons";
import Link from "next/link";

const jwtHeader = `{
  "alg": "EdDSA",
  "typ": "vc+jwt",
  "kid": "did:web:grcorsair.com#key-1"
}`;

const jwtPayloadPreview = `{
  "iss": "did:web:grcorsair.com",
  "vc": {
    "type": ["VerifiableCredential", "CorsairCPOE"],
    "credentialSubject": {
      "scope": "AWS Infrastructure — Prowler Scan",
      "provenance": { "source": "tool", "sourceIdentity": "Prowler v3.1" },
      "summary": {
        "controlsTested": 10,
        "controlsPassed": 8,
        "overallScore": 80
      }
    }
  }
}`;

const signature = "Ed25519...a7f3c9b2d1e8f4a6b0c5d7e9f1a3b5c7d9e1f3...";

export function MarqueAssembly() {
  return (
    <div>
      {/* JWT segments */}
      <div className="mb-8 space-y-3">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
        >
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
            <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
              HEADER
            </span>
          </div>
          <pre className="p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
            {jwtHeader}
          </pre>
        </motion.div>

        {/* Payload */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
        >
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
            <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
              PAYLOAD
            </span>
          </div>
          <pre className="p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
            {jwtPayloadPreview}
          </pre>
        </motion.div>

        {/* Signature */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
        >
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-corsair-green/60" />
            <span className="font-pixel text-[7px] tracking-wider text-corsair-green">
              SIGNATURE
            </span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
            >
              <MarqueIcon size={32} />
            </motion.div>
            <div>
              <p className="font-mono text-[11px] text-corsair-green">
                Ed25519 signature verified
              </p>
              <p className="font-mono text-[10px] text-corsair-text-dim">
                {signature}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Final CPOE summary card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="rounded-xl border-2 border-corsair-gold/30 bg-corsair-surface p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MarqueIcon size={40} />
            <div>
              <p className="font-display text-xl font-bold text-corsair-text">
                CPOE Issued
              </p>
              <p className="text-sm text-corsair-text-dim">
                AWS Infrastructure — Prowler Scan
              </p>
            </div>
          </div>
          <Badge className="bg-corsair-green/20 text-corsair-green border-transparent font-pixel text-[9px]">
            tool — Prowler v3.1
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-pixel text-[7px] text-corsair-text-dim tracking-wider">SIGNED BY</p>
            <p className="mt-1 font-mono text-xs text-corsair-gold">did:web:grcorsair.com</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-corsair-text-dim tracking-wider">CONTROLS</p>
            <p className="mt-1 text-sm text-corsair-text">10 tested, 8 passed</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-corsair-text-dim tracking-wider">SCORE</p>
            <p className="mt-1 text-sm text-corsair-green">80%</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-corsair-text-dim tracking-wider">FRAMEWORKS</p>
            <p className="mt-1 text-sm text-corsair-text">SOC 2, NIST 800-53</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-corsair-border pt-4">
          <Button size="sm" className="font-display font-semibold" asChild>
            <Link href="/verify">
              Verify this CPOE
              <span className="ml-1">&rarr;</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-corsair-gold/30 font-display font-semibold text-corsair-text-dim hover:border-corsair-gold hover:text-corsair-gold"
            asChild
          >
            <Link href="/protocol">
              Explore the Protocol
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
