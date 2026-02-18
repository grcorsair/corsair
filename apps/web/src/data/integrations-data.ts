/**
 * Integrations catalog — every way to use Corsair.
 *
 * Three status tiers:
 *   available — works today, linked to docs
 *   beta     — in progress, early access
 *   coming   — on roadmap, not built yet
 */

export type IntegrationStatus = "available" | "beta" | "coming";

export type IntegrationCategory =
  | "evidence-sources"
  | "sign-verify"
  | "ci-cd"
  | "ai-assistants"
  | "automation"
  | "program-management"
  | "sdks"
  | "browser";

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  description: string;
  docsUrl?: string;
  snippet?: string;
}

export interface IntegrationCategoryMeta {
  id: IntegrationCategory;
  name: string;
  pirateName: string;
  description: string;
}

export const CATEGORIES: IntegrationCategoryMeta[] = [
  {
    id: "evidence-sources",
    name: "Evidence Sources",
    pirateName: "LOOKOUT",
    description:
      "Security tools Corsair can parse natively. Auto-detected from JSON structure.",
  },
  {
    id: "sign-verify",
    name: "Sign & Verify",
    pirateName: "MARQUE",
    description:
      "Every way to sign evidence and verify CPOEs — no account required for verification.",
  },
  {
    id: "ci-cd",
    name: "CI/CD Pipelines",
    pirateName: "CONVOY",
    description:
      "Sign compliance evidence as part of every build. Three lines in your pipeline.",
  },
  {
    id: "ai-assistants",
    name: "AI Assistants",
    pirateName: "PARROT",
    description:
      "AI agents that sign CPOEs as a side effect of compliance work.",
  },
  {
    id: "automation",
    name: "Automation",
    pirateName: "WINDLASS",
    description:
      "Set once, runs forever. Connect Corsair to your existing automation platform.",
  },
  {
    id: "program-management",
    name: "Program Management",
    pirateName: "CHART",
    description:
      "Attach cryptographic proof to work items. FLAGSHIP webhooks fire when compliance changes.",
  },
  {
    id: "sdks",
    name: "SDKs & Libraries",
    pirateName: "ARMORY",
    description:
      "Build custom integrations in your language. All SDKs wrap the same HTTP API.",
  },
  {
    id: "browser",
    name: "Browser",
    pirateName: "SPYGLASS",
    description:
      "Verify CPOEs without leaving your browser. Right-click any JWT to check it.",
  },
];

