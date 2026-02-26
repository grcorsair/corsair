# Homebrew formula for Corsair
# To use: brew tap grcorsair/corsair && brew install corsair
# Or: brew install grcorsair/corsair/corsair

class Corsair < Formula
  desc "Open compliance trust exchange protocol — sign, verify, diff compliance proofs"
  homepage "https://grcorsair.com"
  license "Apache-2.0"

  url "https://github.com/grcorsair/corsair/archive/refs/tags/v1.1.1.tar.gz"
  sha256 "48cbcee21a3dcb3bcd0f382aec5c5f43d4cb081f7af6c1ab8fa5ce896eaee9cf"
  version "1.1.1"

  # HEAD install (always latest from main)
  head "https://github.com/grcorsair/corsair.git", branch: "main"

  depends_on "oven-sh/bun/bun"

  def install
    system "bun", "install", "--production", "--frozen-lockfile"

    # Install everything to libexec (keeps brew's bin/ clean)
    libexec.install "corsair.ts", "src", "bin", "package.json", "node_modules"

    # Create wrapper script in brew's bin/
    (bin/"corsair").write <<~EOS
      #!/bin/bash
      exec bun run "#{libexec}/corsair.ts" "$@"
    EOS
  end

  test do
    # Verify CLI loads and shows help
    assert_match "CORSAIR", shell_output("#{bin}/corsair help")

    # Verify keygen works
    system bin/"corsair", "keygen", "--output", testpath/"keys"
    assert_predicate testpath/"keys/corsair-signing.key", :exist?
  end
end
