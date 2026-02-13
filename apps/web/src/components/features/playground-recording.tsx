"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const AscinemaDemo = dynamic(
  () =>
    import("@/components/features/asciinema-demo").then(
      (mod) => mod.AscinemaDemo
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center bg-[#080c18]">
        <span className="font-pixel text-[7px] tracking-wider text-corsair-text-dim animate-pulse">
          LOADING RECORDING...
        </span>
      </div>
    ),
  }
);

interface PlaygroundRecordingProps {
  castFile?: string;
  className?: string;
}

export function PlaygroundRecording({
  castFile = "/recordings/sign.cast",
  className,
}: PlaygroundRecordingProps) {
  const [mode, setMode] = useState<"watch" | "try">("watch");

  return (
    <div className={className}>
      {/* Mode toggle */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={mode === "watch" ? "default" : "outline"}
          size="sm"
          className="font-mono text-xs"
          onClick={() => setMode("watch")}
        >
          Watch
        </Button>
        <Button
          variant={mode === "try" ? "default" : "outline"}
          size="sm"
          className="font-mono text-xs"
          onClick={() => setMode("try")}
        >
          Try It
        </Button>
        <span className="ml-2 text-xs text-corsair-text-dim">
          {mode === "watch"
            ? "Watch corsair sign in action"
            : "Paste your own evidence JSON below"}
        </span>
      </div>

      {/* Recording */}
      {mode === "watch" && (
        <div className="overflow-hidden rounded-xl border border-corsair-border">
          <div className="flex items-center gap-2 border-b border-corsair-border bg-[#0A0A0A] px-4 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-corsair-crimson/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-corsair-gold/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-corsair-green/60" />
            </div>
            <span className="ml-2 font-pixel text-[6px] tracking-wider text-corsair-text-dim">
              corsair sign
            </span>
          </div>
          <AscinemaDemo
            castFile={castFile}
            cols={100}
            rows={24}
            autoPlay={true}
            loop={true}
            speed={1.5}
            idleTimeLimit={2}
          />
        </div>
      )}
    </div>
  );
}
