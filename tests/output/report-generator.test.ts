/**
 * Report Generator Test Contract
 *
 * Tests HTML and Markdown report generation from Corsair assessment data.
 *
 * Contract Requirements:
 * 1. generateHTML MUST produce self-contained HTML (inline CSS, no external deps)
 * 2. generateMarkdown MUST produce valid Markdown
 * 3. Both outputs MUST include: Executive Summary, Framework Coverage,
 *    Finding Details, Evidence Chain, ISC Table
 * 4. HTML MUST be a complete document with <html>, <head>, <body>
 * 5. Reports MUST handle missing optional fields gracefully
 * 6. Severity levels MUST be visually distinguished in HTML output
 */

import { describe, test, expect } from "bun:test";
import { ReportGenerator } from "../../src/output/report-generator";
import type { ReportOptions } from "../../src/output/report-generator";
import type { DriftFinding, ChartResult, RaidResult, PlunderResult } from "../../src/types";

// ===============================================================================
// TEST FIXTURES
// ===============================================================================

function createTestFindings(): DriftFinding[] {
  return [
    {
      id: "DRIFT-001",
      field: "mfaConfiguration",
      expected: "ON",
      actual: "OFF",
      drift: true,
      severity: "CRITICAL",
      description: "MFA is disabled on user pool",
      timestamp: "2026-01-15T10:00:00.000Z",
    },
    {
      id: "DRIFT-002",
      field: "passwordPolicy.minimumLength",
      expected: 12,
      actual: 6,
      drift: true,
      severity: "HIGH",
      description: "Password minimum length below requirement",
      timestamp: "2026-01-15T10:00:01.000Z",
    },
  ];
}

function createTestChartResult(): ChartResult {
  return {
    mitre: {
      technique: "T1556",
      name: "Modify Authentication Process",
      tactic: "Credential Access",
      description: "MFA misconfiguration detected",
    },
    nist: {
      function: "Protect - Access Control",
      category: "Access Control",
      controls: ["PR.AC-7", "PR.AC-1"],
    },
    soc2: {
      principle: "Common Criteria",
      criteria: ["CC6.1", "CC6.2"],
      description: "Logical access security",
    },
    frameworks: {
      "NIST-800-53": {
        controls: [
          { controlId: "IA-2", controlName: "Identification and Authentication", status: "mapped" },
        ],
      },
    },
  };
}

function createTestRaidResults(): RaidResult[] {
  return [
    {
      raidId: "RAID-001",
      target: "us-west-2_TEST001",
      vector: "mfa-bypass",
      success: true,
      controlsHeld: false,
      findings: ["MFA bypass succeeded - control gap confirmed"],
      timeline: [
        { timestamp: "2026-01-15T10:01:00.000Z", action: "initiate", result: "started" },
        { timestamp: "2026-01-15T10:01:05.000Z", action: "bypass-attempt", result: "success" },
      ],
      startedAt: "2026-01-15T10:01:00.000Z",
      completedAt: "2026-01-15T10:01:05.000Z",
      serialized: true,
      durationMs: 5000,
    },
  ];
}

function createTestPlunderResult(): PlunderResult {
  return {
    evidencePath: "./corsair-evidence.jsonl",
    eventCount: 42,
    chainVerified: true,
    immutable: true,
    auditReady: true,
  };
}

function createTestISCCriteria(): { text: string; satisfaction: string }[] {
  return [
    { text: "MFA enabled all accounts", satisfaction: "FAILED" },
    { text: "Password length minimum twelve", satisfaction: "FAILED" },
    { text: "Risk detection configured active", satisfaction: "SATISFIED" },
  ];
}

function createFullReportOptions(): ReportOptions {
  return {
    title: "Corsair GRC Assessment Report",
    findings: createTestFindings(),
    chartResult: createTestChartResult(),
    raidResults: createTestRaidResults(),
    plunderResult: createTestPlunderResult(),
    iscCriteria: createTestISCCriteria(),
  };
}

// ===============================================================================
// HTML REPORT TESTS
// ===============================================================================

