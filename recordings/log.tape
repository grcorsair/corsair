# CORSAIR LOG — Query the SCITT transparency log
# Demonstrates: corsair log listing signed CPOEs
# Duration: ~15 seconds

Output recordings/log.gif
Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Sleep 1s
Type "# List signed CPOEs — local SCITT transparency log"
Enter
Sleep 1s
Type "corsair log --last 5"
Enter
Sleep 4s
Type "# Every CPOE is append-only. Tamper-evident. Like git log for compliance."
Enter
Sleep 3s
