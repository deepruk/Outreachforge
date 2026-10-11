"""Background workers: campaign sender + IMAP reply sync."""
import asyncio
import logging
import os
import re
from datetime import timedelta

from lib import mailer
from lib.db import db
from lib.util import new_id, now, start_of_today

log = logging.getLogger("engine")
OOO_RE = re.compile(r"out of (the )?office|automatic reply|auto(-| )?reply|on vacation|on leave", re.I)
BOUNCE_FROM = ("mailer-daemon", "postmaster")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def base_url() -> str:
    return os.environ.get("PUBLIC_BASE_URL", os.environ.get("APP_URL", "")).rstrip("/")


async def sent_today(sender_id: str) -> int:
    return await db.messages.count_documents({"sender_id": sender_id, "sent_at": {"$gte": start_of_today()}})


async def deliver(sender: dict, to: str, subject: str, html: str, text: str, in_reply_to: str | None) -> str:
    """Real SMTP for real senders; demo senders simulate delivery."""
    if sender.get("status") == "demo":
        return f"<{new_id()}@{sender['email'].split('@')[-1]}>"
    return await asyncio.to_thread(mailer.send_email, sender, to, subject, html, text, in_reply_to)


async def process_campaign(c: dict) -> None:
    n = now()
    hour = n.hour
    if not (c.get("send_start_hour", 0) <= hour < c.get("send_end_hour", 24)):
        return
    steps = c.get("steps") or []
    if not steps:
        return
    camp_today = await db.messages.count_documents({"campaign_id": c["id"], "sent_at": {"$gte": start_of_today()}})
    budget = c.get("daily_limit", 50) - camp_today
    if budget <= 0:
        return
    senders = await db.senders.find({"id": {"$in": c.get("sender_ids", [])}, "status": {"$in": ["active", "demo"]}}, {"_id": 0}).to_list(100)
    if not senders:
        return
    capacity = {s["id"]: s["daily_limit"] - await sent_today(s["id"]) for s in senders}
    leads = await db.leads.find(
        {"campaign_id": c["id"], "status": {"$in": ["pending", "in_progress"]}, "next_send_at": {"$lte": n}},
        {"_id": 0},
    ).sort("next_send_at", 1).to_list(min(budget, 25))
    for lead in leads:
        avail = [s for s in senders if capacity.get(s["id"], 0) > 0]
        if not avail:
            break
        idx = lead.get("current_step", 0)
        if idx >= len(steps):
            await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "completed"}})
            continue
        # keep one sender per lead so follow-ups thread correctly
        sender = next((s for s in avail if s["id"] == lead.get("sender_id")), None) if lead.get("sender_id") else None
        if lead.get("sender_id") and sender is None:
            if any(s["id"] == lead["sender_id"] for s in senders):
                continue  # assigned sender is out of quota today
            sender = max(avail, key=lambda s: capacity[s["id"]])
        sender = sender or max(avail, key=lambda s: capacity[s["id"]])
        step = steps[idx]
        first = await db.messages.find_one({"lead_id": lead["id"], "step_index": 0}, {"_id": 0})
        subject = mailer.render_vars(step.get("subject") or "", lead)
        if not subject.strip():
            subject = "Re: " + (first["subject"] if first else "Quick question")
        body = mailer.render_vars(step.get("body") or "", lead)
        mid = new_id()
        html = mailer.build_html(body, mid, base_url(), c.get("track_opens", True), c.get("track_clicks", True))
        try:
            header_id = await deliver(sender, lead["email"], subject, html, body, first["message_id_header"] if first else None)
        except Exception as e:  # noqa: BLE001
            err = str(e)[:300]
            log.warning("send failed %s -> %s: %s", sender["email"], lead["email"], err)
            if "recipient" in err.lower() or "550" in err or "553" in err:
                await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "bounced"}})
            else:
                await db.senders.update_one({"id": sender["id"]}, {"$set": {"status": "error", "last_error": err}})
                senders = [s for s in senders if s["id"] != sender["id"]]
            continue
        await db.messages.insert_one({
            "id": mid, "user_id": c["user_id"], "campaign_id": c["id"], "lead_id": lead["id"],
            "sender_id": sender["id"], "step_index": idx, "to_email": lead["email"], "subject": subject,
            "body": body, "message_id_header": header_id, "sent_at": now(), "opened_at": None,
            "open_count": 0, "clicked_at": None, "click_count": 0, "replied_at": None, "bounced": False,
        })
        capacity[sender["id"]] -= 1
        nxt = idx + 1
        upd: dict = {"current_step": nxt, "last_sent_at": now(), "sender_id": sender["id"]}
        if nxt >= len(steps):
            upd.update(status="completed", next_send_at=None)
        else:
            upd.update(status="in_progress", next_send_at=now() + timedelta(days=steps[nxt].get("delay_days", 1)))
        await db.leads.update_one({"id": lead["id"]}, {"$set": upd})
    remaining = await db.leads.count_documents({"campaign_id": c["id"], "status": {"$in": ["pending", "in_progress"]}})
    if remaining == 0:
        await db.campaigns.update_one({"id": c["id"]}, {"$set": {"status": "completed"}})


