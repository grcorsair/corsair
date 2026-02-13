#!/usr/bin/env bash
# inspec-sign.sh — Sign Chef InSpec report as a CPOE
#
# Usage:
#   inspec-sign.sh <inspec-report.json> [corsair sign options...]
#   inspec-sign.sh --file - < inspec-report.json
#   inspec exec ... --reporter json | inspec-sign.sh
#
# This is a convenience wrapper around `corsair sign --format inspec`.
# It auto-sets the format flag so you don't have to remember it.

set -e

# --- Help ---
show_help() {
  cat <<'USAGE'
USAGE:
  inspec-sign.sh <file> [options...]      Sign an InSpec JSON report
  inspec-sign.sh < report.json            Read from stdin
  inspec-sign.sh --help                   Show this help

DESCRIPTION:
  Convenience wrapper for `corsair sign --format inspec`.
  Accepts a Chef InSpec JSON report and signs it as a CPOE (JWT-VC).

EXAMPLES:
  inspec-sign.sh inspec-report.json
  inspec-sign.sh inspec-report.json --output cpoe.jwt --did did:web:acme.com
  inspec-sign.sh inspec-report.json --dry-run
  inspec exec myprofile --reporter json | inspec-sign.sh

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
  $CORSAIR sign --file - --format inspec
else
  FILE="$1"
  shift
  $CORSAIR sign --file "$FILE" --format inspec "$@"
fi
