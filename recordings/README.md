# Corsair Terminal Recordings

Terminal demos of Corsair's 6 protocol primitives, built with [VHS](https://github.com/charmbracelet/vhs).

## Recordings

| File | Primitive | Duration | Description |
|------|-----------|----------|-------------|
| `sign.tape` | SIGN | 30s | Sign evidence as a cryptographic CPOE |
| `verify.tape` | VERIFY | 20s | Verify a CPOE signature via DID:web |
| `diff.tape` | DIFF | 25s | Compare CPOEs, detect regressions |
| `log.tape` | LOG | 15s | Query local SCITT transparency log |
| `full-pipeline.tape` | ALL | 90s | End-to-end pipeline (hero recording) |

## Prerequisites

```bash
brew install vhs
brew install ttyd  # required by VHS
```

## Generate GIFs

Single recording:

```bash
vhs recordings/sign.tape
```

All recordings:

```bash
for tape in recordings/*.tape; do vhs "$tape"; done
```

## Output

- **GIF** (`recordings/*.gif`) — for LinkedIn, social media, GitHub README
- **Dimensions**: 1200x600px, dark theme (Catppuccin Mocha)
- **Font size**: 16px with 20px padding

## Web Embed

For website embedding, use [asciinema-player](https://github.com/asciinema/asciinema-player) with `.cast` recordings:

```bash
brew install asciinema
asciinema rec recordings/sign.cast
```

The `.cast` format supports interactive playback on grcorsair.com/demo.

## Tips

- Edit `.tape` files to adjust timing (`Sleep` commands)
- VHS outputs are deterministic — same tape always produces same GIF
- Keep recordings under 90 seconds for social media attention spans
- The `full-pipeline.tape` is the hero recording for LinkedIn build-in-public posts
