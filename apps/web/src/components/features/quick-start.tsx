"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon } from "lucide-react";

const code = `# Install Bun (if you don't have it)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/Arudjreis/corsair.git
cd corsair && bun install

# Verify the example CPOE (no API keys needed)
bun run bin/corsair-verify.ts examples/example-cpoe.jwt

# Ingest a SOC 2 report and generate a signed CPOE
export ANTHROPIC_API_KEY=your_key_here
bun corsair.ts ingest --file report.pdf --type soc2`;

export function QuickStart() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="relative overflow-hidden bg-corsair-surface">
      {/* Copy button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="absolute right-3 top-3 gap-1.5 font-mono text-xs"
      >
        {copied ? (
          <>
            <CheckIcon className="h-3 w-3 text-corsair-green" />
            Copied!
          </>
        ) : (
          <>
            <CopyIcon className="h-3 w-3" />
            Copy
          </>
        )}
      </Button>

      <CardContent className="p-0">
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
      </CardContent>
    </Card>
  );
}
