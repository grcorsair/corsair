"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RoastReport } from "@/components/features/roast/roast-report";
import { type RoastError, type RoastResult } from "@/lib/roast";

interface RoastResultViewProps {
  id: string;
}

export function RoastResultView({ id }: RoastResultViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoastResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/roast/${encodeURIComponent(id)}`, {
          method: "GET",
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const err = (payload || {}) as RoastError;
          if (!cancelled) {
            setError(err.error || `Could not load roast report (HTTP ${res.status}).`);
          }
          return;
        }

        const roastResult = (payload as { result?: RoastResult })?.result;
        if (!roastResult) {
          if (!cancelled) {
            setError("Roast response was missing result data.");
          }
          return;
        }

        if (!cancelled) {
          setResult(roastResult);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not reach roast endpoint.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
        <p className="font-mono text-sm text-corsair-text-dim">Loading roast report...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="rounded-xl border border-corsair-border bg-corsair-surface p-5">
        <p className="text-sm text-corsair-crimson">{error || "Roast report not found."}</p>
        <Button asChild variant="outline" size="sm" className="mt-4 font-mono text-[10px]">
          <Link href="/roast">Run a new roast</Link>
        </Button>
      </div>
    );
  }

  return <RoastReport result={result} compact />;
}
