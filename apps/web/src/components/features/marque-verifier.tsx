"use client";

import { useState } from "react";
import {
  verifyMarqueInBrowser,
  SAMPLE_MARQUE,
  SAMPLE_NOTE,
  type MarqueVerificationResult,
} from "@/lib/marque-web-verifier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/** Generate a plain-language summary from verification result */
function generatePlainLanguageSummary(result: MarqueVerificationResult): string {
  if (!result.valid) {
    return `This CPOE failed verification: ${result.reason}`;
  }

  const parts: string[] = [];

  // Who issued it and when
  const issuer = result.vcMetadata?.signedBy ?? result.provenance?.sourceIdentity ?? "Unknown";
  const issued = result.vcMetadata?.generatedAt
    ? new Date(result.vcMetadata.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "an unknown date";
  parts.push(`This CPOE was issued by ${issuer} on ${issued}.`);

  // What it covers
  if (result.scope) {
    parts.push(`It covers ${result.scope}.`);
  }

  // Controls and pass rate
  if (result.summary) {
    parts.push(
      `${result.summary.controlsTested} controls were tested with a ${result.summary.overallScore}% pass rate.`
    );
  }

  // Assurance level
  if (result.assuranceName !== undefined) {
    parts.push(`Assurance level: L${result.assuranceLevel} (${result.assuranceName}).`);
  }

  // Provenance
  if (result.provenance) {
    const sourceLabel = result.provenance.source === "auditor"
      ? "auditor-produced"
      : result.provenance.source === "tool"
        ? "tool-generated"
        : "self-assessed";
    parts.push(`Evidence: ${sourceLabel}.`);
  }

  return parts.join(" ");
}

/** Assurance level color mapping */
const ASSURANCE_COLORS: Record<number, string> = {
  0: "border-yellow-500/40 text-yellow-400",
  1: "border-corsair-cyan/40 text-corsair-cyan",
  2: "border-corsair-green/40 text-corsair-green",
  3: "border-blue-400/40 text-blue-400",
  4: "border-purple-400/40 text-purple-400",
};

/** Issuer tier display config */
const TIER_CONFIG = {
  "corsair-verified": { label: "Corsair Verified", color: "text-corsair-green", bg: "bg-corsair-green/10" },
  "self-signed": { label: "Self-Signed", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  "unverifiable": { label: "Unverifiable Issuer", color: "text-muted-foreground", bg: "bg-muted/30" },
  "invalid": { label: "Invalid", color: "text-corsair-crimson", bg: "bg-corsair-crimson/10" },
} as const;

export function MarqueVerifier() {
  const [marqueJson, setMarqueJson] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [result, setResult] = useState<MarqueVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSample, setIsSample] = useState(false);

  const handleVerify = async () => {
    setIsVerifying(true);
    setResult(null);
    try {
      const res = await verifyMarqueInBrowser(marqueJson, publicKey);
      setResult(res);
    } catch {
      setResult({ valid: false, reason: "Unexpected error during verification" });
    }
    setIsVerifying(false);
  };

  const handleLoadSample = () => {
    setMarqueJson(SAMPLE_MARQUE);
    setPublicKey("(demo mode — no key needed)");
    setIsSample(true);
    const parsed = JSON.parse(SAMPLE_MARQUE);
    const marque = parsed.marque;
    setResult({
      valid: true,
      reason: SAMPLE_NOTE,
      format: "json",
      issuerTier: "self-signed",
      assuranceLevel: marque.assurance?.declared ?? 0,
      assuranceName: marque.assurance?.declared !== undefined
        ? ["Documented", "Configured", "Demonstrated", "Observed", "Attested"][marque.assurance.declared]
        : undefined,
      assurance: marque.assurance,
      provenance: marque.provenance,
      scope: marque.scope,
      summary: marque.summary,
      document: marque,
    });
  };

  return (
    <div className="space-y-6">
      {/* Input section */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CPOE Document (JWT-VC or JSON)
          </label>
          <textarea
            value={marqueJson}
            onChange={(e) => {
              setMarqueJson(e.target.value);
              setIsSample(false);
              setResult(null);
            }}
            placeholder='Paste your CPOE (JWT-VC token or JSON document) here...'
            className="h-48 w-full resize-none rounded-lg border border-input bg-card p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Public Key (PEM)
          </label>
          <textarea
            value={publicKey}
            onChange={(e) => {
              setPublicKey(e.target.value);
              setIsSample(false);
              setResult(null);
            }}
            placeholder="-----BEGIN PUBLIC KEY-----&#10;MCowBQYDK2VwAyEA...&#10;-----END PUBLIC KEY-----"
            className="h-28 w-full resize-none rounded-lg border border-input bg-card p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleVerify}
            disabled={!marqueJson || !publicKey || isVerifying || isSample}
            size="lg"
            className="font-display font-semibold"
          >
            {isVerifying ? "Verifying..." : "Verify CPOE"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleLoadSample}
            className="font-display font-semibold hover:border-corsair-gold hover:text-corsair-gold"
          >
            Try with Sample
          </Button>
        </div>
      </div>

      {/* Result section */}
      {result && (
        <Card
          className={
            result.valid
              ? "border-corsair-green/30 bg-corsair-green/5"
              : "border-corsair-crimson/30 bg-corsair-crimson/5"
          }
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                  result.valid
                    ? "bg-corsair-green/20 text-corsair-green"
                    : "bg-corsair-crimson/20 text-corsair-crimson"
                }`}
              >
                {result.valid ? "✓" : "✗"}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-display text-lg font-bold ${
                      result.valid ? "text-corsair-green" : "text-corsair-crimson"
                    }`}
                  >
                    {result.valid ? "SIGNATURE VALID" : "VERIFICATION FAILED"}
                  </span>
                  {result.format && (
                    <Badge
                      variant="outline"
                      className="border-corsair-cyan/40 text-corsair-cyan"
                    >
                      {result.format === "jwt" ? "JWT-VC" : "JSON"}
                    </Badge>
                  )}
                  {/* Assurance level badge */}
                  {result.assuranceLevel !== undefined && (
                    <Badge
                      variant="outline"
                      className={ASSURANCE_COLORS[result.assuranceLevel] ?? "text-muted-foreground"}
                    >
                      L{result.assuranceLevel} {result.assuranceName}
                    </Badge>
                  )}
                  {/* Issuer tier badge */}
                  {result.issuerTier && (
                    <Badge
                      variant="outline"
                      className={`${TIER_CONFIG[result.issuerTier]?.color ?? "text-muted-foreground"}`}
                    >
                      {TIER_CONFIG[result.issuerTier]?.label ?? result.issuerTier}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {result.reason}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Plain-language summary */}
          {result.valid && (
            <CardContent className="pt-0 pb-0">
              <div className="rounded-lg bg-corsair-surface p-4 text-sm text-muted-foreground leading-relaxed">
                {generatePlainLanguageSummary(result)}
              </div>
            </CardContent>
          )}

          {/* Details section */}
          {(result.summary || result.assurance || result.provenance || result.document) && (
            <CardContent className="space-y-6">
              {/* VC Metadata */}
              {result.vcMetadata && (
                <>
                  <Card className="bg-corsair-surface">
                    <CardContent className="space-y-3 p-4">
                      <span className="block font-mono text-xs uppercase text-muted-foreground">
                        Verifiable Credential Details
                      </span>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className="block text-xs text-muted-foreground">@context</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.vcMetadata.context.map((ctx) => (
                              <Badge key={ctx} variant="outline" className="font-mono text-[10px]">
                                {ctx.replace("https://", "")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs text-muted-foreground">Credential Type</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.vcMetadata.credentialType.map((t) => (
                              <Badge key={t} variant="outline" className="font-mono text-[10px]">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      {result.vcMetadata.issuerDID && (
                        <div>
                          <span className="block text-xs text-muted-foreground">Issuer DID</span>
                          <span className="block mt-1 truncate font-mono text-xs text-corsair-cyan">
                            {result.vcMetadata.issuerDID}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Separator className="bg-corsair-border/50" />
                </>
              )}

              {/* Scope */}
              {result.scope && (
                <InfoField label="Scope" value={result.scope} />
              )}

              {/* Metadata grid */}
              {result.vcMetadata && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {result.vcMetadata.signedBy && (
                    <InfoField label="Signed By" value={result.vcMetadata.signedBy} />
                  )}
                  {result.vcMetadata.generatedAt && (
                    <InfoField
                      label="Issued"
                      value={new Date(result.vcMetadata.generatedAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    />
                  )}
                  {result.vcMetadata.expiresAt && (
                    <InfoField
                      label="Expires"
                      value={new Date(result.vcMetadata.expiresAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    />
                  )}
                </div>
              )}

              {/* Legacy document metadata (JSON format) */}
              {!result.vcMetadata && result.document && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoField label="Document ID" value={result.document.id} />
                  <InfoField
                    label="Issuer"
                    value={`${result.document.issuer.name}${result.document.issuer.organization ? ` (${result.document.issuer.organization})` : ""}`}
                  />
                  <InfoField
                    label="Generated"
                    value={new Date(result.document.generatedAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  />
                  <InfoField
                    label="Expires"
                    value={result.document.expiresAt
                      ? new Date(result.document.expiresAt).toLocaleDateString("en-US", {
                          year: "numeric", month: "long", day: "numeric",
                        })
                      : "No expiry"
                    }
                  />
                </div>
              )}

              <Separator className="bg-corsair-border/50" />

              {/* Assurance Level Detail */}
              {result.assurance && (
                <Card className="bg-corsair-surface">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-muted-foreground">
                        Assurance Level
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-sm font-bold ${ASSURANCE_COLORS[result.assurance.declared] ?? ""}`}
                        >
                          L{result.assurance.declared} {result.assuranceName}
                        </Badge>
                        {result.assurance.verified && (
                          <span className="text-xs text-corsair-green">Verified</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Method: <span className="text-foreground">{result.assurance.method.replace(/-/g, " ")}</span>
                    </div>
                    {/* Breakdown bars */}
                    {Object.keys(result.assurance.breakdown).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Control Breakdown</span>
                        <div className="flex gap-1">
                          {Object.entries(result.assurance.breakdown)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([level, count]) => (
                              <div
                                key={level}
                                className="flex items-center gap-1 rounded bg-corsair-deep px-2 py-1"
                              >
                                <span className={`text-xs font-bold ${ASSURANCE_COLORS[Number(level)]?.split(" ")[1] ?? "text-muted-foreground"}`}>
                                  L{level}
                                </span>
                                <span className="text-xs text-muted-foreground">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    {/* Excluded controls */}
                    {result.assurance.excluded && result.assurance.excluded.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Excluded Controls</span>
                        {result.assurance.excluded.map((exc) => (
                          <div key={exc.controlId} className="text-xs text-muted-foreground">
                            <span className="font-mono text-yellow-400">{exc.controlId}</span>: {exc.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Provenance */}
              {result.provenance && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                      Evidence Provenance
                    </span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <span className="block text-xs text-muted-foreground">Source</span>
                        <Badge
                          variant="outline"
                          className={
                            result.provenance.source === "auditor"
                              ? "border-corsair-green/40 text-corsair-green"
                              : result.provenance.source === "tool"
                                ? "border-corsair-cyan/40 text-corsair-cyan"
                                : "border-yellow-500/40 text-yellow-400"
                          }
                        >
                          {result.provenance.source}
                        </Badge>
                      </div>
                      {result.provenance.sourceIdentity && (
                        <div>
                          <span className="block text-xs text-muted-foreground">Identity</span>
                          <span className="text-sm text-foreground">{result.provenance.sourceIdentity}</span>
                        </div>
                      )}
                      {result.provenance.sourceDate && (
                        <div>
                          <span className="block text-xs text-muted-foreground">Assessment Date</span>
                          <span className="text-sm text-foreground">{result.provenance.sourceDate}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Score */}
              {result.summary && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-muted-foreground">
                        Overall Score
                      </span>
                      <span className="font-display text-2xl font-bold text-foreground">
                        {result.summary.overallScore}
                        <span className="text-sm text-muted-foreground">/100</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-corsair-deep">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-corsair-cyan to-corsair-green transition-all"
                        style={{
                          width: `${result.summary.overallScore}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {result.summary.controlsPassed}/
                        {result.summary.controlsTested} controls passed
                      </span>
                      <span>
                        {result.summary.controlsFailed} failed
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Legacy score display (fallback for old JSON format with no top-level summary) */}
              {!result.summary && result.document?.summary && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-muted-foreground">
                        Overall Score
                      </span>
                      <span className="font-display text-2xl font-bold text-foreground">
                        {result.document.summary.overallScore}
                        <span className="text-sm text-muted-foreground">/100</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-corsair-deep">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-corsair-cyan to-corsair-green transition-all"
                        style={{
                          width: `${result.document.summary.overallScore}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {result.document.summary.controlsPassed}/
                        {result.document.summary.controlsTested} controls passed
                      </span>
                      <span>
                        {result.document.summary.controlsFailed} failed
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 7-Dimension Assurance Profile */}
              {result.dimensions && (
                <Card className="bg-corsair-surface">
                  <CardContent className="space-y-3 p-4">
                    <span className="block font-mono text-xs uppercase text-muted-foreground">
                      Assurance Dimensions (FAIR-CAM + GRADE + COSO)
                    </span>
                    {(["capability", "coverage", "reliability", "methodology", "freshness", "independence", "consistency"] as const).map((dim) => {
                      const value = result.dimensions![dim];
                      const labels: Record<string, string> = {
                        capability: "Capability",
                        coverage: "Coverage",
                        reliability: "Reliability",
                        methodology: "Methodology",
                        freshness: "Freshness",
                        independence: "Independence",
                        consistency: "Consistency",
                      };
                      const sources: Record<string, string> = {
                        capability: "FAIR-CAM",
                        coverage: "FAIR-CAM + COBIT",
                        reliability: "COSO",
                        methodology: "GRADE + NIST 53A",
                        freshness: "ISO 27004",
                        independence: "Three Lines Model",
                        consistency: "GRADE + IEC 62443",
                      };
                      return (
                        <div key={dim} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground">{labels[dim]}</span>
                            <span className="text-xs text-muted-foreground">{sources[dim]} — {value}/100</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-corsair-deep">
                            <div
                              className={`h-full rounded-full transition-all ${
                                value >= 75 ? "bg-corsair-green" :
                                value >= 50 ? "bg-corsair-cyan" :
                                value >= 25 ? "bg-yellow-400" :
                                "bg-corsair-crimson"
                              }`}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Evidence Types */}
              {result.evidenceTypes && result.evidenceTypes.length > 0 && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                      Evidence Types (ISO 19011)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.evidenceTypes.map((type) => {
                        const typeColors: Record<string, string> = {
                          "automated-observation": "border-corsair-green/40 text-corsair-green",
                          "system-generated-record": "border-corsair-cyan/40 text-corsair-cyan",
                          "reperformance": "border-blue-400/40 text-blue-400",
                          "documented-record": "border-yellow-500/40 text-yellow-400",
                          "interview": "border-orange-400/40 text-orange-400",
                          "self-attestation": "border-corsair-crimson/40 text-corsair-crimson",
                        };
                        return (
                          <Badge
                            key={type}
                            variant="outline"
                            className={typeColors[type] ?? "text-muted-foreground"}
                          >
                            {type.replace(/-/g, " ")}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observation Period */}
              {result.observationPeriod && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                      Observation Period (COSO)
                    </span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <span className="block text-xs text-muted-foreground">Period</span>
                        <span className="text-sm text-foreground">
                          {result.observationPeriod.startDate} — {result.observationPeriod.endDate}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Classification</span>
                        <Badge
                          variant="outline"
                          className={
                            result.observationPeriod.cosoClassification === "operating"
                              ? "border-corsair-green/40 text-corsair-green"
                              : "border-yellow-500/40 text-yellow-400"
                          }
                        >
                          {result.observationPeriod.cosoClassification === "operating" ? "Operating Effectiveness" : "Design Only"}
                        </Badge>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">SOC 2 Equivalent</span>
                        <span className="text-sm text-foreground">{result.observationPeriod.soc2Equivalent}</span>
                      </div>
                    </div>
                    {!result.observationPeriod.sufficient && (
                      <div className="mt-2 text-xs text-yellow-400">
                        Period of {result.observationPeriod.durationDays} days is below the 90-day minimum for L2+ assurance.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Risk Quantification */}
              {result.riskQuantification && (
                <Card className="bg-corsair-surface">
                  <CardContent className="space-y-3 p-4">
                    <span className="block font-mono text-xs uppercase text-muted-foreground">
                      Risk Quantification (CRQ)
                    </span>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <span className="block text-xs text-muted-foreground">BetaPERT Shape</span>
                        <span className="text-sm text-foreground">
                          {"\u03B3"}={result.riskQuantification.betaPert.shapeParameter} ({result.riskQuantification.betaPert.confidenceWidth.replace(/-/g, " ")})
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">FAIR-CAM Resistance</span>
                        <span className="text-sm text-foreground">
                          {result.riskQuantification.fairMapping.resistanceStrength.replace(/-/g, " ")}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Provenance Modifier</span>
                        <span className="text-sm text-foreground">
                          {result.riskQuantification.provenanceModifier}x
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Freshness Decay</span>
                        <span className="text-sm text-foreground">
                          {Math.round(result.riskQuantification.freshnessDecay * 100)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Framework Results Tabs */}
              {result.frameworks && Object.keys(result.frameworks).length > 0 && (
                <FrameworkTabs frameworks={result.frameworks} />
              )}

              {/* Trust tier */}
              {result.document?.quartermasterAttestation && (
                <Card className="bg-corsair-surface">
                  <CardContent className="flex items-center justify-between p-4">
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      Quartermaster Review
                    </span>
                    <Badge className="bg-corsair-cyan/10 text-corsair-cyan hover:bg-corsair-cyan/20">
                      {result.document.quartermasterAttestation.trustTier} (
                      {result.document.quartermasterAttestation.confidenceScore}
                      %)
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Evidence chain */}
              {result.document?.evidenceChain && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                      Evidence Chain
                    </span>
                    <div className="font-mono text-xs text-muted-foreground">
                      <div>
                        Records: {result.document.evidenceChain.recordCount} |
                        Algorithm: {result.document.evidenceChain.algorithm}
                      </div>
                      <div className="mt-1 truncate text-corsair-cyan/60">
                        Root: {result.document.evidenceChain.hashChainRoot}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Findings */}
              {result.document?.findings && result.document.findings.length > 0 && (
                <div>
                  <span className="mb-3 block font-mono text-xs uppercase text-muted-foreground">
                    Findings
                  </span>
                  <div className="space-y-2">
                    {result.document.findings.map((f, i) => (
                      <Card key={i} className="bg-corsair-deep">
                        <CardContent className="flex items-start gap-3 p-3">
                          <span
                            className={`mt-0.5 text-sm ${
                              f.status === "SATISFIED"
                                ? "text-corsair-green"
                                : "text-corsair-crimson"
                            }`}
                          >
                            {f.status === "SATISFIED" ? "✓" : "✗"}
                          </span>
                          <div className="flex-1">
                            <span className="text-sm text-foreground">
                              {f.criterion}
                            </span>
                            {f.severity && (
                              <Badge
                                variant={f.severity === "CRITICAL" ? "destructive" : "secondary"}
                                className="ml-2 text-xs"
                              >
                                {f.severity}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {/* Technical Details Drawer */}
              {(result.ruleTrace || result.calculationVersion) && (
                <TechnicalDrawer
                  ruleTrace={result.ruleTrace}
                  calculationVersion={result.calculationVersion}
                  parleyVersion={result.vcMetadata?.parleyVersion}
                  issuerDID={result.vcMetadata?.issuerDID}
                />
              )}

              {/* Download as JSON */}
              {result.valid && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs hover:border-corsair-gold hover:text-corsair-gold"
                    onClick={() => {
                      const exportData = {
                        verification: {
                          valid: result.valid,
                          issuerTier: result.issuerTier,
                          format: result.format,
                        },
                        assurance: result.assurance,
                        provenance: result.provenance,
                        summary: result.summary,
                        scope: result.scope,
                        dimensions: result.dimensions,
                        evidenceTypes: result.evidenceTypes,
                        observationPeriod: result.observationPeriod,
                        riskQuantification: result.riskQuantification,
                        vcMetadata: result.vcMetadata,
                      };
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "cpoe-verification.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download as JSON
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block font-mono text-xs uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Framework filter tabs — shows per-framework control results */
function FrameworkTabs({ frameworks }: {
  frameworks: Record<string, {
    controlsMapped: number;
    passed: number;
    failed: number;
    controls: Array<{ controlId: string; status: string }>;
  }>;
}) {
  const [activeTab, setActiveTab] = useState(Object.keys(frameworks)[0] ?? "");
  const fw = frameworks[activeTab];

  return (
    <Card className="bg-corsair-surface">
      <CardContent className="space-y-3 p-4">
        <span className="block font-mono text-xs uppercase text-muted-foreground">
          Framework Results
        </span>
        {/* Tab buttons */}
        <div className="flex flex-wrap gap-1">
          {Object.keys(frameworks).map((name) => (
            <Button
              key={name}
              variant={activeTab === name ? "default" : "outline"}
              size="sm"
              className="font-mono text-xs"
              onClick={() => setActiveTab(name)}
            >
              {name}
              <Badge variant="outline" className="ml-1 text-[10px]">
                {frameworks[name].passed}/{frameworks[name].controlsMapped}
              </Badge>
            </Button>
          ))}
        </div>
        {/* Active framework controls */}
        {fw && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{fw.controlsMapped} mapped</span>
              <span className="text-corsair-green">{fw.passed} passed</span>
              <span className="text-corsair-crimson">{fw.failed} failed</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {fw.controls.map((ctrl) => (
                <div
                  key={ctrl.controlId}
                  className="flex items-center gap-2 rounded bg-corsair-deep px-2 py-1"
                >
                  <span className={`text-xs ${
                    ctrl.status === "passed" ? "text-corsair-green" :
                    ctrl.status === "failed" ? "text-corsair-crimson" :
                    "text-muted-foreground"
                  }`}>
                    {ctrl.status === "passed" ? "P" : ctrl.status === "failed" ? "F" : "-"}
                  </span>
                  <span className="font-mono text-xs text-foreground">{ctrl.controlId}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Technical details drawer — collapsible section for audit/debug info */
function TechnicalDrawer({ ruleTrace, calculationVersion, parleyVersion, issuerDID }: {
  ruleTrace?: string[];
  calculationVersion?: string;
  parleyVersion?: string;
  issuerDID?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="bg-corsair-surface">
      <CardContent className="p-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-mono text-xs uppercase text-muted-foreground">
            Technical Details
          </span>
          <span className="text-xs text-muted-foreground">
            {isOpen ? "Hide" : "Show"}
          </span>
        </button>
        {isOpen && (
          <div className="mt-3 space-y-3">
            {calculationVersion && (
              <div>
                <span className="block text-xs text-muted-foreground">Calculation Version</span>
                <span className="font-mono text-xs text-foreground">{calculationVersion}</span>
              </div>
            )}
            {parleyVersion && (
              <div>
                <span className="block text-xs text-muted-foreground">Parley Version</span>
                <span className="font-mono text-xs text-foreground">{parleyVersion}</span>
              </div>
            )}
            {issuerDID && (
              <div>
                <span className="block text-xs text-muted-foreground">Issuer DID</span>
                <span className="font-mono text-xs text-corsair-cyan break-all">{issuerDID}</span>
              </div>
            )}
            {ruleTrace && ruleTrace.length > 0 && (
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Rule Trace</span>
                <div className="rounded bg-corsair-deep p-2 font-mono text-[11px] text-muted-foreground space-y-0.5 max-h-48 overflow-y-auto">
                  {ruleTrace.map((entry, i) => (
                    <div key={i} className={entry.startsWith("SAFEGUARD:") ? "text-yellow-400" : ""}>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
