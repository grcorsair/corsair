/**
 * Pre-computed anatomy page data from a sample SOC 2 analysis.
 * All data is static — no live API calls on this showcase page.
 */

export interface AnatomyControl {
  id: string;
  name: string;
  level: 0 | 1 | 2;
  status: "effective" | "ineffective" | "not-tested";
  evidence: string;
  ruleTrace: string[];
  methodology: string;
}

export const ANATOMY_DOCUMENT = {
  name: "Acme Corp SOC 2 Type II Report",
  pages: 47,
  auditor: "Example Audit Firm LLP",
  date: "2024-10-31",
  scope: "Cloud Platform — Security and Availability",
  extractionTime: "3.2s",
  totalControls: 82,
  effective: 76,
  ineffective: 6,
};

export const ANATOMY_CONTROLS: AnatomyControl[] = [
  {
    id: "CC6.1",
    name: "Logical and Physical Access Controls",
    level: 1,
    status: "effective",
    evidence: "MFA enforced for all user accounts. Role-based access control implemented via SSO provider.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = documented-record (config)",
      "RULE: control status = effective",
      "RESULT: L1 (Configured) — config evidence, no test results",
    ],
    methodology: "examine",
  },
  {
    id: "CC6.2",
    name: "User Authentication and Authorization",
    level: 1,
    status: "effective",
    evidence: "Password complexity requirements enforced. Session timeout after 15 minutes of inactivity.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = documented-record",
      "RULE: control status = effective",
      "RESULT: L1 (Configured) — policy documented with config proof",
    ],
    methodology: "examine",
  },
  {
    id: "CC6.3",
    name: "Access Provisioning and Deprovisioning",
    level: 1,
    status: "effective",
    evidence: "Automated deprovisioning within 24 hours of termination via HR-IT integration.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = documented-record",
      "RULE: control status = effective",
      "RESULT: L1 (Configured) — automated process documented",
    ],
    methodology: "examine",
  },
  {
    id: "CC7.1",
    name: "System Monitoring and Alerting",
    level: 2,
    status: "effective",
    evidence: "SIEM deployed with 24/7 alerting. Incident response tested via tabletop exercise Q3 2024.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = test (tabletop exercise)",
      "OVERRIDE: test evidence elevates to L2",
      "RESULT: L2 (Demonstrated) — test results prove control works",
    ],
    methodology: "caat",
  },
  {
    id: "CC7.2",
    name: "Vulnerability Management",
    level: 2,
    status: "effective",
    evidence: "Weekly vulnerability scans. Critical findings remediated within 72 hours. Q3 pentest: 0 critical findings.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = test (pentest results)",
      "OVERRIDE: test evidence elevates to L2",
      "RESULT: L2 (Demonstrated) — pentest proves effectiveness",
    ],
    methodology: "caat",
  },
  {
    id: "CC7.3",
    name: "Physical Security Controls",
    level: 0,
    status: "effective",
    evidence: "Cloud-only infrastructure. Physical security delegated to AWS SOC 2.",
    ruleTrace: [
      "RULE: evidence type = policy reference only",
      "RULE: no direct config or test evidence",
      "RULE: delegation to sub-service org = L0",
      "RESULT: L0 (Documented) — policy assertion, no direct proof",
    ],
    methodology: "unknown",
  },
  {
    id: "CC8.1",
    name: "Change Management Process",
    level: 1,
    status: "effective",
    evidence: "All changes require PR approval. CI/CD pipeline enforces automated tests before merge.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = documented-record (CI config)",
      "RULE: control status = effective",
      "RESULT: L1 (Configured) — CI/CD pipeline configuration documented",
    ],
    methodology: "examine",
  },
  {
    id: "CC3.1",
    name: "Risk Assessment Process",
    level: 0,
    status: "effective",
    evidence: "Annual risk assessment performed. Risk register maintained.",
    ruleTrace: [
      "RULE: evidence type = interview + documented-record",
      "RULE: no automated/tool evidence",
      "RULE: interview-only = L0",
      "RESULT: L0 (Documented) — interview-based, no machine evidence",
    ],
    methodology: "unknown",
  },
  {
    id: "CC6.6",
    name: "Encryption at Rest and Transit",
    level: 1,
    status: "effective",
    evidence: "TLS 1.2+ enforced for all connections. AES-256 encryption for data at rest via AWS KMS.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = documented-record (config)",
      "RULE: control status = effective",
      "RESULT: L1 (Configured) — encryption settings documented",
    ],
    methodology: "examine",
  },
  {
    id: "CC5.1",
    name: "Incident Response Program",
    level: 2,
    status: "effective",
    evidence: "IR plan tested via tabletop exercise. Mean time to detect: 4 hours. Mean time to respond: 12 hours.",
    ruleTrace: [
      'RULE: source "soc2" ceiling = L1',
      "RULE: evidence type = test (tabletop + metrics)",
      "OVERRIDE: test evidence elevates to L2",
      "RESULT: L2 (Demonstrated) — IR test with measured outcomes",
    ],
    methodology: "caat",
  },
];

export const ANATOMY_ASSURANCE = {
  declared: 0 as const,
  verified: true,
  method: "self-assessed" as const,
  breakdown: { 0: 6, 1: 73, 2: 3 } as Record<number, number>,
  ruleTrace: [
    "RULE: 82 controls checked",
    'RULE: source "soc2" ceiling = L1',
    'RULE: breakdown = {"0":6,"1":73,"2":3}',
    "RULE: min of in-scope controls = L0 — satisfied",
    "RULE: freshness checked — stale (468 days)",
    "SAFEGUARD: Evidence is 468 days old — capped at L1",
  ],
};

export const ANATOMY_DIMENSIONS = {
  capability: 93,
  coverage: 100,
  reliability: 56,
  methodology: 50,
  freshness: 0,
  independence: 85,
  consistency: 100,
};

export const ANATOMY_FRAMEWORKS = [
  { name: "SOC 2", controlsMapped: 24, passed: 22, failed: 2 },
  { name: "NIST 800-53", controlsMapped: 22, passed: 20, failed: 2 },
  { name: "ISO 27001", controlsMapped: 18, passed: 16, failed: 2 },
  { name: "HIPAA", controlsMapped: 14, passed: 13, failed: 1 },
  { name: "PCI-DSS", controlsMapped: 12, passed: 11, failed: 1 },
  { name: "CIS Controls", controlsMapped: 16, passed: 15, failed: 1 },
  { name: "MITRE ATT&CK", controlsMapped: 8, passed: 7, failed: 1 },
];

export const ASSURANCE_LABELS: Record<number, { name: string; color: string; bgColor: string }> = {
  0: { name: "Documented", color: "text-corsair-text-dim", bgColor: "bg-corsair-text-dim/20" },
  1: { name: "Configured", color: "text-corsair-gold", bgColor: "bg-corsair-gold/20" },
  2: { name: "Demonstrated", color: "text-corsair-green", bgColor: "bg-corsair-green/20" },
  3: { name: "Observed", color: "text-blue-400", bgColor: "bg-blue-400/20" },
  4: { name: "Attested", color: "text-purple-400", bgColor: "bg-purple-400/20" },
};
