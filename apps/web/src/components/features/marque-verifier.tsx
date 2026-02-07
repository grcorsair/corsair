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
    setResult({
      valid: true,
      reason: SAMPLE_NOTE,
      format: "v1",
      document: parsed.marque,
    });
  };

  return (
    <div className="space-y-6">
      {/* Input section */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Marque Document (JSON or JWT)
          </label>
          <textarea
            value={marqueJson}
            onChange={(e) => {
              setMarqueJson(e.target.value);
              setIsSample(false);
              setResult(null);
            }}
            placeholder='Paste your Marque JSON document or JWT-VC token here...'
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
            {isVerifying ? "Verifying..." : "Verify Marque"}
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
                <div className="flex items-center gap-2">
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
                      className={
                        result.format === "v2-jwt-vc"
                          ? "border-corsair-cyan/40 text-corsair-cyan"
                          : "border-corsair-gold/40 text-corsair-gold"
                      }
                    >
                      {result.format === "v2-jwt-vc" ? "v2 (JWT-VC)" : "v1 (Legacy)"}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {result.reason}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Document details */}
          {result.document && (
            <CardContent className="space-y-6">
              {/* VC Metadata (v2 only) */}
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
                          <span className="block mt-1 text-[10px] text-muted-foreground/60">
                            Resolve this DID via the issuer&apos;s .well-known/did.json endpoint
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Separator className="bg-corsair-border/50" />
                </>
              )}

              {/* Metadata grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoField label="Document ID" value={result.document.id} />
                <InfoField
                  label="Issuer"
                  value={`${result.document.issuer.name}${result.document.issuer.organization ? ` (${result.document.issuer.organization})` : ""}`}
                />
                <InfoField
                  label="Generated"
                  value={new Date(result.document.generatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <InfoField
                  label="Expires"
                  value={result.document.expiresAt
                    ? new Date(result.document.expiresAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "No expiry"
                  }
                />
              </div>

              <Separator className="bg-corsair-border/50" />

              {/* Score */}
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

              {/* Trust tier */}
              {result.document.quartermasterAttestation && (
                <Card className="bg-corsair-surface">
                  <CardContent className="flex items-center justify-between p-4">
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      Trust Tier
                    </span>
                    <Badge className="bg-corsair-cyan/10 text-corsair-cyan hover:bg-corsair-cyan/20">
                      {result.document.quartermasterAttestation.trustTier} (
                      {result.document.quartermasterAttestation.confidenceScore}
                      %)
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Frameworks */}
              <div>
                <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                  Frameworks Covered
                </span>
                <div className="flex flex-wrap gap-2">
                  {result.document.scope.frameworksCovered.map((fw) => (
                    <Badge
                      key={fw}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {fw}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Evidence chain */}
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

              {/* Findings */}
              {result.document.findings && result.document.findings.length > 0 && (
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
