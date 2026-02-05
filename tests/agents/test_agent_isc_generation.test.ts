/**
 * Agent ISC Generation Test Contract
 *
 * THE CRITICAL TEST: Validates Corsair's core innovation - agent autonomy.
 *
 * This test proves that CorsairAgent generates valid ISC (Ideal State Criteria)
 * from Claude's security knowledge, NOT from pre-programmed checks.
 *
 * Why This Matters:
 * - Scripted tools: 50 services = 50 maintenance cycles
 * - Autonomous agent: 50 services = 1 architecture + Claude's knowledge
 *
 * Contract Requirements:
 * 1. Agent generates valid S3 ISC criteria from security knowledge
 * 2. Criteria follow ISC format: ≤8 words, binary testable, granular
 * 3. Agent covers critical S3 security controls without pre-programming
 * 4. Output is parseable and structured (not vague prose)
 * 5. Agent reasoning is verifiable (can extract ISC from response)
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { CorsairAgent } from "../../src/agents/corsair-agent";

describe("Agent ISC Generation - Core Autonomy Validation", () => {
  let agent: CorsairAgent;

  beforeEach(() => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY required for agent tests. Set in .env or environment."
      );
    }

    // Use Haiku for fast execution (~2-3s per test)
    agent = new CorsairAgent({
      apiKey,
      model: "haiku",
      verbose: false, // Suppress logs during test
    });
  });

  test(
    "Agent generates valid S3 ISC criteria from security knowledge",
    async () => {
      // Mission: Generate ISC criteria for S3 bucket security
      // This tests BOUNDED AUTONOMY - agent uses Claude's knowledge to generate criteria
      const mission = `Generate ISC (Ideal State Criteria) for S3 bucket security.

Context: You are defining security expectations for S3 bucket "test-bucket" for compliance testing.

Generate 5-8 ISC criteria that define IDEAL STATE for S3 security. Each criterion must be:
- Exactly 8 words or fewer
- Binary testable (clear PASS/FAIL)
- Cover critical S3 security controls
- Start with a capital letter
- Be a statement of EXPECTED STATE (not an action item)

Examples of GOOD ISC criteria:
- "Public access blocked at bucket level settings" (7 words, binary, specific)
- "Encryption enabled using AES256 or KMS algorithm" (8 words, binary, specific)
- "Versioning enabled for data loss protection guarantee" (8 words, binary, specific)

Examples of BAD ISC criteria:
- "Check encryption" (too vague, action not state)
- "Bucket is secure" (not binary, not testable, too vague)
- "Ensure that public access is properly configured according to best practices" (too long, not binary)

Return your ISC criteria as a JSON array for easy parsing:
["criterion 1", "criterion 2", "criterion 3", ...]`;

      const response = await agent.executeMission(mission);

      // Extract ISC criteria from agent response
      const criteria = extractISCCriteria(response);

      // VALIDATION 1: Count and Format Compliance
      expect(criteria.length).toBeGreaterThanOrEqual(5);
      expect(criteria.length).toBeLessThanOrEqual(8);

      criteria.forEach((criterion, index) => {
        const wordCount = criterion.trim().split(/\s+/).length;

        // Word count validation (≤8 words)
        expect(wordCount).toBeLessThanOrEqual(8);

        // Starts with capital letter
        expect(criterion[0]).toMatch(/[A-Z]/);

        // Not too vague (minimum 4 words to be meaningful)
        expect(wordCount).toBeGreaterThanOrEqual(4);

        // Not empty or whitespace
        expect(criterion.trim().length).toBeGreaterThan(0);
      });

      // VALIDATION 2: Security Topic Coverage
      // Agent should autonomously cover critical S3 security controls
      const topicsString = criteria.join(" ").toLowerCase();

      const criticalTopics = {
        encryption: /encrypt/,
        publicAccess: /public|access|acl|permissions/,
        versioning: /version/,
        logging: /log|audit/,
      };

      const coveredTopics = Object.entries(criticalTopics).filter(
        ([_, pattern]) => pattern.test(topicsString)
      );

      // At least 3 of 4 critical topics covered (proves autonomous reasoning)
      expect(coveredTopics.length).toBeGreaterThanOrEqual(3);

      // VALIDATION 3: Binary Testability (Heuristic Check)
      // ISC criteria should describe STATES not ACTIONS
      const hasStateDescriptions = criteria.some((c) =>
        /enabled|disabled|configured|blocked|allowed|encrypted|set|required/i.test(
          c
        )
      );
      expect(hasStateDescriptions).toBe(true);

      // Should NOT be action items (common anti-patterns)
      const hasActionAntiPatterns = criteria.some((c) =>
        /^(check|verify|ensure|validate|test|review)/i.test(c.trim())
      );
      expect(hasActionAntiPatterns).toBe(false);
    },
    30000
  ); // 30s timeout for agent execution

  test(
    "Agent ISC criteria are granular not vague",
    async () => {
      // Mission: Test that agent avoids vague security statements
      const mission = `Generate ISC for S3 bucket encryption security.

You are defining the IDEAL STATE for S3 bucket encryption. Generate 3-5 ISC criteria.

IMPORTANT: Be SPECIFIC and GRANULAR. Avoid vague statements.

BAD (vague): "Bucket is secure"
GOOD (granular): "Encryption enabled using AES256 or KMS algorithm"

BAD (vague): "Check encryption settings"
GOOD (granular): "Server-side encryption configured with KMS key rotation"

Return as JSON array: ["criterion 1", "criterion 2", ...]`;

      const response = await agent.executeMission(mission);
      const criteria = extractISCCriteria(response);

      expect(criteria.length).toBeGreaterThanOrEqual(3);
      expect(criteria.length).toBeLessThanOrEqual(5);

      // Validate NO vague phrases (proves agent generates specific criteria)
      const vaguePhrases = [
        "is secure",
        "is safe",
        "properly configured",
        "best practices",
        "should be",
        "must be",
      ];

      criteria.forEach((criterion) => {
        const lowerCriterion = criterion.toLowerCase();
        const hasVague = vaguePhrases.some((phrase) =>
          lowerCriterion.includes(phrase)
        );

        // Vague phrases indicate weak ISC criteria
        expect(hasVague).toBe(false);
      });

      // All criteria should mention specific technical concepts
      const hasTechnicalTerms = criteria.every((c) => {
        const technical =
          /aes256|kms|encryption|algorithm|key|rotation|policy|block|acl/i;
        return technical.test(c);
      });

      expect(hasTechnicalTerms).toBe(true);
    },
    30000
  );

  test(
    "Agent output is parseable and structured",
    async () => {
      // Mission: Verify agent can return structured ISC criteria
      const mission = `Generate ISC for S3 bucket public access controls.

Generate 4-6 ISC criteria defining IDEAL STATE for public access security.
Return as JSON array: ["criterion 1", "criterion 2", ...]`;

      const response = await agent.executeMission(mission);

      // Test that extractISCCriteria can parse the response
      const criteria = extractISCCriteria(response);

      // Should successfully extract criteria
      expect(criteria.length).toBeGreaterThan(0);

      // All criteria should be non-empty strings
      criteria.forEach((criterion) => {
        expect(typeof criterion).toBe("string");
        expect(criterion.trim().length).toBeGreaterThan(0);
      });

      // Criteria should be distinct (not duplicates)
      const uniqueCriteria = new Set(
        criteria.map((c) => c.trim().toLowerCase())
      );
      expect(uniqueCriteria.size).toBe(criteria.length);
    },
    30000
  );

  test(
    "Agent can generate ISC for multiple S3 security domains",
    async () => {
      // Mission: Test agent's breadth of security knowledge
      const mission = `Generate ISC for comprehensive S3 bucket security.

Cover these security domains:
1. Data protection (encryption, versioning)
2. Access control (public access, IAM policies)
3. Audit & monitoring (logging, metrics)

Generate 6-8 ISC criteria covering all three domains.
Return as JSON array: ["criterion 1", "criterion 2", ...]`;

      const response = await agent.executeMission(mission);
      const criteria = extractISCCriteria(response);

      expect(criteria.length).toBeGreaterThanOrEqual(6);
      expect(criteria.length).toBeLessThanOrEqual(8);

      // Validate domain coverage (proves broad security knowledge)
      const topicsString = criteria.join(" ").toLowerCase();

      const domains = {
        dataProtection: /encrypt|version|backup|recovery/,
        accessControl: /public|access|iam|policy|permissions|acl/,
        auditMonitoring: /log|audit|monitor|metric|cloudtrail/,
      };

      const coveredDomains = Object.entries(domains).filter(([_, pattern]) =>
        pattern.test(topicsString)
      );

      // All 3 domains should be covered (proves comprehensive reasoning)
      expect(coveredDomains.length).toBe(3);
    },
    30000
  );
});

/**
 * Helper function to extract ISC criteria from agent response.
 *
 * Supports multiple formats:
 * 1. JSON array: ["criterion 1", "criterion 2"]
 * 2. Numbered list: 1. criterion 1\n2. criterion 2
 * 3. Bulleted list: - criterion 1\n- criterion 2
 *
 * This flexibility handles agent's natural language responses.
 */
