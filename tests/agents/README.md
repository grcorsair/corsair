# Agent Tests - Autonomous Security Testing Validation

## Overview

The `tests/agents/` directory contains **integration tests** that validate Corsair's core innovation: **agent autonomy**.

Unlike unit tests that validate deterministic behavior, these tests prove that CorsairAgent can **autonomously generate security criteria from Claude's knowledge**, not from pre-programmed checks.

## Why Agent Tests Matter

**The Strategic Question:**
- **Scripted Tools:** 50 cloud services = 50 maintenance cycles (breaks at scale)
- **Autonomous Agent:** 50 cloud services = 1 architecture + Claude's knowledge (scales infinitely)

**Agent tests prove bounded autonomy works:**
1. Agent generates valid ISC (Ideal State Criteria) from security knowledge
2. Criteria follow strict format: ≤8 words, binary testable, granular
3. Agent covers critical controls without pre-programming
4. Output is parseable and verifiable

## Test Files

### `test_agent_isc_generation.test.ts`

**The Critical Test:** Validates that CorsairAgent generates valid ISC criteria from security knowledge.

**What It Tests:**
1. **Format Compliance** - ISC criteria are ≤8 words, start with capital, binary testable
2. **Security Coverage** - Agent autonomously covers encryption, public-access, versioning, logging
3. **Granularity** - Criteria are specific (not vague like "bucket is secure")
4. **Parseability** - Agent response is structured (JSON arrays or lists)
5. **Domain Breadth** - Agent covers data protection, access control, audit & monitoring

**Why This Matters:**
- Proves agent doesn't rely on hardcoded checks
- Demonstrates Claude's security knowledge is sufficient
- Validates bounded autonomy architecture at scale

## Prerequisites

### Environment Setup

Agent tests require a valid Anthropic API key to execute real Claude API calls.

**Option 1: Environment Variable**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Option 2: .env File**
```bash
# Create .env in project root
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

**Get API Key:**
- Sign up at https://console.anthropic.com
- Generate API key from Settings → API Keys
- Free tier includes credits for testing

## Running Tests

### Run All Agent Tests
```bash
bun test tests/agents/
```

### Run Specific Test
```bash
bun test tests/agents/test_agent_isc_generation.test.ts
```

### Run with Verbose Output
```bash
bun test tests/agents/ --verbose
```

## Test Configuration

### Model Selection

Agent tests use **Claude Haiku** for fast execution (~2-3s per test):

```typescript
agent = new CorsairAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "haiku", // Fast model for testing
  verbose: false,  // Suppress logs during test
});
```

**Why Haiku?**
- **Fast:** 2-3 second response times
- **Cost-Effective:** Cheaper than Sonnet for CI/CD
- **Sufficient:** Security knowledge adequate for ISC generation

**For Production:** Use Sonnet for complex reasoning and mission planning.

### Timeouts

Agent tests have **30-second timeouts** to allow for API calls:

```typescript
test("Agent generates ISC...", async () => {
  // test code
}, 30000); // 30s timeout
```

If tests timeout:
1. Check network connectivity
2. Verify API key is valid
3. Check Anthropic API status: https://status.anthropic.com

## Understanding Test Failures

### Common Failure Scenarios

**1. Missing API Key**
```
error: ANTHROPIC_API_KEY required for agent tests
```
**Solution:** Set `ANTHROPIC_API_KEY` in environment or .env file

**2. Invalid API Key**
```
error: Failed to fetch: unauthorized
```
**Solution:** Verify API key is valid and not expired

**3. Agent Output Parsing**
```
expect(criteria.length).toBeGreaterThanOrEqual(5)
```
**What It Means:** Agent didn't generate enough criteria or format was unparseable
**Solution:** This is a REAL failure - agent behavior needs investigation

**4. Coverage Gaps**
```
expect(coveredTopics.length).toBeGreaterThanOrEqual(3)
```
**What It Means:** Agent missed critical security topics (encryption, public-access, etc.)
**Solution:** This proves bounded autonomy has limits - document the gap

## Test Philosophy

### What We're Validating

**Agent tests are NOT unit tests:**
- ❌ NOT testing deterministic output (same input → same output)
- ❌ NOT mocking Claude API calls
- ❌ NOT validating exact wording of criteria

**Agent tests ARE integration tests:**
- ✅ Testing bounded autonomy (can agent reason about security?)
- ✅ Validating format compliance (does agent follow ISC rules?)
- ✅ Proving knowledge coverage (does Claude know S3 security?)
- ✅ Verifying parseability (can we extract structured data?)

### Expected Variability

Agent responses will vary between runs (this is EXPECTED):
- Different wording for same security concepts
- Different ordering of criteria
- Different coverage emphasis

**What MUST remain consistent:**
- Format compliance (≤8 words, binary, granular)
- Topic coverage (critical security controls)
- Parseability (structured output)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Agent Tests
on: [push, pull_request]

jobs:
  agent-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run Agent Tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: bun test tests/agents/
```

**Important:** Store `ANTHROPIC_API_KEY` as GitHub Secret, not in code.

## Cost Considerations

### Test Execution Costs

**Per Test Run:**
- 4 tests × ~2-3s each = ~10 seconds total
- Haiku model: ~$0.01 per test run
- Monthly (100 runs): ~$1.00

**Cost Optimization:**
- Use Haiku for CI/CD (fast + cheap)
- Cache results when possible
- Run on PR merge, not every commit

## Adding New Agent Tests

### Test Template

```typescript
test("Agent validates [specific behavior]", async () => {
  // Define mission prompt
  const mission = `Clear instructions for agent...`;

  // Execute mission
  const response = await agent.executeMission(mission);

  // Extract structured data
  const criteria = extractISCCriteria(response);

  // Validate behavior (not exact output)
  expect(criteria.length).toBeGreaterThanOrEqual(3);
  // ... more validations
}, 30000); // 30s timeout
```

### Guidelines for New Tests

1. **Test Behaviors, Not Words** - Don't assert exact text, validate patterns
2. **Allow Variability** - Agent responses will differ, design tests accordingly
3. **Use Helper Functions** - `extractISCCriteria()` handles parsing variability
4. **Set Realistic Timeouts** - 30s for simple missions, 60s for complex
5. **Document Intent** - Explain WHAT you're validating and WHY it matters

## Debugging Failed Tests

### Enable Verbose Logging

```typescript
agent = new CorsairAgent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "haiku",
  verbose: true, // See agent reasoning
});
```

### Inspect Raw Response

```typescript
const response = await agent.executeMission(mission);
console.log("Raw agent response:", response);
const criteria = extractISCCriteria(response);
console.log("Extracted criteria:", criteria);
```

### Test Extraction Logic

```typescript
// Test your parsing helper independently
const testResponse = `Agent response with criteria...`;
const criteria = extractISCCriteria(testResponse);
expect(criteria.length).toBeGreaterThan(0);
```

## Related Documentation

- **Agent Architecture:** `src/agents/README.md`
- **ISC Specification:** `docs/ISC-FORMAT.md`
- **System Prompts:** `src/agents/system-prompts.ts`
- **Tool Definitions:** `src/agents/tool-definitions.ts`

## Support

**Questions?**
- Create issue: https://github.com/yourusername/corsair/issues
- Check docs: https://github.com/yourusername/corsair/tree/main/docs

**Test Failures?**
1. Verify API key is valid
2. Check agent verbose logs
3. Inspect raw agent response
4. Document unexpected behavior in issue
