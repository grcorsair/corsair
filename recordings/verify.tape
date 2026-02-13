# CORSAIR VERIFY — Verify a CPOE signature
# Demonstrates: corsair verify with a signed CPOE
# Duration: ~20 seconds

Output recordings/verify.gif
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Sleep 1s
Type "# Verify a signed CPOE — check Ed25519 signature and issuer identity"
Enter
Sleep 1s
Type "corsair verify --file cpoe.jwt"
Enter
Sleep 4s
Type "# Verification is always free. No account needed. Anyone can check."
Enter
Sleep 2s
Type "# Four steps: decode JWT → resolve DID:web → extract public key → verify Ed25519"
Enter
Sleep 3s
