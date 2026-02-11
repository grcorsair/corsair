"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { ANATOMY_FRAMEWORKS } from "@/data/anatomy-data";

export function FrameworkMap() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {ANATOMY_FRAMEWORKS.map((fw) => {
        const passRate = Math.round((fw.passed / fw.controlsMapped) * 100);
        return (
          <motion.div
            key={fw.name}
            variants={{
              hidden: { opacity: 0, scale: 0.95, y: 10 },
              visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4 } },
            }}
            className="pixel-card-hover group rounded-xl border border-corsair-border bg-corsair-surface p-4 transition-all"
            style={{ "--glow-color": "rgba(212, 168, 83, 0.15)" } as React.CSSProperties}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm font-bold text-corsair-text group-hover:text-corsair-gold transition-colors">
                {fw.name}
              </span>
              <Badge
                variant="outline"
                className="border-corsair-border font-mono text-[10px] text-corsair-text-dim"
              >
                {fw.controlsMapped}
              </Badge>
            </div>

            {/* Pass rate bar */}
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-corsair-deep">
              <motion.div
                className="h-full rounded-full bg-corsair-green"
                initial={{ width: 0 }}
                whileInView={{ width: `${passRate}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-corsair-green">
                {fw.passed} passed
              </span>
              {fw.failed > 0 && (
                <span className="text-corsair-crimson">
                  {fw.failed} failed
                </span>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Total mappings card */}
      <motion.div
        variants={{
          hidden: { opacity: 0, scale: 0.95 },
          visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
        }}
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-corsair-border p-4"
      >
        <span className="font-pixel-display text-3xl font-bold text-corsair-gold">
          46
        </span>
        <span className="mt-1 text-xs text-corsair-text-dim">
          total framework mappings
        </span>
        <span className="mt-0.5 text-xs text-corsair-text-dim">
          generated automatically
        </span>
      </motion.div>
    </motion.div>
  );
}
