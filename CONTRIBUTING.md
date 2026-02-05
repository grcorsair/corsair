# Contributing to CORSAIR

**Welcome aboard, future crew member!**

## The Pirate's Code

1. **Scout Before You Raid** - Check existing issues/PRs before starting work
2. **Chart Your Course** - Open an issue to discuss significant changes
3. **Leave No Trace** - ESCAPE primitive must clean up all test resources
4. **Plunder With Proof** - All changes need test coverage
5. **Respect the Hash Chain** - Never break evidence integrity

## Getting Started

```bash
# Clone the ship
git clone https://github.com/arudjreis/corsair.git
cd corsair

# Provision the crew
bun install

# Test the cannons
bun test
```

## Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-attack-vector`
3. Write tests first (TDD approach)
4. Implement the feature
5. Ensure all tests pass: `bun test`
6. Update documentation if needed
7. Submit PR with clear description

## Code Style

- **TypeScript strict mode** - No implicit any
- **Explicit types** over inference where it improves clarity
- **Pirate terminology** in user-facing output (RECON, RAID, PLUNDER, etc.)
- **Professional terminology** in code internals (functions, variables, types)
- **Comprehensive tests** - Aim for >80% coverage

## Creating a New Plugin

CORSAIR uses a plugin-first architecture. See `plugins/aws-cognito/` for reference implementation.

**Plugin Requirements:**
1. Implement `ProviderPlugin<T>` interface
2. Create `*.plugin.json` manifest with attack vectors
3. Define framework mappings (MITRE → NIST → SOC2)
4. Implement all 6 primitives: RECON, MARK, RAID, PLUNDER, CHART, ESCAPE
5. Write comprehensive tests

## Testing Guidelines

- **Unit tests**: Test individual primitives
- **Integration tests**: Test full attack lifecycle
- **Plugin tests**: Test provider-specific implementations
- **Evidence validation**: Verify hash chain integrity

Run tests with coverage:
```bash
bun test --coverage
```

## Reporting Issues

- **Bugs**: Use bug report template
- **Feature requests**: Use feature request template
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md)

## Questions?

Open a discussion in GitHub Discussions. The crew is friendly and helpful.

**Fair winds on your contribution voyage!**
