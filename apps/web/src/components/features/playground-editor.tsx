"use client";

import { useState, useCallback } from "react";
import { PLAYGROUND_EXAMPLES, type PlaygroundExample } from "@/data/playground-examples";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type PlaygroundState = "idle" | "previewing" | "error";

interface PreviewResult {
  format: string;
  controlCount: number;
  passCount: number;
  failCount: number;
  score: number;
  provenance: string;
  cliCommand: string;
}

/** Parse evidence JSON and extract a preview of what the CPOE would contain */
function previewEvidence(raw: string): PreviewResult | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON — could not parse input." };
  }

  // Detect format and extract controls
  if (Array.isArray(parsed)) {
    // Prowler array
    const first = parsed[0] as Record<string, unknown> | undefined;
    if (first && "StatusCode" in first) {
      const pass = parsed.filter((f: Record<string, unknown>) => f.StatusCode === "PASS").length;
      const fail = parsed.length - pass;
      return {
        format: "prowler",
        controlCount: parsed.length,
        passCount: pass,
        failCount: fail,
        score: Math.round((pass / parsed.length) * 100),
        provenance: "tool (Prowler)",
        cliCommand: `corsair sign --file findings.json --format prowler`,
      };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // SecurityHub
    if ("Findings" in obj && Array.isArray(obj.Findings)) {
      const findings = obj.Findings as Array<{ Compliance?: { Status?: string } }>;
      const pass = findings.filter((f) => f.Compliance?.Status === "PASSED").length;
      return {
        format: "securityhub",
        controlCount: findings.length,
        passCount: pass,
        failCount: findings.length - pass,
        score: Math.round((pass / findings.length) * 100),
        provenance: "tool (SecurityHub)",
        cliCommand: `corsair sign --file findings.json --format securityhub`,
      };
    }

    // InSpec
    if ("profiles" in obj && Array.isArray(obj.profiles)) {
      const profiles = obj.profiles as Array<{ controls?: Array<{ results?: Array<{ status?: string }> }> }>;
      let total = 0, pass = 0;
      for (const p of profiles) {
        for (const c of p.controls ?? []) {
          total++;
          const allPassed = (c.results ?? []).every((r) => r.status === "passed");
          if (allPassed) pass++;
        }
      }
      return {
        format: "inspec",
        controlCount: total,
        passCount: pass,
        failCount: total - pass,
        score: total > 0 ? Math.round((pass / total) * 100) : 0,
        provenance: "tool (InSpec)",
        cliCommand: `corsair sign --file report.json --format inspec`,
      };
    }

    // Trivy
    if ("Results" in obj && Array.isArray(obj.Results)) {
      const results = obj.Results as Array<{ Vulnerabilities?: Array<{ Severity?: string }> }>;
      let total = 0, crit = 0;
      for (const r of results) {
        for (const v of r.Vulnerabilities ?? []) {
          total++;
          if (v.Severity === "CRITICAL" || v.Severity === "HIGH") crit++;
        }
      }
      return {
        format: "trivy",
        controlCount: total,
        passCount: total - crit,
        failCount: crit,
        score: total > 0 ? Math.round(((total - crit) / total) * 100) : 100,
        provenance: "tool (Trivy)",
        cliCommand: `corsair sign --file trivy.json --format trivy`,
      };
    }

    // GitLab SAST
    if ("vulnerabilities" in obj && Array.isArray(obj.vulnerabilities)) {
      const vulns = obj.vulnerabilities as Array<{ severity?: string }>;
      const crit = vulns.filter((v) => v.severity === "Critical" || v.severity === "High").length;
      return {
        format: "gitlab",
        controlCount: vulns.length,
        passCount: vulns.length - crit,
        failCount: crit,
        score: vulns.length > 0 ? Math.round(((vulns.length - crit) / vulns.length) * 100) : 100,
        provenance: "tool (GitLab SAST)",
        cliCommand: `corsair sign --file gl-sast.json --format gitlab`,
      };
    }

    // CISO Assistant Export
    if ("requirement_assessments" in obj && Array.isArray(obj.requirement_assessments)) {
      const assessments = obj.requirement_assessments as Array<{ result?: string }>;
      const pass = assessments.filter((a) => a.result === "compliant").length;
      return {
        format: "ciso-assistant-export",
        controlCount: assessments.length,
        passCount: pass,
        failCount: assessments.length - pass,
        score: Math.round((pass / assessments.length) * 100),
        provenance: "tool (CISO Assistant)",
        cliCommand: `corsair sign --file export.json --format ciso-assistant-export`,
      };
    }

    // CISO Assistant API
    if ("results" in obj && Array.isArray(obj.results)) {
      const results = obj.results as Array<{ result?: string }>;
      const pass = results.filter((r) => r.result === "compliant").length;
      return {
        format: "ciso-assistant-api",
        controlCount: results.length,
        passCount: pass,
        failCount: results.length - pass,
        score: Math.round((pass / results.length) * 100),
        provenance: "tool (CISO Assistant)",
        cliCommand: `corsair sign --file api-response.json --format ciso-assistant-api`,
      };
    }

    // Generic
    if ("controls" in obj && Array.isArray(obj.controls)) {
      const controls = obj.controls as Array<{ status?: string }>;
      const pass = controls.filter((c) => c.status === "pass" || c.status === "effective").length;
      return {
        format: "generic",
        controlCount: controls.length,
        passCount: pass,
        failCount: controls.length - pass,
        score: controls.length > 0 ? Math.round((pass / controls.length) * 100) : 0,
        provenance: "json",
        cliCommand: `corsair sign --file evidence.json`,
      };
    }
  }

  return { error: "Unrecognized format. Supported: generic, prowler, securityhub, inspec, trivy, gitlab, ciso-assistant-api, ciso-assistant-export." };
}

