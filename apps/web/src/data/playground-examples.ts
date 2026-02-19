/**
 * Playground Examples — Pre-loaded evidence samples for generic + mapping-ready JSON.
 * Keep these short and easy to understand in the UI.
 */

export interface PlaygroundExample {
  name: string;
  format: string;
  description: string;
  data: unknown;
}

export const PLAYGROUND_EXAMPLES: PlaygroundExample[] = [
  {
    name: "Generic Evidence",
    format: "generic",
    description: "Simple JSON with metadata + controls array. Works with any assessment.",
    data: {
      metadata: {
        title: "Acme Corp Cloud Security Assessment",
        issuer: "Acme Security Team",
        date: "2026-02-01",
        scope: "AWS production (us-east-1)",
      },
      controls: [
        { id: "MFA-001", description: "MFA enforced for all users", status: "pass", evidence: "Okta MFA policy active for 142 users" },
        { id: "ENC-001", description: "Encryption at rest enabled", status: "pass", evidence: "RDS encrypted with KMS CMK" },
        { id: "LOG-001", description: "Centralized logging active", status: "pass", evidence: "CloudTrail + VPC Flow Logs to Datadog" },
        { id: "IR-001", description: "Incident response plan tested", status: "fail", evidence: "Tabletop exercise overdue by 2 months" },
        { id: "BCP-001", description: "DR failover tested", status: "fail", evidence: "DR failover never tested" },
      ],
    },
  },
  {
    name: "Evidence-Only Passthrough",
    format: "evidence-only",
    description: "Raw evidence with passthrough fields. Useful when you only want provenance + integrity.",
    data: {
      metadata: {
        title: "Acme Cloud Snapshot",
        issuer: "Acme Security Team",
        date: "2026-02-12",
        scope: "AWS production (us-east-1)",
      },
      controls: [],
      assessmentContext: {
        stack: ["AWS", "Kubernetes", "Postgres"],
        notes: "Evidence-only CPOE; control mapping handled externally.",
      },
    },
  },
];
