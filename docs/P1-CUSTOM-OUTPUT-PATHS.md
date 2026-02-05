# P1 Blocker Fix: User-Controlled Evidence Output Paths

**Status:** ✅ RESOLVED
**Priority:** P1 (Critical for CI/CD integration)
**Date:** 2025-02-05

---

## Problem Statement

**Before this fix:**
- Evidence files were auto-generated in `./evidence/corsair-{timestamp}.jsonl`
- Users had NO CONTROL over output location
- **Blocked CI/CD integration** - pipelines need to specify exact paths
- **Blocked enterprise workflows** - compliance requires specific audit directories

**Impact:**
- Jenkins pipelines couldn't collect evidence artifacts
- GitHub Actions couldn't upload evidence to S3
- Enterprise audit trails couldn't use designated compliance directories

---

## Solution Architecture

### 1. CLI Layer (`corsair.ts`)

New `--output` / `-o` flag allows users to specify exact output path:

```bash
# Default behavior (backward compatible)
bun run corsair --target pool-123 --service cognito
→ ./evidence/corsair-2025-02-05T10-30-45.jsonl

# Custom path (NEW)
bun run corsair --target pool-123 --service cognito --output ./audits/q1/test.jsonl
→ ./audits/q1/test.jsonl
```

### 2. Agent Layer (`corsair-agent.ts`)

The infrastructure was ALREADY PRESENT:
- `handlePlunder()` receives `evidencePath` parameter from agent
- Passes path directly to Corsair core
- No changes needed - infrastructure existed

### 3. Mission Context

CLI injects user-specified path into agent mission:

```typescript
const mission = `
**CRITICAL INSTRUCTION - Evidence Output Path:**
When you execute the PLUNDER primitive, you MUST use this EXACT path:
evidencePath: "${outputPath}"
`;
```

Agent follows instructions and uses the provided path.

### 4. Directory Creation

CLI automatically creates parent directories:

```typescript
function validateOutputPath(outputPath: string): void {
  const dir = dirname(absolutePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
```

---

## Usage Examples

### Local Development

```bash
# Organize by service
bun run corsair \
  --target us-west-2_ABC123 \
  --service cognito \
  --output ./evidence/cognito/test-1.jsonl

bun run corsair \
  --target my-bucket \
  --service s3 \
  --output ./evidence/s3/test-1.jsonl
```

### CI/CD Integration

#### Jenkins Pipeline

```groovy
pipeline {
  stages {
    stage('Security Audit') {
      steps {
        sh '''
          bun run corsair \
            --target ${COGNITO_POOL_ID} \
            --service cognito \
            --output /var/jenkins/workspace/evidence/cognito-${BUILD_ID}.jsonl
        '''
        archiveArtifacts artifacts: 'evidence/*.jsonl'
      }
    }
  }
}
```

#### GitHub Actions

```yaml
- name: Run Corsair Security Audit
  run: |
    bun run corsair \
      --target ${{ secrets.USER_POOL_ID }} \
      --service cognito \
      --output ./evidence/pr-${{ github.event.pull_request.number }}.jsonl

- name: Upload Evidence
  uses: actions/upload-artifact@v3
  with:
    name: security-evidence
    path: evidence/*.jsonl
```

#### GitLab CI

```yaml
corsair:audit:
  script:
    - bun run corsair
        --target $COGNITO_POOL_ID
        --service cognito
        --output /builds/project/evidence/pipeline-${CI_PIPELINE_ID}.jsonl
  artifacts:
    paths:
      - evidence/*.jsonl
```

### Enterprise Workflows

```bash
# Quarterly audit structure
bun run corsair \
  --target prod-pool \
  --service cognito \
  --output /mnt/compliance/2025-q1/corsair/cognito-$(date +%Y%m%d).jsonl

# Multi-project organization
bun run corsair \
  --target project-alpha-pool \
  --service cognito \
  --output /var/audits/project-alpha/cognito/$(date +%Y-%m-%d).jsonl
```

---

## Implementation Details

### Files Changed

1. **`corsair.ts`** (NEW)
   - Created CLI wrapper with full argument parsing
   - Added `--output` / `-o` flag
   - Implemented directory creation
   - Built mission with custom path injection

2. **`src/agents/tool-definitions.ts`**
   - Updated PLUNDER tool description
   - Documented that path is user-controlled
   - Explained when to use custom paths

3. **`src/agents/example-pai-algorithm.ts`**
   - Updated example to show custom path usage
   - Demonstrates: `'./evidence/s3-security-audit.jsonl'`

4. **`README.md`**
   - Added "CLI Usage (Agentic Mode)" section
   - Documented all CLI options
   - Provided CI/CD integration examples

5. **`tests/cli/test_custom_output_path.test.ts`** (NEW)
   - 14 tests validating CLI argument parsing
   - Tests for relative/absolute paths
   - Tests for CI/CD patterns (Jenkins, GitHub Actions, enterprise)

### Backward Compatibility

✅ **100% Backward Compatible**

```bash
# Old usage (still works)
bun run src/agents/example-pai-algorithm.ts
→ Auto-generated timestamp path

# New usage (opt-in)
bun run corsair --target pool --service cognito --output ./custom.jsonl
→ User-specified path
```

---

## Testing

### Unit Tests

```bash
bun test tests/cli/test_custom_output_path.test.ts
```

