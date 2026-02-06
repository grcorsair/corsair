/**
 * Report Generator
 *
 * Generates self-contained HTML and Markdown reports from Corsair assessment data.
 *
 * Sections:
 *   1. Executive Summary - Overview of findings, severity distribution
 *   2. Framework Coverage - MITRE, NIST CSF, SOC2 mappings
 *   3. Finding Details   - Individual drift findings with severity
 *   4. Evidence Chain    - JSONL evidence integrity status
 *   5. ISC Table         - Ideal State Criteria satisfaction matrix
 *
 * HTML output is fully self-contained with inline CSS and zero external dependencies.
 */

import type {
  DriftFinding,
  ChartResult,
  RaidResult,
  PlunderResult,
  ThreatModelResult,
} from "../types";

// ===============================================================================
// REPORT OPTIONS
// ===============================================================================

export interface ReportOptions {
  title?: string;
  findings: DriftFinding[];
  chartResult: ChartResult;
  raidResults?: RaidResult[];
  plunderResult?: PlunderResult;
  iscCriteria?: { text: string; satisfaction: string }[];
  threatModel?: ThreatModelResult;
}

// ===============================================================================
// HTML ESCAPING
// ===============================================================================

function escapeHTML(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ===============================================================================
// SEVERITY HELPERS
// ===============================================================================

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#2563eb",
};

function countBySeverity(findings: DriftFinding[]): Record<string, number> {
  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  }
  return counts;
}

// ===============================================================================
// REPORT GENERATOR
// ===============================================================================

