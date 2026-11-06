import asyncio
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from lib.auth import current_user
from lib.db import db
from lib.util import now, start_of_today
from models.schemas import ActivityItem, ActivityOut, InboxSchedule, UpcomingSend

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=ActivityOut)
async def activity(campaign_id: Optional[str] = None, limit: int = Query(50, ge=1, le=200),
                   user: dict = Depends(current_user)):
    flt: dict = {"user_id": user["id"]}
    if campaign_id:
        flt["campaign_id"] = campaign_id

    # Run independent reads together so the Activity Log does not wait for each
    # collection query to finish before starting the next one.
    msgs, campaigns, senders, sent_last_hour = await asyncio.gather(
        db.messages.find(flt, {"_id": 0, "body": 0}).sort("sent_at", -1).to_list(limit),
        db.campaigns.find(
            {"user_id": user["id"]},
            {"_id": 0, "id": 1, "name": 1, "status": 1},
        ).to_list(1000),
        db.senders.find({"user_id": user["id"]}, {"_id": 0}).to_list(500),
        db.messages.count_documents({**flt, "sent_at": {"$gte": now() - timedelta(hours=1)}}),
    )

    camps = {c["id"]: c for c in campaigns}
    semail = {s["id"]: s["email"] for s in senders}
    lead_ids = list({m["lead_id"] for m in msgs})
    active = [
        c["id"] for c in campaigns
        if c.get("status") == "active" and (not campaign_id or c["id"] == campaign_id)
    ]

    # Fetch lead names, upcoming sends, and per-inbox send stats concurrently.
    today = start_of_today()
    sender_ids = [s["id"] for s in senders]
    lead_query = db.leads.find(
        {"id": {"$in": lead_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1},
    ).to_list(len(lead_ids) or 1)
    upcoming_query = db.leads.find(
        {"campaign_id": {"$in": active}, "status": {"$in": ["pending", "in_progress"]}},
        {"_id": 0},
    ).sort("next_send_at", 1).limit(10).to_list(10)
    inbox_stats_query = db.messages.aggregate([
        {"$match": {"sender_id": {"$in": sender_ids}}},
        {"$group": {
            "_id": "$sender_id",
            "last_sent_at": {"$max": "$sent_at"},
            "sent_today": {"$sum": {"$cond": [{"$gte": ["$sent_at", today]}, 1, 0]}},
        }},
    ]).to_list(len(sender_ids) or 1)

    lead_docs, upcoming_docs, inbox_stats = await asyncio.gather(
        lead_query, upcoming_query, inbox_stats_query
    )
    leads = {l["id"]: l for l in lead_docs}
    stats = {s["_id"]: s for s in inbox_stats}

    items = []
    for m in msgs:
        l = leads.get(m["lead_id"], {})
        items.append(ActivityItem(
            id=m["id"], sent_at=m["sent_at"], campaign_id=m["campaign_id"],
            campaign_name=camps.get(m["campaign_id"], {}).get("name", "—"),
            sender_email=semail.get(m["sender_id"], "removed inbox"),
            to_email=m["to_email"],
            lead_name=f"{l.get('first_name', '')} {l.get('last_name', '')}".strip(),
            subject=m["subject"], step=m.get("step_index", 0) + 1, variant=m.get("variant") or "a",
            opened=bool(m.get("opened_at") or (m.get("open_count") or 0) > 0),
            open_count=int(m.get("open_count") or 0),
            clicked=bool(m.get("clicked_at") or (m.get("click_count") or 0) > 0),
            replied=bool(m.get("replied_at")), bounced=bool(m.get("bounced")),
        ))

    current_time = now()
    inboxes = []
    for s in senders:
        stat = stats.get(s["id"], {})
        nxt = s.get("next_available_at")
        inboxes.append(InboxSchedule(
            id=s["id"], email=s["email"], status=s["status"],
            sent_today=int(stat.get("sent_today") or 0),
            effective_limit=int(s.get("daily_limit") or 0),
            last_sent_at=stat.get("last_sent_at"),
            next_available_at=nxt if nxt and nxt > current_time else None,
        ))

    upcoming = [
        UpcomingSend(
            lead_email=l["email"],
            lead_name=f"{l.get('first_name', '')} {l.get('last_name', '')}".strip(),
            campaign_id=l["campaign_id"],
            campaign_name=camps.get(l["campaign_id"], {}).get("name", "—"),
            step=l.get("current_step", 0) + 1,
            due_at=l.get("next_send_at"),
        )
        for l in upcoming_docs
    ]

    return ActivityOut(
        items=items, inboxes=inboxes, upcoming=upcoming, sent_last_hour=sent_last_hour
    )
