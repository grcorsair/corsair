#!/usr/bin/env bash
# trivy-sign.sh — Sign Aqua Trivy report as a CPOE
#
# Usage:
#   trivy-sign.sh <trivy-report.json> [corsair sign options...]
#   trivy-sign.sh --file - < trivy-report.json
#   trivy image --format json myimage | trivy-sign.sh
#
# This is a convenience wrapper around `corsair sign --format trivy`.
# It auto-sets the format flag so you don't have to remember it.

set -e

# --- Help ---
show_help() {
  cat <<'USAGE'
USAGE:
  trivy-sign.sh <file> [options...]       Sign a Trivy JSON report
  trivy-sign.sh < report.json             Read from stdin
  trivy-sign.sh --help                    Show this help

DESCRIPTION:
  Convenience wrapper for `corsair sign --format trivy`.
  Accepts an Aqua Trivy JSON report and signs it as a CPOE (JWT-VC).

EXAMPLES:
  trivy-sign.sh trivy-report.json
  trivy-sign.sh trivy-report.json --output cpoe.jwt --did did:web:acme.com
  trivy-sign.sh trivy-report.json --dry-run
  trivy image --format json myimage:latest | trivy-sign.sh

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
  $CORSAIR sign --file - --format trivy
else
  FILE="$1"
  shift
  $CORSAIR sign --file "$FILE" --format trivy "$@"
fi
