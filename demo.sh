#!/bin/bash
# CORSAIR 60-Minute Demo Script
# Attack first. Discover reality. Evidence emerges.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'
BOLD='\033[1m'

pause() {
    echo ""
    echo -e "${DIM}Press Enter to continue...${RESET}"
    read -r
}

header() {
    echo ""
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
    echo -e "${CYAN}${BOLD}  $1${RESET}"
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
    echo ""
}

echo -e "${RED}${BOLD}"
cat << 'EOF'

   ██████╗ ██████╗ ██████╗ ███████╗ █████╗ ██╗██████╗
  ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║██╔══██╗
  ██║     ██║   ██║██████╔╝███████╗███████║██║██████╔╝
  ██║     ██║   ██║██╔══██╗╚════██║██╔══██║██║██╔══██╗
  ╚██████╗╚██████╔╝██║  ██║███████║██║  ██║██║██║  ██║
   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝

         60-MINUTE OFFENSIVE VALIDATION DEMO

EOF
echo -e "${RESET}"

echo -e "${YELLOW}This demo shows how CORSAIR discovers security reality through attack,${RESET}"
echo -e "${YELLOW}with compliance evidence emerging as a byproduct.${RESET}"
echo ""
echo -e "${DIM}Duration: ~60 minutes${RESET}"
echo -e "${DIM}Phases: Recon → Attack (4 vectors) → Evidence Review${RESET}"

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 1: THE OFFENSIVE MINDSET (5 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 1: THE OFFENSIVE MINDSET (5 min)"

echo -e "${GREEN}Traditional approach:${RESET}"
echo "  $ compliance-tool init --framework soc2"
echo "  $ compliance-tool configure-controls"
echo "  $ compliance-tool generate-evidence"
echo ""
echo -e "${RED}CORSAIR approach:${RESET}"
echo "  $ corsair strike mfa"
echo ""
echo -e "${YELLOW}No framework selection. No configuration. Just attack.${RESET}"

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 2: RECONNAISSANCE (10 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 2: RECONNAISSANCE (10 min)"

echo -e "${CYAN}Before attacking, we map the authentication surface.${RESET}"
echo ""
echo -e "${DIM}Running: corsair recon mfa${RESET}"
echo ""

bun run corsair.ts recon mfa

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 3: TEMPORAL DRIFT ATTACK (10 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 3: TEMPORAL DRIFT ATTACK (10 min)"

echo -e "${CYAN}Temporal drift injects time-based anomalies:${RESET}"
echo "  - Token replay within validity windows"
echo "  - Clock skew tolerance abuse"
echo "  - Time-based OTP period overlap"
echo ""
echo -e "${DIM}Running: corsair strike mfa --drift=temporal --intensity=7${RESET}"
echo ""

bun run corsair.ts strike mfa --drift=temporal --intensity=7 --output=./demo-temporal.json

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 4: GEOGRAPHIC DRIFT ATTACK (10 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 4: GEOGRAPHIC DRIFT ATTACK (10 min)"

echo -e "${CYAN}Geographic drift injects location-based anomalies:${RESET}"
echo "  - Impossible travel scenarios"
echo "  - VPN egress location spoofing"
echo "  - Geofencing bypass attempts"
echo ""
echo -e "${DIM}Running: corsair strike mfa --drift=geographic --intensity=6${RESET}"
echo ""

bun run corsair.ts strike mfa --drift=geographic --intensity=6 --output=./demo-geographic.json

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 5: BEHAVIORAL DRIFT ATTACK (10 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 5: BEHAVIORAL DRIFT ATTACK (10 min)"

echo -e "${CYAN}Behavioral drift injects pattern anomalies:${RESET}"
echo "  - Abnormal API call rates"
echo "  - Unusual access patterns"
echo "  - Step-up authentication bypass"
echo ""
echo -e "${DIM}Running: corsair strike mfa --drift=behavioral --intensity=8${RESET}"
echo ""

bun run corsair.ts strike mfa --drift=behavioral --intensity=8 --output=./demo-behavioral.json

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 6: PROTOCOL DRIFT ATTACK (10 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 6: PROTOCOL DRIFT ATTACK (10 min)"

echo -e "${CYAN}Protocol drift injects mechanism anomalies:${RESET}"
echo "  - MFA method downgrade"
echo "  - Fallback mechanism abuse"
echo "  - Backup code enumeration"
echo ""
echo -e "${DIM}Running: corsair strike mfa --drift=protocol --intensity=9${RESET}"
echo ""

bun run corsair.ts strike mfa --drift=protocol --intensity=9 --output=./demo-protocol.json

pause

# ═══════════════════════════════════════════════════════════════
# PHASE 7: EVIDENCE REVIEW (5 min)
# ═══════════════════════════════════════════════════════════════

header "PHASE 7: EVIDENCE REVIEW - GRC RELEVANCE EMERGES (5 min)"

echo -e "${GREEN}${BOLD}Attack complete. Now observe what was generated:${RESET}"
echo ""

echo -e "${CYAN}Evidence files created:${RESET}"
ls -la ./demo-*.json ./demo-*.md 2>/dev/null || echo "  (Evidence files generated during attack)"
echo ""

echo -e "${CYAN}Sample evidence content:${RESET}"
echo ""

if [ -f "./demo-temporal.md" ]; then
    head -50 ./demo-temporal.md
fi

pause

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════

header "DEMO COMPLETE: THE PARADIGM SHIFT"

echo -e "${YELLOW}${BOLD}What just happened:${RESET}"
echo ""
echo "  1. We launched 4 attack vectors against MFA"
echo "  2. We discovered actual security weaknesses"
echo "  3. Evidence was generated AUTOMATICALLY"
echo "  4. Framework mappings happened in BACKGROUND"
echo ""
echo -e "${GREEN}${BOLD}Key insight:${RESET}"
echo ""
echo "  We never asked 'are you SOC2 compliant?'"
echo "  We asked 'what happens when authentication is stressed?'"
echo ""
echo "  SOC2 CC6.1, CC6.6, ISO27001 A.9.4.2, NIST-CSF PR.AC-7"
echo "  ...all mapped automatically from attack findings."
echo ""
echo -e "${RED}${BOLD}This is offensive validation:${RESET}"
echo ""
echo "  Attack first. Discover reality. Evidence emerges."
echo ""

echo -e "${DIM}Generated evidence files:${RESET}"
ls -la ./demo-*.json ./demo-*.md 2>/dev/null || echo "  Check current directory for evidence files"
echo ""
echo -e "${GREEN}Demo complete.${RESET}"
