# OutreachForge — App Spec

Cold email outreach platform (Instantly/Smartlead-style) on FastAPI + Mongo + React.

## Pages
- `/` landing, `/login`, `/signup` (email+password, httpOnly JWT cookie `of_session`)
- `/dashboard` KPIs (14d), performance chart, latest replies, campaigns, sender health
- `/campaigns` list + New campaign dialog (`?new=1`); `/campaigns/:id` tabs: overview | leads | sequence | settings (`?tab=`)
- `/inbox` Master Inbox — folders (labels), thread list, thread view, label select, reply composer, Sync inboxes
- `/senders` sender accounts (SMTP/IMAP), presets, test connection, pause/remove
- `/analytics` range 7/14/30/90d, chart, funnel, campaign comparison

## Data model (Mongo, string uuid `id`)
users, senders (smtp/imap creds, daily_limit, status active|error|paused|demo), campaigns (steps[{id,subject,body,delay_days}], sender_ids, daily_limit, track_opens, track_clicks, stop_on_reply, send_start_hour/end_hour UTC, status draft|active|paused|completed), leads (campaign_id, status pending|in_progress|completed|replied|bounced, current_step, next_send_at, sender_id), messages (outbound: step_index, sent_at, opened_at, clicked_at, replied_at, bounced, message_id_header), threads (per lead reply conversation, label, unread), thread_messages (in/out).

## Engine (backend/lib/engine.py)
Background loop every 30s: for active campaigns sends due leads via SMTP (rotating senders, per-sender + per-campaign daily caps, send window). Follow-ups thread via In-Reply-To. Every ~2 min IMAP sync of active senders → replies matched by In-Reply-To/References or from-address → thread created, lead marked replied (stop on reply), OOO auto-labeled, mailer-daemon bounces mark lead bounced.
Senders with status `demo` SIMULATE delivery (no SMTP) — used by seeded demo data only.
Tracking: `/api/t/o/{message_id}.gif` (open pixel), `/api/t/c/{message_id}?u=<url>` (click redirect). Base URL = env PUBLIC_BASE_URL.

## Seed (`cd /app/backend && python seed.py`, idempotent — resets demo workspace)
Demo user demo@outreachforge.io / Demo@1234; 3 demo senders; 4 campaigns: "Q3 SaaS Founders Outreach" (active, 70 leads), "Agency Partnerships" (paused, 45), "Series A CTOs — Infra" (completed, 55), "E-commerce Brands Holiday" (draft, 25 leads, no sends); ~30+ reply threads with labels.
