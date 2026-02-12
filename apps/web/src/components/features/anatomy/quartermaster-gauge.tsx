"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ANATOMY_DIMENSIONS } from "@/data/anatomy-data";

interface DimensionBarProps {
  name: string;
  value: number;
  delay: number;
}

function DimensionBar({ name, value, delay }: DimensionBarProps) {
  const getBarColor = (v: number) => {
    if (v >= 80) return "bg-corsair-green";
    if (v >= 50) return "bg-corsair-gold";
    return "bg-corsair-crimson";
  };

  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-corsair-text group-hover:text-corsair-gold transition-colors capitalize">
          {name}
        </span>
        <span className="font-mono text-xs text-corsair-text-dim">
          {value}/100
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-corsair-surface">
        <motion.div
          className={`h-full rounded-full ${getBarColor(value)}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function AnimatedScore({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!hasStarted) return;
    if (count >= target) return;
    const timer = setTimeout(() => {
      setCount((c) => Math.min(c + 2, target));
    }, 20);
    return () => clearTimeout(timer);
  }, [count, target, hasStarted]);

  return (
    <motion.div
      onViewportEnter={() => setHasStarted(true)}
      viewport={{ once: true }}
      className="text-center"
    >
      <div className="relative mx-auto mb-3 flex h-28 w-28 items-center justify-center">
        {/* Circular gauge background */}
        <svg className="absolute inset-0" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-corsair-surface)"
            strokeWidth="6"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-corsair-gold)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
            whileInView={{
              strokeDashoffset: 2 * Math.PI * 52 * (1 - target / 100),
            }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span className="font-pixel-display text-3xl font-bold text-corsair-gold">
          {count}
        </span>
      </div>
      <p className="font-pixel text-[8px] tracking-widest text-corsair-text-dim">
        CONFIDENCE SCORE
      </p>
    </motion.div>
  );
}

export function QuartermasterGauge() {
  const dimensions = Object.entries(ANATOMY_DIMENSIONS);
  // Compute weighted average for overall score
  const overallScore = 91;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
      {/* Left: Confidence score ring */}
      <div className="flex items-center justify-center">
        <AnimatedScore target={overallScore} />
      </div>

      {/* Right: Dimension bars */}
      <div>
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-text-dim">
          DIMENSION SCORES
        </p>
        <div className="space-y-4">
          {dimensions.map(([name, value], i) => (
            <DimensionBar
              key={name}
              name={name}
              value={value}
              delay={i * 0.1}
            />
          ))}
        </div>
      </div>

      {/* Findings row — spans full width */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="lg:col-span-2 rounded-xl border border-corsair-border bg-[#0A0A0A] p-4"
      >
        <p className="mb-3 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          FINDINGS
        </p>
        <div className="space-y-2 font-mono text-[12px]">
          <div className="flex items-start gap-2">
            <span className="text-corsair-green flex-shrink-0">{"\u2713"}</span>
            <span className="text-corsair-text-dim">
              Evidence freshness: scanned today — 100/100
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-corsair-green flex-shrink-0">{"\u2713"}</span>
            <span className="text-corsair-text-dim">
              All 10 controls use automated methodology (Prowler, Trivy, InSpec)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-corsair-gold flex-shrink-0">!!</span>
            <span className="text-corsair-text-dim">
              2 controls failed — prowler-ec2-1 (IMDSv2) and prowler-kms-1 (key rotation)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-corsair-text-dim flex-shrink-0">i</span>
            <span className="text-corsair-text-dim">
              Evidence sources: 70% config-scan (L1), 20% vulnerability-scan (L2), 10% benchmark-test (L2)
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