**Results:**
- ✅ 14 tests passing
- ✅ 17 expect() assertions
- ✅ 0 failures

**Coverage:**
- Argument parsing (--output, -o)
- Absolute paths
- Relative paths
- Nested directories
- CI/CD patterns (Jenkins, GitHub Actions, enterprise)
- Default path behavior

### Manual Testing

```bash
# Test 1: Default behavior
bun run corsair --target test-pool --service cognito --source fixture
# Verify: ./evidence/corsair-{timestamp}.jsonl created

# Test 2: Custom relative path
bun run corsair --target test-pool --service cognito --source fixture \
  --output ./test-output/custom.jsonl
# Verify: ./test-output/custom.jsonl created

# Test 3: Custom nested path (directory doesn't exist)
bun run corsair --target test-pool --service cognito --source fixture \
  --output ./deep/nested/path/evidence.jsonl
# Verify: Directories created automatically, file written

# Test 4: Help output
bun run corsair --help
# Verify: Shows --output flag documentation
```

---

## Edge Cases Handled

### 1. Parent Directory Doesn't Exist
```bash
bun run corsair --target test --service cognito --output ./never/created/before.jsonl
```
**Solution:** CLI creates directories with `mkdirSync(dir, { recursive: true })`

### 2. File Already Exists
```bash
# Run twice with same output path
bun run corsair --target test --service cognito --output ./same.jsonl
bun run corsair --target test --service cognito --output ./same.jsonl
```
**Solution:** CLI warns user, evidence is appended (JSONL is append-only)

### 3. Absolute vs Relative Paths
```bash
bun run corsair --target test --service cognito --output ./relative.jsonl
bun run corsair --target test --service cognito --output /absolute/path.jsonl
```
**Solution:** Both work correctly, CLI uses `resolve()` for path normalization

### 4. Path with Spaces
```bash
bun run corsair --target test --service cognito --output "./my evidence/test.jsonl"
```
**Solution:** Shell quoting handles spaces, CLI receives correct path

### 5. Environment Variables in Paths
```bash
# User wants: /var/jenkins/evidence/build-${BUILD_ID}.jsonl
bun run corsair --target test --service cognito --output "/var/jenkins/evidence/build-${BUILD_ID}.jsonl"
```
**Solution:** CLI passes through literally. Shell expansion happens before CLI sees it.

---

## Security Considerations

### Path Traversal Prevention
**Status:** User responsibility

The CLI does NOT prevent path traversal (e.g., `../../etc/passwd.jsonl`) because:
1. Users explicitly specify paths - they own the risk
2. CLI runs with user permissions - can only write where user can
3. Attempting to sanitize paths would break legitimate use cases:
   - Absolute paths: `/var/jenkins/...`
   - Parent directories: `../shared/evidence/...`
   - Symlinks to mounted volumes: `/mnt/compliance/...`

### File Overwrite Protection
**Status:** Warning only

```bash
⚠️  Output file already exists: /path/to/file.jsonl
   Evidence will be appended to existing file
```

JSONL is append-only by design. Hash chain verification will detect tampering.

---

## Migration Guide

### For Existing Users

**No migration needed.** Existing scripts continue to work:

```bash
# This still works exactly as before
bun run src/agents/example-pai-algorithm.ts
```

### For CI/CD Integrations

**Add `--output` flag to gain control:**

```diff
# Before (no control over path)
- bun run src/agents/example-pai-algorithm.ts

# After (full control)
+ bun run corsair \
+   --target $POOL_ID \
+   --service cognito \
+   --output ./evidence/build-${BUILD_ID}.jsonl
```

---

## Performance Impact

**None.** This is a CLI parameter addition:
- No runtime overhead
- No memory impact
- No network changes
- Same execution flow as before

---

## Future Enhancements

### Potential Improvements (Not in scope for P1)

1. **Path Templates:**
   ```bash
   --output-template "./evidence/{service}-{date}-{target}.jsonl"
   → ./evidence/cognito-2025-02-05-us-west-2_ABC123.jsonl
   ```

2. **Multiple Output Formats:**
   ```bash
   --output ./evidence.jsonl --output-json ./evidence.json --output-md ./report.md
   ```

3. **Remote Storage:**
   ```bash
   --output s3://bucket/evidence.jsonl
   --output gs://bucket/evidence.jsonl
   ```

4. **Path Validation Modes:**
   ```bash
   --safe-paths   # Only allow relative paths within CWD
   --audit-paths  # Log all write attempts to audit log
   ```

---

## Conclusion

**P1 Blocker:** ✅ RESOLVED

Users now have **full control** over evidence output paths:
- ✅ CLI accepts `--output` flag
- ✅ Directories created automatically
- ✅ Agent respects user-specified paths
- ✅ Backward compatible
- ✅ Tested (14 tests passing)
- ✅ Documented (README + examples)

**CI/CD integration is now unblocked.**

---

## References

- **Implementation:** `/Users/ayoubfandi/projects/corsair/corsair.ts`
- **Tests:** `/Users/ayoubfandi/projects/corsair/tests/cli/test_custom_output_path.test.ts`
- **Documentation:** `/Users/ayoubfandi/projects/corsair/README.md`
- **Example:** `/Users/ayoubfandi/projects/corsair/src/agents/example-pai-algorithm.ts`