export function PlaygroundEditor() {
  const [inputJson, setInputJson] = useState("");
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null);
  const [state, setState] = useState<PlaygroundState>("idle");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectExample = useCallback((example: PlaygroundExample) => {
    const json = JSON.stringify(example.data, null, 2);
    setInputJson(json);
    setSelectedExample(example);
    setState("idle");
    setPreview(null);
    setError(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (!inputJson.trim()) return;

    const result = previewEvidence(inputJson);
    if ("error" in result) {
      setError(result.error);
      setState("error");
      setPreview(null);
    } else {
      setPreview(result);
      setState("previewing");
      setError(null);
    }
  }, [inputJson]);

  const handleClear = useCallback(() => {
    setInputJson("");
    setSelectedExample(null);
    setState("idle");
    setPreview(null);
    setError(null);
  }, []);

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
              setPreview(null);
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
          onClick={handlePreview}
          disabled={!inputJson.trim()}
          size="lg"
          className="font-display font-semibold"
        >
          Preview CPOE
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

      {/* Preview Result */}
      {preview && (
        <Card className="border-corsair-green/30 bg-corsair-green/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-corsair-green/20 text-lg text-corsair-green">
                &#x2713;
              </div>
              <div>
                <span className="font-display text-lg font-bold text-corsair-green">
                  CPOE PREVIEW
                </span>
                <Badge variant="outline" className="ml-2 font-mono text-[10px] text-corsair-cyan border-corsair-cyan/40">
                  {preview.format}
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
                    {preview.score}<span className="text-sm text-muted-foreground">/100</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-corsair-deep">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-corsair-cyan to-corsair-green transition-all"
                    style={{ width: `${preview.score}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {preview.passCount}/{preview.controlCount} controls passed
                  </span>
                  <span>{preview.failCount} failed</span>
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
                  <span className="text-sm font-semibold text-corsair-gold">{preview.format}</span>
                  <span className="block mt-1 text-xs text-muted-foreground">Auto-detected from evidence structure</span>
                </CardContent>
              </Card>
              <Card className="bg-corsair-surface">
                <CardContent className="p-4">
                  <span className="block font-mono text-xs uppercase text-muted-foreground">
                    Evidence Provenance
                  </span>
                  <span className="text-sm font-semibold text-corsair-cyan">{preview.provenance}</span>
                  <span className="block mt-1 text-xs text-muted-foreground">Recorded in CPOE metadata</span>
                </CardContent>
              </Card>
            </div>

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
                    $ {preview.cliCommand}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
