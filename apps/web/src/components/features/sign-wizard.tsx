"use client";

import { useState, useCallback } from "react";
import {
  signViaAPI,
  type APISignRequest,
  type APISignResponse,
} from "@/lib/corsair-api";
import { PLAYGROUND_EXAMPLES } from "@/data/playground-examples";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type WizardStep = 1 | 2 | 3;
type SignState = "idle" | "signing" | "signed" | "error";

const FORMAT_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "generic", label: "Generic" },
  { value: "prowler", label: "Prowler" },
  { value: "securityhub", label: "SecurityHub" },
  { value: "inspec", label: "InSpec" },
  { value: "trivy", label: "Trivy" },
  { value: "gitlab", label: "GitLab SAST" },
  { value: "ciso-assistant-api", label: "CISO Assistant (API)" },
  { value: "ciso-assistant-export", label: "CISO Assistant (Export)" },
];

/** Persist and retrieve API key from localStorage */
function getStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("corsair-api-key") ?? "";
}

function storeApiKey(key: string): void {
  if (typeof window === "undefined") return;
  if (key) {
    localStorage.setItem("corsair-api-key", key);
  } else {
    localStorage.removeItem("corsair-api-key");
  }
}

/** Save signed CPOE to history in localStorage */
function addToHistory(result: APISignResponse): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("corsair-sign-history") ?? "[]";
    const history = JSON.parse(raw) as Array<{ marqueId: string; format: string; score: number; date: string; jwt: string }>;
    history.unshift({
      marqueId: result.marqueId,
      format: result.detectedFormat,
      score: result.summary.overallScore,
      date: new Date().toISOString(),
      jwt: result.cpoe.slice(0, 100) + "...",
    });
    // Keep last 20
    localStorage.setItem("corsair-sign-history", JSON.stringify(history.slice(0, 20)));
  } catch {
    // Ignore localStorage errors
  }
}

