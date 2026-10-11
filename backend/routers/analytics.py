import base64
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse, Response

from lib.auth import current_user
from lib.db import db
from lib.stats import PROJ, build_series, campaign_totals, totals_from
from lib.util import days_ago, now
from models.schemas import AnalyticsOut, CampaignRow, StatTotals

router = APIRouter(tags=["analytics"])

PIXEL = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")


@router.get("/analytics", response_model=AnalyticsOut)
async def analytics(days: int = Query(14, ge=1, le=365), user: dict = Depends(current_user)):
    since = days_ago(days)
    msgs = await db.messages.find({"user_id": user["id"], "sent_at": {"$gte": since}}, PROJ).to_list(200000)
    leads = await db.leads.count_documents({"user_id": user["id"]})
    camps = await db.campaigns.find({"user_id": user["id"]}, {"_id": 0, "id": 1, "name": 1, "status": 1}).to_list(1000)
    totals = await campaign_totals(user["id"], [c["id"] for c in camps])
    rows = []
    for c in camps:
        t = dict(totals[c["id"]])
        t.pop("_progress", None)
        rows.append(CampaignRow(id=c["id"], name=c["name"], status=c["status"], stats=StatTotals(**t)))
    rows.sort(key=lambda r: r.stats.sent, reverse=True)
    return AnalyticsOut(totals=StatTotals(**totals_from(msgs, leads)), series=build_series(msgs, days),
                        campaigns=rows, steps=[])


# ---------- public tracking endpoints (no auth: hit by recipients' mail clients) ----------
@router.get("/t/o/{mid}.gif")
async def track_open(mid: str):
    m = await db.messages.find_one({"id": mid}, {"_id": 0, "opened_at": 1})
    if m is not None:
        upd: dict = {"$inc": {"open_count": 1}}
        if not m.get("opened_at"):
            upd["$set"] = {"opened_at": now()}
        await db.messages.update_one({"id": mid}, upd)
    return Response(content=PIXEL, media_type="image/gif",
                    headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})


@router.get("/t/c/{mid}")
async def track_click(mid: str, u: str = ""):
    url = unquote(u)
    if not url.startswith(("http://", "https://")):
        url = "https://" + url.lstrip("/") if url else "https://www.google.com"
    m = await db.messages.find_one({"id": mid}, {"_id": 0, "clicked_at": 1, "opened_at": 1})
    if m is not None:
        upd: dict = {"$inc": {"click_count": 1}}
        sets = {}
        if not m.get("clicked_at"):
            sets["clicked_at"] = now()
        if not m.get("opened_at"):
            sets["opened_at"] = now()  # a click implies an open (images may be blocked)
        if sets:
            upd["$set"] = sets
        await db.messages.update_one({"id": mid}, upd)
    return RedirectResponse(url, status_code=302)
