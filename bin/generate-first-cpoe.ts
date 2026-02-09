#!/usr/bin/env bun
/**
 * Generate First CPOE — The Genesis Block
 *
 * Generates a realistic CPOE (Certificate of Proof of Operational Effectiveness)
 * from a synthetic SOC 2 Type II report with 24 controls (22 effective, 2 ineffective).
 *
 * Outputs:
 *   examples/example-cpoe.jwt          — Raw JWT-VC string
 *   examples/example-cpoe-decoded.json  — Decoded payload, pretty-printed
 *   examples/did.json                   — DID document for did:web:grcorsair.com
 *
 * Usage:
 *   bun run bin/generate-first-cpoe.ts
 */

import * as fs from "fs";
import * as path from "path";
import { MarqueKeyManager } from "../src/parley/marque-key-manager";
import { generateVCJWT } from "../src/parley/vc-generator";
import { mapToMarqueInput } from "../src/ingestion/mapper";
import type { IngestedDocument, IngestedControl } from "../src/ingestion/types";
import { decodeJwt } from "jose";
import { ASSURANCE_NAMES } from "../src/parley/vc-types";
import type { AssuranceLevel } from "../src/parley/vc-types";

// =============================================================================
// CONSTANTS
// =============================================================================

const KEY_DIR = path.join(process.cwd(), ".test-keys-example");
const EXAMPLES_DIR = path.join(process.cwd(), "examples");
const ISSUER_DID = "did:web:grcorsair.com";
const EXPIRY_DAYS = 90;

// =============================================================================
// SAMPLE DATA: Acme Corp SOC 2 Type II Report — 24 controls
// =============================================================================

