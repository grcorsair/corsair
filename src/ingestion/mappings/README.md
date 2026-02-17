# Evidence Mappings

This directory contains JSON mapping files used by the ingestion mapping registry.

Each mapping file can define:
- how to identify a tool output (`match`)
- how to extract metadata (`metadata`)
- how to map findings into `controls[]` (`controls`)
- how to pass through small fields for evidence-only CPOEs (`passthrough`)

Mappings are loaded at runtime from:
- this directory
- `CORSAIR_MAPPING_DIR` (comma-separated list of directories)
- `CORSAIR_MAPPING_FILE` (comma-separated list of JSON files)

See `src/ingestion/mapping-registry.ts` for the schema.
