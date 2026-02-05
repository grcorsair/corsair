# Archive

This directory contains **completed work artifacts** - documents that described development process but are no longer current reference material.

## What's Archived Here

| Document | Purpose | Status |
|----------|---------|--------|
| `AGENTIC_LAYER.md` | Agent implementation status | ✅ Complete - integrated into src/agents/ |
| `ALGORITHM-INTEGRATION-SUMMARY.md` | PAI Algorithm integration summary | ✅ Complete - documented in docs/PAI-ALGORITHM.md |
| `PRODUCTION_ROADMAP.md` | 7-10 month production plan | 📋 Planning artifact (see issues/projects for current status) |
| `ROOT-CAUSE-ANALYSIS.md` | Bug investigation (API mismatch) | ✅ Fixed - handleChart supports drift finding IDs |
| `VALIDATION-FEEDBACK.md` | Independent review findings | ✅ Complete - gaps addressed |

## Why Archive?

**Event logs document work completed, not how to use Corsair.**

These documents served their purpose:
- **AGENTIC_LAYER.md**: Tracked agent implementation progress → Now: src/agents/ code is the source of truth
- **ALGORITHM-INTEGRATION-SUMMARY.md**: Summarized PAI integration → Now: docs/PAI-ALGORITHM.md is comprehensive guide
- **PRODUCTION_ROADMAP.md**: Planned 7-10 months ahead → Now: GitHub issues/projects track progress
- **ROOT-CAUSE-ANALYSIS.md**: Debugged CHART bug → Now: Fixed in commit 6b52969
- **VALIDATION-FEEDBACK.md**: Independent review → Now: Feedback incorporated

**Value is historical context** (understanding decisions), not ongoing reference.

## For Current Documentation

Looking for how to **use** Corsair?

- **Getting Started**: [Quick Start](../README.md#quick-start)
- **Architecture**: [Primitives](../docs/architecture/) | [Patterns](../docs/architecture/patterns/)
- **Plugins**: [Plugin Architecture](../PLUGIN_ARCHITECTURE.md)
- **Agentic**: [PAI Algorithm](../docs/PAI-ALGORITHM.md)

---

**Git History Preserved**: All documents remain in git history. Use `git log --follow` to trace development timeline.
