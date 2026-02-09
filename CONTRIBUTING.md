# Contributing to CORSAIR

**Welcome aboard, future crew member!**

## The Pirate's Code

1. **Scout Before You Raid** - Check existing issues/PRs before starting work
2. **Chart Your Course** - Open an issue to discuss significant changes
3. **Sign Your Work** - Every CPOE must be cryptographically verifiable
4. **Test With Proof** - All changes need test coverage
5. **Respect the Protocol** - Never break Parley verification or CPOE format

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
2. Create feature branch: `git checkout -b feature/new-parser`
3. Write tests first (TDD approach)
4. Implement the feature
5. Ensure all tests pass: `bun test`
6. Update documentation if needed
7. Submit PR with clear description

## Code Style

- **TypeScript strict mode** - No implicit any
- **Explicit types** over inference where it improves clarity
- **Pirate terminology** in protocol concepts (MARQUE, CHART, QUARTER, FLAGSHIP)
- **Professional terminology** in code internals (functions, variables, types)
- **Comprehensive tests** - Aim for >80% coverage

## Adding Document Parsers

CORSAIR uses an ingestion pipeline to extract compliance data from documents. See `src/ingestion/` for reference implementations.

**Parser Requirements:**
1. Implement `IngestedDocument` output format
2. Add your source to the `DocumentSource` type
3. Map extracted controls to framework identifiers
4. Write comprehensive tests

## Testing Guidelines

- **Unit tests**: Test individual modules (parley, ingestion, flagship)
- **Integration tests**: Test full ingestion-to-CPOE pipeline
- **Protocol tests**: Test Parley exchange, SCITT registration, FLAGSHIP signals
- **Evidence validation**: Verify Ed25519 signatures and hash chain integrity

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
