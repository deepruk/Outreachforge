"""Google Gmail API transport for OAuth-connected sender accounts.

Refresh tokens are Fernet-encrypted at rest. Access tokens are fetched on demand and
never persisted or returned to the browser.
"""
import base64
import email
import os
import random
import time
from email.header import decode_header, make_header
from email.utils import parseaddr

import requests
from cryptography.fernet import Fernet, InvalidToken

TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"


def _fernet() -> Fernet:
    key = os.environ.get("GOOGLE_TOKEN_ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("Google OAuth is not configured: GOOGLE_TOKEN_ENCRYPTION_KEY is missing")
    try:
        return Fernet(key.encode("ascii"))
    except Exception as exc:
        raise RuntimeError("GOOGLE_TOKEN_ENCRYPTION_KEY must be a valid Fernet key") from exc


def encrypt_refresh_token(token: str) -> str:
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_refresh_token(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise RuntimeError("Stored Google authorization is unreadable; reconnect this Gmail account") from exc


def access_token(sender: dict) -> str:
    refresh_token = decrypt_refresh_token(sender.get("google_refresh_token_enc", ""))
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise RuntimeError("Google OAuth is not configured on the backend")
    try:
        response = requests.post(
            TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=20,
        )
        data = response.json()
    except requests.RequestException as exc:
        raise RuntimeError("Could not reach Google to refresh the Gmail connection") from exc
    if response.status_code != 200 or not data.get("access_token"):
        error = data.get("error", "token_refresh_failed")
        if error in ("invalid_grant", "invalid_client"):
            raise RuntimeError("Google authorization expired or was revoked; reconnect this Gmail account")
        raise RuntimeError("Google could not refresh the Gmail authorization")
    return data["access_token"]


def _request(method: str, path: str, sender: dict, *, bearer_token: str | None = None, **kwargs) -> requests.Response:
    token = bearer_token or access_token(sender)
    headers = dict(kwargs.pop("headers", {}) or {})
    headers["Authorization"] = f"Bearer {token}"
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            response = requests.request(
                method, f"{GMAIL_API}{path}", headers=headers, timeout=25, **kwargs
            )
        except requests.RequestException as exc:
            if attempt + 1 >= max_attempts:
                raise RuntimeError("Could not reach the Gmail API after retries") from exc
            time.sleep(min(2 ** attempt + random.random(), 30))
            continue

        if response.status_code == 401:
            raise RuntimeError("Google authorization was rejected; reconnect this Gmail account")
        if response.status_code >= 400:
            try:
                payload = response.json()
                error = payload.get("error") or {}
                details = error.get("errors") or []
                reason = next((str(item.get("reason")) for item in details if item.get("reason")), "")
                message = str(error.get("message") or "")
            except (ValueError, AttributeError):
                reason, message = "", ""

            retryable = (
                response.status_code in (429, 500, 502, 503, 504)
                or reason in ("rateLimitExceeded", "userRateLimitExceeded", "backendError")
            )
            if retryable and attempt + 1 < max_attempts:
                retry_after = response.headers.get("Retry-After", "")
                try:
                    delay = max(0.0, float(retry_after))
                except (TypeError, ValueError):
                    delay = min(2 ** attempt + random.random(), 30)
                time.sleep(min(delay, 60))
                continue

            parts = [f"Gmail API request failed (HTTP {response.status_code})"]
            if reason:
                parts.append(f"reason={reason}")
            if message:
                parts.append(f"message={message[:240]}")
            raise RuntimeError("; ".join(parts))
        return response

    raise RuntimeError("Gmail API request failed after retries")


def test_connection(sender: dict) -> dict:
    _request("GET", "/profile", sender)
    return {
        "smtp_ok": True,
        "smtp_error": "",
        "imap_ok": True,
        "imap_error": "",
    }


def send_message(sender: dict, message: email.message.Message) -> str:
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")
    _request("POST", "/messages/send", sender, json={"raw": raw})
    return str(message.get("Message-ID", "")).strip()


def _decode_header(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _body_from_part(part: dict) -> str:
    mime_type = part.get("mimeType", "")
    body = part.get("body") or {}
    data = body.get("data")
    if data and mime_type == "text/plain":
        try:
            return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", "replace")
        except Exception:
            return ""
    for child in part.get("parts") or []:
        text = _body_from_part(child)
        if text:
            return text
    if data and mime_type == "text/html":
        try:
            raw = base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", "replace")
            import re
            return re.sub(r"<[^>]+>", " ", raw)
        except Exception:
            return ""
    return ""



def _text_from_message(msg: email.message.Message) -> str:
    html_fallback = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_disposition() == "attachment":
                continue
            content_type = part.get_content_type()
            if content_type not in ("text/plain", "text/html"):
                continue
            payload = part.get_payload(decode=True) or b""
            text = payload.decode(part.get_content_charset() or "utf-8", "replace")
            if content_type == "text/plain":
                return text
            if not html_fallback:
                import re
                html_fallback = re.sub(r"<[^>]+>", " ", text)
        return html_fallback
    payload = msg.get_payload(decode=True) or b""
    text = payload.decode(msg.get_content_charset() or "utf-8", "replace")
    if msg.get_content_type() == "text/html":
        import re
        return re.sub(r"<[^>]+>", " ", text)
    return text


def _record_from_raw(message: dict) -> dict | None:
    raw = message.get("raw")
    if not raw:
        return None
    try:
        msg = email.message_from_bytes(
            base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        )
    except Exception:
        return None
    return {
        "uid": int(message.get("internalDate", 0)) // 1000,
        "from_email": parseaddr(msg.get("From", ""))[1].lower(),
        "from_name": _decode_header(parseaddr(msg.get("From", ""))[0]),
        "subject": _decode_header(msg.get("Subject")),
        "message_id": (msg.get("Message-ID") or "").strip(),
        "in_reply_to": (msg.get("In-Reply-To") or "").strip(),
        "references": (msg.get("References") or "").strip(),
        "body": _text_from_message(msg),
    }


def fetch_new(sender: dict, last_cursor: int) -> tuple[list[dict], int]:
    """Fetch new Gmail inbox messages incrementally using Gmail history IDs.

    The first run imports at most 100 recent inbox messages and saves a Gmail
    history ID. Later runs fetch only messages added to the inbox since that ID.
    The returned cursor is a Gmail history ID (not a Unix timestamp).
    """
    token = access_token(sender)
    stored_history_id = str(sender.get("gmail_history_id") or "").strip()
    out: list[dict] = []

    def current_history_id() -> str:
        profile = _request("GET", "/profile", sender, bearer_token=token).json()
        value = str(profile.get("historyId") or "").strip()
        if not value.isdigit():
            raise RuntimeError("Gmail profile did not return a valid history ID")
        return value

    def fetch_message(message_id: str) -> None:
        message = _request(
            "GET", f"/messages/{message_id}", sender,
            bearer_token=token, params={"format": "raw"}
        ).json()
        # Only process messages currently in the inbox; sent mail and archived
        # messages should not be interpreted as inbound replies.
        if "INBOX" not in (message.get("labelIds") or []):
            return
        record = _record_from_raw(message)
        if record:
            out.append(record)

    if stored_history_id:
        try:
            page_token: str | None = None
            seen_ids: set[str] = set()
            latest_history_id = stored_history_id
            while True:
                params: dict = {
                    "startHistoryId": stored_history_id,
                    "historyTypes": ["messageAdded"],
                    "labelId": "INBOX",
                    "maxResults": 100,
                }
                if page_token:
                    params["pageToken"] = page_token
                data = _request("GET", "/history", sender, bearer_token=token, params=params).json()
                latest_history_id = str(data.get("historyId") or latest_history_id)
                for event in data.get("history") or []:
                    for added in event.get("messagesAdded") or []:
                        ref = added.get("message") or {}
                        message_id = str(ref.get("id") or "")
                        if message_id and message_id not in seen_ids:
                            seen_ids.add(message_id)
                            fetch_message(message_id)
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
            if not latest_history_id.isdigit():
                latest_history_id = current_history_id()
            return out, int(latest_history_id)
        except RuntimeError as exc:
            # Gmail returns 404 when a history ID has expired. Re-baseline with
            # a bounded recent scan; all subsequent runs return to incremental sync.
            if "HTTP 404" not in str(exc):
                raise

    # Initial sync or expired history ID: establish a baseline BEFORE listing
    # messages. Any messages arriving during the scan will be picked up next run.
    baseline_history_id = current_history_id()
    params = {"q": "in:inbox newer_than:14d -from:me", "maxResults": 100}
    listed = _request("GET", "/messages", sender, bearer_token=token, params=params).json()
    for ref in listed.get("messages") or []:
        message_id = str(ref.get("id") or "")
        if message_id:
            fetch_message(message_id)
    # Intentionally do not walk every page on bootstrap: that can exhaust the
    # per-user query-cost quota on a busy mailbox. New mail is captured by history.
    return out, int(baseline_history_id)
