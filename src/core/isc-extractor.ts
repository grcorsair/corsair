/**
 * ISCExtractor - Ideal State Criteria Extractor
 *
 * Parses ISC criteria from agent response text. Supports multiple formats:
 * - JSON arrays
 * - Numbered lists
 * - Bullet lists
 * - Quoted text
 *
 * Key Features:
 * - Recognizes ISC section markers (ISC, Ideal State, Expected State, etc.)
 * - Validates criteria (8-word max, binary testable)
 * - Calculates confidence scores
 * - Extracts verification status if present
 */

import type { ISCExtractionResult, ISCSatisfactionStatus } from "../types/isc";

export class ISCExtractor {
  // ISC section marker patterns
  private static readonly ISC_MARKERS = [
    /\bISC\b/i,
    /Ideal State Criteria/i,
    /Expected State/i,
    /Security Expectations/i,
    /Security Criteria/i,
    /Criteria:/i,
  ];

  // Action verb patterns (criteria should NOT start with these)
  private static readonly ACTION_VERBS = [
    /^check\b/i,
    /^verify\b/i,
    /^ensure\b/i,
    /^validate\b/i,
    /^test\b/i,
    /^review\b/i,
    /^audit\b/i,
    /^confirm\b/i,
    /^examine\b/i,
    /^inspect\b/i,
  ];

  // State-indicating words (criteria SHOULD contain these)
  private static readonly STATE_WORDS = [
    /\benabled\b/i,
    /\bdisabled\b/i,
    /\bconfigured\b/i,
    /\bblocked\b/i,
    /\ballowed\b/i,
    /\bencrypted\b/i,
    /\brequired\b/i,
    /\bset\b/i,
    /\bactive\b/i,
    /\bon\b/i,
    /\boff\b/i,
    /\bis\b/i,
    /\bare\b/i,
  ];

  // Vague phrase patterns (criteria should NOT contain these)
  private static readonly VAGUE_PHRASES = [
    /best practices/i,
    /properly configured/i,
    /is secure/i,
    /is safe/i,
    /should be/i,
    /must be/i,
  ];

  // Meta-criteria patterns (ISC validation checklist items, not actual security criteria)
  private static readonly META_PATTERNS = [
    /each.*\d+.*words?/i,          // "Each ≤8 words"
    /binary testable/i,            // Validation requirement
    /state-based/i,                // Validation requirement
    /granular/i,                   // Validation requirement
    /observable/i,                 // Validation requirement
    /isc.*validation/i,            // ISC validation section
    /^✅/,                          // Checkmark bullets are usually meta
    /criterion.*requirement/i,     // Meta-criterion description
    /criteria.*should/i,           // Meta-instruction
    /format.*requirement/i,        // Formatting instruction

    // Stakeholder roles (not security criteria)
    /auditors?$/i,                 // "Security auditors"
    /officers?$/i,                 // "Compliance officers"
    /teams?$/i,                    // "Incident response teams"
    /leadership$/i,                // "Executive leadership"
    /stakeholders?$/i,             // Generic stakeholder

    // Compliance framework codes (not security criteria)
    /^PR\.[A-Z]{2}-\d+/,           // NIST codes: PR.AC-7, PR.DS-5
    /^CC\d+\.\d+/,                 // SOC2 codes: CC6.1, CC6.7
    /^T\d{4}/,                     // MITRE ATT&CK: T1556, T1530
    /^\[?[A-Z]{2,}\]?:/,           // Generic framework prefix: [NIST]:, [SOC2]:
  ];

  // Verification status patterns
  private static readonly STATUS_PATTERNS = [
    { pattern: /\[SATISFIED\]\s*/i, status: "SATISFIED" as ISCSatisfactionStatus },
    { pattern: /\[FAILED\]\s*/i, status: "FAILED" as ISCSatisfactionStatus },
    { pattern: /\[PENDING\]\s*/i, status: "PENDING" as ISCSatisfactionStatus },
    { pattern: /\[PASS\]\s*/i, status: "SATISFIED" as ISCSatisfactionStatus },
    { pattern: /\[FAIL\]\s*/i, status: "FAILED" as ISCSatisfactionStatus },
  ];

