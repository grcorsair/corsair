"use client";

import dynamic from "next/dynamic";
import { SwordLoader } from "@/components/pixel-art/pixel-loader";

const AscinemaDemo = dynamic(
  () =>
    import("@/components/features/asciinema-demo").then(
      (mod) => mod.AscinemaDemo
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-corsair-border bg-[#080c18]">
        <SwordLoader size={40} label="LOADING RECORDING" />
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
