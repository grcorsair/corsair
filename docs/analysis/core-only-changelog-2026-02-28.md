# Core-Only Changelog (2026-02-28)

This changelog covers protocol-first, verification-first core changes only.

## Core API and protocol parity

- Added `GET /formats` and `GET /v1/formats` to expose supported ingestion formats.
- Added `GET /v1/health` alias to match versioned route expectations.
- Normalized `/v1` handling in SSF and SCITT routers for route parity.

## Verification contract hardening

- Aligned `/verify` policy validation behavior with `/v1/verify`.
- Added `sourceDocumentHash` request validation and `inputBinding` result support on `/verify`.
- Unified JWT max-size enforcement in v1 verify path to `100_000` bytes.
- Added deterministic verification digests:
  - `digests.inputSha256`
  - `digests.jwtSha256`

## Integration contract alignment

- Replaced outdated webhook integration examples with SSF stream flows:
  - `POST /v1/ssf/streams`
  - `GET|PATCH|DELETE /v1/ssf/streams/:id`
- Updated OpenAPI contract for health, formats, and verify response shape.
- Updated REST API docs for `/formats`, `/v1/health`, and `/verify` response schema.

## Test coverage added/updated

- Added tests for `/formats` and `/v1/formats`.
- Added tests for `/v1` SSF and SCITT route handling.
- Added verification tests for:
  - extended policy validation,
  - input binding response,
  - digest fields,
  - updated oversized JWT threshold (`>100KB`).