export const INTEGRATIONS: Integration[] = [
  // ── Evidence Sources ─────────────────────────────────────────────────
  {
    id: "prowler",
    name: "Prowler",
    category: "evidence-sources",
    status: "available",
    description: "AWS/Azure/GCP cloud security scanner (OCSF format)",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "prowler aws --output json | corsair sign --format prowler",
  },
  {
    id: "securityhub",
    name: "AWS SecurityHub",
    category: "evidence-sources",
    status: "available",
    description: "AWS native security findings (ASFF format)",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "corsair sign --file findings.json --format securityhub",
  },
  {
    id: "inspec",
    name: "Chef InSpec",
    category: "evidence-sources",
    status: "available",
    description: "Infrastructure compliance testing profiles",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "inspec exec profile --reporter json | corsair sign --format inspec",
  },
  {
    id: "trivy",
    name: "Trivy",
    category: "evidence-sources",
    status: "available",
    description: "Container and infrastructure vulnerability scanner",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "trivy image myapp:latest -f json | corsair sign --format trivy",
  },
  {
    id: "gitlab-sast",
    name: "GitLab SAST",
    category: "evidence-sources",
    status: "available",
    description: "GitLab static application security testing results",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "corsair sign --file gl-sast-report.json --format gitlab",
  },
  {
    id: "ciso-assistant-api",
    name: "CISO Assistant (API)",
    category: "evidence-sources",
    status: "available",
    description: "CISO Assistant API compliance results",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "corsair sign --file results.json --format ciso-assistant-api",
  },
  {
    id: "ciso-assistant-export",
    name: "CISO Assistant (Export)",
    category: "evidence-sources",
    status: "available",
    description: "CISO Assistant bulk export files",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "corsair sign --file export.json --format ciso-assistant-export",
  },
  {
    id: "generic-json",
    name: "Generic JSON",
    category: "evidence-sources",
    status: "available",
    description: "Any JSON with { metadata, controls[] } structure",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "corsair sign --file evidence.json --format generic",
  },
  {
    id: "sarif",
    name: "SARIF",
    category: "evidence-sources",
    status: "coming",
    description: "Static Analysis Results Interchange Format (OASIS standard)",
  },
  {
    id: "oscal",
    name: "OSCAL",
    category: "evidence-sources",
    status: "coming",
    description: "NIST Open Security Controls Assessment Language",
  },
  {
    id: "semgrep",
    name: "Semgrep",
    category: "evidence-sources",
    status: "coming",
    description: "Lightweight static analysis for many languages",
  },
  {
    id: "qualys",
    name: "Qualys",
    category: "evidence-sources",
    status: "coming",
    description: "Enterprise vulnerability management scanner",
  },

  // ── Sign & Verify ────────────────────────────────────────────────────
  {
    id: "cli-bun",
    name: "CLI (Bun)",
    category: "sign-verify",
    status: "available",
    description: "Native Bun runtime — zero build step, fastest option",
    docsUrl: "/docs/getting-started/quick-start",
    snippet: "bun run corsair.ts sign --file evidence.json",
  },
  {
    id: "npx",
    name: "npx",
    category: "sign-verify",
    status: "beta",
    description: "Zero-install — run directly from npm registry",
    snippet: "npx @grcorsair/cli sign --file evidence.json",
  },
  {
    id: "docker",
    name: "Docker",
    category: "sign-verify",
    status: "beta",
    description: "Containerized CLI — no local runtime needed",
    snippet: "docker run ghcr.io/arudjreis/corsair sign --file evidence.json",
  },
  {
    id: "web-sign",
    name: "Web UI (Sign)",
    category: "sign-verify",
    status: "available",
    description: "Sign evidence in your browser at grcorsair.com/sign",
    docsUrl: "/sign",
  },
  {
    id: "web-verify",
    name: "Web UI (Verify)",
    category: "sign-verify",
    status: "available",
    description: "Verify any CPOE at grcorsair.com/verify — no account needed",
    docsUrl: "/verify",
  },
  {
    id: "hosted-api",
    name: "Hosted API",
    category: "sign-verify",
    status: "available",
    description: "REST API at api.grcorsair.com — free verification, auth for signing",
    docsUrl: "/docs/integrations/api",
    snippet: "curl -X POST https://api.grcorsair.com/v1/verify -d '{\"cpoe\":\"eyJ...\"}'",
  },

  // ── CI/CD Pipelines ──────────────────────────────────────────────────
  {
    id: "github-actions",
    name: "GitHub Actions",
    category: "ci-cd",
    status: "available",
    description: "Sign evidence on every push — 3 lines in your workflow",
    docsUrl: "/docs/integrations/ci-cd",
    snippet: "- uses: Arudjreis/corsair@v1\n  with:\n    file: evidence.json",
  },
  {
    id: "gitlab-ci",
    name: "GitLab CI",
    category: "ci-cd",
    status: "available",
    description: "Corsair in your .gitlab-ci.yml pipeline",
    docsUrl: "/docs/integrations/ci-cd",
    snippet: "corsair sign --file $EVIDENCE_FILE --json > cpoe.json",
  },
  {
    id: "jenkins",
    name: "Jenkins",
    category: "ci-cd",
    status: "available",
    description: "Corsair in your Jenkinsfile with Bun runtime",
    docsUrl: "/docs/integrations/ci-cd",
  },
  {
    id: "circleci",
    name: "CircleCI",
    category: "ci-cd",
    status: "coming",
    description: "Orb for CircleCI pipelines",
  },
  {
    id: "azure-devops",
    name: "Azure DevOps",
    category: "ci-cd",
    status: "coming",
    description: "Task extension for Azure Pipelines",
  },

  // ── AI Assistants ────────────────────────────────────────────────────
  {
    id: "agent-skill",
    name: "Agent Skill (skills.sh)",
    category: "ai-assistants",
    status: "available",
    description: "One-line install for Claude Code, Cursor, Copilot, and 25+ AI agents — sign, verify, diff, discover, audit",
    docsUrl: "/docs/integrations/skills",
    snippet: "npx skills add grcorsair/corsair",
  },
  {
    id: "claude-mcp",
    name: "Claude Code (MCP)",
    category: "ai-assistants",
    status: "available",
    description: "4 MCP tools — sign, verify, diff, formats — in Claude Code",
    docsUrl: "/docs/integrations/sdk",
    snippet: '{ "corsair": { "command": "bun", "args": ["run", "bin/corsair-mcp.ts"] } }',
  },
  {
    id: "chatgpt-gpt",
    name: "ChatGPT (Custom GPT)",
    category: "ai-assistants",
    status: "beta",
    description: "Corsair Compliance Analyst GPT — upload evidence, get signed CPOE",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ai-assistants",
    status: "coming",
    description: "Gemini Extension using OpenAPI spec",
  },
  {
    id: "crewai",
    name: "CrewAI",
    category: "ai-assistants",
    status: "coming",
    description: "Python tool for multi-agent compliance workflows",
  },
  {
    id: "langchain",
    name: "LangChain",
    category: "ai-assistants",
    status: "coming",
    description: "LangChain tool wrapping Corsair HTTP API",
  },

  // ── Automation ───────────────────────────────────────────────────────
  {
    id: "zapier",
    name: "Zapier",
    category: "automation",
    status: "beta",
    description: "Sign evidence and verify CPOEs from 6,000+ apps",
  },
  {
    id: "n8n",
    name: "n8n",
    category: "automation",
    status: "coming",
    description: "Self-hosted automation node for Corsair",
  },
  {
    id: "power-automate",
    name: "Power Automate",
    category: "automation",
    status: "coming",
    description: "Microsoft custom connector for enterprise workflows",
  },
  {
    id: "tines",
    name: "Tines",
    category: "automation",
    status: "coming",
    description: "Security automation and orchestration platform",
  },
  {
    id: "make",
    name: "Make (Integromat)",
    category: "automation",
    status: "coming",
    description: "Visual automation platform with Corsair HTTP module",
  },

  // ── Program Management ───────────────────────────────────────────────
  {
    id: "jira",
    name: "Jira",
    category: "program-management",
    status: "beta",
    description: "Attach CPOE links to Jira issues via FLAGSHIP webhooks",
  },
  {
    id: "linear",
    name: "Linear",
    category: "program-management",
    status: "coming",
    description: "Compliance tracking in Linear with webhook automation",
  },
  {
    id: "notion",
    name: "Notion",
    category: "program-management",
    status: "coming",
    description: "Notion database integration for compliance evidence tracking",
  },
  {
    id: "asana",
    name: "Asana",
    category: "program-management",
    status: "coming",
    description: "Task automation with FLAGSHIP compliance events",
  },
  {
    id: "servicenow",
    name: "ServiceNow",
    category: "program-management",
    status: "coming",
    description: "Enterprise ITSM integration via webhook or REST",
  },

  // ── SDKs & Libraries ────────────────────────────────────────────────
  {
    id: "sdk-typescript",
    name: "TypeScript SDK",
    category: "sdks",
    status: "available",
    description: "Full-featured SDK — sign, verify, score, query",
    docsUrl: "/docs/integrations/sdk",
    snippet: "bun add @grcorsair/sdk",
  },
  {
    id: "sdk-python",
    name: "Python SDK",
    category: "sdks",
    status: "coming",
    description: "Minimal HTTP wrapper — sign(), verify(), formats()",
  },
  {
    id: "sdk-go",
    name: "Go SDK",
    category: "sdks",
    status: "coming",
    description: "Go client for Corsair HTTP API",
  },
  {
    id: "rest-api",
    name: "REST API",
    category: "sdks",
    status: "available",
    description: "Direct HTTP calls — works with any language",
    docsUrl: "/docs/integrations/api",
    snippet: "curl -X POST https://api.grcorsair.com/v1/sign -H 'Authorization: Bearer $KEY'",
  },
  {
    id: "openapi",
    name: "OpenAPI Spec",
    category: "sdks",
    status: "available",
    description: "Machine-readable API spec — powers ChatGPT, Zapier, and more",
  },

  // ── Browser ──────────────────────────────────────────────────────────
  {
    id: "chrome-extension",
    name: "Chrome Extension",
    category: "browser",
    status: "coming",
    description: "Verify CPOEs inline — right-click any JWT to check it",
  },
  {
    id: "firefox-extension",
    name: "Firefox Extension",
    category: "browser",
    status: "coming",
    description: "Verify CPOEs inline — same features as Chrome extension",
  },
];

/** Convenience: get integrations by category */
export function getIntegrationsByCategory(
  category: IntegrationCategory,
): Integration[] {
  return INTEGRATIONS.filter((i) => i.category === category);
}

/** Count by status */
export function countByStatus(status: IntegrationStatus): number {
  return INTEGRATIONS.filter((i) => i.status === status).length;
}
