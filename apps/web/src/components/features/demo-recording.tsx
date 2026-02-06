"use client";

import dynamic from "next/dynamic";

const AscinemaDemo = dynamic(
  () =>
    import("@/components/features/asciinema-demo").then(
      (mod) => mod.AscinemaDemo
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-corsair-border bg-[#080c18]">
        <span className="font-mono text-sm text-corsair-text-dim animate-pulse">
          Loading recording...
        </span>
      </div>
    ),
  }
);

interface DemoRecordingProps {
  castFile: string;
  cols?: number;
  rows?: number;
  speed?: number;
}

export function DemoRecording({
  castFile,
  cols = 120,
  rows = 30,
  speed = 1.5,
}: DemoRecordingProps) {
  return (
    <AscinemaDemo
      castFile={castFile}
      cols={cols}
      rows={rows}
      speed={speed}
    />
  );
}
