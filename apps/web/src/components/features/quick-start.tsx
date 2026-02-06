"use client";

import { useState } from "react";

const code = `# Install Bun (if you don't have it)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/Arudjreis/corsair.git
cd corsair && bun install

# Your first mission (no API keys needed)
bun corsair.ts --target demo --service cognito --format html`;

export function QuickStart() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-corsair-border bg-corsair-surface">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-md border border-corsair-border bg-corsair-deep px-3 py-1 font-mono text-xs text-corsair-text-dim transition-colors hover:border-corsair-cyan hover:text-corsair-cyan"
      >
        {copied ? "Copied!" : "Copy"}
      </button>

      {/* Code */}
      <pre className="overflow-x-auto p-6 font-mono text-sm leading-relaxed">
        {code.split("\n").map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith("#")
                ? "text-corsair-text-dim"
                : "text-corsair-cyan"
            }
          >
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}
