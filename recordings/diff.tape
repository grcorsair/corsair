# CORSAIR DIFF — Detect compliance regressions between CPOEs
# Demonstrates: corsair diff comparing two CPOEs
# Duration: ~25 seconds

Output recordings/diff.gif
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Sleep 1s
Type "# Compare two CPOEs to detect compliance regressions — like git diff for compliance"
Enter
Sleep 1s
Type "corsair diff --current new-cpoe.jwt --previous old-cpoe.jwt"
Enter
Sleep 5s
Type "# Diff detects: new failures, improvements, added/removed controls, score changes"
Enter
Sleep 2s
Type "# Exit code 1 = regression detected. Use in CI/CD to gate deployments."
Enter
Sleep 3s
