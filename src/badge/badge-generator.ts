/**
 * Badge Generator — Shields.io-style SVG badges
 *
 * Generates flat SVG badges with two segments (label | value).
 * Zero external dependencies. Used for CPOE verification status badges.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface BadgeParams {
  label: string;
  value: string;
  color: string;
  labelColor?: string; // defaults to #555
  link?: string;
}

export type BadgeTier = "verified" | "self-signed" | "expired" | "invalid";

// =============================================================================
// CONSTANTS
// =============================================================================

const CHAR_WIDTH = 6.5;
const PADDING = 10;
const HEIGHT = 20;
const FONT_SIZE = 11;
const BORDER_RADIUS = 3;
const FONT_FAMILY = "Verdana,Geneva,DejaVu Sans,sans-serif";
const DEFAULT_LABEL_COLOR = "#555";

const TIER_COLORS: Record<BadgeTier, string> = {
  verified: "#2ECC71",
  "self-signed": "#F5C542",
  expired: "#6B7280",
  invalid: "#E63946",
};

// =============================================================================
// SVG GENERATION
// =============================================================================

/**
 * Generate a Shields.io-style flat SVG badge.
 */
export function generateBadgeSVG(params: BadgeParams): string {
  const labelColor = params.labelColor ?? DEFAULT_LABEL_COLOR;
  const labelText = escapeXml(params.label);
  const valueText = escapeXml(params.value);

  const labelWidth = Math.round(params.label.length * CHAR_WIDTH + PADDING * 2);
  const valueWidth = Math.round(params.value.length * CHAR_WIDTH + PADDING * 2);
  const totalWidth = labelWidth + valueWidth;

  const labelX = labelWidth / 2;
  const valueX = labelWidth + valueWidth / 2;

  const inner = `<rect rx="${BORDER_RADIUS}" width="${totalWidth}" height="${HEIGHT}" fill="${labelColor}"/>` +
    `<rect rx="${BORDER_RADIUS}" x="${labelWidth}" width="${valueWidth}" height="${HEIGHT}" fill="${params.color}"/>` +
    `<rect x="${labelWidth}" width="${Math.min(BORDER_RADIUS, valueWidth)}" height="${HEIGHT}" fill="${params.color}"/>` +
    `<g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}">` +
    `<text x="${labelX}" y="${HEIGHT - 5.5}">${labelText}</text>` +
    `<text x="${valueX}" y="${HEIGHT - 5.5}">${valueText}</text>` +
    `</g>`;

  const content = params.link
    ? `<a href="${escapeXml(params.link)}">${inner}</a>`
    : inner;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${HEIGHT}">${content}</svg>`;
}

/**
 * Generate a CPOE verification badge for a given tier.
 */
export function generateCPOEBadge(
  tier: BadgeTier,
  options?: { controls?: number; score?: number },
): string {
  const color = TIER_COLORS[tier];
  const value = buildCPOEValue(tier, options);

  return generateBadgeSVG({
    label: "CPOE",
    value,
    color,
  });
}

// =============================================================================
// HELPERS
// =============================================================================

function buildCPOEValue(
  tier: BadgeTier,
  options?: { controls?: number; score?: number },
): string {
  if (tier === "expired") return "Expired";
  if (tier === "invalid") return "Invalid";

  const parts: string[] = [];

  const tierLabel = tier === "verified" ? "Verified" : "Self-Signed";
  parts.push(tierLabel);

  if (options?.score !== undefined) {
    parts.push(`${options.score}%`);
  }

  if (options?.controls !== undefined) {
    parts.push(`${options.controls} controls`);
  }

  return parts.join(" \u00B7 ");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
