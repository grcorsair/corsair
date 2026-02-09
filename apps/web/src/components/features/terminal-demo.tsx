"use client";

import { useEffect, useState, useCallback } from "react";

interface TerminalLine {
  text: string;
  className: string;
  delayMs: number;
}

const lines: TerminalLine[] = [
  {
    text: "$ corsair ingest --file report.pdf --type soc2",
    className: "text-corsair-gold",
    delayMs: 0,
  },
  { text: "", className: "", delayMs: 800 },
  {
    text: "[INGEST]    Extracting controls from SOC 2 Type II report...",
    className: "text-corsair-cyan",
    delayMs: 1500,
  },
  {
    text: "[INGEST]    Found 24 controls across 8 TSC categories",
    className: "text-corsair-cyan",
    delayMs: 2500,
  },
  {
    text: "[CHART]     Mapping to SOC 2, NIST 800-53, ISO 27001...",
    className: "text-corsair-turquoise",
    delayMs: 3500,
  },
  {
    text: "[CHART]     46 framework mappings generated",
    className: "text-corsair-turquoise",
    delayMs: 4500,
  },
  {
    text: "[QUARTER]   Governance review: 91/100 confidence score",
    className: "text-corsair-gold",
    delayMs: 5500,
  },
  {
    text: "[MARQUE]    Signing CPOE with Ed25519 (did:web:acme.com)...",
    className: "text-corsair-green",
    delayMs: 6500,
  },
  {
    text: "[MARQUE]    \u2713 CPOE issued \u2014 L1 Configured",
    className: "text-corsair-green font-bold",
    delayMs: 7500,
  },
  { text: "", className: "", delayMs: 8200 },
  {
    text: "Verification: bun run bin/corsair-verify.ts output/acme-soc2.jwt",
    className: "text-corsair-text-dim",
    delayMs: 8500,
  },
];

export function TerminalDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [runKey, setRunKey] = useState(0);

  const commandText = lines[0].text;

  const restart = useCallback(() => {
    setVisibleCount(0);
    setTypedChars(0);
    setIsTyping(true);
    setRunKey((k) => k + 1);
  }, []);

  // Typing animation for command line
  useEffect(() => {
    if (!isTyping) return;
    if (typedChars >= commandText.length) {
      setIsTyping(false);
      setVisibleCount(1);
      return;
    }
    const timer = setTimeout(() => setTypedChars((c) => c + 1), 30);
    return () => clearTimeout(timer);
  }, [typedChars, isTyping, commandText.length, runKey]);

  // Reveal subsequent lines
  useEffect(() => {
    if (isTyping || visibleCount < 1 || visibleCount >= lines.length) return;

    const currentDelay = lines[visibleCount].delayMs;
    const prevDelay = lines[visibleCount - 1]?.delayMs ?? 0;

    const timer = setTimeout(
      () => setVisibleCount((c) => c + 1),
      currentDelay - prevDelay
    );
    return () => clearTimeout(timer);
  }, [visibleCount, isTyping, runKey]);

  const isDone = visibleCount >= lines.length;

  return (
    <div
      onClick={isDone ? restart : undefined}
      className={`overflow-hidden rounded-xl border border-corsair-border bg-[#080c18] shadow-2xl shadow-corsair-cyan/5 ${isDone ? "cursor-pointer" : ""}`}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-corsair-crimson/80" />
        <div className="h-3 w-3 rounded-full bg-corsair-gold/80" />
        <div className="h-3 w-3 rounded-full bg-corsair-green/80" />
        <span className="ml-3 font-mono text-xs text-corsair-text-dim">
          corsair — ingest
        </span>
        {isDone && (
          <span className="ml-auto font-mono text-xs text-corsair-text-dim/50">
            click to replay
          </span>
        )}
      </div>

      {/* Terminal content */}
      <div className="min-h-[280px] p-6 font-mono text-[13px] leading-relaxed sm:text-sm">
        {/* Typing line */}
        <div className={lines[0].className}>
          {isTyping ? (
            <>
              {commandText.slice(0, typedChars)}
              <span className="animate-pulse text-corsair-cyan">&#9612;</span>
            </>
          ) : (
            commandText
          )}
        </div>

        {/* Revealed lines */}
        {lines.slice(1, visibleCount).map((line, i) =>
          line.text === "" ? (
            <div key={`${runKey}-${i}`} className="h-4" />
          ) : (
            <div
              key={`${runKey}-${i}`}
              className={line.className}
              style={{
                animation: "fadeIn 0.3s ease-in forwards",
              }}
            >
              {line.text}
            </div>
          )
        )}

        {/* Blinking cursor at end */}
        {isDone && (
          <div className="mt-2 animate-pulse text-corsair-cyan">&#9612;</div>
        )}
      </div>
    </div>
  );
}