function buildControls(): IngestedControl[] {
  return [
    // CC1.x — Control Environment
    {
      id: "CC1.1",
      description: "Management demonstrates commitment to integrity and ethical values through formal code of conduct and annual training",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Code of conduct signed by 100% of employees; annual ethics training completion rate 98%",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC1.1", controlName: "Control Environment — Integrity and Ethical Values" },
        { framework: "NIST-800-53", controlId: "PL-4", controlName: "Rules of Behavior" },
      ],
    },
    {
      id: "CC1.2",
      description: "Board of directors provides oversight of internal controls and risk management",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Quarterly board meetings with security dashboard review; audit committee charter documented",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC1.2", controlName: "Control Environment — Board Oversight" },
        { framework: "NIST-800-53", controlId: "PM-1", controlName: "Information Security Program Plan" },
      ],
    },

    // CC2.x — Communication and Information
    {
      id: "CC2.1",
      description: "Internal communication of security policies through onboarding and quarterly awareness campaigns",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Security policy portal with read-receipt tracking; 95% acknowledgment rate across all departments",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC2.1", controlName: "Communication — Internal" },
        { framework: "NIST-800-53", controlId: "AT-2", controlName: "Literacy Training and Awareness" },
      ],
    },
    {
      id: "CC2.2",
      description: "External communication channels established for security incident notification to affected parties",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Incident notification SLA of 72 hours documented; status page at status.acme.com operational",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC2.2", controlName: "Communication — External" },
        { framework: "NIST-800-53", controlId: "IR-6", controlName: "Incident Reporting" },
      ],
    },

    // CC3.x — Risk Assessment
    {
      id: "CC3.1",
      description: "Formal risk assessment process conducted annually covering all critical information assets",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Annual risk assessment completed January 2026; 47 risks identified and tracked in risk register",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC3.1", controlName: "Risk Assessment — Objectives" },
        { framework: "NIST-800-53", controlId: "RA-3", controlName: "Risk Assessment" },
      ],
    },
    {
      id: "CC3.2",
      description: "Risk identification process includes internal and external threat sources with likelihood and impact scoring",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Threat modeling conducted for all customer-facing services; STRIDE analysis on file for 12 services",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC3.2", controlName: "Risk Assessment — Risk Identification" },
        { framework: "NIST-800-53", controlId: "RA-5", controlName: "Vulnerability Monitoring and Scanning" },
      ],
    },
    {
      id: "CC3.3",
      description: "Fraud risk assessment includes consideration of management override, incentive pressures, and opportunities",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Fraud risk matrix maintained by internal audit; segregation of duties enforced in financial systems",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC3.3", controlName: "Risk Assessment — Fraud Risk" },
        { framework: "NIST-800-53", controlId: "AC-5", controlName: "Separation of Duties" },
      ],
    },
    {
      id: "CC3.4",
      description: "Change management process assesses risk of significant changes to infrastructure and applications",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Change advisory board reviews all P1/P2 changes; risk assessment template required for production changes",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC3.4", controlName: "Risk Assessment — Significant Changes" },
        { framework: "NIST-800-53", controlId: "CM-3", controlName: "Configuration Change Control" },
      ],
    },

    // CC4.x — Monitoring Activities
    {
      id: "CC4.1",
      description: "Ongoing monitoring activities evaluate control effectiveness through automated dashboards and periodic reviews",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Security metrics dashboard reviewed weekly by security team; monthly control effectiveness reports to CISO",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC4.1", controlName: "Monitoring — Ongoing Evaluation" },
        { framework: "NIST-800-53", controlId: "CA-7", controlName: "Continuous Monitoring" },
      ],
    },
    {
      id: "CC4.2",
      description: "Control deficiencies are evaluated, communicated to responsible parties, and tracked to remediation",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Deficiency tracking in Jira with SLA: Critical 7d, High 30d, Medium 90d; 94% on-time remediation rate",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC4.2", controlName: "Monitoring — Deficiency Evaluation" },
        { framework: "NIST-800-53", controlId: "CA-5", controlName: "Plan of Action and Milestones" },
      ],
    },

    // CC5.x — Control Activities
    {
      id: "CC5.1",
      description: "Control activities selected and developed based on risk assessment outcomes for key business processes",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Control matrix maps 47 risks to 24 controls; risk-to-control traceability maintained in GRC tool",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC5.1", controlName: "Control Activities — Selection and Development" },
        { framework: "NIST-800-53", controlId: "PL-2", controlName: "System Security and Privacy Plans" },
      ],
    },
    {
      id: "CC5.2",
      description: "Technology general controls implemented across infrastructure including patching, hardening, and configuration management",
      status: "effective",
      severity: "HIGH",
      evidence: "CIS benchmarks applied to all production servers; automated patching within 14 days for critical CVEs",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC5.2", controlName: "Control Activities — Technology Controls" },
        { framework: "NIST-800-53", controlId: "SI-2", controlName: "Flaw Remediation" },
      ],
    },
    {
      id: "CC5.3",
      description: "Security policies deployed across the organization with version control and acknowledgment tracking",
      status: "ineffective",
      severity: "MEDIUM",
      evidence: "Policy repository exists but 3 policies are outdated (>18 months since last review); acknowledgment tracking incomplete for contractors",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC5.3", controlName: "Control Activities — Policy Deployment" },
        { framework: "NIST-800-53", controlId: "PL-1", controlName: "Policy and Procedures" },
      ],
    },

    // CC6.x — Logical and Physical Access Controls
    {
      id: "CC6.1",
      description: "Logical access security enforced through centralized identity provider with MFA for all interactive accounts",
      status: "effective",
      severity: "CRITICAL",
      evidence: "MFA enforced via Okta SSO for all user accounts; 100% enrollment verified across 3,200 employees",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.1", controlName: "Logical Access Security" },
        { framework: "NIST-800-53", controlId: "IA-2", controlName: "Identification and Authentication" },
      ],
    },
    {
      id: "CC6.2",
      description: "Access provisioning follows formal request and approval workflow with manager authorization",
      status: "effective",
      severity: "HIGH",
      evidence: "ServiceNow access request workflow with dual approval; sampled 40 recent provisioning requests, all properly authorized",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.2", controlName: "Access Provisioning" },
        { framework: "NIST-800-53", controlId: "AC-2", controlName: "Account Management" },
      ],
    },
    {
      id: "CC6.3",
      description: "Access removal within 24 hours of termination with quarterly access certification reviews",
      status: "effective",
      severity: "HIGH",
      evidence: "HR-to-IT termination workflow triggers automatic deprovisioning; last quarterly review completed December 2025",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.3", controlName: "Access Removal" },
        { framework: "NIST-800-53", controlId: "PS-4", controlName: "Personnel Termination" },
      ],
    },
    {
      id: "CC6.6",
      description: "Security event monitoring with centralized SIEM ingesting logs from all production systems",
      status: "effective",
      severity: "HIGH",
      evidence: "Splunk SIEM processes 2.1TB/day from 340 log sources; 24/7 SOC with 15-minute alert triage SLA",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.6", controlName: "Security Events Monitoring" },
        { framework: "NIST-800-53", controlId: "SI-4", controlName: "System Monitoring" },
      ],
    },
    {
      id: "CC6.7",
      description: "Data transmission integrity protected via TLS 1.3 for all external communications and inter-service traffic",
      status: "effective",
      severity: "HIGH",
      evidence: "TLS 1.3 enforced at load balancer; internal service mesh uses mTLS; no TLS 1.0/1.1 endpoints found in scan",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.7", controlName: "Transmission Integrity" },
        { framework: "NIST-800-53", controlId: "SC-8", controlName: "Transmission Confidentiality and Integrity" },
      ],
    },
    {
      id: "CC6.8",
      description: "Unauthorized software prevention through application allowlisting and endpoint detection",
      status: "ineffective",
      severity: "HIGH",
      evidence: "CrowdStrike deployed to 89% of endpoints; remaining 11% are legacy Linux servers pending migration — no allowlisting enforced on those systems",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC6.8", controlName: "Unauthorized Software Prevention" },
        { framework: "NIST-800-53", controlId: "CM-7", controlName: "Least Functionality" },
      ],
    },

    // CC7.x — System Operations
    {
      id: "CC7.1",
      description: "Vulnerability management program with automated scanning and risk-based remediation timelines",
      status: "effective",
      severity: "HIGH",
      evidence: "Qualys scans weekly across all assets; critical vulnerabilities remediated within 7 days, high within 30 days",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC7.1", controlName: "Vulnerability Management" },
        { framework: "NIST-800-53", controlId: "RA-5", controlName: "Vulnerability Monitoring and Scanning" },
      ],
    },
    {
      id: "CC7.2",
      description: "System monitoring covers performance, availability, and security events with automated alerting",
      status: "effective",
      severity: "HIGH",
      evidence: "Datadog monitors 340 services; PagerDuty escalation for P1/P2 alerts; 99.95% uptime achieved in audit period",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC7.2", controlName: "System Monitoring" },
        { framework: "NIST-800-53", controlId: "AU-6", controlName: "Audit Record Review, Analysis, and Reporting" },
      ],
    },
    {
      id: "CC7.3",
      description: "Detection measures evaluated annually through tabletop exercises and purple team assessments",
      status: "effective",
      severity: "MEDIUM",
      evidence: "Annual purple team exercise conducted October 2025; 12 detection gaps identified and remediated within 30 days",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC7.3", controlName: "Detection Measures Evaluation" },
        { framework: "NIST-800-53", controlId: "CA-8", controlName: "Penetration Testing" },
      ],
    },
    {
      id: "CC7.4",
      description: "Incident response plan tested through quarterly tabletop exercises with documented lessons learned",
      status: "effective",
      severity: "HIGH",
      evidence: "4 tabletop exercises completed in audit period; incident response playbooks updated after each exercise",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC7.4", controlName: "Incident Response" },
        { framework: "NIST-800-53", controlId: "IR-3", controlName: "Incident Response Testing" },
      ],
    },

    // CC8.x — Change Management
    {
      id: "CC8.1",
      description: "Change management with mandatory peer review, automated testing, and segregated deployment pipeline",
      status: "effective",
      severity: "HIGH",
      evidence: "GitHub branch protection requires 2 approvals; CI/CD pipeline enforces test passage; sampled 50 deployments, all compliant",
      frameworkRefs: [
        { framework: "SOC2", controlId: "CC8.1", controlName: "Change Management" },
        { framework: "NIST-800-53", controlId: "CM-3", controlName: "Configuration Change Control" },
      ],
    },
  ];
}

