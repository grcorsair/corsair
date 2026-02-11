"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import {
  ANATOMY_CONTROLS,
  ANATOMY_ASSURANCE,
  ASSURANCE_LABELS,
} from "@/data/anatomy-data";
import type { AnatomyControl } from "@/data/anatomy-data";

const barWidths: Record<number, string> = {
  0: "w-[20%]",
  1: "w-[50%]",
  2: "w-[75%]",
  3: "w-[90%]",
  4: "w-full",
};

const barColors: Record<number, string> = {
  0: "bg-corsair-text-dim/40",
  1: "bg-corsair-gold",
  2: "bg-corsair-green",
  3: "bg-blue-400",
  4: "bg-purple-400",
};

function ControlRow({ control, index }: { control: AnatomyControl; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const label = ASSURANCE_LABELS[control.level];

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="group w-full text-left"
      >
        <div className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all hover:border-corsair-border hover:bg-corsair-surface/50">
          {/* Control ID */}
          <span className="w-16 flex-shrink-0 font-mono text-xs text-corsair-text-dim">
            {control.id}
          </span>

          {/* Bar */}
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-corsair-text group-hover:text-corsair-gold transition-colors">
                {control.name}
              </span>
              <Badge
                variant="outline"
                className={`ml-2 border-transparent font-pixel text-[7px] ${label.color}`}
              >
                L{control.level}
              </Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-corsair-surface">
              <motion.div
                className={`h-full rounded-full ${barColors[control.level]}`}
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: index * 0.08, ease: "easeOut" }}
                style={{ maxWidth: control.level === 0 ? "20%" : control.level === 1 ? "50%" : "75%" }}
              />
            </div>
          </div>

          {/* Expand indicator */}
          <span className="flex-shrink-0 font-mono text-xs text-corsair-text-dim transition-transform group-hover:text-corsair-gold">
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        </div>
      </button>

      {/* Expanded rule trace */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="ml-[76px] mr-3 mb-2 rounded-lg border border-corsair-border bg-[#0A0A0A] p-4">
              {/* Evidence */}
              <p className="mb-3 text-xs text-corsair-text-dim">
                <span className="text-corsair-gold">Evidence:</span>{" "}
                {control.evidence}
              </p>

              {/* Rule trace */}
              <div className="font-mono text-[11px] leading-relaxed">
                {control.ruleTrace.map((rule, i) => {
                  const isResult = rule.startsWith("RESULT:");
                  const isOverride = rule.startsWith("OVERRIDE:");
                  const isSafeguard = rule.startsWith("SAFEGUARD:");
                  return (
                    <div
                      key={i}
                      className={
                        isResult
                          ? "text-corsair-green font-semibold"
                          : isOverride
                            ? "text-corsair-gold"
                            : isSafeguard
                              ? "text-corsair-crimson"
                              : "text-corsair-text-dim"
                      }
                    >
                      {i < control.ruleTrace.length - 1 ? "\u251C\u2500\u2500 " : "\u2514\u2500\u2500 "}
                      {rule}
                    </div>
                  );
                })}
              </div>

              {/* Methodology */}
              <div className="mt-2 flex items-center gap-2">
                <span className="font-pixel text-[7px] text-corsair-text-dim">
                  METHOD
                </span>
                <Badge variant="outline" className="border-corsair-border text-[10px] text-corsair-text-dim">
                  {control.methodology}
                </Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AssuranceLadder() {
  const breakdown = ANATOMY_ASSURANCE.breakdown;

  return (
    <div>
      {/* Control list with bars */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        }}
        className="mb-8 space-y-1"
      >
        {ANATOMY_CONTROLS.map((control, i) => (
          <ControlRow key={control.id} control={control} index={i} />
        ))}
      </motion.div>

      {/* Assurance breakdown summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-xl border border-corsair-border bg-corsair-surface p-5"
      >
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-text-dim">
          ASSURANCE BREAKDOWN
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(breakdown).map(([level, count]) => {
            const label = ASSURANCE_LABELS[Number(level)];
            return (
              <div key={level} className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`border-transparent font-pixel text-[8px] ${label.color}`}
                >
                  L{level}
                </Badge>
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-corsair-deep">
                    <div
                      className={`h-full rounded-full ${barColors[Number(level)]}`}
                      style={{ width: `${(count / 82) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-xs text-corsair-text-dim">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Overall declared level */}
        <div className="mt-4 flex items-center gap-3 border-t border-corsair-border pt-4">
          <span className="text-sm text-corsair-text-dim">Declared Level:</span>
          <Badge className={`font-pixel text-[9px] ${ASSURANCE_LABELS[ANATOMY_ASSURANCE.declared].bgColor} ${ASSURANCE_LABELS[ANATOMY_ASSURANCE.declared].color} border-transparent`}>
            L{ANATOMY_ASSURANCE.declared} — {ASSURANCE_LABELS[ANATOMY_ASSURANCE.declared].name}
          </Badge>
          <span className="text-xs text-corsair-text-dim">
            (min of all in-scope controls)
          </span>
        </div>
      </motion.div>
    </div>
  );
}
