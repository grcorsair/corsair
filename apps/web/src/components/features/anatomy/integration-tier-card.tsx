"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import type { IntegrationTier } from "@/data/anatomy-data";

const tierBorderColors: Record<number, string> = {
  1: "border-corsair-gold/30",
  2: "border-corsair-turquoise/30",
  3: "border-corsair-green/30",
};

const tierAccentColors: Record<number, string> = {
  1: "text-corsair-gold",
  2: "text-corsair-turquoise",
  3: "text-corsair-green",
};

const tierBadgeColors: Record<number, string> = {
  1: "bg-corsair-gold/20 text-corsair-gold",
  2: "bg-corsair-turquoise/20 text-corsair-turquoise",
  3: "bg-corsair-green/20 text-corsair-green",
};

export function IntegrationTierCard({ tier }: { tier: IntegrationTier }) {
  const borderColor = tierBorderColors[tier.tier];
  const accentColor = tierAccentColors[tier.tier];
  const badgeColor = tierBadgeColors[tier.tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className={`rounded-xl border ${borderColor} bg-corsair-surface p-6`}
    >
      {/* Pirate subtitle */}
      <p className={`mb-3 font-pixel text-[8px] tracking-widest ${accentColor}/60`}>
        THE {tier.pirateName} — {tier.subtitle.toUpperCase()}
      </p>

      {/* Description */}
      <p className="mb-6 max-w-2xl text-sm text-corsair-text-dim">
        {tier.description}
      </p>

      {/* Sources grid */}
      <div className="mb-6">
        <p className="mb-3 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          SOURCES
        </p>
        <div className="flex flex-wrap gap-2">
          {tier.sources.map((source) => (
            <Badge
              key={source}
              variant="outline"
              className="border-corsair-border text-[10px] text-corsair-text-dim"
            >
              {source}
            </Badge>
          ))}
        </div>
      </div>

      {/* Evidence type + Provenance */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">
            EVIDENCE TYPE
          </p>
          <p className="mt-1 text-sm text-corsair-text">
            {tier.evidenceType}
          </p>
        </div>
        <div>
          <p className="font-pixel text-[7px] tracking-wider text-corsair-text-dim">
            PROVENANCE
          </p>
          <Badge
            className={`mt-1 border-transparent font-pixel text-[9px] ${badgeColor}`}
          >
            {tier.provenanceType}
          </Badge>
        </div>
      </div>

      {/* CLI example */}
      <div>
        <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
          {tier.cliLabel.toUpperCase()}
        </p>
        <div className="overflow-x-auto rounded-lg border border-corsair-border bg-[#0A0A0A] px-4 py-3">
          <code className={`font-mono text-[12px] sm:text-[13px] ${accentColor}`}>
            $ {tier.cliExample}
          </code>
        </div>
      </div>
    </motion.div>
  );
}