function buildDocument(): IngestedDocument {
  return {
    source: "soc2",
    metadata: {
      title: "Acme Corp SOC 2 Type II Report",
      issuer: "Acme Corporation",
      date: "2026-01-15",
      scope: "SOC 2 Type II — Acme Cloud Platform",
      auditor: "Example Audit Firm LLP",
      reportType: "SOC 2 Type II",
    },
    controls: buildControls(),
    assessmentContext: {
      techStack: [
        { component: "Primary IdP", technology: "Okta", scope: "All 3,200 employees via SSO" },
        { component: "Customer Auth", technology: "AWS Cognito", scope: "45,000 customer accounts" },
        { component: "Infrastructure", technology: "AWS (us-east-1, us-west-2)", scope: "Production and staging environments" },
        { component: "SIEM", technology: "Splunk Enterprise", scope: "All production log sources (340)" },
        { component: "Endpoint Protection", technology: "CrowdStrike Falcon", scope: "89% of endpoints (migration in progress)" },
        { component: "CI/CD", technology: "GitHub Actions", scope: "All application deployments" },
      ],
      compensatingControls: [
        {
          description: "Centralized Okta SSO provides MFA instead of per-service MFA configuration",
          rationale: "Single IdP reduces attack surface versus distributed MFA across 47 services",
          acceptedBy: "CISO",
        },
      ],
      gaps: [
        "Legacy Linux servers (11% of fleet) pending CrowdStrike migration",
        "Contractor policy acknowledgment tracking incomplete",
        "Third-party SaaS integrations not in assessment scope",
      ],
      scopeCoverage: "92% of production systems, 100% of customer-facing services",
      assessorNotes: "Assessment period: January 2025 through December 2025. Type II examination with sampling of controls across 12-month period.",
    },
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("CORSAIR CPOE Generator");
  console.log("=".repeat(60));
  console.log();

  // 1. Initialize Ed25519 key manager
  console.log("[1/6] Initializing Ed25519 key manager...");
  const keyManager = new MarqueKeyManager(KEY_DIR);
  let keypair = await keyManager.loadKeypair();
  if (!keypair) {
    console.log("      Generating new Ed25519 keypair...");
    keypair = await keyManager.generateKeypair();
    console.log(`      Keypair stored in ${KEY_DIR}`);
  } else {
    console.log("      Loaded existing keypair.");
  }

  // 2. Build the IngestedDocument
  console.log("[2/6] Building SOC 2 Type II document (24 controls)...");
  const document = buildDocument();
  const effective = document.controls.filter(c => c.status === "effective").length;
  const ineffective = document.controls.filter(c => c.status === "ineffective").length;
  console.log(`      ${document.controls.length} controls: ${effective} effective, ${ineffective} ineffective`);

  // 3. Map to MarqueGeneratorInput
  console.log("[3/6] Mapping controls to CPOE input...");
  const input = mapToMarqueInput(document, {
    did: ISSUER_DID,
    organization: "Acme Corporation",
  });
  console.log(`      Issuer DID: ${ISSUER_DID}`);
  console.log(`      Providers: ${input.providers.join(", ")}`);

  // 4. Generate JWT-VC
  console.log("[4/6] Generating JWT-VC CPOE (Ed25519, 90-day expiry)...");
  const jwt = await generateVCJWT(input, keyManager, { expiryDays: EXPIRY_DAYS });
  console.log(`      JWT length: ${jwt.length} characters`);

  // 5. Decode and write output files
  console.log("[5/6] Writing output files...");

  // Ensure examples/ exists
  fs.mkdirSync(EXAMPLES_DIR, { recursive: true });

  // Write raw JWT
  const jwtPath = path.join(EXAMPLES_DIR, "example-cpoe.jwt");
  await Bun.write(jwtPath, jwt);
  console.log(`      ${jwtPath}`);

  // Decode and write pretty-printed JSON
  const decoded = decodeJwt(jwt);
  const decodedPath = path.join(EXAMPLES_DIR, "example-cpoe-decoded.json");
  await Bun.write(decodedPath, JSON.stringify(decoded, null, 2));
  console.log(`      ${decodedPath}`);

  // Generate DID document
  const didDoc = await keyManager.generateDIDDocument("grcorsair.com");
  const didPath = path.join(EXAMPLES_DIR, "did.json");
  await Bun.write(didPath, JSON.stringify(didDoc, null, 2));
  console.log(`      ${didPath}`);

  // 6. Print verification summary
  console.log("[6/6] Verification summary...");
  console.log();
  console.log("=".repeat(60));
  console.log("CPOE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Source:            ${document.metadata.title}`);
  console.log(`Auditor:           ${document.metadata.auditor}`);
  console.log(`Report Type:       ${document.metadata.reportType}`);
  console.log(`Assessment Date:   ${document.metadata.date}`);
  console.log(`Scope:             ${document.metadata.scope}`);
  console.log();
  console.log(`Controls:          ${document.controls.length} total`);
  console.log(`  Effective:       ${effective}`);
  console.log(`  Ineffective:     ${ineffective}`);
  console.log();

  // Extract assurance info from decoded JWT
  const vc = decoded.vc as Record<string, unknown>;
  const credSubject = vc?.credentialSubject as Record<string, unknown>;
  const assurance = credSubject?.assurance as { declared: number; method: string; breakdown: Record<string, number> };
  const provenance = credSubject?.provenance as { source: string; sourceIdentity?: string; sourceDate?: string };
  const summary = credSubject?.summary as { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number };

  if (assurance) {
    const level = assurance.declared as AssuranceLevel;
    const levelName = ASSURANCE_NAMES[level] || "Unknown";
    console.log(`Assurance Level:   L${level} (${levelName})`);
    console.log(`  Method:          ${assurance.method}`);
    console.log(`  Breakdown:       ${Object.entries(assurance.breakdown).map(([k, v]) => `L${k}: ${v} controls`).join(", ")}`);
  }

  if (provenance) {
    console.log(`Provenance:        ${provenance.source}${provenance.sourceIdentity ? ` (${provenance.sourceIdentity})` : ""}`);
    if (provenance.sourceDate) console.log(`  Source Date:     ${provenance.sourceDate}`);
  }

  if (summary) {
    console.log(`Score:             ${summary.overallScore}% (${summary.controlsPassed}/${summary.controlsTested} passed)`);
  }

  console.log();

  // Framework coverage
  const frameworks = new Set<string>();
  for (const ctrl of document.controls) {
    for (const ref of ctrl.frameworkRefs || []) {
      frameworks.add(ref.framework);
    }
  }
  console.log(`Frameworks:        ${Array.from(frameworks).join(", ")}`);
  console.log(`Format:            JWT-VC (W3C Verifiable Credential 2.0)`);
  console.log(`Issuer DID:        ${ISSUER_DID}`);
  console.log(`Signature:         Ed25519 (EdDSA)`);
  console.log(`Expiry:            ${EXPIRY_DAYS} days`);
  console.log();

  if (document.assessmentContext?.gaps) {
    console.log(`Known Gaps:        ${document.assessmentContext.gaps.length}`);
    for (const gap of document.assessmentContext.gaps) {
      console.log(`  - ${gap}`);
    }
    console.log();
  }

  console.log("Output Files:");
  console.log(`  JWT-VC:          ${jwtPath}`);
  console.log(`  Decoded JSON:    ${decodedPath}`);
  console.log(`  DID Document:    ${didPath}`);
  console.log();
  console.log("This CPOE can be verified at grcorsair.com/verify");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
}

export { main, buildDocument, buildControls };
