"""External, API-key-authenticated endpoints for AI agents and integrations.

All routes are under /api/v1. API keys are restricted to reading and drafting
campaigns; campaign launch and email sending remain available only in the app.
"""
import hashlib

from fastapi import APIRouter, HTTPException, Request

from lib.db import db
from lib.engine import zone
from lib.util import new_id, now
from models.schemas import CampaignCreate, CampaignUpdate
from lib.stats import campaign_totals, totals_from
from routers.campaigns import DEFAULT_STEPS, _out

router = APIRouter(prefix="/v1", tags=["External API"])


async def _api_user(request: Request, scope: str) -> dict:
    auth = request.headers.get("authorization", "")
    scheme, _, raw_key = auth.partition(" ")
    if scheme.lower() != "bearer" or not raw_key.startswith("rhf_live_"):
        raise HTTPException(status_code=401, detail="Provide an API key using Authorization: Bearer <key>")
    digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    key = await db.api_keys.find_one({"key_hash": digest, "revoked_at": None}, {"_id": 0})
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    if scope not in key.get("scopes", []):
        raise HTTPException(status_code=403, detail="API key does not have the required permission")
    user = await db.users.find_one({"id": key["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="API key owner no longer exists")
    await db.api_keys.update_one({"id": key["id"]}, {"$set": {"last_used_at": now()}})
    return user


async def _get_campaign(user: dict, campaign_id: str) -> dict:
    campaign = await db.campaigns.find_one(
        {"id": campaign_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/campaigns")
async def list_campaigns(request: Request):
    """List campaigns in the authenticated workspace."""
    user = await _api_user(request, "campaigns:read")
    docs = await db.campaigns.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    totals = await campaign_totals(user["id"], [c["id"] for c in docs])
    return [_out(c, totals[c["id"]]).model_dump(mode="json") for c in docs]


@router.post("/campaigns", status_code=201)
async def create_campaign(body: CampaignCreate, request: Request):
    """Create a campaign in draft status. This endpoint never launches or sends it."""
    user = await _api_user(request, "campaigns:write")
    senders = await db.senders.find(
        {"user_id": user["id"], "status": {"$in": ["active", "demo"]}},
        {"_id": 0, "id": 1},
    ).to_list(100)
    campaign = {
        "id": new_id(),
        "user_id": user["id"],
        "name": body.name.strip(),
        "status": "draft",
        "steps": [{**step, "id": new_id()} for step in DEFAULT_STEPS],
        "sender_ids": [sender["id"] for sender in senders],
        "daily_limit": 100,
        "track_opens": True,
        "track_clicks": True,
        "stop_on_reply": True,
        "include_unsubscribe": True,
        "custom_fields": [],
        "send_days": [0, 1, 2, 3, 4],
        "timezone": "UTC",
        "use_lead_timezone": False,
        "gap_min_minutes": 10,
        "gap_max_minutes": 15,
        "random_start_minutes": 30,
        "send_start_hour": 0,
        "send_end_hour": 24,
        "plain_text_only": False,
        "smart_subject": False,
        "extra_jitter_minutes": 0,
        "followup_priority": 50,
        "created_at": now(),
        "launched_at": None,
    }
    await db.campaigns.insert_one(campaign)
    return _out(campaign, totals_from([], 0)).model_dump(mode="json")


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, request: Request):
    """Get one campaign, including its email sequence and settings."""
    user = await _api_user(request, "campaigns:read")
    campaign = await _get_campaign(user, campaign_id)
    totals = (await campaign_totals(user["id"], [campaign_id]))[campaign_id]
    return _out(campaign, totals).model_dump(mode="json")


@router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignUpdate, request: Request):
    """Update campaign copy/settings. External API updates are limited to drafts."""
    user = await _api_user(request, "campaigns:write")
    campaign = await _get_campaign(user, campaign_id)
    if campaign.get("status") != "draft":
        raise HTTPException(status_code=409, detail="Only draft campaigns can be edited through the external API")
    update = body.model_dump(exclude_none=True)
    if "steps" in update:
        old_steps = {step["id"]: step for step in campaign.get("steps", [])}
        steps = []
        for step in update["steps"]:
            previous = old_steps.get(step["id"])
            step["id"] = step["id"] if previous else new_id()
            if not previous or previous.get("subject") != step["subject"] or previous.get("subject_b", "") != step["subject_b"]:
                step["ab_winner"] = None
            steps.append(step)
        update["steps"] = steps
    if "sender_ids" in update:
        owned = await db.senders.find(
            {"user_id": user["id"], "id": {"$in": update["sender_ids"]}},
            {"_id": 0, "id": 1},
        ).to_list(500)
        update["sender_ids"] = [sender["id"] for sender in owned]
    if "timezone" in update and not zone(update["timezone"]):
        raise HTTPException(status_code=422, detail=f"Unknown timezone: {update['timezone']}")
    if "gap_min_minutes" in update or "gap_max_minutes" in update:
        low = update.get("gap_min_minutes", campaign.get("gap_min_minutes", 10))
        high = update.get("gap_max_minutes", campaign.get("gap_max_minutes", 15))
        update["gap_min_minutes"], update["gap_max_minutes"] = min(low, high), max(low, high)
    if "send_days" in update:
        update["send_days"] = sorted({day for day in update["send_days"] if 0 <= day <= 6})
    if update:
        await db.campaigns.update_one(
            {"id": campaign_id, "user_id": user["id"], "status": "draft"},
            {"$set": update},
        )
    fresh = await _get_campaign(user, campaign_id)
    totals = (await campaign_totals(user["id"], [campaign_id]))[campaign_id]
    return _out(fresh, totals).model_dump(mode="json")


# ----- Leads: external imports are accepted only for draft campaigns -----
from models.schemas import LeadImport, LeadImportResult, LeadOut, SenderOut
from routers.senders import _out as sender_out
from pydantic import BaseModel, Field
from typing import Literal


class ExternalSenderUpdate(BaseModel):
    """Safe sender metadata only. SMTP/IMAP credentials are never writable/readable here."""
    from_name: str | None = Field(default=None, max_length=200)
    daily_limit: int | None = Field(default=None, ge=1, le=2000)
    status: Literal["active", "paused"] | None = None
    signatures: list[str] | None = Field(default=None, max_length=5)


@router.get("/campaigns/{campaign_id}/leads")
async def list_campaign_leads(campaign_id: str, request: Request, limit: int = 500):
    """List leads for a campaign. Maximum 5,000 rows."""
    user = await _api_user(request, "campaigns:read")
    await _get_campaign(user, campaign_id)
    limit = max(1, min(limit, 5000))
    docs = await db.leads.find(
        {"campaign_id": campaign_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return [LeadOut(**{k: v for k, v in doc.items() if k in LeadOut.model_fields}).model_dump(mode="json") for doc in docs]


@router.post("/campaigns/{campaign_id}/leads", status_code=201)
async def import_campaign_leads(campaign_id: str, body: LeadImport, request: Request):
    """Import/dedupe leads and respect workspace unsubscribes. Draft campaigns only."""
    user = await _api_user(request, "campaigns:write")
    campaign = await _get_campaign(user, campaign_id)
    if campaign.get("status") != "draft":
        raise HTTPException(status_code=409, detail="Leads can only be imported through the external API into draft campaigns")
    if len(body.leads) > 10000:
        raise HTTPException(status_code=422, detail="A maximum of 10,000 leads can be imported per request")
    existing = set(await db.leads.distinct("email", {"campaign_id": campaign_id}))
    emails = [lead.email.lower() for lead in body.leads]
    blocked = set(await db.unsubscribes.distinct(
        "email", {"user_id": user["id"], "email": {"$in": emails}}
    ))
    docs, skipped, fields = [], 0, set()
    for lead in body.leads:
        email = lead.email.lower()
        if email in existing:
            skipped += 1
            continue
        existing.add(email)
        custom = {str(k).strip().lower(): str(v).strip() for k, v in lead.custom.items()}
        custom = {k: v for k, v in custom.items() if k and k not in {"email", "first_name", "last_name", "company", "title", "timezone", "unsubscribe_link"}}
        fields.update(custom)
        docs.append({
            "id": new_id(), "user_id": user["id"], "campaign_id": campaign_id,
            "email": email, "first_name": lead.first_name.strip(),
            "last_name": lead.last_name.strip(), "company": lead.company.strip(),
            "title": lead.title.strip(), "custom": custom,
            "timezone": lead.timezone.strip() if zone(lead.timezone.strip()) else "",
            "status": "unsubscribed" if email in blocked else "pending",
            "current_step": 0, "sender_id": None, "next_send_at": None,
            "last_sent_at": None, "created_at": now(),
        })
    if fields:
        await db.campaigns.update_one(
            {"id": campaign_id, "user_id": user["id"]},
            {"$addToSet": {"custom_fields": {"$each": sorted(fields)} }},
        )
    if docs:
        await db.leads.insert_many(docs)
    return LeadImportResult(added=len(docs), skipped=skipped).model_dump(mode="json")


# ----- Sender accounts: safe metadata only; mailbox secrets stay in the app -----
@router.get("/senders")
async def list_sender_accounts(request: Request):
    """List connected sender accounts without exposing SMTP/IMAP or OAuth secrets."""
    user = await _api_user(request, "campaigns:read")
    docs = await db.senders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    result = []
    for doc in docs:
        item = await sender_out(doc)
        result.append(item.model_dump(mode="json"))
    return result


@router.patch("/senders/{sender_id}")
async def update_sender_account(sender_id: str, body: ExternalSenderUpdate, request: Request):
    """Update sender display name, daily limit, signatures or pause/activate status."""
    user = await _api_user(request, "campaigns:write")
    sender = await db.senders.find_one(
        {"id": sender_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not sender:
        raise HTTPException(status_code=404, detail="Sender account not found")
    update = body.model_dump(exclude_none=True)
    if sender.get("status") == "demo":
        update.pop("status", None)
    if update.get("status") == "active":
        update["last_error"] = ""
    if update:
        await db.senders.update_one(
            {"id": sender_id, "user_id": user["id"]}, {"$set": update}
        )
    fresh = await db.senders.find_one(
        {"id": sender_id, "user_id": user["id"]}, {"_id": 0}
    )
    item = await sender_out(fresh)
    return item.model_dump(mode="json")
