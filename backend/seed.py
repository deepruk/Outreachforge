"""Idempotent demo seed: python seed.py — resets the demo account's workspace."""
import asyncio
import random
from datetime import timedelta

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from lib.util import new_id, now

DEMO_EMAIL = "demo@outreachforge.io"
DEMO_PASSWORD = "Demo@1234"

FIRST = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas", "Mia", "Aiden",
         "Priya", "Arjun", "Chloe", "Daniel", "Zara", "Ryan", "Nina", "Omar", "Grace", "Leo", "Hannah", "Kai"]
LAST = ["Carter", "Nguyen", "Patel", "Brooks", "Kim", "Silva", "Hughes", "Reyes", "Bennett", "Shah", "Foster", "Ward"]
COMPANIES = ["Northwind", "Brightlane", "Quantive", "Lumen Labs", "Stackwise", "Peakflow", "Orbitly", "Fernhill",
             "Cobalt AI", "Helix Commerce", "Vantage HQ", "Tidal Systems", "Pinecrest", "Arcadia Health", "Nimbus Pay"]
TITLES = ["CEO", "Founder", "VP Sales", "Head of Growth", "CTO", "Marketing Director", "COO"]

REPLIES = [
    ("interested", "Hey, thanks for reaching out — this is actually timely. We're reviewing our outbound stack this quarter. Can you send over pricing and a couple of case studies?"),
    ("interested", "Sounds interesting. What does onboarding look like and how long until we'd see results?"),
    ("meeting_booked", "Sure, let's talk. Thursday at 2pm EST works for me — send an invite to this address."),
    ("meeting_booked", "Booked a slot on your calendar for Tuesday. Looking forward to it."),
    ("not_interested", "Thanks, but we're not looking at this right now. Please remove me from your list."),
    ("not_interested", "We already have a vendor for this and are happy with them. Not interested."),
    ("out_of_office", "I'm out of the office until Monday with limited access to email. I'll respond when I'm back."),
    ("none", "Who else at your company is using this? Curious how it compares to what we've got."),
    ("wrong_person", "I'm not the right person for this — try reaching out to our Head of Sales, Jamie."),
]

CAMPAIGNS = [
    ("Q3 SaaS Founders Outreach", "active", 70, 13),
    ("Agency Partnerships", "paused", 45, 10),
    ("Series A CTOs — Infra", "completed", 55, 14),
    ("E-commerce Brands Holiday", "draft", 25, 0),
]

STEPS = [
    {"subject": "{{first_name}}, quick idea for {{company}}", "delay_days": 0,
     "body": "Hi {{first_name}},\n\nI was looking at {{company}} and noticed you're scaling the team. We help companies like yours book 20+ qualified meetings a month without hiring more SDRs.\n\nHere's a 2-minute breakdown: https://outreachforge.io/case-study\n\nWorth a quick chat next week?\n\nBest,\nAlex"},
    {"subject": "", "delay_days": 3,
     "body": "Hi {{first_name}}, just floating this back to the top of your inbox. Would a 15-minute call make sense?\n\nAlex"},
    {"subject": "", "delay_days": 4,
     "body": "{{first_name}} — last note from me. If outbound isn't a priority for {{company}} right now, no worries at all. If it is, happy to share what's working for teams like yours.\n\nAlex"},
]


