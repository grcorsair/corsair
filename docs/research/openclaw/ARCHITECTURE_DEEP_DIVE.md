# OpenClaw Architecture Deep Dive

**Research Date:** 2026-01-31
**Analysis Type:** Exhaustive file-by-file codebase review
**Source:** github.com/openclaw/openclaw

## Executive Summary

OpenClaw provides proven patterns for self-building agent platforms with 100K+ GitHub stars and production deployments. This analysis extracted 15 unique architectural patterns from actual implementation code.

---

## Directory Structure

**Root Structure:**
- `/src` (71 directories) - Core system implementation
- `/skills` (21+ directories) - Extensible skill system
- `/packages` (4 directories) - Monorepo packages
- `/extensions` (31 directories) - Platform-specific extensions
- `/ui` (9 directories) - UI components
- `/apps` (6 directories) - Application containers
- `/docs` (55 directories) - Documentation

**Critical Directories:**
1. `src/gateway` (127 files) - Control plane & WebSocket server
2. `src/agents` (297 files) - Agent execution engine
3. `src/memory` (35 files) - Vector memory with hybrid search
4. `src/sessions` (9 files) - Session state management
5. `src/channels` (33 files) - Channel integration plugins
6. `src/hooks` (30 files) - Event hook system

---

## Pattern 1: Multi-Layer Event System

**Files:**
- `/src/infra/agent-events.ts`
- `/src/infra/system-events.ts`
- `/src/gateway/server-broadcast.ts`

**Architecture:**
```
Agent Event Stream (infra/agent-events.ts)
    ↓
    Emits: {runId, seq, stream, ts, data, sessionKey}

System Event Queue (infra/system-events.ts)
    ↓
    Per-session ephemeral queue (max 20 events)

Broadcast Layer (server-broadcast.ts)
    ↓
    Scope-gated event distribution with backpressure handling
```

**Code Pattern:**
```typescript
const EVENT_SCOPE_GUARDS: Record<string, string[]> = {
  "exec.approval.requested": [APPROVALS_SCOPE],
  "device.pair.requested": [PAIRING_SCOPE],
};
```

**Trade-offs:**
- **Pro**: Decoupled subsystems, easy to add new listeners
- **Con**: Debugging requires tracing multiple event flows

---

## Pattern 2: Stream-Aware State Machine

**File:** `/src/agents/pi-embedded-subscribe.ts` (1600+ lines)

**State Object:**
```typescript
const state: EmbeddedPiSubscribeState = {
  assistantTexts: [],
  toolMetas: [],
  toolMetaById: new Map(),
  blockReplyBreak: params.blockReplyBreak ?? "text_end",
  compactionInFlight: false,
  pendingCompactionRetry: 0,
  compactionRetryPromise: null,
};
```

**Unique Feature - Block-Reply Chunking:**
Maintains state for thinking blocks, final blocks, and inline code spans to handle streaming responses that span multiple chunks.

**Trade-offs:**
- **Pro**: Stateful streaming with block-level semantics
- **Con**: Large state object (8+ fields), complex lifecycle management

---

## Pattern 3: Hybrid Vector + BM25 Search

**File:** `/src/memory/manager.ts` (2300+ lines)

**Architecture:**
```
File System (memory + sessions directories)
    ↓
Markdown Chunker (split by headers + overlap)
    ↓
Embedding Pipeline (batch processing)
    ↓ (OpenAI/Gemini/local)
SQLite with sqlite-vec extension
    ├─ chunks_vec (vector table)
    ├─ chunks_fts (FTS5 table for BM25)
    └─ embedding_cache (provider-specific results)

Query Time: mergeHybridResults(vectorScore, bm25Score)
```

**Key Constants:**
```typescript
const VECTOR_TABLE = "chunks_vec";
const FTS_TABLE = "chunks_fts";
const EMBEDDING_BATCH_MAX_TOKENS = 8000;
const SESSION_DIRTY_DEBOUNCE_MS = 5000;
```

**Embedding Fallback Chain:**
```
Configured provider → Fallback (auto-selects) → Error
```

**Trade-offs:**
- **Pro**: Hybrid scoring for better relevance
- **Con**: 30s vector load timeout, large memory footprint

---

## Pattern 4: Multi-Source Skill Loading

**File:** `/src/agents/skills/workspace.ts`

**Discovery Priority:**
1. Bundled (in-repo, allowlist-gated)
2. Managed (external packages)
3. Workspace (user directory: ~/.openclaw/)
4. Plugin (dynamic discovery)

**Filtering Logic:**
```typescript
shouldIncludeSkill({
  entry,      // Skill metadata
  config,     // OpenClaw config
  eligibility // Platform/runtime constraints
})
```

**Trade-offs:**
- **Pro**: Extensible without modifying core
- **Con**: Load order matters; conflicts require manual resolution

