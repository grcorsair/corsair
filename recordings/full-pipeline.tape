# CORSAIR FULL PIPELINE — End-to-end compliance proof workflow
# Demonstrates: keygen → sign → verify → diff → log
# Duration: ~90 seconds
# This is the hero recording for LinkedIn build-in-public posts

Output recordings/full-pipeline.gif
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Sleep 1s
Type "# CORSAIR — Git for Compliance. Verify proof, not promises."
Enter
Sleep 2s

# Step 1: Generate keys
Type "# Step 1: Generate Ed25519 signing keys"
Enter
Sleep 1s
Type "corsair keygen --output ./demo-keys"
Enter
Sleep 3s

# Step 2: Sign evidence
Type "# Step 2: Sign tool output as a CPOE (Certificate of Proof of Operational Effectiveness)"
Enter
Sleep 1s
Type "corsair sign --file examples/generic-evidence.json --key-dir ./demo-keys --output demo-cpoe.jwt"
Enter
Sleep 5s

# Step 3: Verify the CPOE
Type "# Step 3: Verify the CPOE — Ed25519 signature check"
Enter
Sleep 1s
Type "corsair verify --file demo-cpoe.jwt --pubkey ./demo-keys/corsair-signing.pub"
Enter
Sleep 4s

# Step 4: Sign a second CPOE with different data for diffing
Type "# Step 4: Sign a second CPOE with updated evidence"
Enter
Sleep 1s
Type "corsair sign --file examples/generic-evidence-v2.json --key-dir ./demo-keys --output demo-cpoe-v2.jwt"
Enter
Sleep 5s

# Step 5: Diff the two CPOEs
Type "# Step 5: Diff — detect compliance regressions between CPOEs"
Enter
Sleep 1s
Type "corsair diff --current demo-cpoe-v2.jwt --previous demo-cpoe.jwt"
Enter
Sleep 5s

# Step 6: Check the log
Type "# Step 6: Log — list all signed CPOEs"
Enter
Sleep 1s
Type "corsair log"
Enter
Sleep 4s

# Conclusion
Type "# Open protocol. Ed25519 signatures. JWT-VC format. Anyone can verify."
Enter
Sleep 2s
Type "# https://grcorsair.com"
Enter
Sleep 3s
