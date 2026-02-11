"use client";

import { motion } from "motion/react";
import { DEMO_OUTPUTS } from "@/data/demo-data";

export function OutputGallery() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DEMO_OUTPUTS.map((output, i) => (
        <motion.div
          key={output.format}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="group rounded-xl border border-corsair-border bg-corsair-surface p-4 transition-colors hover:border-corsair-gold/20"
        >
          <div className="flex items-start gap-3">
            {/* Format badge */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A]">
              <span className="font-pixel text-[8px] font-bold text-corsair-gold">
                {output.format}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-corsair-text">
                  {output.name}
                </p>
                <span className="font-mono text-[10px] text-corsair-text-dim/50">
                  {output.size}
                </span>
              </div>
              <p className="mt-1 text-xs text-corsair-text-dim">
                {output.description}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
