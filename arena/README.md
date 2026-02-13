# GRC Model Arena

**Benchmark for GRC AI capabilities.** The Corsair GRC Model Arena evaluates how well AI models handle compliance engineering tasks -- evidence parsing, control mapping, CPOE generation, drift detection, and gap analysis.

Think [Wiz Cyber Model Arena](https://wiz.io) for compliance AI. Deterministic, programmatic scoring. No vibes. No LLM-as-judge.

---

## Challenge Format

Each challenge is a directory under `arena/challenges/` containing three files:

```
arena/challenges/ep-001-prowler-basic/
  challenge.json    # Challenge metadata + scoring config
  input.json        # What the agent receives
  expected.json     # Ground truth for scoring
```

### challenge.json

```json
{
  "id": "ep-001",
  "category": "evidence-parsing",
  "difficulty": "easy",
  "description": "Parse Prowler OCSF output and extract control summary",
  "input": "arena/challenges/ep-001-prowler-basic/input.json",
  "groundTruth": "arena/challenges/ep-001-prowler-basic/expected.json",
  "scoring": {
    "method": "json-field-match",
    "fields": ["summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
    "partialCredit": true,
    "maxScore": 100
  },
  "tags": ["prowler", "aws", "ocsf"],
  "timeLimitMinutes": 5
}
```

## Challenge Categories

| Category | Scoring Method | What It Tests |
|:---------|:---------------|:--------------|
| **evidence-parsing** | `json-field-match` | Extract structured data from tool output (Prowler, InSpec, Trivy) |
| **control-mapping** | `precision-recall` | Map findings to framework controls (SOC 2, NIST, ISO) |
| **cpoe-generation** | `cpoe-verify` | Generate valid JWT-VC CPOEs from evidence |
| **drift-detection** | `diff-match` | Detect compliance regressions between two snapshots |
| **gap-analysis** | `precision-recall` | Identify missing controls for a target framework |
| **policy-review** | `json-field-match` | Extract compliance claims from policy documents |
| **risk-analysis** | `precision-recall` | Identify and classify risks from evidence |

## Scoring Methods

### json-field-match
Compares specific JSON field paths between agent output and ground truth. Supports dot-notation (e.g., `summary.controlsPassed`). Score = matched fields / total fields * 100. Partial credit per field.

### precision-recall
Calculates precision, recall, and F1 on arrays of IDs. Score = F1 * 100. Default threshold: 0.8.

### cpoe-verify
Three-part scoring for JWT-VC output:
- **50 points**: Valid JWT format (3 base64url segments, decodable payload)
- **25 points**: Correct schema (credentialSubject.type matches expected)
- **25 points**: Accurate summary (all summary fields match ground truth)

### diff-match
Compares arrays of regressions/changes. Recall-weighted: Score = recall * 50 + precision * 50. Missing regressions are penalized heavily.

## Running Benchmarks

```bash
# Run scoring tests
bun test arena/

# Programmatic usage
import { scoreChallenge } from "./arena/scoring/score";
import { runBenchmark } from "./arena/scoring/runner";
import { generateLeaderboard, formatLeaderboardMarkdown } from "./arena/leaderboard";
```

### Agent Execution

```typescript
import { runBenchmark } from "./arena/scoring/runner";

const result = await runBenchmark(
  {
    name: "Claude Opus",
    model: "claude-opus-4-6",
    command: "bun run agent.ts",
    timeout: 60000,
  },
  challenges,
  { attempts: 3, parallel: 2 }
);

console.log(`Overall: ${result.overallScore}`);
console.log(`Categories:`, result.categoryScores);
```

### Leaderboard

```typescript
import { generateLeaderboard, formatLeaderboardMarkdown } from "./arena/leaderboard";

const entries = generateLeaderboard([run1, run2, run3]);
const markdown = formatLeaderboardMarkdown(entries);
console.log(markdown);
```

Output:

```
| Rank | Model | Overall | Passed | Last Run |
|-----:|:------|--------:|:------:|:---------|
| 1 | claude-opus-4-6 | 85.0 | 45/50 | 2026-02-13 |
| 2 | gpt-4o | 72.0 | 38/50 | 2026-02-12 |
```

## Contributing Challenges

1. Create a directory under `arena/challenges/` with a descriptive name
2. Write `challenge.json` following the schema in `arena/scoring/types.ts`
3. Create `input.json` with the evidence/data the agent receives
4. Create `expected.json` with the ground truth for scoring
5. Run `bun test arena/` to validate
6. Submit a PR

### Challenge ID Conventions

| Prefix | Category |
|:-------|:---------|
| `ep-` | evidence-parsing |
| `cm-` | control-mapping |
| `cg-` | cpoe-generation |
| `dd-` | drift-detection |
| `ga-` | gap-analysis |
| `pr-` | policy-review |
| `ra-` | risk-analysis |

### Difficulty Guidelines

- **easy**: Single format, clear structure, < 10 controls
- **medium**: Multiple formats, ambiguous fields, 10-50 controls
- **hard**: Cross-framework mapping, noisy data, > 50 controls

## Architecture

```
arena/
  README.md                              # This file
  leaderboard.ts                         # Results aggregation + markdown formatting
  scoring/
    types.ts                             # All Arena type definitions
    score.ts                             # Main scoring dispatcher
    score.test.ts                        # 48 tests, all scoring methods
    runner.ts                            # Agent execution harness (timeout, pass@N)
    runners/
      evidence-parsing-runner.ts         # json-field-match scoring
      control-mapping-runner.ts          # precision-recall scoring
      cpoe-generation-runner.ts          # JWT format + schema + summary scoring
      drift-detection-runner.ts          # Regression recall/precision scoring
      gap-analysis-runner.ts             # Missing control precision-recall
  challenges/                            # Benchmark challenges (input + expected)
```