async def send_tick() -> None:
    async for c in db.campaigns.find({"status": "active"}, {"_id": 0}):
        try:
            await process_campaign(c)
        except Exception:  # noqa: BLE001
            log.exception("campaign %s failed", c.get("id"))


async def record_reply(user_id: str, lead: dict, sender_id: str, subject: str, body: str,
                       message_id: str, from_email: str, to_email: str) -> bool:
    if message_id and await db.thread_messages.find_one({"message_id": message_id, "user_id": user_id}):
        return False
    at = now()
    snippet = " ".join(body.split())[:160]
    label = "out_of_office" if OOO_RE.search(subject + " " + body[:400]) else None
    thread = await db.threads.find_one({"user_id": user_id, "lead_id": lead["id"]}, {"_id": 0})
    if thread:
        upd = {"snippet": snippet, "last_at": at, "unread": True}
        if label and thread.get("label") == "none":
            upd["label"] = label
        await db.threads.update_one({"id": thread["id"]}, {"$set": upd})
        tid = thread["id"]
    else:
        tid = new_id()
        await db.threads.insert_one({
            "id": tid, "user_id": user_id, "lead_id": lead["id"], "campaign_id": lead["campaign_id"],
            "sender_id": sender_id, "contact_email": lead["email"],
            "contact_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}".strip() or lead["email"],
            "company": lead.get("company", ""), "subject": subject, "snippet": snippet, "last_at": at,
            "unread": True, "label": label or "none",
        })
    await db.thread_messages.insert_one({
        "id": new_id(), "user_id": user_id, "thread_id": tid, "direction": "in", "from_email": from_email,
        "to_email": to_email, "subject": subject, "body": body, "at": at, "message_id": message_id, "kind": "reply",
    })
    camp = await db.campaigns.find_one({"id": lead["campaign_id"]}, {"_id": 0, "stop_on_reply": 1})
    if label != "out_of_office" and (camp or {}).get("stop_on_reply", True):
        await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "replied", "next_send_at": None}})
    last = await db.messages.find({"lead_id": lead["id"]}, {"_id": 0, "id": 1, "replied_at": 1}).sort("sent_at", -1).to_list(1)
    if last and not last[0].get("replied_at") and label != "out_of_office":
        await db.messages.update_one({"id": last[0]["id"]}, {"$set": {"replied_at": at}})
    return True


async def sync_sender(sender: dict) -> int:
    msgs, max_uid = await asyncio.to_thread(mailer.fetch_new, sender, int(sender.get("last_uid") or 0))
    uid = sender["user_id"]
    count = 0
    for m in msgs:
        if m["from_email"] == sender["email"].lower():
            continue
        if any(b in m["from_email"] for b in BOUNCE_FROM):
            for addr in set(EMAIL_RE.findall(m["body"])):
                lead = await db.leads.find_one({"user_id": uid, "email": addr.lower(), "status": {"$in": ["in_progress", "completed"]}}, {"_id": 0})
                if lead:
                    await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "bounced", "next_send_at": None}})
                    await db.messages.update_many({"lead_id": lead["id"]}, {"$set": {"bounced": True}})
            continue
        lead = None
        refs = [r for r in (m["in_reply_to"] + " " + m["references"]).split() if r]
        if refs:
            orig = await db.messages.find_one({"user_id": uid, "message_id_header": {"$in": refs}}, {"_id": 0, "lead_id": 1})
            if orig:
                lead = await db.leads.find_one({"id": orig["lead_id"]}, {"_id": 0})
        if not lead:
            lead = await db.leads.find_one({"user_id": uid, "email": m["from_email"], "current_step": {"$gt": 0}}, {"_id": 0}, sort=[("last_sent_at", -1)])
        if not lead:
            continue
        body = mailer.strip_quoted(m["body"])
        if await record_reply(uid, lead, sender["id"], m["subject"] or "(no subject)", body, m["message_id"], m["from_email"], sender["email"]):
            count += 1
    await db.senders.update_one({"id": sender["id"]}, {"$set": {"last_uid": max_uid, "last_synced_at": now()}})
    return count


async def sync_user(user_id: str) -> tuple[int, list[str]]:
    total, errors = 0, []
    async for s in db.senders.find({"user_id": user_id, "imap_host": {"$ne": ""}, "status": {"$in": ["active", "error"]}}, {"_id": 0}):
        try:
            total += await sync_sender(s)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{s['email']}: {str(e)[:200]}")
    return total, errors


async def sync_tick() -> None:
    async for s in db.senders.find({"imap_host": {"$ne": ""}, "status": "active"}, {"_id": 0}):
        try:
            await sync_sender(s)
        except Exception as e:  # noqa: BLE001
            log.warning("imap sync %s: %s", s.get("email"), e)


async def run_forever() -> None:
    i = 0
    while True:
        try:
            await send_tick()
            if i % 4 == 0:
                await sync_tick()
        except Exception:  # noqa: BLE001
            log.exception("engine tick failed")
        i += 1
        await asyncio.sleep(30)
