# Corsair Zapier Integration

Connect Corsair to 6,000+ apps via Zapier.

## Actions

| Action | Description |
|--------|-------------|
| **Sign Evidence** | POST to `/v1/sign` with JSON evidence |
| **Verify CPOE** | POST to `/v1/verify` with JWT string |

## Template Zaps

### 1. Google Drive → Sign → Slack Notification
**Trigger**: New file in Google Drive folder
**Action 1**: Corsair Sign (POST to API with file contents)
**Action 2**: Slack message with CPOE summary + verification link

### 2. Webhook → Sign → Email CPOE
**Trigger**: Catch webhook (from security tool)
**Action 1**: Corsair Sign
**Action 2**: Email CPOE JWT + grcorsair.com/marque verification link

### 3. Schedule → Scanner → Sign → Archive
**Trigger**: Schedule (weekly)
**Action 1**: Run your scanner via SSH/webhook
**Action 2**: Corsair Sign
**Action 3**: Upload CPOE to S3/Google Drive

## Authentication

Use **API Key** authentication:
1. Get your API key from your Corsair account
2. In Zapier, add a Custom Request step
3. Set header: `Authorization: Bearer YOUR_API_KEY`

## Custom Request Setup

### Sign Evidence
```
Method: POST
URL: https://api.grcorsair.com/v1/sign
Headers:
  Authorization: Bearer {{api_key}}
  Content-Type: application/json
Body:
{
  "evidence": {{step.output}},
  "scope": "Automated compliance scan"
}
```

### Verify CPOE
```
Method: POST
URL: https://api.grcorsair.com/v1/verify
Headers:
  Content-Type: application/json
Body:
{
  "cpoe": "{{step.jwt}}"
}
```