---

## Pattern 5: Approval Gate with Heartbeat

**File:** `/src/agents/bash-tools.exec.ts` (1350+ lines)

**Mechanism:**
```
Tool execution initiates
    ↓
Needs approval? → Create approval request (UUID slug)
    ↓
enqueueSystemEvent("Approval required...")
requestHeartbeatNow() → Wakes bot loop
    ↓
Wait with timeout (DEFAULT_APPROVAL_TIMEOUT_MS = 120s)
    ↓
Client approves via gateway → Unblock
    OR
Timeout → Reject with error
```

**Constants:**
```typescript
const DEFAULT_MAX_OUTPUT = 200_000; // chars
const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;
```

**Trade-offs:**
- **Pro**: Non-blocking approval (doesn't halt agent)
- **Con**: Requires separate approval resolution handler

---

## Pattern 6: WebSocket Backpressure Management

**File:** `/src/gateway/server-broadcast.ts`

**Mechanism:**
```typescript
for (const c of params.clients) {
  if (!hasEventScope(c, event)) continue;  // Scope guard
  const slow = c.socket.bufferedAmount > MAX_BUFFERED_BYTES;
  if (slow && opts?.dropIfSlow) continue;   // Drop event
  if (slow) {
    c.socket.close(1008, "slow consumer");  // Kill slow client
  }
}
```

**Scope Guards:**
```typescript
EVENT_SCOPE_GUARDS: {
  "exec.approval.requested": [APPROVALS_SCOPE],
  "device.pair.requested": [PAIRING_SCOPE],
}
```

**Trade-offs:**
- **Pro**: Prevents slowdown cascade
- **Con**: Clients may lose connection without understanding why

---

## Pattern 7: Session Serialization (JSONL)

**File:** `/src/gateway/server-methods/chat.ts`

**Format:**
```typescript
{type: "session", version, id, ...}
{type: "message", role: "user", content: {...}}
{type: "tool_call", id, name, ...}
```

**Transaction Model:**
- File-based session store
- Atomic writes via session-write-lock
- JSONL format for streaming append

**Trade-offs:**
- **Pro**: Durable, human-readable, easy to tail
- **Con**: Slow random access (requires parsing full history)

---

## Pattern 8: Dynamic Hook Loading

**File:** `/src/hooks/loader.ts`

**Loading Mechanism:**
```typescript
const url = pathToFileURL(entry.hook.handlerPath).href;
const cacheBustedUrl = `${url}?t=${Date.now()}`;
const mod = await import(cacheBustedUrl);
const handler = mod[exportName];
registerInternalHook(handler, events);
```

**Discovery Sources:**
- `bundled/` - Packaged hooks
- `.openclaw/hooks/` - User-defined
- Plugin hooks via registry

**Trade-offs:**
- **Pro**: Hot-reload capable, zero-copy extension
- **Con**: Runtime errors if hook module is invalid

---

## Pattern 9: Hierarchical Tool Authorization

**File:** `/src/agents/pi-tools.policy.ts`

**Policy Resolution Order:**
1. Explicit allowlist (user config)
2. Role-based policy (subagent vs main)
3. Group-level policy
4. Profile policy (from marketplace)
5. Plugin groups expansion

**Trade-offs:**
- **Pro**: Fine-grained control
- **Con**: Policy resolution has 5+ layers, hard to debug

---

## Pattern 10: Cron with Isolated Execution

**File:** `/src/gateway/server-cron.ts`

**Execution Model:**
```
CronService (in-memory scheduler)
    ↓
Job triggers → runCronIsolatedAgentTurn
    ↓
Isolated session key: `cron:${job.id}`
Lane: "cron" (separate concurrency lane)
    ↓
Results: Announce to requester or discard
```

**Trade-offs:**
- **Pro**: Cron jobs don't block main agent
- **Con**: Results require explicit announcement flow

---

## Pattern 11: Memory Compaction

**File:** `/src/agents/compaction.ts`

**Algorithm:**
```typescript
const BASE_CHUNK_RATIO = 0.4;
const MIN_CHUNK_RATIO = 0.15;
const SAFETY_MARGIN = 1.2;
const targetTokens = totalTokens / normalizedParts;
```

**Functions:**
- `splitMessagesByTokenShare()` - Splits by token count
- `chunkMessagesByMaxTokens()` - Creates fixed-size chunks
- Multi-part summary merging with fallback

---

## Pattern 12: Foundry Crystallization

**Source:** External meta-extension (github.com/lekt9/openclaw-foundry)

**5-Phase Recursive Improvement:**
```
Observes workflows → Learns patterns → Researches docs →
Writes tools/hooks → Integrates into Foundry → Better at working like you
```

**Crystallization Threshold:**
- 5+ successful uses
- 70%+ success rate
- Automatically transforms patterns into dedicated tools

**Code Generation Types:**
1. API Skills (AgentSkills format)
2. Browser Automation Skills
3. Standalone Hooks

**Sandbox Validation:**
- Blocked patterns: shell execution, eval(), credential access
- Flagged patterns: env vars, filesystem ops, base64 encoding
- Executes in isolated Node processes before deployment

---

## Pattern 13: MCP Integration via mcporter

**Discovery:** OpenClaw does NOT have native `openclaw mcp` command

**Integration Pattern:**
```
MCP Servers (compliance tools, APIs, etc.)
    ↓
mcporter (CLI bridge)
    ↓
Skills (wrap mcporter calls)
    ↓
Agent executes skills on-demand
```

**Key Insight:** Skills invoke `npx mcporter call` = **zero token overhead** until tool actually needed.

**Commands:**
```bash
# List tools from MCP server
npx mcporter list server-name

# Call tool
npx mcporter call 'server.tool(arg: "value")'

# Generate standalone CLI
npx mcporter generate-cli "npx -y mcp-server@latest" --compile
```

---

## Pattern 14: Context Window Guard

**File:** `/src/agents/context-window-guard.ts`

**Resolution Priority:**
```
Model.contextWindow (from API)
    → modelsConfig[provider].models[id].contextWindow
    → config.agents.defaults.contextTokens
    → DEFAULT_CONTEXT_TOKENS
```

**Guard Levels:**
- `CONTEXT_WINDOW_HARD_MIN_TOKENS = 16,000` (blocks execution)
- `CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32,000` (warns)

---

## Pattern 15: Agent Lane Serialization

**File:** `/src/agents/pi-embedded-runner.ts`

**Concurrency Model:**
- Runs serialized per session key (session lane)
- Optional global lane for cross-session serialization
- Prevents tool/session race conditions

**Key Design:** One run at a time per session, ensuring state consistency.

---

## Key Architectural Insights

### What Makes OpenClaw Successful

1. **Event-Driven Architecture** - Multiple event streams (agent, system, broadcast)
2. **Zero-Token Overhead** - Skills invoke tools on-demand via mcporter
3. **Self-Building** - Foundry crystallization learns from usage patterns
4. **Extensibility** - Multi-source loading (bundled, workspace, plugins)
5. **Safety** - Approval gates, blast radius control, sandbox validation
6. **Observability** - JSONL sessions, event tracing, memory search
7. **State Management** - Lane serialization prevents race conditions
8. **Hybrid Search** - Vector + BM25 for better memory retrieval

### Trade-Offs Made

- **Decoupling vs Debuggability** - Multiple event flows require cross-system tracing
- **Extensibility vs Complexity** - 4+ skill sources = resolution conflicts
- **Streaming vs State** - Large state objects for streaming subscriptions
- **Backpressure vs UX** - Killing slow clients is harsh but prevents cascades
- **Hot-Reload vs Safety** - Dynamic imports can fail at runtime

---

## Applicability to GRC Chaos Engineering

### Direct Mappings

| OpenClaw Pattern | GRC Application |
|------------------|-----------------|
| Multi-stream events | Chaos experiment lifecycle events |
| Hybrid search | Find similar past experiments |
| JSONL sessions | Experiment transcript for evidence |
| Approval gates | Human-in-loop for high-risk chaos |
| Tool policy | Blast radius authorization |
| Skill loading | Chaos experiment library |
| Foundry crystallization | Learn compliance patterns |
| Memory compaction | Evidence summarization |
| Heartbeat wake | Trigger chaos on anomaly detection |
| Scope guards | Evidence access control |
| Lane serialization | Prevent concurrent chaos conflicts |

### Patterns to Adapt

- **Cron isolation** → Scheduled compliance checks
- **Backpressure** → Rate limiting chaos experiments
- **Context window guard** → Blast radius limit enforcement
- **Auth profile cooldown** → Failed experiment backoff

### Patterns Not Applicable

- **Canvas host** (UI rendering) - Not needed for chaos backend
- **Channel plugins** (messaging platforms) - Different integration model
- **Voice transcription** - Not relevant to GRC

---

## Next Steps for Analysis

1. **Stress Test:** Can event-driven architecture handle 1000+ concurrent experiments?
2. **Trade-Off Analysis:** JSONL evidence vs database for high-volume chaos?
3. **Crystallization Adaptation:** How to detect "successful compliance pattern"?
4. **Authorization Model:** Map tool policy to blast radius levels
5. **Evidence Chain:** JSONL + cryptographic signatures = audit trail?

---

## References

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [mcporter](https://github.com/steipete/mcporter)
- [Foundry Meta-Extension](https://github.com/lekt9/openclaw-foundry)