  /**
   * Extract ISC criteria from text.
   */
  extract(text: string): ISCExtractionResult {
    if (!text || !text.trim()) {
      return {
        criteria: [],
        confidence: 0,
        found: false,
        method: "fallback",
      };
    }

    // Find ISC section if present
    const { section, hasMarker } = this.findISCSection(text);
    const textToSearch = section || text;

    // Try extraction methods in order of confidence
    let result = this.tryJsonArray(textToSearch);
    if (result.found && result.criteria.length > 0) {
      result.confidence = this.calculateConfidence(result, hasMarker);
      result.rawSection = section;
      return result;
    }

    result = this.tryNumberedList(textToSearch);
    if (result.found && result.criteria.length > 0) {
      result.confidence = this.calculateConfidence(result, hasMarker);
      result.rawSection = section;
      return result;
    }

    result = this.tryBulletList(textToSearch);
    if (result.found && result.criteria.length > 0) {
      result.confidence = this.calculateConfidence(result, hasMarker);
      result.rawSection = section;
      return result;
    }

    result = this.tryQuotedText(textToSearch);
    if (result.found && result.criteria.length > 0) {
      result.confidence = this.calculateConfidence(result, hasMarker);
      result.rawSection = section;
      return result;
    }

    // Fallback: no criteria found
    return {
      criteria: [],
      confidence: 0,
      found: false,
      method: "fallback",
    };
  }

  /**
   * Find the ISC section in text.
   */
  private findISCSection(text: string): { section: string | undefined; hasMarker: boolean } {
    const lines = text.split("\n");
    let inISCSection = false;
    let sectionLines: string[] = [];
    let hasMarker = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is an ISC section header
      if (this.looksLikeISC(line)) {
        inISCSection = true;
        hasMarker = true;
        sectionLines = [line];
        continue;
      }

      // Check if we've hit a new section header (end of ISC section)
      if (inISCSection && /^#{1,3}\s/.test(line.trim()) && !this.looksLikeISC(line)) {
        break;
      }

      if (inISCSection) {
        sectionLines.push(line);
      }
    }

    if (sectionLines.length > 0) {
      return { section: sectionLines.join("\n"), hasMarker };
    }

    // No specific section found, check if any ISC marker exists anywhere
    for (const marker of ISCExtractor.ISC_MARKERS) {
      if (marker.test(text)) {
        return { section: undefined, hasMarker: true };
      }
    }

