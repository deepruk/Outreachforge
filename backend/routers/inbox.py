from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from lib import mailer
from lib.auth import current_user
from lib.db import db
from lib.engine import base_url, deliver, sync_user
from lib.util import new_id, now
from models.schemas import (
    InboxCounts, ReplyIn, SyncResult, ThreadDetail, ThreadMessage, ThreadOut, ThreadUpdate,
)

router = APIRouter(prefix="/inbox", tags=["inbox"])


async def _enrich(threads: list[dict]) -> list[ThreadOut]:
    cids = list({t["campaign_id"] for t in threads})
    sids = list({t["sender_id"] for t in threads})
    cnames = {c["id"]: c["name"] for c in await db.campaigns.find({"id": {"$in": cids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)}
    semails = {s["id"]: s["email"] for s in await db.senders.find({"id": {"$in": sids}}, {"_id": 0, "id": 1, "email": 1}).to_list(1000)}
    return [ThreadOut(**{k: v for k, v in t.items() if k in ThreadOut.model_fields},
                      campaign_name=cnames.get(t["campaign_id"], ""), sender_email=semails.get(t["sender_id"], ""))
            for t in threads]


async def _get(user: dict, tid: str) -> dict:
    t = await db.threads.find_one({"id": tid, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return t


@router.get("/threads", response_model=list[ThreadOut])
async def list_threads(label: Optional[str] = None, q: str = "", campaign_id: Optional[str] = None,
                       limit: int = Query(200, ge=1, le=1000), user: dict = Depends(current_user)):
    flt: dict = {"user_id": user["id"]}
    if label == "unread":
        flt["unread"] = True
    elif label and label != "all":
        flt["label"] = label
    if campaign_id:
        flt["campaign_id"] = campaign_id
    if q:
        flt["$or"] = [{f: {"$regex": q, "$options": "i"}} for f in ("contact_email", "contact_name", "company", "subject", "snippet")]
    docs = await db.threads.find(flt, {"_id": 0}).sort("last_at", -1).to_list(limit)
    return await _enrich(docs)


@router.get("/counts", response_model=InboxCounts)
async def counts(user: dict = Depends(current_user)):
    out = InboxCounts(all=await db.threads.count_documents({"user_id": user["id"]}),
                      unread=await db.threads.count_documents({"user_id": user["id"], "unread": True}))
    async for row in db.threads.aggregate([{"$match": {"user_id": user["id"]}}, {"$group": {"_id": "$label", "n": {"$sum": 1}}}]):
        if row["_id"] in InboxCounts.model_fields:
            setattr(out, row["_id"], row["n"])
    return out


@router.get("/threads/{tid}", response_model=ThreadDetail)
async def get_thread(tid: str, user: dict = Depends(current_user)):
    t = await _get(user, tid)
    sender = await db.senders.find_one({"id": t["sender_id"]}, {"_id": 0, "email": 1}) or {"email": ""}
    msgs: list[ThreadMessage] = []
    async for m in db.messages.find({"lead_id": t["lead_id"]}, {"_id": 0}):
        msgs.append(ThreadMessage(id=m["id"], direction="out", from_email=sender["email"], to_email=m["to_email"],
                                  subject=m["subject"], body=m.get("body", ""), at=m["sent_at"], kind="campaign"))
    async for m in db.thread_messages.find({"thread_id": tid}, {"_id": 0}):
        msgs.append(ThreadMessage(**{k: v for k, v in m.items() if k in ThreadMessage.model_fields}))
    msgs.sort(key=lambda m: m.at)
    if t.get("unread"):
        await db.threads.update_one({"id": tid}, {"$set": {"unread": False}})
        t["unread"] = False
    return ThreadDetail(thread=(await _enrich([t]))[0], messages=msgs)


@router.patch("/threads/{tid}", response_model=ThreadOut)
async def update_thread(tid: str, body: ThreadUpdate, user: dict = Depends(current_user)):
    await _get(user, tid)
    upd = body.model_dump(exclude_none=True)
    if upd:
        await db.threads.update_one({"id": tid}, {"$set": upd})
    return (await _enrich([await _get(user, tid)]))[0]


@router.post("/threads/{tid}/reply", response_model=ThreadMessage)
async def reply(tid: str, body: ReplyIn, user: dict = Depends(current_user)):
    t = await _get(user, tid)
    sender = await db.senders.find_one({"id": t["sender_id"], "user_id": user["id"]}, {"_id": 0})
    if not sender:
        raise HTTPException(status_code=400, detail="The sender account for this conversation was removed")
    last_in = await db.thread_messages.find({"thread_id": tid, "direction": "in"}, {"_id": 0}).sort("at", -1).to_list(1)
    subject = t["subject"] if t["subject"].lower().startswith("re:") else f"Re: {t['subject']}"
    html = mailer.build_html(body.body, new_id(), base_url(), False, False)
    try:
        mid = await deliver(sender, t["contact_email"], subject, html, body.body,
                            last_in[0].get("message_id") if last_in else None)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not send: {str(e)[:200]}")
    msg = {"id": new_id(), "user_id": user["id"], "thread_id": tid, "direction": "out",
           "from_email": sender["email"], "to_email": t["contact_email"], "subject": subject,
           "body": body.body, "at": now(), "message_id": mid, "kind": "manual"}
    await db.thread_messages.insert_one(msg)
    await db.threads.update_one({"id": tid}, {"$set": {"last_at": msg["at"], "snippet": "You: " + " ".join(body.body.split())[:150]}})
    return ThreadMessage(**{k: v for k, v in msg.items() if k in ThreadMessage.model_fields})


@router.post("/sync", response_model=SyncResult)
async def sync(user: dict = Depends(current_user)):
    n, errors = await sync_user(user["id"])
    return SyncResult(new_replies=n, errors=errors)
