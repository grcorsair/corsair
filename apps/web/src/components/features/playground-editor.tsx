"use client";

import { useState, useCallback } from "react";
import { PLAYGROUND_EXAMPLES, type PlaygroundExample } from "@/data/playground-examples";
import { signDemoViaAPI, type APISignResponse } from "@/lib/corsair-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyIcon, CheckIcon } from "lucide-react";

type PlaygroundState = "idle" | "signing" | "signed" | "error";

function buildCliCommand(format?: string): string {
  if (!format || format === "generic") return "corsair sign --file evidence.json";
  return `corsair sign --file evidence.json --format ${format}`;
}

export function PlaygroundEditor() {
  const [inputJson, setInputJson] = useState("");
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null);
  const [state, setState] = useState<PlaygroundState>("idle");
  const [result, setResult] = useState<APISignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSelectExample = useCallback((example: PlaygroundExample) => {
    const json = JSON.stringify(example.data, null, 2);
    setInputJson(json);
    setSelectedExample(example);
    setState("idle");
    setResult(null);
    setError(null);
  }, []);

  const handleSignDemo = useCallback(async () => {
    if (!inputJson.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(inputJson);
    } catch {
      setError("Invalid JSON — could not parse input.");
      setState("error");
      setResult(null);
      return;
    }

    setState("signing");
    setError(null);
    setResult(null);

    const apiResult = await signDemoViaAPI({
      evidence: parsed,
      ...(selectedExample?.format ? { format: selectedExample.format } : {}),
    });

    if (apiResult.ok) {
      setResult(apiResult.data);
      setCopied(false);
      setState("signed");
    } else {
      const msg = apiResult.error.message.includes("Demo signing unavailable")
        ? "Demo signing is not configured on this server. Ask the admin to set CORSAIR_DEMO_PUBLIC_KEY and CORSAIR_DEMO_PRIVATE_KEY."
        : apiResult.error.message;
      setError(msg);
      setState("error");
      setResult(null);
    }
  }, [inputJson, selectedExample]);

  const handleClear = useCallback(() => {
    setInputJson("");
    setSelectedExample(null);
    setState("idle");
    setResult(null);
    setError(null);
    setCopied(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result?.cpoe) return;
    await navigator.clipboard.writeText(result.cpoe);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Format selector */}
      <div>
        <label className="mb-3 block font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Select Example Format
        </label>
        <div className="flex flex-wrap gap-2">
          {PLAYGROUND_EXAMPLES.map((example) => (
            <Button
              key={example.format}
              variant={selectedExample?.format === example.format ? "default" : "outline"}
              size="sm"
              className="font-mono text-xs"
              onClick={() => handleSelectExample(example)}
            >
              {example.name}
            </Button>
          ))}
        </div>
        {selectedExample && (
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedExample.description}
          </p>
        )}
      </div>

      <Separator className="bg-corsair-border/50" />

      {/* JSON Input */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Evidence JSON
          </label>
          {selectedExample && (
            <Badge variant="outline" className="font-mono text-[10px] text-corsair-gold border-corsair-gold/30">
              {selectedExample.format}
            </Badge>
          )}
        </div>
        <textarea
          value={inputJson}
          onChange={(e) => {
            setInputJson(e.target.value);
            if (state !== "idle") {
              setState("idle");
              setResult(null);
              setError(null);
            }
          }}
          placeholder='Paste your evidence JSON here, or select an example above...'
          className="h-64 w-full resize-y rounded-lg border border-input bg-card p-4 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          spellCheck={false}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSignDemo}
          disabled={!inputJson.trim() || state === "signing"}
          size="lg"
          className="font-display font-semibold"
        >
          {state === "signing" ? "Signing..." : "Sign Demo CPOE"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleClear}
          disabled={!inputJson}
          className="font-display font-semibold hover:border-corsair-gold hover:text-corsair-gold"
        >
          Clear
        </Button>
      </div>

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

      {/* Signed Result */}
      {result && state === "signed" && (
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
                <Badge variant="outline" className="ml-2 font-mono text-[10px] text-corsair-gold border-corsair-gold/30">
                  DEMO
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
                    Controls Summary
                  </span>
                  <span className="font-display text-2xl font-bold text-foreground">
                    {result.summary.overallScore}<span className="text-sm text-muted-foreground">/100</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-corsair-deep">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-corsair-cyan to-corsair-green transition-all"
                    style={{ width: `${result.summary.overallScore}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {result.summary.controlsPassed}/{result.summary.controlsTested} controls passed
                  </span>
                  <span>{result.summary.controlsFailed} failed</span>
                </div>
              </CardContent>
            </Card>

            {/* Provenance + Format */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="bg-corsair-surface">
                <CardContent className="p-4">
                  <span className="block font-mono text-xs uppercase text-muted-foreground">
                    Detected Format
                  </span>
                  <span className="text-sm font-semibold text-corsair-gold">{result.detectedFormat}</span>
                  <span className="block mt-1 text-xs text-muted-foreground">Auto-detected from evidence structure</span>
                </CardContent>
              </Card>
              <Card className="bg-corsair-surface">
                <CardContent className="p-4">
                  <span className="block font-mono text-xs uppercase text-muted-foreground">
                    Evidence Provenance
                  </span>
                  <span className="text-sm font-semibold text-corsair-cyan">
                    {result.provenance.sourceIdentity || result.provenance.source}
                  </span>
                  <span className="block mt-1 text-xs text-muted-foreground">Recorded in CPOE metadata</span>
                </CardContent>
              </Card>
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-corsair-gold/30 bg-corsair-gold/5 p-3 text-xs text-corsair-text-dim">
                {result.warnings.join(" ")}
              </div>
            )}

            <Separator className="bg-corsair-border/50" />

            {/* CLI Command */}
            <div>
              <span className="mb-2 block font-mono text-xs uppercase text-muted-foreground">
                Sign for real
              </span>
              <div className="overflow-hidden rounded-lg border border-corsair-border bg-[#0A0A0A]">
                <div className="flex items-center gap-2 border-b border-corsair-border px-3 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-corsair-gold/60" />
                  <span className="font-pixel text-[6px] tracking-wider text-corsair-gold">
                    TERMINAL
                  </span>
                </div>
                <div className="p-3">
                  <code className="font-mono text-xs text-corsair-cyan">
                    $ {buildCliCommand(result.detectedFormat)}
                  </code>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                This command signs the evidence and outputs a JWT-VC CPOE. Verify at{" "}
                <a href="/marque" className="text-corsair-gold hover:underline">
                  /marque
                </a>
                .
              </p>
            </div>

            {/* JWT Output */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  JWT-VC Output (demo)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 font-mono text-[10px]"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <CheckIcon className="h-3 w-3 text-corsair-green" />
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CopyIcon className="h-3 w-3" />
                      Copy JWT
                    </span>
                  )}
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-corsair-border bg-[#0A0A0A] p-3">
                <code className="block max-h-24 overflow-y-auto break-all font-mono text-[11px] text-corsair-cyan/80">
                  {result.cpoe}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
