"use client";

import { motion } from "motion/react";
import {
  MERKLE_TREE_EXAMPLE,
  SCITT_RECEIPT_EXAMPLE,
  COSE_RECEIPT_STRUCTURE,
} from "@/data/protocol-data";

function MerkleTree() {
  const { leafLabels, targetLeaf } = MERKLE_TREE_EXAMPLE;

  // Build a simple visual Merkle tree with 8 leaves (3 levels)
  // Level 0 (leaves): 8 nodes
  // Level 1: 4 nodes
  // Level 2: 2 nodes
  // Level 3 (root): 1 node

  // Calculate which nodes are on the proof path for leaf at index 2
  // Leaf 2's sibling is leaf 3 (proof node)
  // Parent of (2,3) is node 1 at level 1 — sibling is node 0 at level 1 (proof node)
  // Parent of (0,1) at level 1 is node 0 at level 2 — sibling is node 1 at level 2 (proof node)
  // Then root

  const proofLeaf = targetLeaf; // index 2
  const proofSibling = 3; // sibling of target leaf
  const proofLevel1 = 0; // sibling at level 1
  const proofLevel2 = 1; // sibling at level 2

  type NodeState = "target" | "proof" | "normal" | "root";

  const getLeafState = (i: number): NodeState => {
    if (i === proofLeaf) return "target";
    if (i === proofSibling) return "proof";
    return "normal";
  };

  const getLevel1State = (i: number): NodeState => {
    if (i === 1) return "target"; // parent of target leaf
    if (i === proofLevel1) return "proof";
    return "normal";
  };

  const getLevel2State = (i: number): NodeState => {
    if (i === 0) return "target"; // parent path
    if (i === proofLevel2) return "proof";
    return "normal";
  };

  const stateColors: Record<NodeState, { fill: string; stroke: string; text: string }> = {
    target: { fill: "#D4A853", stroke: "#D4A853", text: "#0A0E17" },
    proof: { fill: "#0A0E17", stroke: "#2ECC71", text: "#2ECC71" },
    normal: { fill: "#0A0E17", stroke: "#2A3150", text: "#8B92A8" },
    root: { fill: "#0A0E17", stroke: "#D4A853", text: "#D4A853" },
  };

  const nodeW = 64;
  const nodeH = 28;
  const svgW = 700;
  const levelY = [240, 170, 100, 30]; // y positions for each level
  const levelCounts = [8, 4, 2, 1];

  const getNodeX = (level: number, index: number) => {
    const count = levelCounts[level];
    const totalWidth = count * nodeW + (count - 1) * 16;
    const startX = (svgW - totalWidth) / 2;
    return startX + index * (nodeW + 16) + nodeW / 2;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="overflow-x-auto"
    >
      <svg viewBox={`0 0 ${svgW} 290`} className="w-full min-w-[500px]">
        {/* Connection lines */}
        {/* Level 0 to Level 1 */}
        {Array.from({ length: 4 }).map((_, i) => (
          <g key={`l01-${i}`}>
            <line
              x1={getNodeX(0, i * 2)}
              y1={levelY[0]}
              x2={getNodeX(1, i)}
              y2={levelY[1] + nodeH}
              stroke="var(--color-corsair-border)"
              strokeWidth={1}
              opacity={0.4}
            />
            <line
              x1={getNodeX(0, i * 2 + 1)}
              y1={levelY[0]}
              x2={getNodeX(1, i)}
              y2={levelY[1] + nodeH}
              stroke="var(--color-corsair-border)"
              strokeWidth={1}
              opacity={0.4}
            />
          </g>
        ))}
        {/* Level 1 to Level 2 */}
        {Array.from({ length: 2 }).map((_, i) => (
          <g key={`l12-${i}`}>
            <line
              x1={getNodeX(1, i * 2)}
              y1={levelY[1]}
              x2={getNodeX(2, i)}
              y2={levelY[2] + nodeH}
              stroke="var(--color-corsair-border)"
              strokeWidth={1}
              opacity={0.4}
            />
            <line
              x1={getNodeX(1, i * 2 + 1)}
              y1={levelY[1]}
              x2={getNodeX(2, i)}
              y2={levelY[2] + nodeH}
              stroke="var(--color-corsair-border)"
              strokeWidth={1}
              opacity={0.4}
            />
          </g>
        ))}
        {/* Level 2 to Root */}
        <line
          x1={getNodeX(2, 0)}
          y1={levelY[2]}
          x2={getNodeX(3, 0)}
          y2={levelY[3] + nodeH}
          stroke="var(--color-corsair-border)"
          strokeWidth={1}
          opacity={0.4}
        />
        <line
          x1={getNodeX(2, 1)}
          y1={levelY[2]}
          x2={getNodeX(3, 0)}
          y2={levelY[3] + nodeH}
          stroke="var(--color-corsair-border)"
          strokeWidth={1}
          opacity={0.4}
        />

        {/* Highlighted proof path lines */}
        {/* Leaf 2 → Level 1 node 1 */}
        <motion.line
          x1={getNodeX(0, 2)} y1={levelY[0]}
          x2={getNodeX(1, 1)} y2={levelY[1] + nodeH}
          stroke="#D4A853" strokeWidth={2}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
        {/* Level 1 node 1 → Level 2 node 0 */}
        <motion.line
          x1={getNodeX(1, 1)} y1={levelY[1]}
          x2={getNodeX(2, 0)} y2={levelY[2] + nodeH}
          stroke="#D4A853" strokeWidth={2}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
        />
        {/* Level 2 node 0 → Root */}
        <motion.line
          x1={getNodeX(2, 0)} y1={levelY[2]}
          x2={getNodeX(3, 0)} y2={levelY[3] + nodeH}
          stroke="#D4A853" strokeWidth={2}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.7 }}
        />

        {/* Leaf nodes */}
        {leafLabels.map((label, i) => {
          const state = getLeafState(i);
          const colors = stateColors[state];
          const x = getNodeX(0, i);
          return (
            <motion.g
              key={label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <rect
                x={x - nodeW / 2}
                y={levelY[0]}
                width={nodeW}
                height={nodeH}
                rx={4}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={state === "normal" ? 1 : 2}
              />
              <text
                x={x}
                y={levelY[0] + nodeH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize={8}
                fontFamily="monospace"
              >
                {label}
              </text>
            </motion.g>
          );
        })}

        {/* Level 1 nodes */}
        {Array.from({ length: 4 }).map((_, i) => {
          const state = getLevel1State(i);
          const colors = stateColors[state];
          const x = getNodeX(1, i);
          return (
            <motion.g
              key={`l1-${i}`}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.05 }}
            >
              <rect
                x={x - nodeW / 2}
                y={levelY[1]}
                width={nodeW}
                height={nodeH}
                rx={4}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={state === "normal" ? 1 : 2}
              />
              <text
                x={x}
                y={levelY[1] + nodeH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize={8}
                fontFamily="monospace"
              >
                H({i * 2},{i * 2 + 1})
              </text>
            </motion.g>
          );
        })}

        {/* Level 2 nodes */}
        {Array.from({ length: 2 }).map((_, i) => {
          const state = getLevel2State(i);
          const colors = stateColors[state];
          const x = getNodeX(2, i);
          return (
            <motion.g
              key={`l2-${i}`}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.05 }}
            >
              <rect
                x={x - nodeW / 2}
                y={levelY[2]}
                width={nodeW}
                height={nodeH}
                rx={4}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={state === "normal" ? 1 : 2}
              />
              <text
                x={x}
                y={levelY[2] + nodeH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize={8}
                fontFamily="monospace"
              >
                H({i * 4}..{i * 4 + 3})
              </text>
            </motion.g>
          );
        })}

        {/* Root */}
        <motion.g
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <rect
            x={getNodeX(3, 0) - nodeW / 2}
            y={levelY[3]}
            width={nodeW}
            height={nodeH}
            rx={4}
            fill={stateColors.root.fill}
            stroke={stateColors.root.stroke}
            strokeWidth={2}
          />
          <text
            x={getNodeX(3, 0)}
            y={levelY[3] + nodeH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={stateColors.root.text}
            fontSize={8}
            fontFamily="monospace"
          >
            ROOT
          </text>
        </motion.g>

        {/* Legend */}
        <g transform="translate(10, 282)">
          <rect x={0} y={0} width={8} height={8} rx={2} fill="#D4A853" />
          <text x={12} y={7} fill="#8B92A8" fontSize={7}>Target CPOE</text>
          <rect x={90} y={0} width={8} height={8} rx={2} fill="#0A0E17" stroke="#2ECC71" strokeWidth={1.5} />
          <text x={102} y={7} fill="#8B92A8" fontSize={7}>Proof sibling</text>
          <line x1={190} y1={4} x2={210} y2={4} stroke="#D4A853" strokeWidth={2} />
          <text x={214} y={7} fill="#8B92A8" fontSize={7}>Verification path</text>
        </g>
      </svg>
    </motion.div>
  );
}

