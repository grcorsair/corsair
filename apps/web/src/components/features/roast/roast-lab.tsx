"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoastReport } from "@/components/features/roast/roast-report";
import {
  isValidDomain,
  normalizeDomain,
  type RoastError,
  type RoastResult,
} from "@/lib/roast";

const EXAMPLE_DOMAINS = ["trust.acme.com", "example.com", "grcorsair.com"];

type RoastState = "idle" | "loading" | "ready" | "error";

export function RoastLab() {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<RoastState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoastResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeDomain(domain);

    if (!isValidDomain(normalized)) {
      setState("error");
      setError("Enter a valid domain like trust.acme.com.");
      setResult(null);
      return;
    }

    setDomain(normalized);
    setState("loading");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: normalized }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const err = (payload || {}) as RoastError;
        setState("error");
        setError(err.error || `Roast request failed (HTTP ${res.status}).`);
        return;
      }

      const roastResult = (payload as { result?: RoastResult })?.result;
      if (!roastResult) {
        setState("error");
        setError("Roast response was missing result data.");
        return;
      }

      setResult(roastResult);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not reach roast endpoint.");
    }
  }

  async function copyShareLink() {
    if (!result) return;
    const url = `${window.location.origin}/roast/${result.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
        <p className="mb-2 font-pixel text-[7px] tracking-wider text-corsair-gold/60">
          TARGET DOMAIN
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="trust.acme.com"
            autoComplete="off"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
          <Button
            type="submit"
            disabled={state === "loading"}
            className="min-w-36 font-display font-semibold"
          >
            {state === "loading" ? "Scanning..." : "Roast my trust center"}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-corsair-text-dim/70">
            Try:
          </span>
          {EXAMPLE_DOMAINS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setDomain(example)}
              className="rounded border border-corsair-border/70 px-2 py-1 font-mono text-[10px] text-corsair-text-dim transition-colors hover:border-corsair-gold/30 hover:text-corsair-gold"
            >
              {example}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-corsair-text-dim/80">
          Public pages only. Paste a domain or URL and Corsair will normalize it, crawl trust/security/compliance content,
          and generate a roast plus `trust.txt` bootstrap guidance.
        </p>

        {error && (
          <p className="mt-3 rounded-md border border-corsair-crimson/30 bg-corsair-crimson/10 px-3 py-2 text-xs text-corsair-crimson">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm" className="font-mono text-[10px]">
              <Link href={`/roast/${result.id}`}>Open share page</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-[10px]"
              onClick={copyShareLink}
            >
              {copied ? "Link copied" : "Copy share link"}
            </Button>
          </div>
          <RoastReport result={result} />
        </div>
      )}
    </div>
  );
}
