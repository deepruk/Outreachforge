# Slack workspace integration setup

Rohence Flow connects each user's Slack workspace using Slack OAuth 2.0 and the `incoming-webhook` scope. The selected channel's webhook URL is encrypted with the existing `INTEGRATION_ENCRYPTION_KEY` vault key and stored against that Rohence Flow user.

## Slack app configuration

1. Create a Slack app at https://api.slack.com/apps.
2. Under OAuth & Permissions, add the Redirect URL configured in Render as `SLACK_REDIRECT_URI`.
3. Add the Bot Token Scope `incoming-webhook`. No user scopes are required.
4. Copy the app's Client ID and Client Secret.

## Render environment variables

Set these on the Rohence Flow backend service:

- `SLACK_CLIENT_ID`: Slack app Client ID
- `SLACK_CLIENT_SECRET`: Slack app Client Secret
- `SLACK_REDIRECT_URI`: `https://YOUR_PUBLIC_APP_HOST/api/integrations/slack/oauth/callback` (must exactly match the Slack app redirect URL)
- `INTEGRATION_ENCRYPTION_KEY`: existing Fernet key already used by the integrations vault; do not rotate it without migrating stored credentials.

Do not put Slack credentials or webhook URLs in the frontend or Git repository.

## User experience

Each signed-in user opens Workspace → Integrations and chooses Connect on Slack. Slack asks them to select a workspace and destination channel, then redirects back to Rohence Flow. The connection is stored per user. A Test Slack action sends a sample message. Interested and meeting-booked replies are sent to that user's connected workspace; existing in-app notifications continue to work.

Disconnecting Slack removes only that user's stored Slack connection.
