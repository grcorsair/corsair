# Corsair MCP Server for Claude Code

Corsair provides 4 MCP tools for signing, verifying, and diffing compliance evidence directly from Claude Code.

## Setup

Add to your Claude Code MCP configuration (`~/.claude/mcp.json` or project-level):

```json
{
  "mcpServers": {
    "corsair": {
      "command": "bun",
      "args": ["run", "/path/to/corsair/bin/corsair-mcp.ts"],
      "env": {
        "CORSAIR_KEY_DIR": "/path/to/corsair/keys"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `corsair_sign` | Sign evidence as a CPOE (JWT-VC with Ed25519) |
| `corsair_verify` | Verify a CPOE signature and structure |
| `corsair_diff` | Compare two CPOEs and detect regressions |
| `corsair_formats` | List supported evidence formats |

## Generate Keys First

```bash
cd /path/to/corsair
bun run corsair.ts keygen --output ./keys
```

## Example Usage in Claude Code

> "Sign this scanner output as a CPOE"
> "Verify this JWT: eyJ..."
> "Compare these two CPOEs and show me what regressed"
> "What evidence formats does Corsair support?"
