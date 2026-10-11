import asyncio

from fastapi import APIRouter, Depends, HTTPException

from lib import mailer
from lib.auth import current_user
from lib.db import db
from lib.util import new_id, now, start_of_today, warmup_info
from models.schemas import ConnectionTestOut, SenderIn, SenderOut, SenderUpdate

router = APIRouter(prefix="/senders", tags=["senders"])


async def _out(s: dict) -> SenderOut:
    sent_today = await db.messages.count_documents({"sender_id": s["id"], "sent_at": {"$gte": start_of_today()}})
    sent_total = await db.messages.count_documents({"sender_id": s["id"]})
    replies = await db.threads.count_documents({"sender_id": s["id"]})
    effective, day = warmup_info(s)
    return SenderOut(**{k: v for k, v in s.items() if k in SenderOut.model_fields and k not in ("effective_limit", "warmup_day")},
                     sent_today=sent_today, sent_total=sent_total, reply_count=replies,
                     effective_limit=effective, warmup_day=day)


async def _get(user: dict, sid: str) -> dict:
    s = await db.senders.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Sender not found")
    return s


@router.get("", response_model=list[SenderOut])
async def list_senders(user: dict = Depends(current_user)):
    docs = await db.senders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [await _out(s) for s in docs]


@router.post("/test", response_model=ConnectionTestOut)
async def test_new(body: SenderIn, user: dict = Depends(current_user)):
    return ConnectionTestOut(**await asyncio.to_thread(mailer.test_connection, body.model_dump()))


@router.post("", response_model=SenderOut)
async def create_sender(body: SenderIn, user: dict = Depends(current_user)):
    email = body.email.lower()
    if await db.senders.find_one({"user_id": user["id"], "email": email}):
        raise HTTPException(status_code=409, detail="This sender is already connected")
    doc = body.model_dump()
    doc.update(id=new_id(), user_id=user["id"], email=email, status="active", last_error="",
               last_uid=0, last_synced_at=None, created_at=now(), warmup_started_at=now())
    if not doc["imap_user"]:
        doc["imap_user"] = doc["smtp_user"]
    if not doc["imap_pass"]:
        doc["imap_pass"] = doc["smtp_pass"]
    await db.senders.insert_one(doc)
    return await _out(doc)


@router.patch("/{sid}", response_model=SenderOut)
async def update_sender(sid: str, body: SenderUpdate, user: dict = Depends(current_user)):
    s = await _get(user, sid)
    upd = body.model_dump(exclude_none=True)
    if s["status"] == "demo":
        upd.pop("status", None)
    if upd.get("status") == "active":
        upd["last_error"] = ""
    if upd.get("warmup_enabled") and not s.get("warmup_enabled"):
        upd["warmup_started_at"] = now()  # restart the ramp from day 1
    if upd:
        await db.senders.update_one({"id": sid}, {"$set": upd})
    return await _out(await _get(user, sid))


@router.post("/{sid}/test", response_model=ConnectionTestOut)
async def test_existing(sid: str, user: dict = Depends(current_user)):
    s = await _get(user, sid)
    if s["status"] == "demo":
        return ConnectionTestOut(smtp_ok=True, imap_ok=True, smtp_error="Demo account (simulated)")
    res = await asyncio.to_thread(mailer.test_connection, s)
    if res["smtp_ok"] and s["status"] == "error":
        await db.senders.update_one({"id": sid}, {"$set": {"status": "active", "last_error": ""}})
    return ConnectionTestOut(**res)


@router.delete("/{sid}")
async def delete_sender(sid: str, user: dict = Depends(current_user)):
    await _get(user, sid)
    await db.senders.delete_one({"id": sid})
    await db.campaigns.update_many({"user_id": user["id"]}, {"$pull": {"sender_ids": sid}})
    return {"ok": True}
