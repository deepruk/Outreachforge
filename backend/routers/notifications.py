from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.db import db
from lib.engine import notify_hot_reply
from models.schemas import Notification, NotificationList

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
async def list_notifications(user: dict = Depends(current_user)):
    docs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(30)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return NotificationList(items=[Notification(**d) for d in docs], unread=unread)


@router.post("/read-all")
async def read_all(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/{nid}/read", response_model=Notification)
async def read_one(nid: str, user: dict = Depends(current_user)):
    res = await db.notifications.find_one_and_update(
        {"id": nid, "user_id": user["id"]}, {"$set": {"read": True}}, projection={"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="Notification not found")
    return Notification(**res)


@router.post("/test", response_model=Notification)
async def send_test(user: dict = Depends(current_user)):
    """Fire a sample hot-lead alert from the most recent interested/meeting thread."""
    t = await db.threads.find_one({"user_id": user["id"], "label": {"$in": ["interested", "meeting_booked"]}},
                                  {"_id": 0}, sort=[("last_at", -1)])
    if not t:
        raise HTTPException(status_code=404, detail="No interested or meeting-booked conversations yet")
    await notify_hot_reply(user["id"], t["id"], t["label"], t["contact_name"], t.get("company", ""), t["snippet"], t["campaign_id"])
    doc = await db.notifications.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    return Notification(**doc)