export class ReportGenerator {
  /**
   * Generate a self-contained HTML report.
   */
  generateHTML(options: ReportOptions): string {
    const title = options.title || "Corsair Assessment Report";
    const {
      findings,
      chartResult,
      raidResults = [],
      plunderResult,
      iscCriteria = [],
    } = options;

    const severityCounts = countBySeverity(findings);
    const driftFindings = findings.filter((f) => f.drift);
    const threatModel = options.threatModel;
    const now = new Date().toISOString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    color: #1e293b;
    background: #f8fafc;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; color: #0f172a; }
  h2 {
    font-size: 1.375rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e2e8f0;
    color: #0f172a;
  }
  h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
  .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
  .card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .stat-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: center;
  }
  .stat-value { font-size: 1.75rem; font-weight: 700; }
  .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5rem 0;
    font-size: 0.875rem;
  }
  th, td { padding: 0.625rem 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-weight: 600; color: #475569; }
  tr:hover { background: #f8fafc; }
  .severity-critical { color: ${SEVERITY_COLORS.CRITICAL}; font-weight: 600; }
  .severity-high { color: ${SEVERITY_COLORS.HIGH}; font-weight: 600; }
  .severity-medium { color: ${SEVERITY_COLORS.MEDIUM}; font-weight: 600; }
  .severity-low { color: ${SEVERITY_COLORS.LOW}; font-weight: 600; }
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge-critical { background: #fef2f2; color: ${SEVERITY_COLORS.CRITICAL}; border: 1px solid #fecaca; }
  .badge-high { background: #fff7ed; color: ${SEVERITY_COLORS.HIGH}; border: 1px solid #fed7aa; }
  .badge-medium { background: #fefce8; color: ${SEVERITY_COLORS.MEDIUM}; border: 1px solid #fef08a; }
  .badge-low { background: #eff6ff; color: ${SEVERITY_COLORS.LOW}; border: 1px solid #bfdbfe; }
  .badge-satisfied { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .badge-failed { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .badge-pending { background: #f5f5f5; color: #737373; border: 1px solid #d4d4d4; }
  .badge-open { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .badge-closed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .framework-tag {
    display: inline-block;
    background: #f1f5f9;
    color: #334155;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    margin: 0.125rem;
  }
  .evidence-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot-green { background: #16a34a; }
  .dot-red { background: #dc2626; }
  .dot-gray { background: #9ca3af; }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.75rem; }
</style>
</head>
<body>

<h1>${escapeHTML(title)}</h1>
<p class="subtitle">Generated: ${escapeHTML(now)} | Corsair GRC Chaos Engineering Platform</p>

${this.renderExecutiveSummaryHTML(driftFindings, severityCounts, raidResults, iscCriteria)}

${threatModel ? this.renderThreatModelHTML(threatModel) : ""}

${this.renderFrameworkCoverageHTML(chartResult)}

${this.renderFindingDetailsHTML(findings)}

${raidResults.length > 0 ? this.renderRaidResultsHTML(raidResults) : ""}

${this.renderEvidenceChainHTML(plunderResult)}

${iscCriteria.length > 0 ? this.renderISCTableHTML(iscCriteria) : ""}

<footer>
  Corsair GRC Chaos Engineering Platform | Report generated at ${escapeHTML(now)}
</footer>

</body>
</html>`;
  }

  /**
   * Generate a Markdown report.
   */
  generateMarkdown(options: ReportOptions): string {
    const title = options.title || "Corsair Assessment Report";
    const {
      findings,
      chartResult,
      raidResults = [],
      plunderResult,
      iscCriteria = [],
    } = options;

    const severityCounts = countBySeverity(findings);
    const driftFindings = findings.filter((f) => f.drift);
    const threatModel = options.threatModel;
    const now = new Date().toISOString();

    const sections: string[] = [];

    sections.push(`# ${title}`);
    sections.push("");
    sections.push(`> Generated: ${now} | Corsair GRC Chaos Engineering Platform`);
    sections.push("");

    sections.push(this.renderExecutiveSummaryMD(driftFindings, severityCounts, raidResults, iscCriteria));

    if (threatModel) {
      sections.push(this.renderThreatModelMD(threatModel));
    }

    sections.push(this.renderFrameworkCoverageMD(chartResult));
    sections.push(this.renderFindingDetailsMD(findings));

    if (raidResults.length > 0) {
      sections.push(this.renderRaidResultsMD(raidResults));
    }

    sections.push(this.renderEvidenceChainMD(plunderResult));

    if (iscCriteria.length > 0) {
      sections.push(this.renderISCTableMD(iscCriteria));
    }

    sections.push("---");
    sections.push(`*Corsair GRC Chaos Engineering Platform | Report generated at ${now}*`);
    sections.push("");

    return sections.join("\n");
  }

  // ===============================================================================
  // HTML SECTION RENDERERS
  // ===============================================================================

  private renderExecutiveSummaryHTML(
    driftFindings: DriftFinding[],
    severityCounts: Record<string, number>,
    raidResults: RaidResult[],
    iscCriteria: { text: string; satisfaction: string }[]
  ): string {
    const totalDrift = driftFindings.length;
    const raidCount = raidResults.length;
    const successfulRaids = raidResults.filter((r) => r.success).length;
    const iscTotal = iscCriteria.length;
    const iscSatisfied = iscCriteria.filter((c) => c.satisfaction === "SATISFIED").length;
    const satisfactionRate = iscTotal > 0 ? Math.round((iscSatisfied / iscTotal) * 100) : 0;

    return `
<h2>Executive Summary</h2>
<div class="summary-grid">
  <div class="stat-card">
    <div class="stat-value">${totalDrift}</div>
    <div class="stat-label">Drift Findings</div>
  </div>
  <div class="stat-card">
    <div class="stat-value severity-critical">${severityCounts.CRITICAL}</div>
    <div class="stat-label">Critical</div>
  </div>
  <div class="stat-card">
    <div class="stat-value severity-high">${severityCounts.HIGH}</div>
    <div class="stat-label">High</div>
  </div>
  <div class="stat-card">
    <div class="stat-value severity-medium">${severityCounts.MEDIUM}</div>
    <div class="stat-label">Medium</div>
  </div>
  <div class="stat-card">
    <div class="stat-value severity-low">${severityCounts.LOW}</div>
    <div class="stat-label">Low</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${raidCount}</div>
    <div class="stat-label">Raids Executed</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${successfulRaids}</div>
    <div class="stat-label">Controls Bypassed</div>
  </div>
  <div class="stat-card">
    <div class="stat-value">${satisfactionRate}%</div>
    <div class="stat-label">ISC Satisfaction</div>
  </div>
</div>`;
  }

  private renderFrameworkCoverageHTML(chartResult: ChartResult): string {
    let frameworksHTML = "";

    if (chartResult.frameworks) {
      for (const [framework, data] of Object.entries(chartResult.frameworks)) {
        frameworksHTML += `
    <div class="card">
      <h3>${escapeHTML(framework)}</h3>
      <p>${data.controls.map((c) => `<span class="framework-tag">${escapeHTML(c.controlId)}: ${escapeHTML(c.controlName)}</span>`).join(" ")}</p>
    </div>`;
      }
    }

    return `
<h2>Framework Coverage</h2>
<div class="card">
  <h3>MITRE ATT&amp;CK</h3>
  <table>
    <tr><th>Technique</th><th>Name</th><th>Tactic</th><th>Description</th></tr>
    <tr>
      <td><span class="framework-tag">${escapeHTML(chartResult.mitre.technique)}</span></td>
      <td>${escapeHTML(chartResult.mitre.name)}</td>
      <td>${escapeHTML(chartResult.mitre.tactic)}</td>
      <td>${escapeHTML(chartResult.mitre.description)}</td>
    </tr>
  </table>
</div>
<div class="card">
  <h3>NIST CSF</h3>
  <p><strong>Function:</strong> ${escapeHTML(chartResult.nist.function)} | <strong>Category:</strong> ${escapeHTML(chartResult.nist.category)}</p>
  <p><strong>Controls:</strong> ${chartResult.nist.controls.map((c) => `<span class="framework-tag">${escapeHTML(c)}</span>`).join(" ")}</p>
</div>
<div class="card">
  <h3>SOC2</h3>
  <p><strong>Principle:</strong> ${escapeHTML(chartResult.soc2.principle)} | <strong>Description:</strong> ${escapeHTML(chartResult.soc2.description)}</p>
  <p><strong>Criteria:</strong> ${chartResult.soc2.criteria.map((c) => `<span class="framework-tag">${escapeHTML(c)}</span>`).join(" ")}</p>
</div>
${frameworksHTML}`;
  }

  private renderFindingDetailsHTML(findings: DriftFinding[]): string {
    if (findings.length === 0) {
      return `
<h2>Finding Details</h2>
<div class="card"><p>No drift findings detected.</p></div>`;
    }

    const sorted = [...findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    );

    const rows = sorted
      .map(
        (f) => `
    <tr>
      <td>${escapeHTML(f.id)}</td>
      <td>${escapeHTML(f.field)}</td>
      <td><span class="badge badge-${f.severity.toLowerCase()}">${escapeHTML(f.severity)}</span></td>
      <td>${escapeHTML(String(f.expected))}</td>
      <td>${escapeHTML(String(f.actual))}</td>
      <td>${escapeHTML(f.description)}</td>
    </tr>`
      )
      .join("");

    return `
<h2>Finding Details</h2>
<div class="card">
  <table>
    <thead>
      <tr><th>ID</th><th>Field</th><th>Severity</th><th>Expected</th><th>Actual</th><th>Description</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</div>`;
  }

  private renderRaidResultsHTML(raidResults: RaidResult[]): string {
    const rows = raidResults
      .map((r) => {
        const statusClass = r.success ? "open" : "closed";
        const statusText = r.success ? "Bypassed" : "Blocked";
        return `
    <tr>
      <td>${escapeHTML(r.raidId)}</td>
      <td>${escapeHTML(r.vector)}</td>
      <td>${escapeHTML(r.target)}</td>
      <td><span class="badge badge-${statusClass}">${statusText}</span></td>
      <td>${r.durationMs}ms</td>
      <td>${escapeHTML(r.findings.join("; "))}</td>
    </tr>`;
      })
      .join("");

    return `
<h2>RAID Results</h2>
<div class="card">
  <table>
    <thead>
      <tr><th>RAID ID</th><th>Vector</th><th>Target</th><th>Result</th><th>Duration</th><th>Findings</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</div>`;
  }

  private renderEvidenceChainHTML(plunderResult?: PlunderResult): string {
    if (!plunderResult) {
      return `
<h2>Evidence Chain</h2>
<div class="card"><p>No evidence chain data available.</p></div>`;
    }

    const chainStatus = plunderResult.chainVerified;
    const dotClass = chainStatus ? "dot-green" : "dot-red";
    const statusText = chainStatus ? "Verified" : "Broken";

    return `
<h2>Evidence Chain</h2>
<div class="card">
  <table>
    <tr><th>Evidence Path</th><td>${escapeHTML(plunderResult.evidencePath)}</td></tr>
    <tr><th>Event Count</th><td>${plunderResult.eventCount}</td></tr>
    <tr><th>Chain Integrity</th><td><span class="evidence-status"><span class="dot ${dotClass}"></span> ${statusText}</span></td></tr>
    <tr><th>Immutable</th><td>${plunderResult.immutable ? "Yes" : "No"}</td></tr>
    <tr><th>Audit Ready</th><td>${plunderResult.auditReady ? "Yes" : "No"}</td></tr>
  </table>
</div>`;
  }

  private renderISCTableHTML(iscCriteria: { text: string; satisfaction: string }[]): string {
    const rows = iscCriteria
      .map((isc) => {
        const badgeClass =
          isc.satisfaction === "SATISFIED"
            ? "satisfied"
            : isc.satisfaction === "FAILED"
              ? "failed"
              : "pending";
        return `
    <tr>
      <td>${escapeHTML(isc.text)}</td>
      <td><span class="badge badge-${badgeClass}">${escapeHTML(isc.satisfaction)}</span></td>
    </tr>`;
      })
      .join("");

    const satisfied = iscCriteria.filter((c) => c.satisfaction === "SATISFIED").length;
    const total = iscCriteria.length;
    const rate = total > 0 ? Math.round((satisfied / total) * 100) : 0;

    return `
<h2>ISC Criteria (Ideal State Criteria)</h2>
<div class="card">
  <p><strong>Satisfaction Rate:</strong> ${satisfied}/${total} (${rate}%)</p>
  <table>
    <thead>
      <tr><th>Criterion</th><th>Status</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</div>`;
  }

  private renderThreatModelHTML(threatModel: ThreatModelResult): string {
    if (threatModel.threats.length === 0) {
      return `
<h2>Threat Model (SPYGLASS)</h2>
<div class="card"><p>No threats identified by STRIDE analysis.</p></div>`;
    }

    const riskBars = Object.entries(threatModel.riskDistribution)
      .sort((a, b) => (SEVERITY_ORDER[a[0]] ?? 99) - (SEVERITY_ORDER[b[0]] ?? 99))
      .map(([sev, count]) => {
        const pct = Math.round((count / threatModel.threatCount) * 100);
        const color = SEVERITY_COLORS[sev] || "#94a3b8";
        return `<div style="display:flex;align-items:center;gap:0.5rem;margin:0.25rem 0">
          <span style="width:80px;font-size:0.75rem;font-weight:600">${escapeHTML(sev)}</span>
          <div style="flex:1;background:#f1f5f9;border-radius:4px;height:20px;overflow:hidden">
            <div style="width:${pct}%;background:${color};height:100%;border-radius:4px;min-width:2px"></div>
          </div>
          <span style="font-size:0.75rem;color:#64748b">${count} (${pct}%)</span>
        </div>`;
      })
      .join("");

    const rows = threatModel.threats
      .map(
        (t) => `
    <tr>
      <td><span class="badge badge-${t.severity.toLowerCase()}">${escapeHTML(t.stride)}</span></td>
      <td>${escapeHTML(t.description)}</td>
      <td><span class="framework-tag">${escapeHTML(t.mitreTechnique)}</span></td>
      <td><span class="badge badge-${t.severity.toLowerCase()}">${escapeHTML(t.severity)}</span></td>
      <td>${escapeHTML(t.affectedField)}</td>
    </tr>`
      )
      .join("");

    return `
<h2>Threat Model (SPYGLASS)</h2>
<div class="card">
  <h3>Risk Distribution</h3>
  ${riskBars}
</div>
<div class="card">
  <table>
    <thead>
      <tr><th>Category</th><th>Description</th><th>ATT&amp;CK</th><th>Severity</th><th>Affected Field</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</div>`;
  }

  // ===============================================================================
  // MARKDOWN SECTION RENDERERS
  // ===============================================================================

  private renderExecutiveSummaryMD(
    driftFindings: DriftFinding[],
    severityCounts: Record<string, number>,
    raidResults: RaidResult[],
    iscCriteria: { text: string; satisfaction: string }[]
  ): string {
    const totalDrift = driftFindings.length;
    const raidCount = raidResults.length;
    const successfulRaids = raidResults.filter((r) => r.success).length;
    const iscTotal = iscCriteria.length;
    const iscSatisfied = iscCriteria.filter((c) => c.satisfaction === "SATISFIED").length;
    const satisfactionRate = iscTotal > 0 ? Math.round((iscSatisfied / iscTotal) * 100) : 0;

    const lines: string[] = [];
    lines.push("## Executive Summary");
    lines.push("");
    lines.push(`- **Drift Findings:** ${totalDrift}`);
    lines.push(`  - CRITICAL: ${severityCounts.CRITICAL}`);
    lines.push(`  - HIGH: ${severityCounts.HIGH}`);
    lines.push(`  - MEDIUM: ${severityCounts.MEDIUM}`);
    lines.push(`  - LOW: ${severityCounts.LOW}`);
    lines.push(`- **Raids Executed:** ${raidCount}`);
    lines.push(`- **Controls Bypassed:** ${successfulRaids}`);

    if (iscTotal > 0) {
      lines.push(`- **ISC Satisfaction:** ${iscSatisfied}/${iscTotal} (${satisfactionRate}%)`);
    }

    lines.push("");
    return lines.join("\n");
  }

  private renderFrameworkCoverageMD(chartResult: ChartResult): string {
    const lines: string[] = [];
    lines.push("## Framework Coverage");
    lines.push("");

    // MITRE
    lines.push("### MITRE ATT&CK");
    lines.push("");
    lines.push(`- **Technique:** ${chartResult.mitre.technique} - ${chartResult.mitre.name}`);
    lines.push(`- **Tactic:** ${chartResult.mitre.tactic}`);
    lines.push(`- **Description:** ${chartResult.mitre.description}`);
    lines.push("");

    // NIST
    lines.push("### NIST CSF");
    lines.push("");
    lines.push(`- **Function:** ${chartResult.nist.function}`);
    lines.push(`- **Category:** ${chartResult.nist.category}`);
    lines.push(`- **Controls:** ${chartResult.nist.controls.join(", ")}`);
    lines.push("");

    // SOC2
    lines.push("### SOC2");
    lines.push("");
    lines.push(`- **Principle:** ${chartResult.soc2.principle}`);
    lines.push(`- **Criteria:** ${chartResult.soc2.criteria.join(", ")}`);
    lines.push(`- **Description:** ${chartResult.soc2.description}`);
    lines.push("");

    // Extended frameworks
    if (chartResult.frameworks) {
      for (const [framework, data] of Object.entries(chartResult.frameworks)) {
        lines.push(`### ${framework}`);
        lines.push("");
        lines.push("| Control ID | Control Name | Status |");
        lines.push("| --- | --- | --- |");
        for (const ctrl of data.controls) {
          lines.push(`| ${ctrl.controlId} | ${ctrl.controlName} | ${ctrl.status} |`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  private renderFindingDetailsMD(findings: DriftFinding[]): string {
    const lines: string[] = [];
    lines.push("## Finding Details");
    lines.push("");

    if (findings.length === 0) {
      lines.push("No drift findings detected.");
      lines.push("");
      return lines.join("\n");
    }

    const sorted = [...findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    );

    lines.push("| ID | Field | Severity | Expected | Actual | Description |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const f of sorted) {
      lines.push(
        `| ${f.id} | ${f.field} | **${f.severity}** | ${String(f.expected)} | ${String(f.actual)} | ${f.description} |`
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  private renderRaidResultsMD(raidResults: RaidResult[]): string {
    const lines: string[] = [];
    lines.push("## RAID Results");
    lines.push("");
    lines.push("| RAID ID | Vector | Target | Result | Duration | Findings |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const r of raidResults) {
      const status = r.success ? "BYPASSED" : "BLOCKED";
      lines.push(
        `| ${r.raidId} | ${r.vector} | ${r.target} | **${status}** | ${r.durationMs}ms | ${r.findings.join("; ")} |`
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  private renderEvidenceChainMD(plunderResult?: PlunderResult): string {
    const lines: string[] = [];
    lines.push("## Evidence Chain");
    lines.push("");

    if (!plunderResult) {
      lines.push("No evidence chain data available.");
      lines.push("");
      return lines.join("\n");
    }

    const chainStatus = plunderResult.chainVerified ? "Verified" : "Broken";

    lines.push(`- **Evidence Path:** ${plunderResult.evidencePath}`);
    lines.push(`- **Event Count:** ${plunderResult.eventCount}`);
    lines.push(`- **Chain Integrity:** ${chainStatus}`);
    lines.push(`- **Immutable:** ${plunderResult.immutable ? "Yes" : "No"}`);
    lines.push(`- **Audit Ready:** ${plunderResult.auditReady ? "Yes" : "No"}`);
    lines.push("");
    return lines.join("\n");
  }

  private renderThreatModelMD(threatModel: ThreatModelResult): string {
    const lines: string[] = [];
    lines.push("## Threat Model (SPYGLASS)");
    lines.push("");

    if (threatModel.threats.length === 0) {
      lines.push("No threats identified by STRIDE analysis.");
      lines.push("");
      return lines.join("\n");
    }

    lines.push(`**Provider:** ${threatModel.provider} | **Threats Found:** ${threatModel.threatCount}`);
    lines.push("");
    lines.push("**Risk Distribution:**");
    for (const [sev, count] of Object.entries(threatModel.riskDistribution)) {
      const pct = Math.round((count / threatModel.threatCount) * 100);
      lines.push(`- ${sev}: ${count} (${pct}%)`);
    }
    lines.push("");
    lines.push("| Category | Description | ATT&CK | Severity | Affected Field |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const t of threatModel.threats) {
      lines.push(`| ${t.stride} | ${t.description} | ${t.mitreTechnique} | **${t.severity}** | ${t.affectedField} |`);
    }
    lines.push("");
    return lines.join("\n");
  }

  private renderISCTableMD(iscCriteria: { text: string; satisfaction: string }[]): string {
    const satisfied = iscCriteria.filter((c) => c.satisfaction === "SATISFIED").length;
    const total = iscCriteria.length;
    const rate = total > 0 ? Math.round((satisfied / total) * 100) : 0;

    const lines: string[] = [];
    lines.push("## ISC Criteria (Ideal State Criteria)");
    lines.push("");
    lines.push(`**Satisfaction Rate:** ${satisfied}/${total} (${rate}%)`);
    lines.push("");
    lines.push("| Criterion | Status |");
    lines.push("| --- | --- |");
    for (const isc of iscCriteria) {
      lines.push(`| ${isc.text} | **${isc.satisfaction}** |`);
    }
    lines.push("");
    return lines.join("\n");
  }
}
