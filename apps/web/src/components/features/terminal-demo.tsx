"use client";

import { useEffect, useState, useCallback } from "react";

interface TerminalLine {
  text: string;
  className: string;
  delayMs: number;
}

const lines: TerminalLine[] = [
  {
    text: "$ corsair sign --format prowler --input scan-results.json",
    className: "text-corsair-gold",
    delayMs: 0,
  },
  { text: "", className: "", delayMs: 800 },
  {
    text: "[EVIDENCE]  Accepting Prowler scan output (10 controls)...",
    className: "text-corsair-cyan",
    delayMs: 1500,
  },
  {
    text: "[SIGN]      Provenance: tool (Prowler v3.1)",
    className: "text-corsair-cyan",
    delayMs: 2500,
  },
  {
    text: "[SIGN]      Controls: 10 found, 8 effective, 2 ineffective",
    className: "text-corsair-turquoise",
    delayMs: 3500,
  },
  {
    text: "[SIGN]      Scope: AWS Production — Prowler CIS Benchmark",
    className: "text-corsair-turquoise",
    delayMs: 4500,
  },
  {
    text: "[SIGN]      Signing with Ed25519 (did:web:acme.com)...",
    className: "text-corsair-gold",
    delayMs: 5500,
  },
  {
    text: "[SIGN]      Registering in SCITT transparency log...",
    className: "text-corsair-green",
    delayMs: 6500,
  },
  {
    text: "[SIGN]      \u2713 CPOE signed — provenance: tool (Prowler v3.1)",
    className: "text-corsair-green font-bold",
    delayMs: 7500,
  },
  { text: "", className: "", delayMs: 8200 },
  {
    text: "Verification: corsair verify output/acme-prowler.jwt",
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
          corsair — sign
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
