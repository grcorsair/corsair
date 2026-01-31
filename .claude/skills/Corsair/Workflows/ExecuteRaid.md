# Execute Raid Workflow

Executes a controlled chaos raid to validate compliance controls.

## Trigger

- "run corsair raid"
- "execute chaos test"
- "attack [control name]"

## Steps

1. **Verify Authorization**
   - Confirm user has authorization to raid (letter of marque)
   - Check blast radius constraints
   - Validate dry-run vs live execution

2. **RECON Phase**
   ```bash
   cd ~/projects/corsair
   bun run corsair.ts recon <target-config.json>
   ```

3. **MARK Phase**
   - Define expectations (compliance requirements)
   - Identify drift candidates for raid targeting

4. **RAID Phase**
   ```bash
   bun run corsair.ts raid --vector <attack-vector> \
     --intensity <0.0-1.0> \
     --dry-run  # Remove for live execution
   ```

5. **PLUNDER Phase**
   - Extract evidence with cryptographic hash chain
   - Output to JSONL format for audit trail

6. **CHART Phase**
   - Map findings to MITRE ATT&CK
   - Translate to NIST CSF controls
   - Map to SOC2 Trust Services Criteria

7. **ESCAPE Phase**
   - Execute scope guard cleanup
   - Restore pre-raid state
   - Verify no leaked resources

## Output

Return structured raid report with:
- Attack vector executed
- Controls bypassed (if any)
- Evidence artifacts (JSONL path)
- Compliance framework mappings
- Cleanup verification status