function extractISCCriteria(agentResponse: string): string[] {
  // Strategy 1: Try to parse JSON array first (most structured)
  const jsonMatch = agentResponse.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim());
      }
    } catch {
      // Not valid JSON, continue to fallback strategies
    }
  }

  // Strategy 2: Extract from numbered/bulleted list
  const lines = agentResponse.split("\n");
  const criteria: string[] = [];

  for (const line of lines) {
    const cleaned = line.trim();

    // Match patterns: "1. ", "- ", "* ", "• "
    const match = cleaned.match(/^(?:\d+\.|[-*•])\s*(.+)$/);
    if (match && match[1]) {
      const criterion = match[1]
        .replace(/^["']|["']$/g, "") // Remove quotes
        .replace(/^`|`$/g, "") // Remove backticks
        .trim();

      // Filter out headers/non-criteria (too short = likely a header)
      if (criterion.length > 15) {
        criteria.push(criterion);
      }
    }
  }

  // Strategy 3: If still nothing, try to extract quoted strings
  if (criteria.length === 0) {
    const quotedMatches = agentResponse.match(/"([^"]+)"/g);
    if (quotedMatches) {
      return quotedMatches
        .map((m) => m.replace(/"/g, "").trim())
        .filter((c) => c.length > 15);
    }
  }

  return criteria;
}
