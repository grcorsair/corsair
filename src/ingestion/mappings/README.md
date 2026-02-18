# Evidence Mappings

This directory contains JSON mapping files used by the ingestion mapping registry.

Each mapping file can define:
- how to identify a tool output (`match`)
- how to extract metadata (`metadata`)
- how to map findings into `controls[]` (`controls`)
- how to pass through small fields for evidence-only CPOEs (`passthrough`)
- optional `priority` to control match precedence (higher wins)

Mappings are loaded at runtime from:
- this directory
- `CORSAIR_MAPPING_DIR` (comma-separated list of directories)
- `CORSAIR_MAPPING_FILE` (comma-separated list of JSON files)

To distribute mappings as a bundle, create a mapping pack:

```bash
corsair mappings pack --id <ID> --version <VER> --mapping ./mappings
corsair mappings sign --file mapping-pack.json --key ./keys/mapping-pack.key
```

Mappings are evaluated in priority order (highest first). When priorities
are equal, file order is deterministic by filename within each directory.

See `src/ingestion/mapping-registry.ts` for the schema.
