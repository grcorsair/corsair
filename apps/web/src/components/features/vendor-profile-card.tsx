"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SCITTProvenance {
  source: "self" | "tool" | "auditor" | "unknown";
  sourceIdentity?: string;
}

export interface ProvenanceSummary {
  self: number;
  tool: number;
  auditor: number;
}

export interface VendorProfile {
  issuerDID: string;
  totalCPOEs: number;
  frameworks: string[];
  averageScore: number;
  provenanceSummary?: ProvenanceSummary;
  lastCPOEDate: string;
  history: Array<{
    entryId: string;
    registrationTime: string;
    scope: string;
    score: number;
    provenance?: SCITTProvenance;
  }>;
}

interface VendorProfileCardProps {
  profile: VendorProfile;
  compact?: boolean;
  className?: string;
}

const PROVENANCE_LABELS: Record<string, string> = {
  tool: "Tool-Signed",
  auditor: "Auditor-Attested",
  self: "Self-Reported",
  unknown: "Unknown",
};

const PROVENANCE_COLORS: Record<string, string> = {
  tool: "text-corsair-green border-corsair-green/40",
  auditor: "text-corsair-gold border-corsair-gold/40",
  self: "text-corsair-cyan border-corsair-cyan/40",
  unknown: "text-corsair-text-dim border-corsair-border",
};

function extractDomain(did: string): string {
  return did.replace("did:web:", "").replace(/%3A/g, ":").split(":")[0];
}

function getDominantProvenance(summary?: ProvenanceSummary): string {
  if (!summary) return "unknown";
  const entries = Object.entries(summary).filter(([, count]) => count > 0);
  if (entries.length === 0) return "unknown";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function VendorProfileCard({
  profile,
  compact = false,
  className,
}: VendorProfileCardProps) {
  const domain = extractDomain(profile.issuerDID);
  const dominantProvenance = getDominantProvenance(profile.provenanceSummary);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 rounded-lg bg-corsair-surface p-3 ${className ?? ""}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-corsair-deep font-mono text-xs font-bold text-corsair-gold">
          {domain.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <span className="block font-mono text-sm font-semibold text-corsair-text">
            {domain}
          </span>
          <span className="block font-mono text-[10px] text-corsair-text-dim">
            {profile.totalCPOEs} CPOEs | Score: {Math.round(profile.averageScore)}
          </span>
        </div>
        <Badge
          variant="outline"
          className={`font-mono text-[10px] ${PROVENANCE_COLORS[dominantProvenance] ?? PROVENANCE_COLORS.unknown}`}
        >
          {PROVENANCE_LABELS[dominantProvenance] ?? "Unknown"}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={`border-corsair-border bg-corsair-surface ${className ?? ""}`}>
      <CardContent className="space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-corsair-deep font-mono text-lg font-bold text-corsair-gold">
              {domain.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-corsair-text">
                {domain}
              </h2>
              <span className="font-mono text-xs text-corsair-text-dim">
                {profile.issuerDID}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`font-mono text-xs ${PROVENANCE_COLORS[dominantProvenance] ?? PROVENANCE_COLORS.unknown}`}
          >
            {PROVENANCE_LABELS[dominantProvenance] ?? "Unknown"}
          </Badge>
        </div>

        {/* Provenance distribution */}
        {profile.provenanceSummary && (
          <div className="flex gap-2">
            {Object.entries(profile.provenanceSummary)
              .filter(([, count]) => count > 0)
              .map(([source, count]) => (
                <div key={source} className="flex items-center gap-1 rounded bg-corsair-deep px-2 py-1">
                  <span className={`font-mono text-[9px] ${PROVENANCE_COLORS[source]?.split(" ")[0] ?? "text-corsair-text-dim"}`}>
                    {PROVENANCE_LABELS[source] ?? source}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-corsair-text">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total CPOEs", value: String(profile.totalCPOEs), color: "text-corsair-gold" },
            { label: "Avg Score", value: String(Math.round(profile.averageScore)), color: "text-corsair-green" },
            { label: "Frameworks", value: String(profile.frameworks.length), color: "text-corsair-cyan" },
            { label: "Last CPOE", value: new Date(profile.lastCPOEDate).toLocaleDateString(), color: "text-corsair-text" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-corsair-deep p-3 text-center">
              <span className="block font-mono text-[9px] uppercase text-corsair-text-dim">
                {stat.label}
              </span>
              <span className={`font-mono text-lg font-bold ${stat.color}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Frameworks */}
        {profile.frameworks.length > 0 && (
          <div>
            <span className="mb-2 block font-mono text-[10px] uppercase text-corsair-text-dim">
              Frameworks Covered
            </span>
            <div className="flex flex-wrap gap-1">
              {profile.frameworks.map((fw) => (
                <Badge
                  key={fw}
                  variant="outline"
                  className="font-mono text-[10px] text-corsair-cyan border-corsair-cyan/30"
                >
                  {fw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* CPOE History */}
        {profile.history.length > 0 && (
          <div>
            <span className="mb-2 block font-mono text-[10px] uppercase text-corsair-text-dim">
              Recent CPOEs
            </span>
            <div className="space-y-1">
              {profile.history.slice(0, 5).map((h) => (
                <div
                  key={h.entryId}
                  className="flex items-center justify-between rounded bg-corsair-deep px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[9px] ${PROVENANCE_COLORS[h.provenance?.source ?? "unknown"] ?? PROVENANCE_COLORS.unknown}`}
                    >
                      {PROVENANCE_LABELS[h.provenance?.source ?? "unknown"] ?? "Unknown"}
                    </Badge>
                    <span className="text-xs text-corsair-text-dim">{h.scope}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-corsair-gold">
                      {h.score}
                    </span>
                    <span className="font-mono text-[10px] text-corsair-text-dim/60">
                      {new Date(h.registrationTime).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/log?issuer=${domain}`}>
              View All CPOEs
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/badge/did/${domain}.svg`} target="_blank" rel="noopener noreferrer">
              Badge
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
