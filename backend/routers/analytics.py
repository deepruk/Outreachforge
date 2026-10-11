import base64
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from lib.auth import current_user
from lib.db import db
from lib.engine import unsubscribe_message
from lib.stats import PROJ, build_series, campaign_totals, totals_from
from lib.util import days_ago, now
from models.schemas import AnalyticsOut, CampaignRow, StatTotals

router = APIRouter(tags=["analytics"])

# Fresh transparent 1x1 GIF used by the email open-tracking endpoint.
PIXEL = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")

# Heuristic only: ignore clearly identified security scanners/crawlers. Mail privacy
# proxies can still make some automated requests indistinguishable from real opens.
AUTOMATED_OPEN_UA = (
    "bot", "crawler", "spider", "scanner", "proofpoint", "mimecast",
    "barracuda", "urlscan", "fireeye", "fortinet", "safelinks",
    "email security", "security gateway",
)


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
async def track_open(mid: str, request: Request):
    """Record first and repeat opens, filtering obvious security scanners."""
    user_agent = request.headers.get("user-agent", "").lower()
    if any(marker in user_agent for marker in AUTOMATED_OPEN_UA):
        return Response(content=PIXEL, media_type="image/gif", headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache"
        })
    m = await db.messages.find_one(
        {"id": mid}, {"_id": 0, "lead_id": 1, "campaign_id": 1}
    )
    if m is not None:
        at = now()
        first = await db.messages.update_one(
            {"id": mid, "$or": [{"opened_at": {"$exists": False}}, {"opened_at": None}]},
            {"$set": {"opened_at": at}},
        )
        await db.messages.update_one(
            {"id": mid}, {"$inc": {"open_count": 1}, "$set": {"last_opened_at": at}}
        )
        if first.modified_count == 1:
            await db.leads.update_one({"id": m["lead_id"]}, {"$set": {"opened_at": at}})
            await db.campaigns.update_one(
                {"id": m["campaign_id"]}, {"$inc": {"total_opens": 1, "unique_opens": 1}}
            )
    return Response(content=PIXEL, media_type="image/gif", headers={
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "Pragma": "no-cache"
    })


@router.get("/t/c/{mid}")
async def track_click(mid: str, u: str = ""):
    """Count first and repeat clicks, then redirect only to HTTP(S) destinations."""
    url = unquote(u)
    if not url.startswith(("http://", "https://")):
        return RedirectResponse("https://www.google.com", status_code=302)
    m = await db.messages.find_one(
        {"id": mid}, {"_id": 0, "lead_id": 1, "campaign_id": 1}
    )
    if m is not None:
        at = now()
        first = await db.messages.update_one(
            {"id": mid, "$or": [{"clicked_at": {"$exists": False}}, {"clicked_at": None}]},
            {"$set": {"clicked_at": at}},
        )
        await db.messages.update_one(
            {"id": mid}, {"$inc": {"click_count": 1}, "$set": {"last_clicked_at": at}}
        )
        if first.modified_count == 1:
            await db.leads.update_one({"id": m["lead_id"]}, {"$set": {"clicked_at": at}})
            await db.campaigns.update_one(
                {"id": m["campaign_id"]}, {"$inc": {"total_clicks": 1, "unique_clicks": 1}}
            )
    return RedirectResponse(url, status_code=302)



@router.get("/t/debug/{mid}")
async def tracking_debug(mid: str, user: dict = Depends(current_user)):
    """Authenticated diagnostic for one of the current user's messages."""
    row = await db.messages.find_one(
        {"id": mid, "user_id": user["id"]},
        {"_id": 0, "id": 1, "campaign_id": 1, "lead_id": 1, "opened_at": 1,
         "open_count": 1, "last_opened_at": 1, "clicked_at": 1, "click_count": 1, "last_clicked_at": 1,
         "replied_at": 1},
    )
    if not row:
        return {"ok": False, "detail": "Message not found"}
    return {"ok": True, "message": row}


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
