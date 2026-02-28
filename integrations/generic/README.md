# Generic Webhook Integration (SSF Push)

Connect FLAGSHIP compliance events to any system that accepts HTTPS webhook calls.

## Register an SSF stream

Corsair delivers FLAGSHIP events using OpenID Shared Signals Framework (SSF) and Security Event Tokens (SET).
Create a push stream:

```bash
curl -X POST https://api.grcorsair.com/v1/ssf/streams \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery": {
      "method": "push",
      "endpoint_url": "https://your-tool.example.com/webhook/corsair"
    },
    "events_requested": [
      "https://grcorsair.com/events/compliance-change/v1",
      "https://grcorsair.com/events/credential-change/v1"
    ],
    "format": "jwt"
  }'
```

## Event types

| Alias | Event URI |
|-------|-----------|
| `COLORS_CHANGED` | `https://grcorsair.com/events/colors-changed/v1` |
| `FLEET_ALERT` | `https://grcorsair.com/events/compliance-change/v1` |
| `PAPERS_CHANGED` | `https://grcorsair.com/events/credential-change/v1` |
| `MARQUE_REVOKED` | `https://grcorsair.com/events/session-revoked/v1` |

## Delivery format

Push delivery uses:
- `Content-Type: application/secevent+jwt`
- Body: a signed SET JWT

Decode and verify the JWT signature against the issuer key in `/.well-known/jwks.json`.

## Stream lifecycle

- `GET /v1/ssf/streams/:id` to inspect stream configuration/status
- `PATCH /v1/ssf/streams/:id` to update subscriptions or destination
- `DELETE /v1/ssf/streams/:id` to disable delivery
