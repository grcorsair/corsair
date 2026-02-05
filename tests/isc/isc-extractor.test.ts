/**
 * ISCExtractor Test Contract - RED PHASE
 *
 * ISCExtractor parses ISC criteria from agent response text.
 * It supports multiple formats: JSON arrays, numbered lists, bullet lists, and quoted text.
 *
 * Contract Requirements:
 * 1. ISCExtractor MUST extract criteria from bullet lists
 * 2. ISCExtractor MUST extract criteria from numbered lists
 * 3. ISCExtractor MUST extract criteria from quoted text
 * 4. ISCExtractor MUST recognize ISC section markers
 * 5. ISCExtractor MUST validate 8-word maximum
 * 6. ISCExtractor MUST identify binary testable criteria
 * 7. ISCExtractor MUST calculate confidence scores
 * 8. ISCExtractor MUST extract verification status if present
 * 9. ISCExtractor MUST handle malformed input gracefully
 * 10. ISCExtractor MUST skip non-ISC content
 */

import { describe, test, expect } from "bun:test";
import { ISCExtractor } from "../../src/core/isc-extractor";
import type { ISCExtractionResult } from "../../src/types/isc";

describe("ISCExtractor - Criteria Extraction", () => {
  const extractor = new ISCExtractor();

  // Test 1: Extract from bullet lists
  test("extracts criteria from bullet list format", () => {
    const text = `
Here are the ISC criteria for S3 bucket security:

- Public access blocked at bucket level
- Encryption enabled using AES256 algorithm
- Versioning enabled for data protection
- Server access logging enabled on bucket
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(4);
    expect(result.criteria).toContain("Public access blocked at bucket level");
    expect(result.criteria).toContain("Encryption enabled using AES256 algorithm");
    expect(result.criteria).toContain("Versioning enabled for data protection");
    expect(result.criteria).toContain("Server access logging enabled on bucket");
    expect(result.method).toBe("bullet_list");
  });

  // Test 2: Extract from numbered lists
  test("extracts criteria from numbered list format", () => {
    const text = `
ISC Criteria:

1. MFA required for all user accounts
2. Password minimum length is twelve characters
3. Risk configuration enabled for compromise detection
4. Device tracking enabled for security
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(4);
    expect(result.criteria).toContain("MFA required for all user accounts");
    expect(result.criteria).toContain("Password minimum length is twelve characters");
    expect(result.method).toBe("numbered_list");
  });

  // Test 3: Extract from JSON array format
  test("extracts criteria from JSON array format", () => {
    const text = `
Based on S3 security best practices, here are the ISC criteria:

["Public access blocked at bucket level", "Encryption enabled using AES256", "Versioning enabled for protection"]

These criteria cover essential security controls.
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(3);
    expect(result.criteria).toContain("Public access blocked at bucket level");
    expect(result.criteria).toContain("Encryption enabled using AES256");
    expect(result.criteria).toContain("Versioning enabled for protection");
    expect(result.method).toBe("json_array");
  });

  // Test 4: Extract from quoted text
  test("extracts criteria from quoted text format", () => {
    const text = `
The ISC criteria are:
"Public access blocked completely"
"Encryption enabled with KMS"
"Access logging enabled on bucket"
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(3);
    expect(result.criteria).toContain("Public access blocked completely");
    expect(result.criteria).toContain("Encryption enabled with KMS");
    expect(result.method).toBe("quoted");
  });

  // Test 5: Recognize ISC section markers
  test("recognizes ISC section markers and extracts criteria", () => {
    const text = `
Some preamble text about the mission.

## ISC (Ideal State Criteria)

- Criterion one for security
- Criterion two for compliance
- Criterion three for protection

## Next Steps

More text about what to do next.
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(3);
    expect(result.rawSection).toContain("ISC");
  });

  // Test 6: Recognize alternative ISC markers
  test("recognizes alternative ISC section markers", () => {
    const textWithIdealState = `
### Ideal State Criteria

1. Public access is blocked completely
2. Encryption is enabled on bucket
`;

    const textWithExpectations = `
**Expected State:**
- MFA is required for all users
- Password policy is configured correctly
`;

    const result1 = extractor.extract(textWithIdealState);
    expect(result1.found).toBe(true);
    expect(result1.criteria.length).toBe(2);

    const result2 = extractor.extract(textWithExpectations);
    expect(result2.found).toBe(true);
    expect(result2.criteria.length).toBe(2);
  });
});

describe("ISCExtractor - Validation", () => {
  const extractor = new ISCExtractor();

  // Test 7: Validate 8-word maximum
  test("filters criteria exceeding 8 words", () => {
    const text = `
ISC:
- Public access blocked (valid - 3 words)
- This is a very long criterion that exceeds the eight word limit significantly (invalid - 13 words)
- Encryption enabled using AES (valid - 4 words)
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(2);
    expect(result.criteria).toContain("Public access blocked");
    expect(result.criteria).toContain("Encryption enabled using AES");
  });

  // Test 8: Identify binary testable criteria
  test("validates binary testable criteria", () => {
    const extractor = new ISCExtractor();

    // Binary testable (pass/fail)
    expect(extractor.isBinaryTestable("Public access blocked at bucket")).toBe(true);
    expect(extractor.isBinaryTestable("Encryption enabled using AES256")).toBe(true);
    expect(extractor.isBinaryTestable("MFA required for all users")).toBe(true);
    expect(extractor.isBinaryTestable("Versioning enabled on bucket")).toBe(true);

    // Not binary testable (vague or action-oriented)
    expect(extractor.isBinaryTestable("Check security")).toBe(false);
    expect(extractor.isBinaryTestable("Review access")).toBe(false);
    expect(extractor.isBinaryTestable("Ensure compliance")).toBe(false);
    expect(extractor.isBinaryTestable("Best practices applied")).toBe(false);
  });

  // Test 9: Skip action-oriented phrases
  test("skips action-oriented criteria", () => {
    const text = `
ISC:
- Check public access settings
- Verify encryption configuration
- Public access blocked at bucket
- Review IAM policies
- Encryption enabled using KMS
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    // Should only include state-based criteria, not action items
    expect(result.criteria).toContain("Public access blocked at bucket");
    expect(result.criteria).toContain("Encryption enabled using KMS");
    expect(result.criteria).not.toContain("Check public access settings");
    expect(result.criteria).not.toContain("Verify encryption configuration");
  });
});

describe("ISCExtractor - Confidence Scoring", () => {
  const extractor = new ISCExtractor();

  // Test 10: Calculate confidence scores
  test("calculates confidence based on extraction quality", () => {
    // High confidence: JSON array with ISC marker
    const jsonText = `
## ISC Criteria
["Public access blocked", "Encryption enabled", "Versioning on"]
`;
    const jsonResult = extractor.extract(jsonText);
    expect(jsonResult.confidence).toBeGreaterThanOrEqual(0.8);

    // Medium confidence: bullet list with ISC marker
    const bulletText = `
ISC:
- Public access blocked
- Encryption enabled
`;
    const bulletResult = extractor.extract(bulletText);
    expect(bulletResult.confidence).toBeGreaterThanOrEqual(0.6);

    // Lower confidence: no ISC marker
    const noMarkerText = `
Here are some points:
- Public access blocked
- Encryption enabled
`;
    const noMarkerResult = extractor.extract(noMarkerText);
    expect(noMarkerResult.confidence).toBeLessThan(0.8);
  });

  // Test 11: Confidence affected by word count compliance
  test("confidence affected by criteria quality", () => {
    const extractor = new ISCExtractor();

    // All criteria meet word limit
    const goodText = `
ISC:
["Short criterion", "Another short one", "Third valid criterion"]
`;
    const goodResult = extractor.extract(goodText);

    // Mixed quality
    const mixedText = `
ISC:
- Valid short criterion
- This criterion is way too long and should reduce confidence score significantly
`;
    const mixedResult = extractor.extract(mixedText);

    expect(goodResult.confidence).toBeGreaterThan(mixedResult.confidence);
  });
});

describe("ISCExtractor - Edge Cases", () => {
  const extractor = new ISCExtractor();

  // Test 12: Handle malformed input gracefully
  test("handles malformed input gracefully", () => {
    // Empty string
    let result = extractor.extract("");
    expect(result.found).toBe(false);
    expect(result.criteria).toEqual([]);

    // Only whitespace
    result = extractor.extract("   \n\t\n   ");
    expect(result.found).toBe(false);
    expect(result.criteria).toEqual([]);

    // No criteria content
    result = extractor.extract("This is just plain text without any criteria.");
    expect(result.found).toBe(false);
    expect(result.criteria).toEqual([]);

    // Malformed JSON
    result = extractor.extract('["unclosed array');
    expect(result.found).toBe(false);
  });

  // Test 13: Skip non-ISC content
  test("skips non-ISC content and headers", () => {
    const text = `
## Introduction

This is some introduction text.

## ISC Criteria

- Valid criterion one here
- Valid criterion two here

## Conclusion

- This is not ISC
- Neither is this
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(2);
    expect(result.criteria).toContain("Valid criterion one here");
    expect(result.criteria).toContain("Valid criterion two here");
    expect(result.criteria).not.toContain("This is not ISC");
  });

  // Test 14: Handle mixed formats
  test("handles mixed format text", () => {
    const text = `
ISC Criteria:

1. First numbered criterion here
2. Second numbered criterion here

Additional points:
- Third bullet criterion here
- Fourth bullet criterion here
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBeGreaterThanOrEqual(2);
  });

  // Test 15: Extract verification status if present
  test("extracts verification status markers", () => {
    const text = `
ISC:
- [SATISFIED] Public access blocked at bucket
- [FAILED] Encryption enabled using KMS
- [PENDING] Versioning enabled for protection
- MFA required for users (no status)
`;

    const result = extractor.extract(text);
    const statuses = extractor.extractVerificationStatuses(text);

    expect(result.found).toBe(true);
    expect(statuses.get("Public access blocked at bucket")).toBe("SATISFIED");
    expect(statuses.get("Encryption enabled using KMS")).toBe("FAILED");
    expect(statuses.get("Versioning enabled for protection")).toBe("PENDING");
  });
});

describe("ISCExtractor - Algorithm Phase Integration", () => {
  const extractor = new ISCExtractor();

  // Test 16: Recognize PAI algorithm phase markers
  test("recognizes PAI algorithm phase ISC markers", () => {
    const text = `
## Phase 4: READY THE CANNONS

Based on my analysis, here are the ISC criteria:

- Public access blocked completely
- Encryption enabled with KMS
- Versioning enabled for recovery
`;

    const result = extractor.extract(text);

    expect(result.found).toBe(true);
    expect(result.criteria.length).toBe(3);
  });

  // Test 17: looksLikeISC utility function
  test("looksLikeISC identifies potential ISC sections", () => {
    const extractor = new ISCExtractor();

    expect(extractor.looksLikeISC("ISC Criteria:")).toBe(true);
    expect(extractor.looksLikeISC("Ideal State Criteria")).toBe(true);
    expect(extractor.looksLikeISC("## Expected State")).toBe(true);
    expect(extractor.looksLikeISC("Security Expectations:")).toBe(true);

    expect(extractor.looksLikeISC("Random text")).toBe(false);
    expect(extractor.looksLikeISC("Introduction")).toBe(false);
    expect(extractor.looksLikeISC("Conclusion")).toBe(false);
  });
});
