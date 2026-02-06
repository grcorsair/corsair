/**
 * Pixel Art Pipeline Stage Icons
 *
 * Each icon is a 16x16 grid rendered as SVG <rect> elements.
 * Colors use the Corsair palette. shapeRendering="crispEdges"
 * gives the authentic pixel art look at any scale.
 */

// Palette shorthand for grid definitions
const C = "#00CFFF"; // cyan
const G = "#D4A853"; // gold
const R = "#C0392B"; // crimson
const N = "#1B2A4A"; // navy
const T = "#7FDBCA"; // turquoise
const K = "#2ECC71"; // green
const W = "#E2DFD6"; // text/white
const D = "#8B92A8"; // dim
const S = "#111833"; // surface
const _ = ""; // transparent

interface PixelIconProps {
  size?: number;
  className?: string;
}

function PixelGrid({
  grid,
  size = 32,
  className = "",
}: {
  grid: string[][];
  size?: number;
  className?: string;
}) {
  const cellSize = size / 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
    >
      {grid.map((row, y) =>
        row.map((color, x) =>
          color ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />
          ) : null
        )
      )}
    </svg>
  );
}

// ─── RECON: Telescope/Spyglass ──────────────────────
const reconGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, G, G, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, G, G, G, G, _],
  [_, _, _, _, _, _, _, _, _, _, G, G, C, C, G, _],
  [_, _, _, _, _, _, _, _, _, G, G, C, C, G, _, _],
  [_, _, _, _, _, _, _, _, G, N, N, N, G, _, _, _],
  [_, _, _, _, _, _, _, G, N, N, N, G, _, _, _, _],
  [_, _, _, _, _, _, G, N, N, N, G, _, _, _, _, _],
  [_, _, _, _, _, G, N, N, N, G, _, _, _, _, _, _],
  [_, _, _, _, G, N, N, N, G, _, _, _, _, _, _, _],
  [_, _, _, G, N, N, N, G, _, _, _, _, _, _, _, _],
  [_, _, G, N, N, N, G, _, _, _, _, _, _, _, _, _],
  [_, G, G, N, N, G, _, _, _, _, _, _, _, _, _, _],
  [_, G, G, G, G, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, G, G, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── SPYGLASS: Compass ──────────────────────────────
const spyglassGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, T, T, T, T, _, _, _, _, _, _],
  [_, _, _, _, T, T, N, N, N, N, T, T, _, _, _, _],
  [_, _, _, T, N, N, N, N, N, N, N, N, T, _, _, _],
  [_, _, T, N, N, N, N, T, N, N, N, N, N, T, _, _],
  [_, _, T, N, N, N, T, T, T, N, N, N, N, T, _, _],
  [_, T, N, N, N, T, T, R, T, T, N, N, N, N, T, _],
  [_, T, N, N, T, T, R, R, R, T, T, N, N, N, T, _],
  [_, T, N, N, N, T, T, R, T, T, N, N, N, N, T, _],
  [_, T, N, N, N, N, T, T, T, N, N, N, N, N, T, _],
  [_, _, T, N, N, N, N, T, N, N, N, N, N, T, _, _],
  [_, _, T, N, N, N, N, N, N, N, N, N, N, T, _, _],
  [_, _, _, T, N, N, N, N, N, N, N, N, T, _, _, _],
  [_, _, _, _, T, T, N, N, N, N, T, T, _, _, _, _],
  [_, _, _, _, _, _, T, T, T, T, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── MARK: Anchor ───────────────────────────────────
const markGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
  [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, G, G, G, G, G, G, G, G, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, G, G, _, _, _, G, G, _, _, _, G, G, _, _],
  [_, _, _, G, G, _, _, G, G, _, _, G, G, _, _, _],
  [_, _, _, _, G, G, G, G, G, G, G, G, _, _, _, _],
  [_, _, _, _, _, G, G, G, G, G, G, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── RAID: Crossed Swords ───────────────────────────
const raidGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, R, R, _, _, _, _, _, _, _, _, _, _, C, C, _],
  [_, _, R, R, _, _, _, _, _, _, _, _, C, C, _, _],
  [_, _, _, R, R, _, _, _, _, _, _, C, C, _, _, _],
  [_, _, _, _, R, C, _, _, _, _, C, R, _, _, _, _],
  [_, _, _, _, _, C, C, _, _, C, C, _, _, _, _, _],
  [_, _, _, _, _, _, C, C, C, C, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, C, C, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, C, C, C, C, _, _, _, _, _, _],
  [_, _, _, _, _, C, C, _, _, C, C, _, _, _, _, _],
  [_, _, _, _, C, R, _, _, _, _, R, C, _, _, _, _],
  [_, _, _, C, C, _, _, _, _, _, _, C, C, _, _, _],
  [_, _, C, C, _, _, _, _, _, _, _, _, C, C, _, _],
  [_, C, C, _, _, _, _, _, _, _, _, _, _, C, C, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── PLUNDER: Treasure Chest ────────────────────────
const plunderGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, G, G, G, G, G, G, G, G, G, G, _, _, _],
  [_, _, G, G, N, N, N, N, N, N, N, N, G, G, _, _],
  [_, _, G, N, N, N, N, G, G, N, N, N, N, G, _, _],
  [_, _, G, N, N, N, N, G, G, N, N, N, N, G, _, _],
  [_, _, G, G, G, G, G, G, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, C, C, G, G, G, G, G, _, _],
  [_, _, G, N, N, N, N, C, C, N, N, N, N, G, _, _],
  [_, _, G, N, N, N, N, N, N, N, N, N, N, G, _, _],
  [_, _, G, N, N, N, N, N, N, N, N, N, N, G, _, _],
  [_, _, G, N, N, N, N, N, N, N, N, N, N, G, _, _],
  [_, _, G, G, G, G, G, G, G, G, G, G, G, G, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── CHART: Map/Scroll ──────────────────────────────
const chartGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, G, G, G, G, G, G, G, G, G, _, _, _, _],
  [_, _, G, G, W, W, W, W, W, W, W, G, G, _, _, _],
  [_, _, G, W, W, W, W, W, W, W, W, W, G, _, _, _],
  [_, _, G, W, W, T, T, T, W, W, W, W, G, _, _, _],
  [_, _, G, W, W, W, W, W, T, W, W, W, G, _, _, _],
  [_, _, G, W, W, T, T, T, T, T, W, W, G, _, _, _],
  [_, _, G, W, W, W, W, W, W, W, W, W, G, _, _, _],
  [_, _, G, W, W, T, T, T, T, W, W, W, G, _, _, _],
  [_, _, G, W, W, W, W, W, W, W, W, W, G, _, _, _],
  [_, _, G, W, W, T, T, W, W, W, W, W, G, _, _, _],
  [_, _, G, W, W, W, W, W, W, W, W, W, G, _, _, _],
  [_, _, G, G, W, W, W, W, W, W, W, G, G, _, _, _],
  [_, _, _, G, G, G, G, G, G, G, G, G, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── QUARTER: Ship's Wheel ──────────────────────────
const quarterGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
  [_, _, _, G, _, _, G, N, N, G, _, _, G, _, _, _],
  [_, _, _, _, G, _, G, N, N, G, _, G, _, _, _, _],
  [_, _, _, _, _, G, G, N, N, G, G, _, _, _, _, _],
  [_, _, G, G, G, G, N, N, N, N, G, G, G, G, _, _],
  [_, G, G, N, N, N, N, N, N, N, N, N, N, G, G, _],
  [_, G, G, N, N, N, N, N, N, N, N, N, N, G, G, _],
  [_, _, G, G, G, G, N, N, N, N, G, G, G, G, _, _],
  [_, _, _, _, _, G, G, N, N, G, G, _, _, _, _, _],
  [_, _, _, _, G, _, G, N, N, G, _, G, _, _, _, _],
  [_, _, _, G, _, _, G, N, N, G, _, _, G, _, _, _],
  [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, G, G, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── MARQUE: Wax Seal ───────────────────────────────
const marqueGrid = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, R, R, R, R, R, R, _, _, _, _, _],
  [_, _, _, _, R, R, R, R, R, R, R, R, _, _, _, _],
  [_, _, _, R, R, R, R, R, R, R, R, R, R, _, _, _],
  [_, _, R, R, R, R, G, G, G, G, R, R, R, R, _, _],
  [_, _, R, R, R, G, G, K, K, G, G, R, R, R, _, _],
  [_, _, R, R, R, G, K, K, K, K, G, R, R, R, _, _],
  [_, _, R, R, R, G, K, K, K, K, G, R, R, R, _, _],
  [_, _, R, R, R, G, G, K, K, G, G, R, R, R, _, _],
  [_, _, R, R, R, R, G, G, G, G, R, R, R, R, _, _],
  [_, _, _, R, R, R, R, R, R, R, R, R, R, _, _, _],
  [_, _, _, _, R, R, R, R, R, R, R, R, _, _, _, _],
  [_, _, _, _, _, R, R, R, R, R, R, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// ─── Exports ────────────────────────────────────────

export function ReconIcon(props: PixelIconProps) {
  return <PixelGrid grid={reconGrid} {...props} />;
}

export function SpyglassIcon(props: PixelIconProps) {
  return <PixelGrid grid={spyglassGrid} {...props} />;
}

export function MarkIcon(props: PixelIconProps) {
  return <PixelGrid grid={markGrid} {...props} />;
}

export function RaidIcon(props: PixelIconProps) {
  return <PixelGrid grid={raidGrid} {...props} />;
}

export function PlunderIcon(props: PixelIconProps) {
  return <PixelGrid grid={plunderGrid} {...props} />;
}

export function ChartIcon(props: PixelIconProps) {
  return <PixelGrid grid={chartGrid} {...props} />;
}

export function QuarterIcon(props: PixelIconProps) {
  return <PixelGrid grid={quarterGrid} {...props} />;
}

export function MarqueIcon(props: PixelIconProps) {
  return <PixelGrid grid={marqueGrid} {...props} />;
}

// Convenience map for dynamic lookup
export const pipelineIcons = {
  RECON: ReconIcon,
  SPYGLASS: SpyglassIcon,
  MARK: MarkIcon,
  RAID: RaidIcon,
  PLUNDER: PlunderIcon,
  CHART: ChartIcon,
  QUARTER: QuarterIcon,
  MARQUE: MarqueIcon,
} as const;
