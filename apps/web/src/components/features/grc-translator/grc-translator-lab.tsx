"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  byteLength,
  parseJsonPayload,
  type GrcTranslateError,
  type GrcTranslateMode,
  type GrcTranslateResponse,
} from "@/lib/grc-translator";

const EXAMPLE_JSON = `{
  "framework": "SOC2",
  "controls": [
    { "id": "CC6.1", "status": "pass", "evidence": "MFA enabled" },
    { "id": "CC7.2", "status": "fail", "evidence": "No weekly vuln scans" }
  ],
  "owner": "security@acme.com",
  "assessmentDate": "2026-02-20"
}`;

export function GrcTranslatorLab() {
  const [payloadText, setPayloadText] = useState(EXAMPLE_JSON);
  const [mode, setMode] = useState<GrcTranslateMode>("quick");
  const [redact, setRedact] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GrcTranslateResponse | null>(null);

  const payloadBytes = useMemo(() => byteLength(payloadText), [payloadText]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    let payload: unknown;
    try {
      payload = parseJsonPayload(payloadText);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Invalid JSON.");
      return;
    }

    try {
      const response = await fetch("/api/grc-translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload,
          mode,
          redact,
          style: "funny",
          audience: "grc-buyer",
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const parsed = (body || {}) as GrcTranslateError;
        setError(parsed.error || `Translator failed (HTTP ${response.status}).`);
        setLoading(false);
        return;
      }

      const parsed = (body as { result?: GrcTranslateResponse })?.result;
      if (!parsed) {
        setError("Translator response missing result payload.");
        setLoading(false);
        return;
      }

      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translator request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-corsair-border bg-corsair-surface p-5">
        <div>
          <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">GRC JSON INPUT</p>
          <textarea
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="min-h-[220px] w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            spellCheck={false}
          />
          <p className="mt-2 font-mono text-[10px] text-corsair-text-dim">{payloadBytes} bytes</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-corsair-text-dim">
            <span className="font-mono">Mode</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as GrcTranslateMode)}
              className="rounded border border-corsair-border bg-corsair-deep px-2 py-1 font-mono text-xs text-corsair-text"
            >
              <option value="quick">Quick (cheap defaults)</option>
              <option value="compare">Compare (more models)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-corsair-text-dim">
            <input
              type="checkbox"
              checked={redact}
              onChange={(event) => setRedact(event.target.checked)}
            />
            Redact sensitive fields
          </label>

          <Button type="submit" disabled={loading} className="font-display">
            {loading ? "Translating..." : "Translate my JSON"}
          </Button>
        </div>

        {error && (
          <p className="rounded-md border border-corsair-crimson/30 bg-corsair-crimson/10 px-3 py-2 text-xs text-corsair-crimson">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="space-y-4">
          <div className="rounded-xl border border-corsair-border bg-corsair-surface p-4">
            <p className="font-mono text-xs text-corsair-text-dim">
              Run {result.runId} · {result.mode} · {result.input.redacted ? "redacted" : "raw"}
            </p>
            <p className="mt-1 text-sm text-corsair-text-dim">{result.input.fingerprint}</p>
          </div>

          <div className="grid gap-3">
            {result.results.map((entry) => (
              <article key={`${entry.model}-${entry.latencyMs}`} className="rounded-xl border border-corsair-border bg-corsair-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg text-corsair-text">{entry.label}</p>
                  <p className="font-mono text-[10px] text-corsair-text-dim">
                    {entry.status} · {entry.latencyMs}ms · {entry.model}
                  </p>
                </div>
                <p className="mt-2 text-sm text-corsair-text">{entry.output.roast}</p>
                <p className="mt-2 text-xs text-corsair-text-dim">{entry.output.plainEnglish}</p>

                <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-corsair-gold/70">Findings</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-corsair-text-dim">
                  {entry.output.grcFindings.map((finding, idx) => (
                    <li key={`${entry.model}-f-${idx}`}>{finding}</li>
                  ))}
                </ul>

                <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-corsair-cyan/70">Next actions</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-corsair-text-dim">
                  {entry.output.nextActions.map((action, idx) => (
                    <li key={`${entry.model}-a-${idx}`}>{action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="rounded-xl border border-corsair-gold/20 bg-corsair-surface p-4">
            <p className="font-pixel text-[7px] tracking-wider text-corsair-gold/70">TURN COMMENTARY INTO PROOF</p>
            <p className="mt-2 text-xs text-corsair-text-dim">
              LLM takes are probabilistic. Use Corsair to generate deterministic, verifiable trust artifacts.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" className="font-mono text-[10px]"><Link href={result.cta.sign}>Sign evidence</Link></Button>
              <Button asChild variant="outline" size="sm" className="font-mono text-[10px]"><Link href={result.cta.verify}>Verify CPOE</Link></Button>
              <Button asChild variant="outline" size="sm" className="font-mono text-[10px]"><Link href={result.cta.publish}>Generate trust.txt</Link></Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