export function MerkleViz() {
  return (
    <div className="space-y-6">
      {/* Merkle tree */}
      <div className="rounded-xl border border-corsair-border bg-[#0A0A0A] p-5">
        <p className="mb-4 font-pixel text-[8px] tracking-widest text-corsair-gold/60">
          MERKLE INCLUSION PROOF — CPOE #3 IN 8-LEAF TREE
        </p>
        <MerkleTree />
        <p className="mt-4 text-xs text-corsair-text-dim">
          To verify CPOE #3 is in the log, a verifier only needs the{" "}
          <span className="text-corsair-green">green sibling hashes</span> and the{" "}
          <span className="text-corsair-gold">root hash</span>.
          Three hashes prove membership in a tree of 1,247 entries — O(log n) verification.
        </p>
      </div>

      {/* COSE Receipt */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
        >
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-corsair-gold/60" />
            <span className="font-pixel text-[7px] tracking-wider text-corsair-gold">
              COSE_SIGN1 RECEIPT
            </span>
          </div>
          <div className="divide-y divide-corsair-border/30">
            {COSE_RECEIPT_STRUCTURE.map((field) => (
              <div key={field.field} className="px-4 py-2.5">
                <div className="flex items-start gap-3">
                  <span className="w-32 flex-shrink-0 font-mono text-[10px] text-corsair-turquoise">
                    {field.field}
                  </span>
                  <span className="font-mono text-[10px] text-corsair-text-dim">
                    {field.value}
                  </span>
                </div>
                <p className="mt-0.5 pl-32 text-[9px] text-corsair-text-dim/50 sm:pl-[8.5rem]">
                  {field.note}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="overflow-hidden rounded-xl border border-corsair-border bg-[#0A0A0A]"
        >
          <div className="flex items-center gap-2 border-b border-corsair-border px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-corsair-turquoise/60" />
            <span className="font-pixel text-[7px] tracking-wider text-corsair-turquoise">
              SCITT RECEIPT
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-corsair-text-dim">
            {SCITT_RECEIPT_EXAMPLE}
          </pre>
        </motion.div>
      </div>
    </div>
  );
}
