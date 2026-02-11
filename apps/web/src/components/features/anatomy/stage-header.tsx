"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface StageHeaderProps {
  number: number;
  name: string;
  subtitle: string;
  color: string;
  icon: ReactNode;
}

export function StageHeader({ number, name, subtitle, color, icon }: StageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="mb-8 flex items-center gap-4"
    >
      {/* Pixel-art stage number */}
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-corsair-border bg-corsair-surface">
        {icon}
      </div>

      <div>
        <div className="flex items-center gap-3">
          <span className="font-pixel text-[8px] tracking-widest text-corsair-text-dim">
            STAGE {String(number).padStart(2, "0")}
          </span>
          <span className={`font-pixel text-[9px] tracking-wider ${color}`}>
            {name}
          </span>
        </div>
        <p className="mt-1 font-display text-lg font-bold text-corsair-text sm:text-xl">
          {subtitle}
        </p>
      </div>
    </motion.div>
  );
}
