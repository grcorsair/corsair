"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SCITTEntry {
  entryId: string;
  registrationTime: string;
  issuer: string;
  scope: string;
  assuranceLevel?: number;
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
}

interface SCITTEntryCardProps {
  entry: SCITTEntry;
}

const LEVEL_LABELS: Record<number, string> = {
  0: "L0 Documented",
  1: "L1 Configured",
  2: "L2 Demonstrated",
  3: "L3 Observed",
  4: "L4 Attested",
};

const LEVEL_COLORS: Record<number, string> = {
  0: "text-corsair-text-dim border-corsair-border",
  1: "text-corsair-cyan border-corsair-cyan/40",
  2: "text-corsair-green border-corsair-green/40",
  3: "text-corsair-gold border-corsair-gold/40",
  4: "text-corsair-gold border-corsair-gold/60",
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractDomain(issuer: string): string {
  return issuer.replace("did:web:", "").replace(/%3A/g, ":").split(":")[0];
}

export function SCITTEntryCard({ entry }: SCITTEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const domain = extractDomain(entry.issuer);
  const level = entry.assuranceLevel ?? 0;

  return (
    <Card
      className="cursor-pointer border-corsair-border bg-corsair-surface transition-colors hover:border-corsair-gold/30"
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        {/* Main row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Issuer domain badge */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-corsair-deep font-mono text-[10px] font-bold text-corsair-gold">
              {domain.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="block font-mono text-sm font-semibold text-corsair-text">
                {domain}
              </span>
              <span className="block text-xs text-corsair-text-dim">
                {entry.scope}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Assurance level */}
            <Badge
              variant="outline"
              className={`font-mono text-[10px] ${LEVEL_COLORS[level] ?? LEVEL_COLORS[0]}`}
            >
              {LEVEL_LABELS[level] ?? `L${level}`}
            </Badge>

            {/* Score */}
            {entry.summary && (
              <span className="font-mono text-sm font-bold text-corsair-gold">
                {entry.summary.overallScore}
              </span>
            )}

            {/* Time */}
            <span className="font-mono text-[10px] text-corsair-text-dim">
              {formatTimeAgo(entry.registrationTime)}
            </span>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-corsair-border pt-4">
            {/* Controls summary */}
            {entry.summary && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Tested", value: entry.summary.controlsTested },
                  { label: "Passed", value: entry.summary.controlsPassed, color: "text-corsair-green" },
                  { label: "Failed", value: entry.summary.controlsFailed, color: "text-corsair-crimson" },
                  { label: "Score", value: entry.summary.overallScore, color: "text-corsair-gold" },
                ].map((item) => (
                  <div key={item.label} className="rounded bg-corsair-deep p-2 text-center">
                    <span className="block font-mono text-[9px] uppercase text-corsair-text-dim">
                      {item.label}
                    </span>
                    <span className={`font-mono text-sm font-bold ${item.color ?? "text-corsair-text"}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-2 text-xs text-corsair-text-dim">
              <span className="font-mono">ID: {entry.entryId.slice(0, 12)}...</span>
              <span>|</span>
              <span>{new Date(entry.registrationTime).toLocaleString()}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={`/marque?entryId=${entry.entryId}`}>
                  Verify
                </a>
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={`/profile/${domain}`}>
                  View Profile
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
