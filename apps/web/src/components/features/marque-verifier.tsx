"use client";

import { useState } from "react";
import {
  verifyMarqueInBrowser,
  SAMPLE_MARQUE,
  SAMPLE_NOTE,
  type MarqueVerificationResult,
} from "@/lib/marque-web-verifier";

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
    // Parse and display the sample directly
    const parsed = JSON.parse(SAMPLE_MARQUE);
    setResult({
      valid: true,
      reason: SAMPLE_NOTE,
      document: parsed.marque,
    });
  };

  return (
    <div className="space-y-6">
      {/* Input section */}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-corsair-text-dim">
            Marque JSON
          </label>
          <textarea
            value={marqueJson}
            onChange={(e) => {
              setMarqueJson(e.target.value);
              setIsSample(false);
              setResult(null);
            }}
            placeholder='Paste your Marque JSON document here...'
            className="h-48 w-full resize-none rounded-lg border border-corsair-border bg-corsair-surface p-4 font-mono text-sm text-corsair-text placeholder:text-corsair-text-dim/40 focus:border-corsair-cyan focus:outline-none focus:ring-1 focus:ring-corsair-cyan/30"
          />
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-corsair-text-dim">
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
            className="h-28 w-full resize-none rounded-lg border border-corsair-border bg-corsair-surface p-4 font-mono text-sm text-corsair-text placeholder:text-corsair-text-dim/40 focus:border-corsair-cyan focus:outline-none focus:ring-1 focus:ring-corsair-cyan/30"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleVerify}
            disabled={!marqueJson || !publicKey || isVerifying || isSample}
            className="rounded-lg bg-corsair-cyan px-6 py-3 font-display text-sm font-semibold text-corsair-deep transition-all hover:shadow-[0_0_20px_rgba(0,207,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isVerifying ? "Verifying..." : "Verify Marque"}
          </button>
          <button
            onClick={handleLoadSample}
            className="rounded-lg border border-corsair-border bg-corsair-surface px-6 py-3 font-display text-sm font-semibold text-corsair-text-dim transition-colors hover:border-corsair-gold hover:text-corsair-gold"
          >
            Try with Sample
          </button>
        </div>
      </div>

      {/* Result section */}
      {result && (
        <div
          className={`rounded-xl border p-6 ${
            result.valid
              ? "border-corsair-green/30 bg-corsair-green/5"
              : "border-corsair-crimson/30 bg-corsair-crimson/5"
          }`}
        >
          {/* Status badge */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                result.valid
                  ? "bg-corsair-green/20 text-corsair-green"
                  : "bg-corsair-crimson/20 text-corsair-crimson"
              }`}
            >
              {result.valid ? "✓" : "✗"}
            </div>
            <div>
              <div
                className={`font-display text-lg font-bold ${
                  result.valid ? "text-corsair-green" : "text-corsair-crimson"
                }`}
              >
                {result.valid ? "SIGNATURE VALID" : "VERIFICATION FAILED"}
              </div>
              <div className="text-sm text-corsair-text-dim">
                {result.reason}
              </div>
            </div>
          </div>

          {/* Document details */}
          {result.document && (
            <div className="space-y-6">
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
                  value={new Date(result.document.expiresAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              </div>

              {/* Score */}
              <div className="rounded-lg border border-corsair-border bg-corsair-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase text-corsair-text-dim">
                    Overall Score
                  </span>
                  <span className="font-display text-2xl font-bold text-corsair-text">
                    {result.document.summary.overallScore}
                    <span className="text-sm text-corsair-text-dim">/100</span>
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
                <div className="mt-2 flex justify-between text-xs text-corsair-text-dim">
                  <span>
                    {result.document.summary.controlsPassed}/
                    {result.document.summary.controlsTested} controls passed
                  </span>
                  <span>
                    {result.document.summary.controlsFailed} failed
                  </span>
                </div>
              </div>

              {/* Trust tier */}
              {result.document.quartermasterAttestation && (
                <div className="rounded-lg border border-corsair-border bg-corsair-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-corsair-text-dim">
                      Trust Tier
                    </span>
                    <span className="rounded-full bg-corsair-cyan/10 px-3 py-1 font-mono text-sm font-semibold text-corsair-cyan">
                      {result.document.quartermasterAttestation.trustTier} (
                      {result.document.quartermasterAttestation.confidenceScore}
                      %)
                    </span>
                  </div>
                </div>
              )}

              {/* Frameworks */}
              <div>
                <span className="mb-2 block font-mono text-xs uppercase text-corsair-text-dim">
                  Frameworks Covered
                </span>
                <div className="flex flex-wrap gap-2">
                  {result.document.scope.frameworksCovered.map((fw) => (
                    <span
                      key={fw}
                      className="rounded-md border border-corsair-border bg-corsair-surface px-3 py-1 font-mono text-xs text-corsair-text"
                    >
                      {fw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Evidence chain */}
              <div className="rounded-lg border border-corsair-border bg-corsair-surface p-4">
                <span className="mb-2 block font-mono text-xs uppercase text-corsair-text-dim">
                  Evidence Chain
                </span>
                <div className="font-mono text-xs text-corsair-text-dim">
                  <div>
                    Records: {result.document.evidenceChain.recordCount} |
                    Algorithm: {result.document.evidenceChain.algorithm}
                  </div>
                  <div className="mt-1 truncate text-corsair-cyan/60">
                    Root: {result.document.evidenceChain.hashChainRoot}
                  </div>
                </div>
              </div>

              {/* Findings */}
              {result.document.findings && result.document.findings.length > 0 && (
                <div>
                  <span className="mb-3 block font-mono text-xs uppercase text-corsair-text-dim">
                    Findings
                  </span>
                  <div className="space-y-2">
                    {result.document.findings.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-corsair-border bg-corsair-deep p-3"
                      >
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
                          <span className="text-sm text-corsair-text">
                            {f.criterion}
                          </span>
                          {f.severity && (
                            <span
                              className={`ml-2 rounded-full px-2 py-0.5 font-mono text-xs ${
                                f.severity === "CRITICAL"
                                  ? "bg-corsair-crimson/10 text-corsair-crimson"
                                  : "bg-corsair-gold/10 text-corsair-gold"
                              }`}
                            >
                              {f.severity}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block font-mono text-xs uppercase text-corsair-text-dim">
        {label}
      </span>
      <span className="text-sm text-corsair-text">{value}</span>
    </div>
  );
}
