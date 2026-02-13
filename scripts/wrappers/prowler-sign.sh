#!/usr/bin/env bash
# prowler-sign.sh — Sign Prowler OCSF findings as a CPOE
#
# Usage:
#   prowler-sign.sh <prowler-findings.json> [corsair sign options...]
#   prowler-sign.sh --file - < prowler-findings.json
#   prowler | prowler-sign.sh
#
# This is a convenience wrapper around `corsair sign --format prowler`.
# It auto-sets the format flag so you don't have to remember it.

set -e

# --- Help ---
show_help() {
  cat <<'USAGE'
USAGE:
  prowler-sign.sh <file> [options...]     Sign a Prowler OCSF JSON file
  prowler-sign.sh < findings.json         Read from stdin
  prowler-sign.sh --help                  Show this help

DESCRIPTION:
  Convenience wrapper for `corsair sign --format prowler`.
  Accepts a Prowler OCSF JSON findings file and signs it as a CPOE (JWT-VC).

EXAMPLES:
  prowler-sign.sh prowler-findings.json
  prowler-sign.sh prowler-findings.json --output cpoe.jwt --did did:web:acme.com
  prowler-sign.sh prowler-findings.json --dry-run
  cat prowler-findings.json | prowler-sign.sh

OPTIONS:
  All options after the file path are passed through to `corsair sign`.
  Run `corsair sign --help` for the full list.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      show_help
      exit 0
      ;;
  esac
done

# --- Locate corsair ---
CORSAIR=""
if command -v corsair >/dev/null 2>&1; then
  CORSAIR="corsair"
elif [ -f "./corsair.ts" ]; then
  CORSAIR="bun run ./corsair.ts"
elif [ -f "$(dirname "$0")/../../corsair.ts" ]; then
  CORSAIR="bun run $(dirname "$0")/../../corsair.ts"
else
  echo "Error: Cannot find corsair CLI. Install with: bun add -g corsair" >&2
  exit 2
fi

# --- Determine input ---
if [ $# -eq 0 ]; then
  # No arguments — read from stdin
  $CORSAIR sign --file - --format prowler
else
  FILE="$1"
  shift
  $CORSAIR sign --file "$FILE" --format prowler "$@"
fi
