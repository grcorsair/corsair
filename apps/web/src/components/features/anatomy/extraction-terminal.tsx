"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface TerminalLine {
  text: string;
  className: string;
  delayMs: number;
}

const lines: TerminalLine[] = [
  {
    text: "$ scanner run --output json | corsair sign --mapping ./mappings/toolx.json",
    className: "text-corsair-gold",
    delayMs: 0,
  },
  { text: "", className: "", delayMs: 800 },
  {
    text: "[SIGN] Reading tool output from stdin...",
    className: "text-corsair-gold/70",
    delayMs: 1400,
  },
  {
    text: "[SIGN] Detected: Toolx v1.0 | AWS account 4821-XXXX-7193",
    className: "text-corsair-text-dim",
    delayMs: 2200,
  },
  { text: "", className: "", delayMs: 2800 },
  {
    text: "[SIGN] scan-iam-1     MFA Enabled for Root Account         PASS",
    className: "text-corsair-gold/80",
    delayMs: 3200,
  },
  {
    text: "[SIGN] scan-iam-4     IAM Password Policy Enforced         PASS",
    className: "text-corsair-gold/80",
    delayMs: 3500,
  },
  {
    text: "[SIGN] scan-s3-1      S3 Bucket Encryption at Rest         PASS",
    className: "text-corsair-gold/80",
    delayMs: 3800,
  },
  {
    text: "[SIGN] scan-vpc-1     VPC Flow Logs Enabled                PASS",
    className: "text-corsair-gold/80",
    delayMs: 4100,
  },
  {
    text: "[SIGN] scan-ec2-1     EC2 IMDSv2 Enforced                  FAIL",
    className: "text-corsair-crimson/80",
    delayMs: 4400,
  },
  {
    text: "           ... 5 more controls",
    className: "text-corsair-text-dim",
    delayMs: 4700,
  },
  { text: "", className: "", delayMs: 5100 },
  {
    text: "[SIGN] \u2713 10 controls | 8 effective | 2 ineffective",
    className: "text-corsair-green font-semibold",
    delayMs: 5500,
  },
  {
    text: "[SIGN] \u2713 Provenance: tool (Toolx v1.0)",
    className: "text-corsair-green",
    delayMs: 6000,
  },
  {
    text: "[SIGN] \u2713 Ed25519 signature: did:web:grcorsair.com#key-1",
    className: "text-corsair-green",
    delayMs: 6400,
  },
  {
    text: "[SIGN] CPOE written to toolx-cpoe.jwt (1.4 KB)",
    className: "text-corsair-text-dim",
    delayMs: 6800,
  },
];

export function ExtractionTerminal() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const commandText = lines[0].text;

  // Start animation when in view
  function handleInView() {
    if (!hasStarted) {
      setHasStarted(true);
      setIsTyping(true);
    }
  }

  // Typing animation for command line
  useEffect(() => {
    if (!isTyping) return;
    if (typedChars >= commandText.length) {
      setIsTyping(false);
      setVisibleCount(1);
      return;
    }
    const timer = setTimeout(() => setTypedChars((c) => c + 1), 25);
    return () => clearTimeout(timer);
  }, [typedChars, isTyping, commandText.length]);

  // Reveal subsequent lines
  useEffect(() => {
    if (isTyping || visibleCount < 1 || visibleCount >= lines.length) return;

    const currentDelay = lines[visibleCount].delayMs;
    const prevDelay = lines[visibleCount - 1]?.delayMs ?? 0;

    const timer = setTimeout(
      () => setVisibleCount((c) => c + 1),
      currentDelay - prevDelay,
    );
    return () => clearTimeout(timer);
  }, [visibleCount, isTyping]);

  const isDone = visibleCount >= lines.length;

  return (
    <motion.div
      onViewportEnter={handleInView}
      viewport={{ once: true, margin: "-100px" }}
      className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A] shadow-2xl shadow-corsair-gold/5"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-corsair-crimson/80" />
        <div className="h-3 w-3 rounded-full bg-corsair-gold/80" />
        <div className="h-3 w-3 rounded-full bg-corsair-green/80" />
        <span className="ml-3 font-mono text-xs text-corsair-text-dim">
          parley — sign
        </span>
      </div>

      {/* Terminal content */}
      <div className="min-h-[320px] p-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
        {/* Typing line */}
        <div className={lines[0].className}>
          {isTyping ? (
            <>
              {commandText.slice(0, typedChars)}
              <span className="animate-pulse text-corsair-gold">&#9612;</span>
            </>
          ) : hasStarted ? (
            commandText
          ) : (
            <span className="animate-pulse text-corsair-gold">&#9612;</span>
          )}
        </div>

        {/* Revealed lines */}
        {lines.slice(1, visibleCount).map((line, i) =>
          line.text === "" ? (
            <div key={i} className="h-3" />
          ) : (
            <div
              key={i}
              className={line.className}
              style={{ animation: "fadeIn 0.3s ease-in forwards" }}
            >
              {line.text}
            </div>
          ),
        )}

        {/* Blinking cursor at end */}
        {isDone && (
          <div className="mt-2 animate-pulse text-corsair-gold">&#9612;</div>
        )}
      </div>
    </motion.div>
  );
}