export function SignWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [signState, setSignState] = useState<SignState>("idle");

  // Step 1: Evidence
  const [evidenceJson, setEvidenceJson] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2: Options
  const [format, setFormat] = useState("");
  const [scope, setScope] = useState("");
  const [did, setDid] = useState("");
  const [expiryDays, setExpiryDays] = useState("90");
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());

  // Step 3: Result
  const [result, setResult] = useState<APISignResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoadExample = useCallback((exampleFormat: string) => {
    const example = PLAYGROUND_EXAMPLES.find((e) => e.format === exampleFormat);
    if (example) {
      setEvidenceJson(JSON.stringify(example.data, null, 2));
      setParseError(null);
    }
  }, []);

  const handleNextToStep2 = useCallback(() => {
    if (!evidenceJson.trim()) return;
    try {
      JSON.parse(evidenceJson);
      setParseError(null);
      setStep(2);
    } catch {
      setParseError("Invalid JSON — fix syntax errors before continuing.");
    }
  }, [evidenceJson]);

  const handleSign = useCallback(async () => {
    if (!evidenceJson.trim()) return;

    let parsedEvidence: unknown;
    try {
      parsedEvidence = JSON.parse(evidenceJson);
    } catch {
      setErrorMsg("Invalid JSON in evidence input.");
      setSignState("error");
      return;
    }

    storeApiKey(apiKey);
    setSignState("signing");
    setErrorMsg(null);

    const request: APISignRequest = {
      evidence: parsedEvidence,
      ...(format && { format }),
      ...(scope && { scope }),
      ...(did && { did }),
      ...(expiryDays && { expiryDays: parseInt(expiryDays, 10) }),
    };

    const apiResult = await signViaAPI(request, apiKey || undefined);

    if (apiResult.ok) {
      setResult(apiResult.data);
      addToHistory(apiResult.data);
      setSignState("signed");
      setStep(3);
    } else {
      setErrorMsg(apiResult.error.message);
      setSignState("error");
    }
  }, [evidenceJson, format, scope, did, expiryDays, apiKey]);

  const handleStartOver = useCallback(() => {
    setStep(1);
    setSignState("idle");
    setResult(null);
    setErrorMsg(null);
    setEvidenceJson("");
    setParseError(null);
  }, []);

  const handleDownloadJWT = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.cpoe], { type: "application/jwt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.marqueId}.jwt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => { if (s < step) setStep(s); }}
              disabled={s > step}
              className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors ${
                s === step
                  ? "bg-corsair-gold text-corsair-deep"
                  : s < step
                    ? "bg-corsair-green/20 text-corsair-green cursor-pointer hover:bg-corsair-green/30"
                    : "bg-corsair-surface text-muted-foreground"
              }`}
            >
              {s < step ? "\u2713" : s}
            </button>
            {s < 3 && (
              <div className={`h-px w-12 ${s < step ? "bg-corsair-green/40" : "bg-corsair-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {step === 1 ? "Upload Evidence" : step === 2 ? "Configure & Sign" : "Result"}
      </div>

      {/* Step 1: Upload Evidence */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Quick load examples */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Quick Load
            </label>
            <div className="flex flex-wrap gap-2">
              {PLAYGROUND_EXAMPLES.slice(0, 5).map((ex) => (
                <Button
                  key={ex.format}
                  variant="outline"
                  size="sm"
                  className="font-mono text-[10px]"
                  onClick={() => handleLoadExample(ex.format)}
                >
                  {ex.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Evidence JSON
            </label>
            <textarea
              value={evidenceJson}
              onChange={(e) => {
                setEvidenceJson(e.target.value);
                setParseError(null);
              }}
              placeholder="Paste your security tool output (JSON)..."
              className="h-64 w-full resize-y rounded-lg border border-input bg-card p-4 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
              spellCheck={false}
            />
            {parseError && (
              <p className="mt-1 text-xs text-corsair-crimson">{parseError}</p>
            )}
          </div>

          <Button
            onClick={handleNextToStep2}
            disabled={!evidenceJson.trim()}
            size="lg"
            className="w-full font-display font-semibold"
          >
            Next: Configure Signing
          </Button>
        </div>
      )}

      {/* Step 2: Configure & Sign */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="bg-corsair-surface">
            <CardContent className="space-y-4 p-4">
              {/* Format */}
              <div>
                <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-xs text-foreground"
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Leave as auto-detect unless the parser picks the wrong format.
                </p>
              </div>

              {/* Scope */}
              <div>
                <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">
                  Scope (optional)
                </label>
                <input
                  type="text"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="e.g., SOC 2 Type II - AWS Production"
                  className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40"
                />
              </div>

              {/* DID */}
              <div>
                <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">
                  Issuer DID (optional)
                </label>
                <input
                  type="text"
                  value={did}
                  onChange={(e) => setDid(e.target.value)}
                  placeholder="e.g., did:web:acme.com"
                  className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">
                  Expiry (days)
                </label>
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  min="1"
                  max="365"
                  className="w-32 rounded border border-input bg-card px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-corsair-border/50" />

          {/* API Key */}
          <div>
            <label className="mb-1 block font-mono text-xs uppercase text-muted-foreground">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Corsair API key..."
              className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Stored in your browser only. Never sent to third parties.
            </p>
          </div>

          {errorMsg && (
            <Card className="border-corsair-crimson/30 bg-corsair-crimson/5">
              <CardContent className="p-3">
                <span className="text-sm text-corsair-crimson">{errorMsg}</span>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep(1)}
              className="font-display font-semibold"
            >
              Back
            </Button>
            <Button
              onClick={handleSign}
              disabled={signState === "signing"}
              size="lg"
              className="flex-1 font-display font-semibold"
            >
              {signState === "signing" ? "Signing..." : "Sign Evidence"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <div className="space-y-4">
          <Card className="border-corsair-green/30 bg-corsair-green/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-corsair-green/20 text-lg text-corsair-green">
                  &#x2713;
                </div>
                <div>
                  <span className="font-display text-lg font-bold text-corsair-green">
                    CPOE SIGNED
                  </span>
                  <Badge variant="outline" className="ml-2 font-mono text-[10px] text-corsair-cyan border-corsair-cyan/40">
                    {result.detectedFormat}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <Card className="bg-corsair-surface">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      Overall Score
                    </span>
                    <span className="font-display text-2xl font-bold text-foreground">
                      {result.summary.overallScore}<span className="text-sm text-muted-foreground">/100</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-corsair-deep">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-corsair-cyan to-corsair-green"
                      style={{ width: `${result.summary.overallScore}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{result.summary.controlsPassed}/{result.summary.controlsTested} passed</span>
                    <span>{result.summary.controlsFailed} failed</span>
                  </div>
                </CardContent>
              </Card>

              {/* Metadata */}
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoField label="MARQUE ID" value={result.marqueId} />
                <InfoField label="Format" value={result.detectedFormat} />
                <InfoField label="Provenance" value={`${result.provenance.source}${result.provenance.sourceIdentity ? ` (${result.provenance.sourceIdentity})` : ""}`} />
                {result.expiresAt && <InfoField label="Expires" value={new Date(result.expiresAt).toLocaleDateString()} />}
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="p-3">
                    <span className="block font-mono text-xs uppercase text-yellow-400">Warnings</span>
                    {result.warnings.map((w, i) => (
                      <p key={i} className="mt-1 text-xs text-yellow-400/80">{w}</p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Extensions */}
              {result.extensions && Object.keys(result.extensions).length > 0 && (
                <Card className="bg-corsair-surface">
                  <CardContent className="p-4">
                    <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                      Extensions
                    </span>
                    <pre className="max-h-48 overflow-auto rounded-md bg-corsair-deep p-3 font-mono text-xs text-corsair-cyan/80">
                      {JSON.stringify(result.extensions, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              <Separator className="bg-corsair-border/50" />

              {/* JWT */}
              <div>
                <label className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                  Signed CPOE (JWT-VC)
                </label>
                <textarea
                  value={result.cpoe}
                  readOnly
                  className="h-32 w-full resize-none rounded-lg border border-corsair-border bg-[#0A0A0A] p-3 font-mono text-[10px] text-corsair-cyan break-all"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleDownloadJWT}
                  className="font-display font-semibold"
                >
                  Download JWT
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(result.cpoe);
                  }}
                  className="font-display font-semibold hover:border-corsair-gold hover:text-corsair-gold"
                >
                  Copy to Clipboard
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="font-display font-semibold hover:border-corsair-green hover:text-corsair-green"
                >
                  <a href="/verify">Verify at /verify</a>
                </Button>
              </div>

              <Separator className="bg-corsair-border/50" />

              <Button
                variant="outline"
                onClick={handleStartOver}
                className="w-full font-display font-semibold hover:border-corsair-gold hover:text-corsair-gold"
              >
                Sign Another
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block font-mono text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-all">{value}</span>
    </div>
  );
}
