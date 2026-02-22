# Corsair Jira Integration

Attach CPOE verification links to Jira issues when compliance events fire.

## How It Works

1. **FLAGSHIP** emits a webhook when compliance changes (drift, new CPOE, revocation)
2. **Jira Automation** receives the webhook
3. Rule matches the control ID to a Jira issue
4. Attaches CPOE verification link as a comment

## Setup

### 1. Create a Jira Automation Rule

Go to **Project Settings → Automation → Create Rule**

**Trigger**: Incoming webhook
- Webhook URL: (Jira provides this)

**Condition**: Check webhook payload
```
{{webhookData.event_type}} equals "cpoe.signed"
```

**Action**: Add comment to issue
```
Compliance evidence signed as CPOE.

*CPOE ID*: {{webhookData.data.marque_id}}
*Controls Tested*: {{webhookData.data.summary.controls_tested}}
*Controls Passed*: {{webhookData.data.summary.controls_passed}}
*Score*: {{webhookData.data.summary.overall_score}}%

[Verify CPOE|https://grcorsair.com/marque?jwt={{webhookData.data.jwt}}]
```

### 2. Configure FLAGSHIP Webhook

Register the Jira automation webhook URL with Corsair:

```bash
curl -X POST https://api.grcorsair.com/v1/webhooks \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://automation.atlassian.com/pro/hooks/YOUR_HOOK_ID",
    "events": ["cpoe.signed", "drift.detected", "score.degraded"],
    "secret": "your-webhook-secret"
  }'
```

## Webhook Event Payloads

### cpoe.signed
```json
{
  "event_type": "cpoe.signed",
  "timestamp": "2026-02-14T00:00:00Z",
  "data": {
    "marque_id": "marque-a1b2c3d4...",
    "jwt": "eyJ...",
    "summary": {
      "controls_tested": 24,
      "controls_passed": 22,
      "controls_failed": 2,
      "overall_score": 91
    }
  }
}
```

### drift.detected
```json
{
  "event_type": "drift.detected",
  "timestamp": "2026-02-14T00:00:00Z",
  "data": {
    "control_id": "iam-mfa-root",
    "previous_status": "effective",
    "current_status": "ineffective",
    "severity": "high"
  }
}
```
