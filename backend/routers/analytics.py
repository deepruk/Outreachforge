import base64
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from lib.auth import current_user
from lib.db import db
from lib.engine import unsubscribe_message
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


UNSUB_PAGE = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed</title></head><body style="margin:0;background:#0B0F17;font-family:Arial,sans-serif;color:#F8FAFC;
display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="max-width:420px;padding:40px;
border:1px solid #1E293B;border-radius:14px;background:#111827;text-align:center"><div style="font-size:34px">&#10003;</div>
<h1 style="font-size:22px;margin:12px 0 8px">{title}</h1><p style="color:#94A3B8;line-height:1.5;margin:0">{body}</p></div></body></html>"""


@router.get("/u/{mid}", response_class=HTMLResponse)
async def unsubscribe_get(mid: str):
    ok = await unsubscribe_message(mid)
    if not ok:
        return HTMLResponse(UNSUB_PAGE.format(title="Link expired", body="This unsubscribe link is no longer valid."), status_code=404)
    return HTMLResponse(UNSUB_PAGE.format(title="You're unsubscribed", body="You won't receive any more emails from this sender."))


@router.post("/u/{mid}")
async def unsubscribe_post(mid: str):
    """RFC 8058 one-click (List-Unsubscribe-Post) from mail clients."""
    await unsubscribe_message(mid)
    return {"ok": True}
