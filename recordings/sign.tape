# CORSAIR SIGN — Sign evidence as a cryptographic CPOE
# Demonstrates: corsair sign with generic evidence
# Duration: ~30 seconds

Output recordings/sign.gif
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Sleep 1s
Type "# Sign tool output as a CPOE (Certificate of Proof of Operational Effectiveness)"
Enter
Sleep 1s
Type "corsair sign --file examples/generic-evidence.json --json"
Enter
Sleep 5s
Type "# The output is a signed JWT-VC — verifiable by anyone with standard JWT libraries"
Enter
Sleep 2s
Type "# No vendor lock-in. Ed25519 signature. DID:web identity. Open protocol."
Enter
Sleep 3s
