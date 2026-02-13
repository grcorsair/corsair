#!/usr/bin/env bash
# =============================================================================
# Corsair Installer — curl-pipeable install script
# Usage: curl -fsSL https://raw.githubusercontent.com/Arudjreis/corsair/main/scripts/install.sh | bash
# =============================================================================
set -e

REPO="https://github.com/Arudjreis/corsair.git"
INSTALL_DIR="${CORSAIR_INSTALL_DIR:-$HOME/corsair}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf "\033[1;34m[corsair]\033[0m %s\n" "$1"; }
ok()    { printf "\033[1;32m[corsair]\033[0m %s\n" "$1"; }
err()   { printf "\033[1;31m[corsair]\033[0m %s\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
detect_os() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS" in
    Linux*)   OS_NAME="linux" ;;
    Darwin*)  OS_NAME="macos" ;;
    MINGW*|MSYS*|CYGWIN*) OS_NAME="windows" ;;
    *)        err "Unsupported operating system: $OS" ;;
  esac
  info "Detected OS: $OS_NAME ($ARCH)"
}

# ---------------------------------------------------------------------------
# Check for required tools
# ---------------------------------------------------------------------------
check_git() {
  if ! command -v git >/dev/null 2>&1; then
    err "git is required but not installed. Install git first: https://git-scm.com"
  fi
}

# ---------------------------------------------------------------------------
# Install Bun if not present
# ---------------------------------------------------------------------------
install_bun() {
  if command -v bun >/dev/null 2>&1; then
    info "Bun already installed: $(bun --version)"
    return
  fi

  info "Installing Bun..."
  case "$OS_NAME" in
    linux|macos)
      curl -fsSL https://bun.sh/install | bash
      # Source the updated profile to get bun in PATH
      export BUN_INSTALL="$HOME/.bun"
      export PATH="$BUN_INSTALL/bin:$PATH"
      ;;
    windows)
      err "On Windows, install Bun manually: https://bun.sh/docs/installation"
      ;;
  esac

  if ! command -v bun >/dev/null 2>&1; then
    err "Bun installation failed. Install manually: https://bun.sh"
  fi
  ok "Bun installed: $(bun --version)"
}

# ---------------------------------------------------------------------------
# Clone and install Corsair
# ---------------------------------------------------------------------------
install_corsair() {
  if [ -d "$INSTALL_DIR" ]; then
    info "Corsair directory already exists at $INSTALL_DIR — pulling latest..."
    cd "$INSTALL_DIR"
    git pull --ff-only
  else
    info "Cloning Corsair to $INSTALL_DIR..."
    git clone "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  info "Installing dependencies..."
  bun install

  ok "Corsair installed at $INSTALL_DIR"
}

# ---------------------------------------------------------------------------
# Print next steps
# ---------------------------------------------------------------------------
print_next_steps() {
  echo ""
  ok "Installation complete!"
  echo ""
  info "Next steps:"
  echo ""
  echo "  cd $INSTALL_DIR"
  echo ""
  echo "  # Generate Ed25519 signing keys"
  echo "  bun run corsair.ts keygen"
  echo ""
  echo "  # Sign your first evidence file"
  echo "  bun run corsair.ts sign --help"
  echo ""
  echo "  # Verify an existing CPOE"
  echo "  bun run corsair.ts verify --help"
  echo ""
  info "Documentation: https://grcorsair.com/docs"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  info "Installing Corsair — Verify Trust. Not Promises."
  echo ""
  detect_os
  check_git
  install_bun
  install_corsair
  print_next_steps
}

main
