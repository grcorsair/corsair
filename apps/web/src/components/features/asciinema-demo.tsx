"use client";

import { useEffect, useRef } from "react";
import "asciinema-player/dist/bundle/asciinema-player.css";

interface AscinemaDemoProps {
  castFile: string;
  cols?: number;
  rows?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  idleTimeLimit?: number;
}

export function AscinemaDemo({
  castFile,
  cols = 120,
  rows = 30,
  autoPlay = true,
  loop = false,
  speed = 1.5,
  idleTimeLimit = 2,
}: AscinemaDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamic import to avoid SSR issues
    import("asciinema-player").then((AsciinemaPlayer) => {
      if (containerRef.current && !playerRef.current) {
        playerRef.current = AsciinemaPlayer.create(castFile, containerRef.current, {
          cols,
          rows,
          autoPlay,
          loop,
          speed,
          idleTimeLimit,
          theme: "monokai",
          fit: "width",
          terminalFontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
          terminalFontSize: "13px",
        });
      }
    });

    return () => {
      if (playerRef.current && typeof (playerRef.current as { dispose?: () => void }).dispose === "function") {
        (playerRef.current as { dispose: () => void }).dispose();
        playerRef.current = null;
      }
    };
  }, [castFile, cols, rows, autoPlay, loop, speed, idleTimeLimit]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border border-corsair-border [&_.ap-wrapper]:!bg-[#080c18] [&_.ap-terminal]:!bg-[#080c18]"
    />
  );
}
