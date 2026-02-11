"use client";

import { motion } from "motion/react";
import { DEMO_PIPELINE_STAGES, DEMO_DOCUMENT } from "@/data/demo-data";

const stageColors: Record<string, string> = {
  "corsair-gold": "#D4A853",
  "corsair-turquoise": "#C4A96A",
  "corsair-green": "#2ECC71",
};

export function PipelineFlow() {
  return (
    <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5 sm:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-pixel text-[8px] tracking-widest text-corsair-gold/60">
            PIPELINE RUN
          </p>
          <p className="mt-1 font-mono text-xs text-corsair-text-dim">
            {DEMO_DOCUMENT.file}
            <span className="ml-2 text-corsair-text-dim/50">{DEMO_DOCUMENT.size}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-corsair-green/20 bg-corsair-green/5 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-corsair-green" />
          <span className="font-pixel text-[7px] tracking-wider text-corsair-green">
            COMPLETE
          </span>
          <span className="font-mono text-[10px] text-corsair-text-dim">
            7.7s total
          </span>
        </div>
      </div>

      {/* Pipeline stages — horizontal on desktop, vertical on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
        {DEMO_PIPELINE_STAGES.map((stage, i) => {
          const color = stageColors[stage.color] ?? "#D4A853";
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-1 items-center"
            >
              {/* Stage card */}
              <div className="flex w-full flex-col rounded-lg border border-corsair-border bg-corsair-surface p-3 sm:p-4">
                {/* Number + name */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="font-pixel text-[8px] tracking-wider"
                    style={{ color }}
                  >
                    {stage.name}
                  </span>
                </div>

                {/* Subtitle */}
                <p className="mb-2 text-xs text-corsair-text-dim">
                  {stage.subtitle}
                </p>

                {/* Duration */}
                <div className="mt-auto flex items-center gap-1.5">
                  <div className="h-1 flex-1 rounded-full bg-corsair-border">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: "100%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-corsair-text-dim">
                    {stage.duration}
                  </span>
                </div>
              </div>

              {/* Connector arrow (not on last) */}
              {i < DEMO_PIPELINE_STAGES.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="hidden flex-shrink-0 px-1 text-corsair-border sm:flex sm:items-center"
                >
                  <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                    <path
                      d="M0 6H16M16 6L11 1M16 6L11 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Document input strip */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1 }}
        className="mt-6 flex flex-wrap items-center gap-4 border-t border-corsair-border pt-4 text-xs text-corsair-text-dim"
      >
        <span>
          <span className="text-corsair-text-dim/50">Input:</span>{" "}
          <span className="text-corsair-gold">{DEMO_DOCUMENT.name}</span>
        </span>
        <span className="text-corsair-border">|</span>
        <span>{DEMO_DOCUMENT.pages} pages</span>
        <span className="text-corsair-border">|</span>
        <span>Auditor: {DEMO_DOCUMENT.auditor}</span>
        <span className="text-corsair-border">|</span>
        <span>{DEMO_DOCUMENT.period}</span>
      </motion.div>
    </div>
  );
}
