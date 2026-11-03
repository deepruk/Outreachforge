# Rohence Flow External API

Base URL: `https://app.rohence.com/api/v1`

The external API lets trusted AI agents and integrations read campaigns and create/edit **draft** campaigns. It does not permit campaign launch or email sending.

## Create an API key

Sign in to Rohence Flow in your browser, then open:

`https://app.rohence.com/api/docs`

Use the session-authenticated endpoint `POST /api/auth/api-keys` with:

```json
{ "name": "Claude campaign assistant" }
```

Copy the returned `api_key` immediately. It is shown only once. API keys are stored as SHA-256 hashes and can be revoked with `DELETE /api/auth/api-keys/{key_id}`. Manage/list keys with `GET /api/auth/api-keys`.

## Authentication

Send the key as a bearer token:

```
Authorization: Bearer rhf_live_...
Content-Type: application/json
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/campaigns` | List workspace campaigns |
| POST | `/campaigns` | Create a draft campaign |
| GET | `/campaigns/{campaign_id}` | Read campaign and sequence |
| PUT | `/campaigns/{campaign_id}` | Update a draft campaign and its email steps |

All paths above are relative to `/api/v1`.

## Create a draft

```http
POST /api/v1/campaigns
Authorization: Bearer rhf_live_...
Content-Type: application/json

{ "name": "US Marketing Agencies - November" }
```

## Update email steps

```http
PUT /api/v1/campaigns/CAMPAIGN_ID
Authorization: Bearer rhf_live_...
Content-Type: application/json

{
  "steps": [
    {
      "id": "EXISTING_STEP_ID",
      "subject": "Quick idea for {{company}}",
      "subject_b": "",
      "body": "Hi {{first_name}},\n\nI noticed {{company}} works with B2B clients. We help agencies book qualified sales meetings. Would it be worth sharing how?\n\nBest,",
      "delay_days": 0,
      "preheader": ""
    },
    {
      "id": "EXISTING_STEP_ID_2",
      "subject": "Re: Quick idea for {{company}}",
      "subject_b": "",
      "body": "Hi {{first_name}},\n\nJust following up on my note. Would a short conversation next week make sense?\n\nBest,",
      "delay_days": 3,
      "preheader": ""
    }
  ]
}
```

Use the step IDs returned by the create/read endpoint when updating existing steps. The update endpoint accepts the same campaign settings as the in-app campaign editor. Only campaigns with `status: draft` can be modified through this external API. Attempts to edit active/paused campaigns return HTTP 409.

## Safety boundaries

- API keys are scoped to `campaigns:read` and `campaigns:write`.
- API keys cannot launch/pause campaigns, send test emails, or send campaign emails.
- Campaign creation always starts in `draft` status.
- Keys can be revoked at any time from the API key management endpoints.
- Keep keys in a secrets manager; never put them in frontend JavaScript, prompts visible to prospects, or source control.


## Import leads

Leads can be imported into a draft campaign in batches of up to 10,000. Existing emails in the campaign are skipped, and workspace-level unsubscribes are retained as unsubscribed records.

```http
POST /api/v1/campaigns/CAMPAIGN_ID/leads
Authorization: Bearer rhf_live_...
Content-Type: application/json

{
  "leads": [
    {
      "email": "alex@example.com",
      "first_name": "Alex",
      "last_name": "Morgan",
      "company": "Example Co",
      "title": "Founder",
      "timezone": "America/New_York",
      "custom": { "industry": "SaaS", "website": "https://example.com" }
    }
  ]
}
```

Response: `{"added": 1, "skipped": 0}`.

Use `GET /api/v1/campaigns/CAMPAIGN_ID/leads?limit=500` to list imported leads. The limit is capped at 5,000. The external API only imports into draft campaigns, so adding prospects cannot unexpectedly start sending.

## Sender accounts

| Method | Path | Purpose |
|---|---|---|
| GET | `/senders` | List connected sender accounts and safe metadata |
| PATCH | `/senders/{sender_id}` | Update display name, daily limit, signatures, or status |

Example:

```http
PATCH /api/v1/senders/SENDER_ID
Authorization: Bearer rhf_live_...
Content-Type: application/json

{ "daily_limit": 25, "status": "paused" }
```

For security, sender mailbox credentials, OAuth refresh tokens, SMTP/IMAP passwords, and sender creation/connection are not exposed to the external API. Connect or re-authorize Gmail/SMTP inboxes inside the Rohence Flow application. Sender deletion also remains an in-app action.
