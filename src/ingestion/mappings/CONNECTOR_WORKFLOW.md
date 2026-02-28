# Connector Workflow (Deterministic)

Use this workflow when adding a new ingestion connector.

## 1) Start from template

Copy `connector-template.mapping.jsonc` into a new `*.json` mapping file.

## 2) Add provider fixture test

Add a test case in `tests/ingestion/provider-mappings.test.ts` using a representative payload from the provider.

Test assertions should minimally verify:
- mapping ID (`extensions.mapping.id`)
- issuer metadata
- control count
- status + severity mapping

## 3) Validate schema and strict contract

Run:

```bash
bun run corsair.ts mappings validate --strict --json
```

This enforces mapping schema and strict ingestion expectations.

## 4) Run connector guardrail command

Run:

```bash
bun run validate:connectors
```

This executes:
- provider mapping tests
- strict mapping validation

## 5) Optional pack/sign for distribution

```bash
bun run corsair.ts mappings pack --id <PACK_ID> --version <SEMVER> --mapping ./src/ingestion/mappings
bun run corsair.ts mappings sign --file <PACK.json> --key <KEY.pem>
```
