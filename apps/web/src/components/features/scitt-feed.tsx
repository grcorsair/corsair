"use client";

import { useState, useEffect, useCallback } from "react";
import { SCITTEntryCard, type SCITTEntry } from "./scitt-entry-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SCITTFeedProps {
  className?: string;
}

type ProvenanceFilter = "all" | "self" | "tool" | "auditor";

const REFRESH_INTERVAL = 30_000; // 30 seconds

export function SCITTFeed({ className }: SCITTFeedProps) {
  const [entries, setEntries] = useState<SCITTEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [provenanceFilter, setProvenanceFilter] = useState<ProvenanceFilter>("all");
  const [issuerFilter, setIssuerFilter] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const limit = 20;

  const fetchEntries = useCallback(
    async (reset = false) => {
      try {
        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(currentOffset),
        });
        if (provenanceFilter !== "all") {
          params.set("provenanceSource", provenanceFilter);
        }
        if (issuerFilter.trim()) {
          params.set("issuer", `did:web:${issuerFilter.trim()}`);
        }

        const res = await fetch(`/api/scitt?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: SCITTEntry[] = await res.json();

        if (reset) {
          setEntries(data);
          setOffset(data.length);
        } else {
          setEntries((prev) => [...prev, ...data]);
          setOffset((prev) => prev + data.length);
        }

        setHasMore(data.length === limit);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load entries");
      } finally {
        setLoading(false);
      }
    },
    [offset, provenanceFilter, issuerFilter],
  );

  // Initial load
  useEffect(() => {
    fetchEntries(true);
  }, [provenanceFilter, issuerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEntries(true);
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [provenanceFilter, issuerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      {/* Header with live indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-corsair-green" />
            <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-corsair-green/60" />
          </div>
          <span className="font-mono text-xs text-corsair-text-dim">
            Live feed
          </span>
          {lastUpdated && (
            <span className="font-mono text-[10px] text-corsair-text-dim/60">
              updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* RSS link */}
        <a
          href="/api/scitt/feed.xml"
          className="flex items-center gap-1 font-mono text-[10px] text-corsair-gold hover:underline"
        >
          RSS
        </a>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Provenance filter (primary signal) */}
        {(["all", "tool", "auditor", "self"] as const).map((source) => (
          <Button
            key={source}
            variant={provenanceFilter === source ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 font-mono text-[10px]"
            onClick={() => setProvenanceFilter(source)}
          >
            {source === "all" ? "All" : source === "tool" ? "Tool" : source === "auditor" ? "Auditor" : "Self"}
          </Button>
        ))}

        {/* Issuer search */}
        <input
          type="text"
          placeholder="Filter by domain..."
          value={issuerFilter}
          onChange={(e) => setIssuerFilter(e.target.value)}
          className="h-6 rounded-md border border-corsair-border bg-corsair-surface px-2 font-mono text-[10px] text-corsair-text placeholder:text-corsair-text-dim/40 focus:border-corsair-gold/40 focus:outline-none"
        />
      </div>

      {/* Entry count */}
      {!loading && (
        <div className="mb-3">
          <Badge variant="outline" className="font-mono text-[10px] text-corsair-text-dim border-corsair-border">
            {entries.length} entries
          </Badge>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg border border-corsair-crimson/30 bg-corsair-crimson/5 p-4">
          <span className="text-sm text-corsair-crimson">{error}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-3 h-6 text-xs"
            onClick={() => fetchEntries(true)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-corsair-border bg-corsair-surface"
            />
          ))}
        </div>
      )}

      {/* Entries */}
      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => (
            <SCITTEntryCard key={entry.entryId} entry={entry} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && !error && (
        <div className="rounded-lg border border-corsair-border bg-corsair-surface p-8 text-center">
          <p className="text-sm text-corsair-text-dim">
            No SCITT entries found. Sign your first CPOE to see it here.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <a href="/sign">Sign your first CPOE</a>
          </Button>
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && entries.length > 0 && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntries(false)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