async def main() -> None:
    await ensure_indexes()
    user = await db.users.find_one({"email": DEMO_EMAIL})
    if user:
        uid = user["id"]
        for coll in ("senders", "campaigns", "leads", "messages", "threads", "thread_messages"):
            await db[coll].delete_many({"user_id": uid})
        await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(DEMO_PASSWORD)}})
    else:
        uid = new_id()
        await db.users.insert_one({"id": uid, "name": "Alex Morgan", "email": DEMO_EMAIL,
                                   "password_hash": hash_password(DEMO_PASSWORD), "created_at": now() - timedelta(days=30)})
    rnd = random.Random(42)
    senders = []
    for i, (email, name) in enumerate([("alex@getoutreachforge.com", "Alex Morgan"), ("alex.m@tryoutreachforge.com", "Alex Morgan"),
                                      ("sam@outreachforgehq.com", "Sam Rivera")]):
        s = {"id": new_id(), "user_id": uid, "email": email, "from_name": name, "smtp_host": "smtp.demo.local",
             "smtp_port": 587, "smtp_security": "starttls", "smtp_user": email, "smtp_pass": "demo",
             "imap_host": "", "imap_port": 993, "imap_user": email, "imap_pass": "demo", "daily_limit": [50, 40, 30][i],
             "status": "demo", "last_error": "", "last_uid": 0, "last_synced_at": None,
             "created_at": now() - timedelta(days=28 - i)}
        senders.append(s)
    await db.senders.insert_many(senders)

    n = now()
    for name, status, n_leads, spread in CAMPAIGNS:
        cid = new_id()
        await db.campaigns.insert_one({
            "id": cid, "user_id": uid, "name": name, "status": status,
            "steps": [{**s, "id": new_id()} for s in STEPS], "sender_ids": [s["id"] for s in senders],
            "daily_limit": 120, "track_opens": True, "track_clicks": True, "stop_on_reply": True,
            "send_start_hour": 0, "send_end_hour": 24, "created_at": n - timedelta(days=spread + 2),
            "launched_at": (n - timedelta(days=spread)) if status != "draft" else None,
        })
        leads, messages, threads, tmsgs = [], [], [], []
        for i in range(n_leads):
            fn, ln, co = rnd.choice(FIRST), rnd.choice(LAST), rnd.choice(COMPANIES)
            email = f"{fn.lower()}.{ln.lower()}{i}@{co.lower().replace(' ', '')}.com"
            lead = {"id": new_id(), "user_id": uid, "campaign_id": cid, "email": email, "first_name": fn,
                    "last_name": ln, "company": co, "title": rnd.choice(TITLES), "status": "pending",
                    "current_step": 0, "sender_id": None, "next_send_at": None, "last_sent_at": None,
                    "created_at": n - timedelta(days=spread + 1)}
            leads.append(lead)
            if status == "draft":
                continue
            sender = senders[i % len(senders)]
            lead["sender_id"] = sender["id"]
            t0 = n - timedelta(days=rnd.uniform(1, spread), hours=rnd.uniform(0, 8))
            n_steps = 3 if status == "completed" else rnd.choice([1, 2, 2, 3])
            replied = bounced = False
            first_subject = ""
            t = t0
            sent = 0
            for si in range(n_steps):
                if si > 0:
                    t = t + timedelta(days=STEPS[si]["delay_days"])
                    if t > n:
                        break
                subject = (STEPS[si]["subject"] or "").replace("{{first_name}}", fn).replace("{{company}}", co) or f"Re: {first_subject}"
                first_subject = first_subject or subject
                body = STEPS[si]["body"].replace("{{first_name}}", fn).replace("{{company}}", co)
                opened = rnd.random() < 0.34
                clicked = opened and rnd.random() < 0.2
                bounce = si == 0 and rnd.random() < 0.025
                rep = (not bounce) and rnd.random() < 0.075
                m = {"id": new_id(), "user_id": uid, "campaign_id": cid, "lead_id": lead["id"], "sender_id": sender["id"],
                     "step_index": si, "to_email": email, "subject": subject, "body": body,
                     "message_id_header": f"<{new_id()}@{sender['email'].split('@')[1]}>", "sent_at": t,
                     "opened_at": min(t + timedelta(hours=rnd.uniform(0.2, 20)), n) if opened else None,
                     "open_count": rnd.randint(1, 4) if opened else 0,
                     "clicked_at": min(t + timedelta(hours=rnd.uniform(0.5, 22)), n) if clicked else None,
                     "click_count": 1 if clicked else 0,
                     "replied_at": min(t + timedelta(hours=rnd.uniform(1, 30)), n) if rep else None, "bounced": bounce}
                messages.append(m)
                sent += 1
                if bounce:
                    bounced = True
                    break
                if rep:
                    replied = True
                    label, text = rnd.choice(REPLIES)
                    tid = new_id()
                    threads.append({"id": tid, "user_id": uid, "lead_id": lead["id"], "campaign_id": cid,
                                    "sender_id": sender["id"], "contact_email": email, "contact_name": f"{fn} {ln}",
                                    "company": co, "subject": f"Re: {first_subject}", "snippet": text[:160],
                                    "last_at": m["replied_at"], "unread": rnd.random() < 0.5, "label": label})
                    tmsgs.append({"id": new_id(), "user_id": uid, "thread_id": tid, "direction": "in", "from_email": email,
                                  "to_email": sender["email"], "subject": f"Re: {first_subject}", "body": text,
                                  "at": m["replied_at"], "message_id": f"<{new_id()}@{co.lower().replace(' ', '')}.com>", "kind": "reply"})
                    break
            lead["current_step"] = sent
            lead["last_sent_at"] = t if sent else None
            if bounced:
                lead["status"] = "bounced"
            elif replied:
                lead["status"] = "replied"
            elif sent >= len(STEPS) or status == "completed":
                lead["status"] = "completed"
            elif status == "active":
                # keep the active campaign quietly idle until real follow-ups are due
                lead["status"] = "in_progress"
                lead["next_send_at"] = t + timedelta(days=STEPS[sent]["delay_days"] + 2)
            else:
                lead["status"] = "in_progress"
                lead["next_send_at"] = t + timedelta(days=STEPS[sent]["delay_days"])
        await db.leads.insert_many(leads)
        if messages:
            await db.messages.insert_many(messages)
        if threads:
            await db.threads.insert_many(threads)
            await db.thread_messages.insert_many(tmsgs)
    print(f"Seeded demo workspace for {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
