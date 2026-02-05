/**
 * ISCDistributor - Criteria Distribution for Parallel MARK Agents (Phase 3.3)
 *
 * Distributes ISC criteria to MARK agents based on resource type:
 * - S3 resources get S3-related criteria (bucket, encryption, versioning)
 * - Cognito resources get auth-related criteria (MFA, password, authentication)
 * - Generic distribution for unknown resource types
 *
 * Used by CorsairCoordinator to assign relevant criteria to each MARK agent.
 */

import type { ISCCriterion } from "../types/isc";
import type { ISCDistribution } from "../types/coordination";

/**
 * Keywords associated with resource types.
 * Used to filter criteria by relevance.
 */
const RESOURCE_TYPE_KEYWORDS: Record<string, string[]> = {
  s3: [
    "bucket",
    "s3",
    "public",
    "access",
    "encryption",
    "aes",
    "kms",
    "versioning",
    "logging",
    "storage",
    "object",
    "block",
  ],
  cognito: [
    "mfa",
    "authentication",
    "password",
    "user",
    "pool",
    "identity",
    "login",
    "session",
    "token",
    "risk",
    "device",
    "factor",
  ],
  iam: [
    "permission",
    "role",
    "policy",
    "access",
    "iam",
    "principal",
    "trust",
    "assume",
  ],
  lambda: [
    "function",
    "lambda",
    "execution",
    "timeout",
    "memory",
    "concurrency",
    "environment",
  ],
  rds: [
    "database",
    "rds",
    "encryption",
    "backup",
    "retention",
    "multi-az",
    "endpoint",
  ],
};

/**
 * ISCDistributor filters and distributes criteria to agents.
 */
export class ISCDistributor {
  /**
   * Distribute criteria to a MARK agent based on resource type.
   *
   * @param criteria - All available ISC criteria
   * @param resourceId - Resource identifier
   * @param resourceType - Type of resource (s3, cognito, etc.)
   * @param agentIndex - Optional agent index for distribution tracking
   * @returns ISCDistribution with filtered criteria
   */
  distributeByResourceType(
    criteria: ISCCriterion[],
    resourceId: string,
    resourceType: string,
    agentIndex: number = 0
  ): ISCDistribution {
    const typeLower = resourceType.toLowerCase();
    const keywords = RESOURCE_TYPE_KEYWORDS[typeLower] || [];

    // Filter criteria that match resource type keywords
    const filteredCriteria = criteria.filter(criterion => {
      const textLower = criterion.text.toLowerCase();

      // Check if any keyword matches
      return keywords.some(keyword => textLower.includes(keyword));
    });

    // If no matching criteria, check if resource ID gives hints
    if (filteredCriteria.length === 0) {
      // Try to match based on resource ID patterns
      const resourceLower = resourceId.toLowerCase();

      for (const [type, kws] of Object.entries(RESOURCE_TYPE_KEYWORDS)) {
        if (kws.some(kw => resourceLower.includes(kw))) {
          const matched = criteria.filter(c =>
            kws.some(kw => c.text.toLowerCase().includes(kw))
          );
          if (matched.length > 0) {
            return {
              agentId: `mark-agent-${agentIndex}`,
              resourceId,
              criteria: matched,
              index: agentIndex,
            };
          }
        }
      }
    }

    return {
      agentId: `mark-agent-${agentIndex}`,
      resourceId,
      criteria: filteredCriteria.length > 0 ? filteredCriteria : criteria, // Fallback to all
      index: agentIndex,
    };
  }

  /**
   * Distribute criteria across multiple resources.
   *
   * @param criteria - All available ISC criteria
   * @param resources - Array of { id, type } objects
   * @returns Array of ISCDistribution objects
   */
  distributeToResources(
    criteria: ISCCriterion[],
    resources: Array<{ id: string; type: string }>
  ): ISCDistribution[] {
    return resources.map((resource, index) =>
      this.distributeByResourceType(criteria, resource.id, resource.type, index)
    );
  }

  /**
   * Get relevant keywords for a resource type.
   *
   * @param resourceType - Type of resource
   * @returns Array of keywords
   */
  getKeywordsForType(resourceType: string): string[] {
    return RESOURCE_TYPE_KEYWORDS[resourceType.toLowerCase()] || [];
  }

  /**
   * Detect resource type from resource ID.
   *
   * @param resourceId - Resource identifier
   * @returns Detected resource type or "unknown"
   */
  detectResourceType(resourceId: string): string {
    const resourceLower = resourceId.toLowerCase();

    // S3 patterns
    if (resourceLower.includes("bucket") || resourceLower.startsWith("s3://")) {
      return "s3";
    }

    // Cognito patterns
    if (
      resourceLower.includes("userpool") ||
      resourceLower.includes("user-pool") ||
      resourceLower.includes("cognito")
    ) {
      return "cognito";
    }

    // IAM patterns
    if (
      resourceLower.includes("role") ||
      resourceLower.includes("policy") ||
      resourceLower.startsWith("arn:aws:iam")
    ) {
      return "iam";
    }

    // Lambda patterns
    if (
      resourceLower.includes("function") ||
      resourceLower.includes("lambda")
    ) {
      return "lambda";
    }

    // RDS patterns
    if (
      resourceLower.includes("database") ||
      resourceLower.includes("rds") ||
      resourceLower.includes("cluster")
    ) {
      return "rds";
    }

    return "unknown";
  }

  /**
   * Check if a criterion is relevant to a resource type.
   *
   * @param criterion - ISC criterion to check
   * @param resourceType - Type of resource
   * @returns true if relevant
   */
  isRelevant(criterion: ISCCriterion, resourceType: string): boolean {
    const keywords = this.getKeywordsForType(resourceType);
    const textLower = criterion.text.toLowerCase();

    return keywords.some(keyword => textLower.includes(keyword));
  }
}
