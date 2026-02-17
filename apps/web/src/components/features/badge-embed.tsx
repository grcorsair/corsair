"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmbedFormat = "markdown" | "html" | "rst";

interface BadgeEmbedProps {
  marqueId: string;
  className?: string;
}

const BADGE_BASE = "https://grcorsair.com/badge";

function getSnippet(marqueId: string, format: EmbedFormat): string {
  const url = `${BADGE_BASE}/${marqueId}.svg`;
  const link = `https://grcorsair.com/verify?cpoe=${marqueId}`;

  switch (format) {
    case "markdown":
      return `[![CPOE Status](${url})](${link})`;
    case "html":
      return `<a href="${link}"><img src="${url}" alt="CPOE Status" /></a>`;
    case "rst":
      return `.. image:: ${url}\n   :target: ${link}\n   :alt: CPOE Status`;
  }
}

export function BadgeEmbed({ marqueId, className }: BadgeEmbedProps) {
  const [format, setFormat] = useState<EmbedFormat>("markdown");
  const [copied, setCopied] = useState(false);

  const snippet = getSnippet(marqueId, format);
  const badgeUrl = `${BADGE_BASE}/${marqueId}.svg`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [snippet]);

  return (
    <Card className={`border-corsair-border bg-corsair-surface ${className ?? ""}`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold text-corsair-text">
            Embed Your Badge
          </span>
          <span className="font-mono text-[10px] text-corsair-text-dim">
            Auto-updates on CPOE change
          </span>
        </div>

        {/* Badge preview */}
        <div className="flex items-center justify-center rounded-lg bg-corsair-deep p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgeUrl}
            alt="CPOE Badge"
            className="h-5"
          />
        </div>

        {/* Format selector */}
        <div className="flex gap-1">
          {(["markdown", "html", "rst"] as const).map((fmt) => (
            <Button
              key={fmt}
              variant={format === fmt ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 font-mono text-[10px] uppercase"
              onClick={() => setFormat(fmt)}
            >
              {fmt}
            </Button>
          ))}
        </div>

        {/* Snippet */}
        <div className="relative">
          <div className="overflow-hidden rounded-lg border border-corsair-border bg-[#0A0A0A] p-3">
            <code className="block whitespace-pre-wrap break-all font-mono text-[11px] text-corsair-cyan/80">
              {snippet}
            </code>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-2 h-6 px-2 font-mono text-[10px]"
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>

        <p className="text-xs text-corsair-text-dim">
          Add this to your README, wiki, or trust center. The badge auto-refreshes every 5 minutes.
        </p>
      </CardContent>
    </Card>
  );
}
