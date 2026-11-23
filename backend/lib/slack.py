"""Slack Incoming Webhook delivery for per-user workspace integrations."""
import logging

import httpx
from cryptography.fernet import Fernet, InvalidToken

from lib.db import db

log = logging.getLogger(__name__)


def _decrypt_webhook(encrypted: str) -> str:
    key = __import__("os").environ.get("INTEGRATION_ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("Integration encryption is not configured")
    return Fernet(key.encode()).decrypt(encrypted.encode()).decode()


async def _post_webhook(user_id: str, text: str) -> tuple[bool, str]:
    doc = await db.integrations.find_one({"user_id": user_id, "provider": "slack", "status": "connected"})
    if not doc or not doc.get("encrypted_webhook_url"):
        return False, "Connect a Slack workspace first."
    try:
        url = _decrypt_webhook(doc["encrypted_webhook_url"])
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            response = await client.post(url, json={"text": text})
        if response.status_code != 200 or response.text.strip() != "ok":
            log.warning("Slack webhook rejected notification for user %s: HTTP %s", user_id, response.status_code)
            return False, "Slack could not accept the message. Reconnect the workspace and try again."
        return True, "Slack test message sent."
    except (InvalidToken, KeyError, ValueError):
        log.exception("Stored Slack webhook could not be decrypted for user %s", user_id)
        return False, "Saved Slack connection is unreadable. Reconnect Slack."
    except Exception as exc:
        log.warning("Slack notification failed for user %s (%s)", user_id, type(exc).__name__)
        return False, "Could not reach Slack. Try again later."


async def send_slack_test(user_id: str) -> tuple[bool, str]:
    return await _post_webhook(user_id, "✅ Rohence Flow test notification — your Slack workspace is connected.")


async def send_hot_reply_alert(user_id: str, label: str, contact_name: str, company: str,
                               snippet: str, campaign_name: str) -> None:
    if label not in {"interested", "meeting_booked"}:
        return
    title = "🎯 New interested reply" if label == "interested" else "📅 Meeting booked"
    details = [f"*{title}*", f"*Prospect:* {contact_name or 'Unknown'}"]
    if company:
        details.append(f"*Company:* {company}")
    if campaign_name:
        details.append(f"*Campaign:* {campaign_name}")
    details.append(f"*Reply:* {snippet[:500]}")
    ok, message = await _post_webhook(user_id, "\\n".join(details))
    if not ok:
        log.info("Slack alert skipped for user %s: %s", user_id, message)