    return { section: undefined, hasMarker: false };
  }

  /**
   * Check if a line looks like an ISC section header.
   */
  looksLikeISC(line: string): boolean {
    const trimmed = line.trim();
    return ISCExtractor.ISC_MARKERS.some((marker) => marker.test(trimmed));
  }

  /**
   * Try to extract from JSON array.
   */
  private tryJsonArray(text: string): ISCExtractionResult {
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const criteria = this.filterAndValidateCriteria(
            parsed.map((item) => String(item).trim())
          );
          return {
            criteria,
            confidence: 0,
            found: criteria.length > 0,
            method: "json_array",
          };
        }
      } catch {
        // Not valid JSON
      }
    }
    return { criteria: [], confidence: 0, found: false, method: "json_array" };
  }

  /**
   * Try to extract from numbered list.
   */
  private tryNumberedList(text: string): ISCExtractionResult {
    const lines = text.split("\n");
    const criteria: string[] = [];

    for (const line of lines) {
      const match = line.trim().match(/^\d+[.)]\s*(.+)$/);
      if (match && match[1]) {
        const criterion = this.cleanCriterion(match[1]);
        if (criterion) {
          criteria.push(criterion);
        }
      }
    }

    const validated = this.filterAndValidateCriteria(criteria);
    return {
      criteria: validated,
      confidence: 0,
      found: validated.length > 0,
      method: "numbered_list",
    };
  }

  /**
   * Try to extract from bullet list.
   */
  private tryBulletList(text: string): ISCExtractionResult {
    const lines = text.split("\n");
    const criteria: string[] = [];

    for (const line of lines) {
      // Match bullet patterns: "- text", "* text", "+ text"
      // But exclude markdown emphasis like "**text**" or "*text*"
      const match = line.trim().match(/^[-*+]\s+(.+)$/);
      if (match && match[1]) {
        // Skip if it looks like a header (ends with colon or has emphasis markers)
        if (match[1].endsWith(":") || match[1].startsWith("*") || match[1].endsWith("**")) {
          continue;
        }
        const criterion = this.cleanCriterion(match[1]);
        if (criterion) {
          criteria.push(criterion);
        }
      }
    }

    const validated = this.filterAndValidateCriteria(criteria);
    return {
      criteria: validated,
      confidence: 0,
      found: validated.length > 0,
      method: "bullet_list",
    };
  }

  /**
   * Try to extract from quoted text.
   */
  private tryQuotedText(text: string): ISCExtractionResult {
    const matches = text.match(/"([^"]+)"/g);
    if (matches) {
      const criteria = matches
        .map((m) => m.replace(/"/g, "").trim())
        .filter((c) => c.length > 10); // Filter out short quotes

      const validated = this.filterAndValidateCriteria(criteria);
      return {
        criteria: validated,
        confidence: 0,
        found: validated.length > 0,
        method: "quoted",
      };
    }
    return { criteria: [], confidence: 0, found: false, method: "quoted" };
  }

  /**
   * Clean and normalize a criterion text.
   */
  private cleanCriterion(text: string): string | null {
    // Remove status markers
    let cleaned = text;
    for (const { pattern } of ISCExtractor.STATUS_PATTERNS) {
      cleaned = cleaned.replace(pattern, "");
    }

    // Remove quotes and backticks
    cleaned = cleaned
      .replace(/^["'`]|["'`]$/g, "")
      .replace(/\(.*\)$/, "") // Remove parenthetical comments
      .trim();

    // Skip if too short
    if (cleaned.length < 10) {
      return null;
    }

    return cleaned;
  }

  /**
   * Filter and validate criteria.
   * Removes meta-criteria, action-oriented text, and vague phrases.
   */
  private filterAndValidateCriteria(criteria: string[]): string[] {
    return criteria.filter((criterion) => {
      // Skip empty or too short
      if (!criterion || criterion.length < 10) {
        return false;
      }

      // Check word count (max 8 words)
      const wordCount = criterion.trim().split(/\s+/).length;
      if (wordCount > 8) {
        return false;
      }

      // Skip meta-criteria (ISC validation checklist items, not actual security criteria)
      if (this.isMetaCriterion(criterion)) {
        return false;
      }

      // Skip action-oriented criteria
      for (const pattern of ISCExtractor.ACTION_VERBS) {
        if (pattern.test(criterion.trim())) {
          return false;
        }
      }

      // Skip vague phrases
      for (const pattern of ISCExtractor.VAGUE_PHRASES) {
        if (pattern.test(criterion)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Check if text is a meta-criterion (ISC validation checklist item).
   * Meta-criteria describe how ISC should be formatted, not actual security expectations.
   */
  isMetaCriterion(text: string): boolean {
    return ISCExtractor.META_PATTERNS.some((pattern) => pattern.test(text));
  }

  /**
   * Check if a criterion is binary testable.
   */
  isBinaryTestable(criterion: string): boolean {
    // Must not be action-oriented
    for (const pattern of ISCExtractor.ACTION_VERBS) {
      if (pattern.test(criterion.trim())) {
        return false;
      }
    }

    // Must not be vague
    for (const pattern of ISCExtractor.VAGUE_PHRASES) {
      if (pattern.test(criterion)) {
        return false;
      }
    }

    // Should contain state-indicating words
    for (const pattern of ISCExtractor.STATE_WORDS) {
      if (pattern.test(criterion)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate confidence score for extraction result.
   */
  private calculateConfidence(result: ISCExtractionResult, hasMarker: boolean): number {
    let confidence = 0;

    // Base confidence by method
    switch (result.method) {
      case "json_array":
        confidence = 0.7;
        break;
      case "numbered_list":
        confidence = 0.6;
        break;
      case "bullet_list":
        confidence = 0.6;
        break;
      case "quoted":
        confidence = 0.5;
        break;
      default:
        confidence = 0.3;
    }

    // Boost if ISC marker was found
    if (hasMarker) {
      confidence += 0.2;
    }

    // Boost for criteria quality
    if (result.criteria.length > 0) {
      const validCount = result.criteria.filter((c) => this.isBinaryTestable(c)).length;
      const qualityRatio = validCount / result.criteria.length;
      confidence += qualityRatio * 0.1;
    }

    // Penalize if no criteria found
    if (result.criteria.length === 0) {
      confidence = 0;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Extract verification status markers from text.
   * Returns a map of criterion text -> status.
   */
  extractVerificationStatuses(text: string): Map<string, ISCSatisfactionStatus> {
    const statuses = new Map<string, ISCSatisfactionStatus>();
    const lines = text.split("\n");

    for (const line of lines) {
      for (const { pattern, status } of ISCExtractor.STATUS_PATTERNS) {
        if (pattern.test(line)) {
          // Extract the criterion text after the status marker
          const criterionText = line
            .trim()
            .replace(/^[-*+]\s*/, "") // Remove bullet
            .replace(pattern, "") // Remove status
            .trim();

          if (criterionText.length > 10) {
            statuses.set(criterionText, status);
          }
        }
      }
    }

    return statuses;
  }
}
