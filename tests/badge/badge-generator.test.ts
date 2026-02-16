/**
 * Badge Generator Tests — TDD
 *
 * Tests for Shields.io-style SVG badge generation.
 * Covers: all 4 tiers, custom params, link embedding, text width, CPOE badges.
 */

import { describe, test, expect } from "bun:test";
import {
  generateBadgeSVG,
  generateCPOEBadge,
} from "../../src/badge/badge-generator";
import type { BadgeParams, BadgeTier } from "../../src/badge/badge-generator";

// =============================================================================
// SVG HELPERS
// =============================================================================

function isSVG(str: string): boolean {
  return str.startsWith("<svg") && str.endsWith("</svg>");
}

function hasText(svg: string, text: string): boolean {
  return svg.includes(text);
}

// =============================================================================
// generateBadgeSVG — CUSTOM PARAMS
// =============================================================================

describe("generateBadgeSVG", () => {
  test("generates valid SVG with label and value", () => {
    const svg = generateBadgeSVG({
      label: "build",
      value: "passing",
      color: "#2ECC71",
    });
    expect(isSVG(svg)).toBe(true);
    expect(hasText(svg, "build")).toBe(true);
    expect(hasText(svg, "passing")).toBe(true);
  });

  test("uses default labelColor #555 when not provided", () => {
    const svg = generateBadgeSVG({
      label: "test",
      value: "ok",
      color: "#2ECC71",
    });
    expect(svg).toContain("#555");
  });

  test("uses custom labelColor when provided", () => {
    const svg = generateBadgeSVG({
      label: "test",
      value: "ok",
      color: "#2ECC71",
      labelColor: "#333",
    });
    expect(svg).toContain("#333");
  });

  test("contains the specified value color", () => {
    const svg = generateBadgeSVG({
      label: "status",
      value: "active",
      color: "#E63946",
    });
    expect(svg).toContain("#E63946");
  });

  test("wraps in anchor tag when link is provided", () => {
    const svg = generateBadgeSVG({
      label: "docs",
      value: "read",
      color: "#2ECC71",
      link: "https://grcorsair.com/docs",
    });
    expect(svg).toContain("<a");
    expect(svg).toContain("https://grcorsair.com/docs");
    expect(svg).toContain("</a>");
  });

  test("does not include anchor tag when no link", () => {
    const svg = generateBadgeSVG({
      label: "test",
      value: "ok",
      color: "#2ECC71",
    });
    expect(svg).not.toContain("<a");
  });

  test("uses Verdana font family", () => {
    const svg = generateBadgeSVG({
      label: "font",
      value: "check",
      color: "#555",
    });
    expect(svg).toContain("Verdana");
  });

  test("uses 11px font size", () => {
    const svg = generateBadgeSVG({
      label: "font",
      value: "size",
      color: "#555",
    });
    expect(svg).toContain("11");
  });

  test("has rounded corners (rx attribute)", () => {
    const svg = generateBadgeSVG({
      label: "corner",
      value: "test",
      color: "#555",
    });
    expect(svg).toContain('rx="3"');
  });

  test("uses white text fill", () => {
    const svg = generateBadgeSVG({
      label: "text",
      value: "color",
      color: "#555",
    });
    expect(svg).toContain("#fff");
  });

  test("wider badges for longer text", () => {
    const shortSvg = generateBadgeSVG({
      label: "a",
      value: "b",
      color: "#555",
    });
    const longSvg = generateBadgeSVG({
      label: "very long label text",
      value: "very long value text",
      color: "#555",
    });

    // Extract width from SVG
    const shortWidth = parseInt(shortSvg.match(/width="(\d+)"/)?.[1] || "0");
    const longWidth = parseInt(longSvg.match(/width="(\d+)"/)?.[1] || "0");

    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  test("escapes special XML characters in label and value", () => {
    const svg = generateBadgeSVG({
      label: "test <&>",
      value: 'val "quotes"',
      color: "#555",
    });
    expect(isSVG(svg)).toBe(true);
    expect(svg).not.toContain("test <&>");
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&amp;");
  });
});

// =============================================================================
// generateCPOEBadge — ALL 4 TIERS
// =============================================================================

describe("generateCPOEBadge — tier badges", () => {
  const tiers: BadgeTier[] = ["verified", "self-signed", "expired", "invalid"];

  for (const tier of tiers) {
    test(`generates valid SVG for tier: ${tier}`, () => {
      const svg = generateCPOEBadge(tier);
      expect(isSVG(svg)).toBe(true);
      expect(hasText(svg, "CPOE")).toBe(true);
    });
  }

  test("verified badge uses green #2ECC71", () => {
    const svg = generateCPOEBadge("verified");
    expect(svg).toContain("#2ECC71");
  });

  test("self-signed badge uses gold #F5C542", () => {
    const svg = generateCPOEBadge("self-signed");
    expect(svg).toContain("#F5C542");
  });

  test("expired badge uses gray #6B7280", () => {
    const svg = generateCPOEBadge("expired");
    expect(svg).toContain("#6B7280");
  });

  test("invalid badge uses red #E63946", () => {
    const svg = generateCPOEBadge("invalid");
    expect(svg).toContain("#E63946");
  });
});

// =============================================================================
// generateCPOEBadge — OPTIONS
// =============================================================================

describe("generateCPOEBadge — options", () => {
  test("verified badge includes controls count when provided", () => {
    const svg = generateCPOEBadge("verified", { controls: 22 });
    expect(hasText(svg, "22 controls")).toBe(true);
  });

  test("verified badge shows score when provided", () => {
    const svg = generateCPOEBadge("verified", { score: 95 });
    expect(hasText(svg, "95%")).toBe(true);
  });

  test("expired badge ignores options (just shows Expired)", () => {
    const svg = generateCPOEBadge("expired", { controls: 10 });
    expect(hasText(svg, "Expired")).toBe(true);
  });

  test("invalid badge ignores options (just shows Invalid)", () => {
    const svg = generateCPOEBadge("invalid", { score: 80 });
    expect(hasText(svg, "Invalid")).toBe(true);
  });

  test("verified badge with all options", () => {
    const svg = generateCPOEBadge("verified", {
      controls: 46,
      score: 91,
    });
    expect(isSVG(svg)).toBe(true);
    expect(hasText(svg, "CPOE")).toBe(true);
    expect(hasText(svg, "91%")).toBe(true);
  });
});

// =============================================================================
// TEXT WIDTH CALCULATION
// =============================================================================

describe("generateBadgeSVG — text width calculation", () => {
  test("single character label produces narrow badge", () => {
    const svg = generateBadgeSVG({
      label: "X",
      value: "Y",
      color: "#555",
    });
    const width = parseInt(svg.match(/width="(\d+)"/)?.[1] || "0");
    // Single char ~ 6.5px + padding. Should be relatively small.
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(100);
  });

  test("empty strings produce minimal badge", () => {
    const svg = generateBadgeSVG({
      label: "",
      value: "",
      color: "#555",
    });
    expect(isSVG(svg)).toBe(true);
    const width = parseInt(svg.match(/width="(\d+)"/)?.[1] || "0");
    expect(width).toBeGreaterThan(0);
  });

  test("text width scales approximately 6.5px per character", () => {
    const short = generateBadgeSVG({
      label: "AB",
      value: "CD",
      color: "#555",
    });
    const long = generateBadgeSVG({
      label: "ABCDEFGHIJ",
      value: "KLMNOPQRST",
      color: "#555",
    });

    const shortWidth = parseInt(short.match(/width="(\d+)"/)?.[1] || "0");
    const longWidth = parseInt(long.match(/width="(\d+)"/)?.[1] || "0");

    // Long has 16 more characters total, should be roughly 16 * 6.5 = 104px wider
    const diff = longWidth - shortWidth;
    expect(diff).toBeGreaterThan(80);
    expect(diff).toBeLessThan(140);
  });
});
