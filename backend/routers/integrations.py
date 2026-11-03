"""Per-user third-party integration credentials, encrypted at rest."""
import os
from datetime import datetime, timezone
from typing import Literal

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import current_user
from lib.db import db
from lib.util import new_id

router = APIRouter(prefix="/integrations", tags=["Integrations"])
Provider = Literal["apollo", "neverbounce", "zerobounce"]

PROVIDERS = {
    "apollo": {"name": "Apollo.io", "category": "Prospecting"},
    "neverbounce": {"name": "NeverBounce", "category": "Email verification"},
    "zerobounce": {"name": "ZeroBounce", "category": "Email verification"},
}


def _cipher() -> Fernet:
    key = os.environ.get("INTEGRATION_ENCRYPTION_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="Integrations vault is not configured. Set INTEGRATION_ENCRYPTION_KEY in the backend environment.")
    try:
        return Fernet(key.encode())
    except Exception:
        raise HTTPException(status_code=503, detail="INTEGRATION_ENCRYPTION_KEY must be a valid Fernet key.")


class ConnectBody(BaseModel):
    provider: Provider
    api_key: str = Field(min_length=8, max_length=2048)


def _public(doc: dict) -> dict:
    return {
        "id": doc["id"], "provider": doc["provider"],
        "name": PROVIDERS[doc["provider"]]["name"],
        "category": PROVIDERS[doc["provider"]]["category"],
        "key_hint": doc["key_hint"], "status": doc.get("status", "connected"),
        "created_at": doc["created_at"], "last_tested_at": doc.get("last_tested_at"),
    }


async def _check(provider: str, api_key: str) -> tuple[bool, str]:
    timeout = httpx.Timeout(12.0, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if provider == "apollo":
                response = await client.post(
                    "https://api.apollo.io/api/v1/auth/health",
                    headers={"x-api-key": api_key, "Cache-Control": "no-cache"},
                )
            elif provider == "neverbounce":
                response = await client.get(
                    "https://api.neverbounce.com/v4.2/account/info",
                    params={"key": api_key},
                )
            elif provider == "zerobounce":
                response = await client.get(
                    "https://api.zerobounce.net/v2/getcredits",
                    params={"api_key": api_key},
                )
            else:
                return False, "Provider is not supported yet."
        if response.status_code == 200:
            data = response.json()
            if provider == "neverbounce" and data.get("status") not in (None, "success"):
                return False, "NeverBounce did not accept this API key."
            if provider == "zerobounce" and "Credits" not in data and "credits" not in data:
                return False, str(data.get("error", "ZeroBounce did not accept this API key."))[:180]
            return True, "API key verified."
        if response.status_code in (401, 403):
            return False, "Authentication failed. Check the API key and provider permissions."
        return False, f"Provider returned HTTP {response.status_code}. Check the key and try again."
    except httpx.TimeoutException:
        return False, "Provider request timed out. Try again."
    except Exception:
        return False, "Could not reach the provider. Try again later."


@router.get("")
async def list_integrations(user: dict = Depends(current_user)):
    docs = await db.integrations.find({"user_id": user["id"]}).to_list(100)
    return [_public(doc) for doc in docs if doc.get("provider") in PROVIDERS]


@router.post("", status_code=201)
async def connect_integration(body: ConnectBody, user: dict = Depends(current_user)):
    key = body.api_key.strip()
    if not key:
        raise HTTPException(status_code=422, detail="API key cannot be empty.")
    cipher = _cipher()
    encrypted = cipher.encrypt(key.encode()).decode()
    now = datetime.now(timezone.utc)
    doc = {
        "id": new_id(), "user_id": user["id"], "provider": body.provider,
        "encrypted_api_key": encrypted, "key_hint": key[:4] + "••••" + key[-4:],
        "status": "connected", "created_at": now, "last_tested_at": None,
    }
    await db.integrations.update_one(
        {"user_id": user["id"], "provider": body.provider},
        {"$set": doc}, upsert=True,
    )
    return _public(doc)


@router.post("/{provider}/test")
async def test_integration(provider: Provider, user: dict = Depends(current_user)):
    doc = await db.integrations.find_one({"user_id": user["id"], "provider": provider})
    if not doc:
        raise HTTPException(status_code=404, detail="Connect this integration first.")
    try:
        api_key = _cipher().decrypt(doc["encrypted_api_key"].encode()).decode()
    except (InvalidToken, KeyError):
        raise HTTPException(status_code=500, detail="Could not decrypt the saved credential. Reconnect this integration.")
    ok, message = await _check(provider, api_key)
    await db.integrations.update_one(
        {"id": doc["id"], "user_id": user["id"]},
        {"$set": {"status": "connected" if ok else "error", "last_tested_at": datetime.now(timezone.utc)}},
    )
    return {"ok": ok, "message": message}


@router.delete("/{provider}")
async def disconnect_integration(provider: Provider, user: dict = Depends(current_user)):
    result = await db.integrations.delete_one({"user_id": user["id"], "provider": provider})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Integration not found.")
    return {"ok": True}
