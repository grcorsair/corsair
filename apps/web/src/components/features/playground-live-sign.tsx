"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SignState = "idle" | "signing" | "signed" | "error";

interface SignResult {
  jwt: string;
  marqueId: string;
  format: string;
  controlsTested: number;
  controlsPassed: number;
  controlsFailed: number;
  overallScore: number;
  provenance: string;
  issuedAt: string;
  expiresAt: string;
}

interface PlaygroundLiveSignProps {
  evidenceJson: string;
  className?: string;
}

export function PlaygroundLiveSign({
  evidenceJson,
  className,
}: PlaygroundLiveSignProps) {
  const [state, setState] = useState<SignState>("idle");
  const [result, setResult] = useState<SignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0);

  const steps = [
    { label: "Parse", desc: "Detecting format & extracting controls" },
    { label: "Provenance", desc: "Recording evidence source metadata" },
    { label: "Sign", desc: "Generating Ed25519 JWT-VC signature" },
    { label: "Done", desc: "CPOE ready" },
  ];

  const handleSign = useCallback(async () => {
    if (!evidenceJson.trim()) return;

    setState("signing");
    setError(null);
    setResult(null);

    try {
      // Animate through steps
      for (let i = 0; i < 3; i++) {
        setStep(i);
        await new Promise((r) => setTimeout(r, 600));
      }

      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: evidenceJson, dryRun: true }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Sign request failed" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setStep(3);
      setResult(data);
      setState("signed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
      setStep(0);
    }
  }, [evidenceJson]);

  const handleCopy = useCallback(async () => {
    if (!result?.jwt) return;
    await navigator.clipboard.writeText(result.jwt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className={className}>
      {/* Sign button */}
      <div className="mb-4 flex items-center gap-3">
        <Button
          onClick={handleSign}
          disabled={!evidenceJson.trim() || state === "signing"}
          className="font-display font-semibold"
        >
          {state === "signing" ? "Signing..." : "Sign as CPOE"}
        </Button>
        <span className="text-xs text-corsair-text-dim">
          Dry-run mode — preview the CPOE without persisting
        </span>
      </div>

      {/* Step animation */}
      {state === "signing" && (
        <div className="mb-4 flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono transition-all ${
                  i < step
                    ? "bg-corsair-green/20 text-corsair-green"
                    : i === step
                      ? "bg-corsair-gold/20 text-corsair-gold animate-pulse"
                      : "bg-corsair-surface text-corsair-text-dim"
                }`}
              >
                {i < step ? "\u2713" : i === step ? "\u25CF" : "\u25CB"}
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-1 h-px w-4 ${i < step ? "bg-corsair-green/40" : "bg-corsair-border"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-corsair-crimson/30 bg-corsair-crimson/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-corsair-crimson">&#x2717;</span>
              <span className="text-sm text-corsair-crimson">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signed result */}
      {result && state === "signed" && (
        <Card className="border-corsair-green/30 bg-corsair-green/5">
          <CardContent className="space-y-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-corsair-green/20 text-corsair-green text-sm">
                  &#x2713;
                </div>
                <span className="font-display font-bold text-corsair-green">
                  CPOE Signed
                </span>
                <Badge variant="outline" className="font-mono text-[10px] text-corsair-cyan border-corsair-cyan/40">
                  {result.format}
                </Badge>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] text-corsair-gold border-corsair-gold/30">
                dry-run
              </Badge>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Score", value: `${result.overallScore}/100`, color: "text-corsair-gold" },
                { label: "Passed", value: String(result.controlsPassed), color: "text-corsair-green" },
                { label: "Failed", value: String(result.controlsFailed), color: "text-corsair-crimson" },
                { label: "Provenance", value: result.provenance, color: "text-corsair-cyan" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-corsair-surface p-2">
                  <span className="block font-mono text-[10px] uppercase text-corsair-text-dim">
                    {item.label}
                  </span>
                  <span className={`font-mono text-sm font-bold ${item.color}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* JWT output */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs uppercase text-corsair-text-dim">
                  JWT-VC Output
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 font-mono text-[10px]"
                  onClick={handleCopy}
                >
                  {copied ? "Copied!" : "Copy JWT"}
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-corsair-border bg-[#0A0A0A] p-3">
                <code className="block max-h-24 overflow-y-auto break-all font-mono text-[11px] text-corsair-cyan/80">
                  {result.jwt}
                </code>
              </div>
            </div>

            {/* Next steps */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/marque?cpoe=${encodeURIComponent(result.jwt)}`}>
                  Verify this CPOE
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/sign">
                  Sign for real
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
