# Corsair Jira Integration (SSF Push)

Attach verification links or compliance status updates to Jira issues from FLAGSHIP event streams.

## Flow

1. Jira Automation receives a webhook.
2. Automation rule decodes payload fields and comments on matching issues.
3. Corsair sends events via SSF push delivery as signed SET JWTs.

## 1) Create a Jira incoming webhook rule

In Jira: **Project Settings -> Automation -> Create Rule**

- Trigger: **Incoming webhook**
- Keep the generated webhook URL.
- Add actions (for example: comment on issue, transition issue, set priority).

## 2) Register the Jira endpoint as an SSF stream

```bash
curl -X POST https://api.grcorsair.com/v1/ssf/streams \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery": {
      "method": "push",
      "endpoint_url": "https://automation.atlassian.com/pro/hooks/YOUR_HOOK_ID"
    },
    "events_requested": [
      "https://grcorsair.com/events/compliance-change/v1",
      "https://grcorsair.com/events/credential-change/v1"
    ],
    "format": "jwt"
  }'
```

## 3) Handle SET payloads

Corsair sends:
- Header: `Content-Type: application/secevent+jwt`
- Body: signed SET JWT

Decode JWT claims in your receiver and use `events` entries to map actions (for example, create a comment when `credential-change` events arrive).

## Useful stream endpoints

- `GET /v1/ssf/streams/:id` to inspect status
- `PATCH /v1/ssf/streams/:id` to change subscriptions
- `DELETE /v1/ssf/streams/:id` to stop delivery
