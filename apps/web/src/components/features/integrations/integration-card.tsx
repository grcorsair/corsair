"use client";

import { Badge } from "@/components/ui/badge";
import type { Integration } from "@/data/integrations-data";
import { useState } from "react";

const STATUS_CONFIG = {
  available: {
    label: "Available",
    dotColor: "bg-corsair-green",
    badgeClass: "border-corsair-green/30 text-corsair-green",
  },
  beta: {
    label: "Beta",
    dotColor: "bg-corsair-gold",
    badgeClass: "border-corsair-gold/30 text-corsair-gold",
  },
  coming: {
    label: "Coming",
    dotColor: "bg-corsair-text-dim/40",
    badgeClass: "border-corsair-border text-corsair-text-dim",
  },
} as const;

export function IntegrationCard({
  integration,
}: {
  integration: Integration;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[integration.status];

  return (
    <button
      type="button"
      onClick={() => {
        if (integration.snippet || integration.docsUrl) setExpanded(!expanded);
      }}
      className={`group w-full rounded-xl border text-left transition-all duration-200 ${
        integration.status === "coming"
          ? "border-corsair-border/20 bg-corsair-surface/50 opacity-60"
          : "border-corsair-border/30 bg-corsair-surface hover:border-corsair-gold/30"
      } ${expanded ? "border-corsair-gold/40" : ""}`}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Status dot */}
        <div className={`h-2 w-2 shrink-0 rounded-full ${config.dotColor}`} />

        {/* Name + description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-corsair-text">
              {integration.name}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${config.badgeClass}`}
            >
              {config.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-corsair-text-dim line-clamp-1">
            {integration.description}
          </p>
        </div>

        {/* Expand indicator */}
        {(integration.snippet || integration.docsUrl) && (
          <svg
            className={`h-4 w-4 shrink-0 text-corsair-text-dim/40 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-corsair-border/20 px-4 pb-4 pt-3">
          {integration.snippet && (
            <div className="overflow-x-auto rounded-lg border border-corsair-border bg-[#0A0A0A] px-3 py-2">
              <code className="whitespace-pre font-mono text-[11px] text-corsair-gold">
                {integration.snippet}
              </code>
            </div>
          )}
          {integration.docsUrl && (
            <a
              href={integration.docsUrl}
              className="mt-2 inline-block text-xs text-corsair-gold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View documentation &rarr;
            </a>
          )}
        </div>
      )}
    </button>
  );
}
