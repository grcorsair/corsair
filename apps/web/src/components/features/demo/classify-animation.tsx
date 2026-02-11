"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DEMO_CONTROLS,
  DEMO_ASSURANCE_BREAKDOWN,
  type DemoControl,
} from "@/data/demo-data";

const levelStyles: Record<
  number,
  { label: string; color: string; textColor: string; bgColor: string }
> = {
  0: { label: "L0 Documented", color: "#9A8F80", textColor: "text-corsair-text-dim", bgColor: "bg-corsair-text-dim/20" },
  1: { label: "L1 Configured", color: "#D4A853", textColor: "text-corsair-gold", bgColor: "bg-corsair-gold/20" },
  2: { label: "L2 Demonstrated", color: "#2ECC71", textColor: "text-corsair-green", bgColor: "bg-corsair-green/20" },
};

function ControlRow({ control, index }: { control: DemoControl; index: number }) {
  const style = levelStyles[control.level];
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="flex items-center gap-3 rounded-lg border border-corsair-border bg-corsair-surface px-3 py-2"
    >
      {/* Control ID */}
      <span className="w-14 flex-shrink-0 font-mono text-[11px] font-semibold text-corsair-text">
        {control.id}
      </span>

      {/* Name */}
      <span className="flex-1 truncate text-xs text-corsair-text-dim">
        {control.name}
      </span>

      {/* Status */}
      <div
        className="flex-shrink-0 rounded-full px-1.5 py-0.5"
        style={{ backgroundColor: control.status === "effective" ? "#2ECC7115" : "#C0392B15" }}
      >
        <span
          className="font-pixel text-[6px] tracking-wider"
          style={{ color: control.status === "effective" ? "#2ECC71" : "#C0392B" }}
        >
          {control.status === "effective" ? "PASS" : "FAIL"}
        </span>
      </div>

      {/* Level badge */}
      <div
        className="flex-shrink-0 rounded-md px-2 py-0.5"
        style={{ backgroundColor: `${style.color}15` }}
      >
        <span
          className="font-pixel text-[7px] tracking-wider"
          style={{ color: style.color }}
        >
          L{control.level}
        </span>
      </div>

      {/* Assurance bar */}
      <div className="hidden w-16 sm:block">
        <div className="h-1.5 rounded-full bg-corsair-border">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${(control.level / 2) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 + index * 0.06 }}
            className="h-full rounded-full"
            style={{ backgroundColor: style.color, minWidth: control.level > 0 ? "25%" : "8%" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function ClassifyAnimation() {
  const [showAll, setShowAll] = useState(false);
  const visibleControls = showAll ? DEMO_CONTROLS : DEMO_CONTROLS.slice(0, 8);
  const total = 82;

  return (
    <div className="space-y-6">
      {/* Assurance breakdown summary */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          ASSURANCE DISTRIBUTION — {total} CONTROLS
        </p>

        <div className="space-y-3">
          {(Object.entries(DEMO_ASSURANCE_BREAKDOWN) as [string, { count: number; label: string; color: string; bg: string }][]).map(
            ([level, data], i) => {
              const pct = Math.round((data.count / total) * 100);
              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`font-pixel text-[8px] tracking-wider ${data.color}`}>
                        L{level}
                      </span>
                      <span className="text-xs text-corsair-text-dim">
                        {data.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-corsair-text-dim">
                        {data.count} controls
                      </span>
                      <span className={`font-mono text-xs font-semibold ${data.color}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-corsair-border/50">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.15, ease: "easeOut" }}
                      className={`h-full rounded-full ${data.bg}`}
                    />
                  </div>
                </motion.div>
              );
            }
          )}
        </div>

        {/* Floor rule callout */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-4 flex items-start gap-2 rounded-lg border border-corsair-gold/20 bg-corsair-gold/5 px-3 py-2"
        >
          <span className="mt-0.5 text-corsair-gold">⚡</span>
          <p className="text-xs text-corsair-text-dim">
            <span className="text-corsair-gold">CPOE declared level = L0</span>
            {" "}— the minimum across all in-scope controls. Like an SSL cert: one unverified domain = rejected.
          </p>
        </motion.div>
      </div>

      {/* Control list */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          INDIVIDUAL CONTROL CLASSIFICATIONS
        </p>

        <div className="space-y-2">
          {visibleControls.map((control, i) => (
            <ControlRow key={control.id} control={control} index={i} />
          ))}
        </div>

        <AnimatePresence>
          {!showAll && DEMO_CONTROLS.length > 8 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center"
            >
              <button
                onClick={() => setShowAll(true)}
                className="font-mono text-xs text-corsair-gold/70 transition-colors hover:text-corsair-gold"
              >
                + {DEMO_CONTROLS.length - 8} more controls ({total - 12} not shown in sample)
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
