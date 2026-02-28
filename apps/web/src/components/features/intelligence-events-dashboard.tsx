"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getIntelligenceEventsViaAPI,
  type APIIntelligenceEvent,
  type APIIntelligenceEventsResponse,
} from "@/lib/corsair-api";

function toLocalTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function statusBadge(status: "success" | "failure") {
  return status === "success"
    ? "border-corsair-green/50 text-corsair-green"
    : "border-corsair-crimson/50 text-corsair-crimson";
}

export function IntelligenceEventsDashboard() {
  const [token, setToken] = useState("");
  const [eventType, setEventType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState<"" | "success" | "failure">("");
  const [limit, setLimit] = useState("50");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<APIIntelligenceEventsResponse | null>(null);

  const canLoad = token.trim().length > 0;

  const totalFailures = useMemo(
    () => (result?.events || []).filter((event) => event.status === "failure").length,
    [result],
  );

  const onLoad = async () => {
    setLoading(true);
    setError(null);

    const response = await getIntelligenceEventsViaAPI(token.trim(), {
      eventType: eventType.trim() || undefined,
      targetType: targetType.trim() || undefined,
      targetId: targetId.trim() || undefined,
      status: status || undefined,
      limit: parseInt(limit, 10) || 50,
    });

    if (!response.ok) {
      setResult(null);
      setError(response.error.message);
      setLoading(false);
      return;
    }

    setResult(response.data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-corsair-border bg-corsair-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-corsair-text">
            <span className="font-display text-xl">Intelligence Events</span>
            <Badge variant="outline" className="border-corsair-gold/40 text-corsair-gold">Auth-gated preview</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              API Key / OIDC Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Required. Events are scoped to this authenticated actor.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="eventType"
              className="rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | "success" | "failure")}
              className="rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs"
            >
              <option value="">status: any</option>
              <option value="success">success</option>
              <option value="failure">failure</option>
            </select>
            <input
              type="text"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              placeholder="targetType"
              className="rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs"
            />
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="targetId"
              className="rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs"
            />
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="limit"
              className="rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={onLoad} disabled={!canLoad || loading}>
              {loading ? "Loading..." : "Load Events"}
            </Button>
            {result && (
              <span className="text-xs text-corsair-text-dim">
                {result.pagination.count} rows · {totalFailures} failures
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-corsair-crimson/40 bg-corsair-crimson/10 px-3 py-2 font-mono text-xs text-corsair-crimson">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-corsair-border bg-corsair-surface">
          <CardContent className="space-y-4 p-0">
            <div className="grid grid-cols-6 border-b border-corsair-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-corsair-text-dim">
              <span>Time</span>
              <span>Type</span>
              <span>Status</span>
              <span>Target</span>
              <span>Path</span>
              <span>Metadata</span>
            </div>

            <div className="max-h-[560px] overflow-auto">
              {result.events.length === 0 ? (
                <p className="px-4 py-6 font-mono text-xs text-corsair-text-dim">No events found for current filters.</p>
              ) : (
                result.events.map((event: APIIntelligenceEvent) => (
                  <div key={event.eventId} className="grid grid-cols-1 gap-2 border-b border-corsair-border/60 px-4 py-3 text-xs sm:grid-cols-6 sm:gap-3">
                    <span className="font-mono text-corsair-text-dim">{toLocalTime(event.occurredAt)}</span>
                    <span className="font-mono text-corsair-text">{event.eventType}</span>
                    <div>
                      <Badge variant="outline" className={statusBadge(event.status)}>
                        {event.status}
                      </Badge>
                    </div>
                    <span className="font-mono text-corsair-text-dim">
                      {[event.targetType, event.targetId].filter(Boolean).join(":") || "-"}
                    </span>
                    <span className="font-mono text-corsair-text-dim">{event.requestPath || "-"}</span>
                    <span className="font-mono text-corsair-text-dim">{JSON.stringify(event.metadata)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator className="bg-corsair-border" />
      <p className="text-xs text-corsair-text-dim">
        Current model: visible product surface, authenticated access, actor-scoped reads. This supports preview/go-to-market now while preserving paid expansion (team scope, exports, alerts).
      </p>
    </div>
  );
}