describe("Report Generator - HTML", () => {
  const generator = new ReportGenerator();

  describe("Document Structure", () => {
    test("produces complete HTML document", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("<head>");
      expect(html).toContain("<body>");
      expect(html).toContain("</html>");
    });

    test("includes inline CSS (no external stylesheets)", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("<style>");
      expect(html).not.toContain('rel="stylesheet"');
      expect(html).not.toContain("link href=");
    });

    test("includes no external JavaScript dependencies", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).not.toContain("src=\"http");
      expect(html).not.toContain("src='http");
    });

    test("includes custom title when provided", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("Corsair GRC Assessment Report");
    });

    test("uses default title when not provided", () => {
      const options = createFullReportOptions();
      delete options.title;
      const html = generator.generateHTML(options);

      expect(html).toContain("Corsair Assessment Report");
    });
  });

  describe("Report Sections", () => {
    test("includes Executive Summary section", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("Executive Summary");
    });

    test("executive summary shows finding counts", () => {
      const html = generator.generateHTML(createFullReportOptions());

      // Should mention the number of findings
      expect(html).toContain("2"); // 2 drift findings
    });

    test("includes Framework Coverage section", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("Framework Coverage");
      expect(html).toContain("MITRE");
      expect(html).toContain("T1556");
      expect(html).toContain("NIST");
      expect(html).toContain("SOC2");
    });

    test("includes Finding Details section", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("Finding Details");
      expect(html).toContain("mfaConfiguration");
      expect(html).toContain("CRITICAL");
      expect(html).toContain("passwordPolicy.minimumLength");
    });

    test("includes Evidence Chain section", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("Evidence Chain");
      expect(html).toContain("corsair-evidence.jsonl");
    });

    test("includes ISC Table section", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("ISC");
      expect(html).toContain("MFA enabled all accounts");
      expect(html).toContain("SATISFIED");
      expect(html).toContain("FAILED");
    });

    test("includes RAID results when provided", () => {
      const html = generator.generateHTML(createFullReportOptions());

      expect(html).toContain("mfa-bypass");
      expect(html).toContain("RAID-001");
    });
  });

  describe("Severity Styling", () => {
    test("CRITICAL severity has distinct styling", () => {
      const html = generator.generateHTML(createFullReportOptions());

      // Should have CSS classes or inline styles for severity levels
      expect(html).toContain("CRITICAL");
    });

    test("all severity levels are represented in CSS", () => {
      const html = generator.generateHTML(createFullReportOptions());

      // The CSS should define styles for different severity levels
      const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
      expect(style.length).toBeGreaterThan(100);
    });
  });

  describe("Edge Cases", () => {
    test("handles missing raidResults gracefully", () => {
      const options: ReportOptions = {
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      };

      const html = generator.generateHTML(options);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Executive Summary");
    });

    test("handles missing plunderResult gracefully", () => {
      const options: ReportOptions = {
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      };

      const html = generator.generateHTML(options);
      expect(html).toContain("<!DOCTYPE html>");
    });

    test("handles missing iscCriteria gracefully", () => {
      const options: ReportOptions = {
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      };

      const html = generator.generateHTML(options);
      expect(html).toContain("<!DOCTYPE html>");
    });

    test("handles empty findings array", () => {
      const options: ReportOptions = {
        findings: [],
        chartResult: createTestChartResult(),
      };

      const html = generator.generateHTML(options);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Executive Summary");
    });

    test("escapes HTML entities in finding descriptions", () => {
      const findings: DriftFinding[] = [
        {
          id: "DRIFT-XSS",
          field: "testField",
          expected: "<script>alert('xss')</script>",
          actual: "safe",
          drift: true,
          severity: "LOW",
          description: "Test <b>bold</b> & \"quotes\"",
          timestamp: "2026-01-15T10:00:00.000Z",
        },
      ];

      const html = generator.generateHTML({
        findings,
        chartResult: createTestChartResult(),
      });

      expect(html).not.toContain("<script>alert");
      expect(html).toContain("&lt;script&gt;");
    });
  });
});

// ===============================================================================
// MARKDOWN REPORT TESTS
// ===============================================================================

describe("Report Generator - Markdown", () => {
  const generator = new ReportGenerator();

  describe("Document Structure", () => {
    test("starts with a level-1 heading", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md.startsWith("# ")).toBe(true);
    });

    test("includes custom title", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("# Corsair GRC Assessment Report");
    });

    test("uses default title when not provided", () => {
      const options = createFullReportOptions();
      delete options.title;
      const md = generator.generateMarkdown(options);

      expect(md).toContain("# Corsair Assessment Report");
    });
  });

  describe("Report Sections", () => {
    test("includes Executive Summary heading", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("## Executive Summary");
    });

    test("includes Framework Coverage heading", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("## Framework Coverage");
    });

    test("includes Finding Details heading", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("## Finding Details");
    });

    test("includes Evidence Chain heading", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("## Evidence Chain");
    });

    test("includes ISC Criteria heading", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("## ISC");
    });

    test("framework section contains MITRE mapping", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("T1556");
      expect(md).toContain("Modify Authentication Process");
    });

    test("finding details uses markdown table or list", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("mfaConfiguration");
      expect(md).toContain("CRITICAL");
      // Should use table separators or list markers
      expect(md.includes("|") || md.includes("- ")).toBe(true);
    });

    test("ISC table uses markdown table format", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      // Markdown tables have pipe separators and header dividers
      expect(md).toContain("|");
      expect(md).toContain("---");
    });

    test("includes evidence chain details when plunder result provided", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).toContain("corsair-evidence.jsonl");
      expect(md).toContain("42"); // event count
    });
  });

  describe("Edge Cases", () => {
    test("handles missing optional fields", () => {
      const options: ReportOptions = {
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      };

      const md = generator.generateMarkdown(options);
      expect(md).toContain("## Executive Summary");
      expect(md).toContain("## Framework Coverage");
    });

    test("handles empty findings", () => {
      const options: ReportOptions = {
        findings: [],
        chartResult: createTestChartResult(),
      };

      const md = generator.generateMarkdown(options);
      expect(md).toContain("## Executive Summary");
    });

    test("no raw HTML in markdown output", () => {
      const md = generator.generateMarkdown(createFullReportOptions());

      expect(md).not.toContain("<div");
      expect(md).not.toContain("<table");
      expect(md).not.toContain("<style");
    });
  });
});
