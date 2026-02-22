# Generic Webhook Integration

Connect FLAGSHIP compliance events to any tool with a webhook URL.

## FLAGSHIP Event Types

| Event | Description | CAEP Type |
|-------|-------------|-----------|
| `cpoe.signed` | New CPOE signed | `credential-change` |
| `cpoe.verified` | CPOE verified by third party | `credential-change` |
| `drift.detected` | Compliance drift detected | `compliance-change` |
| `score.degraded` | Evidence quality score dropped | `compliance-change` |
| `cert.expiring` | Certification expiring soon | `credential-change` |
| `cert.renewed` | Certification renewed | `credential-change` |
| `cpoe.revoked` | CPOE emergency revocation | `session-revoked` |
| `vendor.risk_change` | Vendor risk level changed | `compliance-change` |

## Register a Webhook

```bash
curl -X POST https://api.grcorsair.com/v1/webhooks \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-tool.example.com/webhook/corsair",
    "events": ["cpoe.signed", "drift.detected"],
    "secret": "whsec_your_secret_here"
  }'
```

## Webhook Payload Format

All webhooks are signed with HMAC-SHA256. Verify using the `X-Corsair-Signature` header.

```json
{
  "id": "evt_a1b2c3d4",
  "event_type": "cpoe.signed",
  "timestamp": "2026-02-14T00:00:00Z",
  "data": { ... }
}
```

## Verify Webhook Signature

```typescript
import { createHmac } from "crypto";

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${expected}` === signature;
}
```

## Works With

Any tool that accepts incoming webhooks:
- **Asana** — Create tasks on drift detection
- **Monday.com** — Update compliance board
- **ServiceNow** — Create incidents on revocation
- **PagerDuty** — Alert on-call on critical drift
- **Slack** — Post to compliance channel
- **Teams** — Send adaptive cards
- **Discord** — Post to security channel
- **Custom apps** — Any HTTP endpoint
