"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ASSURANCE_DIMENSIONS, type DimensionData } from "@/data/protocol-data";

function RadarChart({ dimensions }: { dimensions: DimensionData[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const cx = 150;
  const cy = 150;
  const maxR = 110;
  const n = dimensions.length;

  // Generate polygon points for a given radius function
  const polygonPoints = (radiusFn: (i: number) => number) =>
    dimensions
      .map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = radiusFn(i);
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      })
      .join(" ");

  // Grid rings at 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 300" className="w-full max-w-sm">
        {/* Grid rings */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(() => maxR * level)}
            fill="none"
            stroke="var(--color-corsair-border)"
            strokeWidth={level === 1 ? 1 : 0.5}
            opacity={0.5}
          />
        ))}

        {/* Axis lines */}
        {dimensions.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke="var(--color-corsair-border)"
              strokeWidth={0.5}
              opacity={0.3}
            />
          );
        })}

        {/* Data polygon */}
        <motion.polygon
          points={polygonPoints((i) => (dimensions[i].score / 100) * maxR)}
          fill="rgba(212,168,83,0.15)"
          stroke="#D4A853"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.3 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points + labels */}
        {dimensions.map((dim, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const r = (dim.score / 100) * maxR;
          const labelR = maxR + 20;
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy + labelR * Math.sin(angle);
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={dim.key}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Data point */}
              <motion.circle
                cx={px}
                cy={py}
                r={isHovered ? 5 : 3.5}
                fill={dim.score >= 80 ? "#2ECC71" : dim.score >= 50 ? "#D4A853" : "#C0392B"}
                initial={{ r: 0 }}
                whileInView={{ r: isHovered ? 5 : 3.5 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              />

              {/* Label */}
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-corsair-text-dim text-[9px]"
                style={{
                  fill: isHovered ? "#D4A853" : undefined,
                  fontWeight: isHovered ? 600 : 400,
                }}
              >
                {dim.name}
              </text>

              {/* Score */}
              <text
                x={lx}
                y={ly + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-corsair-text-dim text-[8px] font-mono"
              >
                {dim.score}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover detail */}
      <AnimatePresence mode="wait">
        {hoveredIndex !== null && (
          <motion.div
            key={hoveredIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="mt-2 rounded-lg border border-corsair-border bg-[#0A0A0A] px-4 py-2.5 text-center"
          >
            <p className="text-sm font-medium text-corsair-gold">
              {dimensions[hoveredIndex].name}
            </p>
            <p className="text-xs text-corsair-text-dim">
              {dimensions[hoveredIndex].description}
            </p>
            <p className="mt-1 font-mono text-[10px] text-corsair-turquoise">
              Source: {dimensions[hoveredIndex].source}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DimensionThresholds({ dimensions }: { dimensions: DimensionData[] }) {
  return (
    <div className="space-y-3">
      <p className="font-pixel text-[8px] tracking-widest text-corsair-gold/60">
        DIMENSION GATING THRESHOLDS
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-corsair-border">
              <th className="pb-2 pr-4 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
                DIMENSION
              </th>
              <th className="pb-2 pr-4 font-pixel text-[7px] tracking-wider text-corsair-gold">
                L1
              </th>
              <th className="pb-2 pr-4 font-pixel text-[7px] tracking-wider text-corsair-green">
                L2
              </th>
              <th className="pb-2 pr-4 font-pixel text-[7px] tracking-wider text-blue-400">
                L3
              </th>
              <th className="pb-2 font-pixel text-[7px] tracking-wider text-corsair-text-dim">
                SCORE
              </th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dim, i) => (
              <motion.tr
                key={dim.key}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-corsair-border/30"
              >
                <td className="py-2 pr-4 text-xs text-corsair-text">
                  {dim.name}
                </td>
                <td className="py-2 pr-4 font-mono text-[11px] text-corsair-text-dim">
                  {"\u2265"}{dim.thresholds.L1}
                </td>
                <td className="py-2 pr-4 font-mono text-[11px] text-corsair-text-dim">
                  {"\u2265"}{dim.thresholds.L2}
                </td>
                <td className="py-2 pr-4 font-mono text-[11px] text-corsair-text-dim">
                  {"\u2265"}{dim.thresholds.L3}
                </td>
                <td className="py-2">
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      dim.score >= 80
                        ? "text-corsair-green"
                        : dim.score >= 50
                          ? "text-corsair-gold"
                          : "text-corsair-crimson"
                    }`}
                  >
                    {dim.score}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DimensionRadar() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <RadarChart dimensions={ASSURANCE_DIMENSIONS} />
      <DimensionThresholds dimensions={ASSURANCE_DIMENSIONS} />
    </div>
  );
}
