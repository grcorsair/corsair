# Cloudflare Worker — trust.txt Hosting

Serve `/.well-known/trust.txt` from a Cloudflare Worker in one click.

## Deploy

1. Copy `worker.ts` into your Cloudflare Worker project.
2. Set environment variables:
   - `TRUST_TXT_URL` to proxy a hosted trust.txt
   - OR `TRUST_TXT` for raw content
3. Bind the Worker to `/.well-known/trust.txt`.

## Recommended (Hosted trust.txt)

If you use Corsair hosted trust.txt, set:

```
TRUST_TXT_URL=https://trust.grcorsair.com/trust/<your-domain>/trust.txt
```

Then add DNS delegation:

```
_corsair.example.com TXT "corsair-trusttxt=https://trust.grcorsair.com/trust/example.com/trust.txt"
_corsair.example.com TXT "corsair-trusttxt-sha256=<hash>"
```

## Notes

- The Worker responds only on `/.well-known/trust.txt`.
- Cache is set to 5 minutes by default.
