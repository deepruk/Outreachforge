"""Session-authenticated API key management. Secret values are shown only once."""
import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import current_user
from lib.db import db
from lib.util import new_id, now

router = APIRouter(prefix="/auth", tags=["API keys"])


class APIKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


def _public_key(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "prefix": doc["prefix"],
        "scopes": doc["scopes"],
        "created_at": doc["created_at"],
        "last_used_at": doc.get("last_used_at"),
        "revoked_at": doc.get("revoked_at"),
    }


@router.get("/api-keys")
async def list_api_keys(user: dict = Depends(current_user)):
    docs = await db.api_keys.find({"user_id": user["id"]}, {"_id": 0, "key_hash": 0}).sort("created_at", -1).to_list(100)
    return [_public_key(doc) for doc in docs]


@router.post("/api-keys", status_code=201)
async def create_api_key(body: APIKeyCreate, user: dict = Depends(current_user)):
    # A key can draft/read campaigns, but cannot launch campaigns or send email.
    raw_key = "rhf_live_" + secrets.token_urlsafe(32)
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "name": body.name.strip(),
        "prefix": raw_key[:16],
        "key_hash": hashlib.sha256(raw_key.encode("utf-8")).hexdigest(),
        "scopes": ["campaigns:read", "campaigns:write"],
        "created_at": now(),
        "last_used_at": None,
        "revoked_at": None,
    }
    await db.api_keys.insert_one(doc)
    return {**_public_key(doc), "api_key": raw_key, "warning": "Copy this key now. It will not be shown again."}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, user: dict = Depends(current_user)):
    result = await db.api_keys.update_one(
        {"id": key_id, "user_id": user["id"], "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc)}},
    )
    if not result.modified_count:
        raise HTTPException(status_code=404, detail="Active API key not found")
    return {"ok": True}
