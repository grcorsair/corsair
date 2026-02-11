/**
 * Pre-computed demo page data showing a sample SOC 2 pipeline run.
 * All data is static — no live API calls on this showcase page.
 */

export interface DemoPipelineStage {
  id: string;
  name: string;
  subtitle: string;
  status: "complete" | "active" | "pending";
  duration: string;
  color: string;
}

export interface DemoControl {
  id: string;
  name: string;
  level: 0 | 1 | 2;
  status: "effective" | "ineffective";
}

export interface DemoFrameworkMapping {
  framework: string;
  controlsMapped: number;
  passed: number;
  failed: number;
  color: string;
}

export interface DemoDimension {
  name: string;
  score: number;
  color: string;
  description: string;
}

export const DEMO_DOCUMENT = {
  name: "Acme Corp SOC 2 Type II",
  file: "acme-soc2-report.pdf",
  pages: 47,
  size: "2.4 MB",
  auditor: "Example Audit Firm LLP",
  period: "Apr 2024 – Oct 2024",
  totalControls: 82,
  effective: 76,
  ineffective: 6,
  extractionTime: "3.2s",
};

export const DEMO_PIPELINE_STAGES: DemoPipelineStage[] = [
  {
    id: "ingest",
    name: "INGEST",
    subtitle: "Extract controls",
    status: "complete",
    duration: "3.2s",
    color: "corsair-gold",
  },
  {
    id: "classify",
    name: "CLASSIFY",
    subtitle: "Assign assurance",
    status: "complete",
    duration: "0.4s",
    color: "corsair-gold",
  },
  {
    id: "chart",
    name: "CHART",
    subtitle: "Map frameworks",
    status: "complete",
    duration: "1.1s",
    color: "corsair-turquoise",
  },
  {
    id: "quarter",
    name: "QUARTER",
    subtitle: "Governance review",
    status: "complete",
    duration: "2.8s",
    color: "corsair-gold",
  },
  {
    id: "marque",
    name: "MARQUE",
    subtitle: "Sign CPOE",
    status: "complete",
    duration: "0.2s",
    color: "corsair-green",
  },
];

export const DEMO_CONTROLS: DemoControl[] = [
  { id: "CC6.1", name: "Logical Access Controls", level: 1, status: "effective" },
  { id: "CC6.2", name: "Authentication & Authorization", level: 1, status: "effective" },
  { id: "CC6.3", name: "Access Provisioning", level: 1, status: "effective" },
  { id: "CC6.6", name: "Encryption at Rest/Transit", level: 1, status: "effective" },
  { id: "CC7.1", name: "System Monitoring", level: 2, status: "effective" },
  { id: "CC7.2", name: "Vulnerability Management", level: 2, status: "effective" },
  { id: "CC7.3", name: "Physical Security", level: 0, status: "effective" },
  { id: "CC8.1", name: "Change Management", level: 1, status: "effective" },
  { id: "CC3.1", name: "Risk Assessment", level: 0, status: "effective" },
  { id: "CC5.1", name: "Incident Response", level: 2, status: "effective" },
  { id: "CC2.1", name: "Security Awareness", level: 0, status: "ineffective" },
  { id: "CC4.1", name: "Asset Inventory", level: 0, status: "ineffective" },
];

export const DEMO_ASSURANCE_BREAKDOWN = {
  0: { count: 6, label: "Documented", color: "text-corsair-text-dim", bg: "bg-corsair-text-dim" },
  1: { count: 73, label: "Configured", color: "text-corsair-gold", bg: "bg-corsair-gold" },
  2: { count: 3, label: "Demonstrated", color: "text-corsair-green", bg: "bg-corsair-green" },
} as const;

export const DEMO_FRAMEWORK_MAPPINGS: DemoFrameworkMapping[] = [
  { framework: "SOC 2", controlsMapped: 24, passed: 22, failed: 2, color: "#D4A853" },
  { framework: "NIST 800-53", controlsMapped: 22, passed: 20, failed: 2, color: "#7FDBCA" },
  { framework: "ISO 27001", controlsMapped: 18, passed: 16, failed: 2, color: "#93C5FD" },
  { framework: "HIPAA", controlsMapped: 14, passed: 13, failed: 1, color: "#C084FC" },
  { framework: "PCI-DSS", controlsMapped: 12, passed: 11, failed: 1, color: "#F472B6" },
  { framework: "CIS Controls", controlsMapped: 16, passed: 15, failed: 1, color: "#34D399" },
  { framework: "MITRE ATT&CK", controlsMapped: 8, passed: 7, failed: 1, color: "#FB923C" },
];

export const DEMO_DIMENSIONS: DemoDimension[] = [
  { name: "Capability", score: 93, color: "#D4A853", description: "Can controls defend against threats?" },
  { name: "Coverage", score: 100, color: "#2ECC71", description: "Are all required areas addressed?" },
  { name: "Reliability", score: 56, color: "#C0392B", description: "How consistently do controls perform?" },
  { name: "Methodology", score: 50, color: "#D4A853", description: "How rigorous was the testing approach?" },
  { name: "Freshness", score: 0, color: "#C0392B", description: "How recent is the evidence?" },
  { name: "Independence", score: 85, color: "#2ECC71", description: "Was the assessment independent?" },
  { name: "Consistency", score: 100, color: "#2ECC71", description: "Are findings internally consistent?" },
];

export const DEMO_OUTPUTS = [
  {
    format: "JWT",
    name: "CPOE (JWT-VC)",
    description: "W3C Verifiable Credential signed with Ed25519. The cryptographic proof.",
    icon: "🔐",
    color: "corsair-gold",
    size: "4.2 KB",
  },
  {
    format: "JSON",
    name: "OSCAL Assessment",
    description: "NIST SP 800-53A compliant machine-readable output. Standards-native.",
    icon: "📋",
    color: "corsair-turquoise",
    size: "18.7 KB",
  },
  {
    format: "JSONL",
    name: "Evidence Chain",
    description: "SHA-256 hash chain with tamper-proof integrity. Every decision logged.",
    icon: "⛓️",
    color: "corsair-green",
    size: "12.3 KB",
  },
  {
    format: "HTML",
    name: "Executive Report",
    description: "Self-contained summary with findings, framework mappings, and assurance level.",
    icon: "📊",
    color: "corsair-text",
    size: "89 KB",
  },
];
