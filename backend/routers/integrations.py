"""Per-user third-party integration credentials, encrypted at rest."""
import os
import asyncio
import logging
import secrets
from datetime import timedelta
from urllib.parse import urlencode

import requests
from fastapi.responses import RedirectResponse
from datetime import datetime, timezone
from typing import Literal

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from lib.auth import current_user
from lib.db import db
from lib.util import new_id

router = APIRouter(prefix="/integrations", tags=["Integrations"])
log = logging.getLogger(__name__)
Provider = Literal["apollo", "neverbounce", "zerobounce", "smartlead", "instantly", "google_sheets", "hubspot", "calendly"]

PROVIDERS = {
    "apollo": {"name": "Apollo.io", "category": "Prospecting"},
    "neverbounce": {"name": "NeverBounce", "category": "Email verification"},
    "zerobounce": {"name": "ZeroBounce", "category": "Email verification"},
    "smartlead": {"name": "Smartlead", "category": "Outreach"},
    "instantly": {"name": "Instantly", "category": "Outreach"},
    "google_sheets": {"name": "Google Sheets", "category": "Database"},
    "hubspot": {"name": "HubSpot", "category": "CRM"},
    "calendly": {"name": "Calendly", "category": "Scheduling"},
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
            elif provider == "smartlead":
                response = await client.get(
                    "https://server.smartlead.ai/api/v1/campaigns/",
                    params={"api_key": api_key},
                )
            elif provider == "instantly":
                response = await client.get(
                    "https://api.instantly.ai/api/v2/campaigns",
                    headers={"Authorization": f"Bearer {api_key}"},
                    params={"limit": 1},
                )
            else:
                return False, "Provider is not supported yet."
        if response.status_code == 200:
            data = response.json()
            if provider == "neverbounce" and data.get("status") not in (None, "success"):
                return False, "NeverBounce did not accept this API key."
            if provider == "zerobounce" and "Credits" not in data and "credits" not in data:
                return False, str(data.get("error", "ZeroBounce did not accept this API key."))[:180]
            if provider == "smartlead" and isinstance(data, dict) and data.get("message") == "Invalid API Key":
                return False, "Smartlead did not accept this API key."
            if provider == "instantly" and isinstance(data, dict) and data.get("statusCode") in (401, 403):
                return False, "Instantly rejected this API key or its permissions."
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


# OAuth-based integrations. Tokens are encrypted with the same Fernet vault as API keys.
OAUTH_CONFIG = {
    "google_sheets": {
        "client_id": "GOOGLE_CLIENT_ID", "client_secret": "GOOGLE_CLIENT_SECRET",
        "redirect_env": "GOOGLE_SHEETS_REDIRECT_URI",
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "scope": "openid email https://www.googleapis.com/auth/drive.file",
        "extra": {"access_type": "offline", "prompt": "consent"},
    },
    "hubspot": {
        "client_id": "HUBSPOT_CLIENT_ID", "client_secret": "HUBSPOT_CLIENT_SECRET",
        "redirect_env": "HUBSPOT_REDIRECT_URI",
        "authorize": "https://app.hubspot.com/oauth/authorize",
        "token": "https://api.hubapi.com/oauth/v3/token",
        "scope": "crm.objects.contacts.read crm.objects.contacts.write",
        "extra": {},
    },
    "calendly": {
        "client_id": "CALENDLY_CLIENT_ID", "client_secret": "CALENDLY_CLIENT_SECRET",
        "redirect_env": "CALENDLY_REDIRECT_URI",
        "authorize": "https://auth.calendly.com/oauth/authorize",
        "token": "https://auth.calendly.com/oauth/token",
        "scope": "scheduled_events:read users:read",
        "extra": {},
    },
}


def _frontend_url() -> str:
    return os.environ.get("GOOGLE_OAUTH_FRONTEND_URL", "https://outreachforge-1.onrender.com").rstrip("/")


def _oauth_settings(provider: str) -> dict:
    cfg = OAUTH_CONFIG[provider]
    values = {
        "client_id": os.environ.get(cfg["client_id"], ""),
        "client_secret": os.environ.get(cfg["client_secret"], ""),
        "redirect_uri": os.environ.get(cfg["redirect_env"], ""),
    }
    if not all(values.values()):
        raise HTTPException(status_code=503, detail=f"{PROVIDERS[provider]['name']} OAuth is not configured. Set {cfg['client_id']}, {cfg['client_secret']}, and {cfg['redirect_env']} in Render.")
    return {**cfg, **values}


@router.get("/{provider}/oauth/start")
async def oauth_start(provider: str, user: dict = Depends(current_user)):
    if provider not in OAUTH_CONFIG:
        raise HTTPException(status_code=404, detail="OAuth provider not found")
    cfg = _oauth_settings(provider)
    state = secrets.token_urlsafe(32)
    await db.integration_oauth_states.insert_one({
        "state": state, "provider": provider, "user_id": user["id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    params = {
        "client_id": cfg["client_id"], "redirect_uri": cfg["redirect_uri"],
        "response_type": "code", "scope": cfg["scope"], "state": state,
        **cfg["extra"],
    }
    return RedirectResponse(cfg["authorize"] + "?" + urlencode(params), status_code=302)


@router.get("/{provider}/oauth/callback")
async def oauth_callback(provider: str, request: Request):
    if provider not in OAUTH_CONFIG:
        raise HTTPException(status_code=404, detail="OAuth provider not found")
    frontend = _frontend_url()
    state = request.query_params.get("state", "")
    code = request.query_params.get("code", "")
    if request.query_params.get("error"):
        return RedirectResponse(f"{frontend}/connectors?oauth={provider}_error", status_code=303)
    state_doc = await db.integration_oauth_states.find_one_and_delete({
        "state": state, "provider": provider,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })
    if not state_doc or not code:
        return RedirectResponse(f"{frontend}/connectors?oauth={provider}_state_error", status_code=303)
    try:
        cfg = _oauth_settings(provider)
        token_response = await asyncio.to_thread(
            requests.post, cfg["token"],
            data={
                "grant_type": "authorization_code", "code": code,
                "redirect_uri": cfg["redirect_uri"], "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
            },
            headers={"Accept": "application/json"},
            timeout=20,
        )
        data = token_response.json()
        if token_response.status_code != 200 or not data.get("access_token"):
            raise RuntimeError("OAuth token exchange failed")
        cipher = _cipher()
        now_utc = datetime.now(timezone.utc)
        record = {
            "id": new_id(), "user_id": state_doc["user_id"], "provider": provider,
            "encrypted_access_token": cipher.encrypt(data["access_token"].encode()).decode(),
            "encrypted_refresh_token": cipher.encrypt(data["refresh_token"].encode()).decode() if data.get("refresh_token") else None,
            "token_expires_at": now_utc + timedelta(seconds=int(data.get("expires_in", 3600))),
            "key_hint": "OAuth account", "status": "connected", "created_at": now_utc,
            "last_tested_at": now_utc,
        }
        await db.integrations.update_one(
            {"user_id": state_doc["user_id"], "provider": provider},
            {"$set": record}, upsert=True,
        )
        return RedirectResponse(f"{frontend}/connectors?oauth={provider}_connected", status_code=303)
    except Exception as exc:
        log.warning("Integration OAuth callback failed for %s (%s)", provider, type(exc).__name__)
        return RedirectResponse(f"{frontend}/connectors?oauth={provider}_error", status_code=303)


async def _oauth_access_token(user_id: str, provider: str) -> str:
    doc = await db.integrations.find_one({"user_id": user_id, "provider": provider})
    if not doc or not doc.get("encrypted_access_token"):
        raise HTTPException(status_code=400, detail=f"Connect {PROVIDERS[provider]['name']} first.")
    cipher = _cipher()
    if doc.get("token_expires_at") and doc["token_expires_at"] <= datetime.now(timezone.utc):
        refresh = doc.get("encrypted_refresh_token")
        if not refresh:
            raise HTTPException(status_code=401, detail="Authorization expired. Reconnect this integration.")
        cfg = _oauth_settings(provider)
        refresh_token = cipher.decrypt(refresh.encode()).decode()
        response = await asyncio.to_thread(
            requests.post, cfg["token"],
            data={
                "grant_type": "refresh_token", "refresh_token": refresh_token,
                "client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
            },
            headers={"Accept": "application/json"}, timeout=20,
        )
        data = response.json()
        if response.status_code != 200 or not data.get("access_token"):
            raise HTTPException(status_code=401, detail="Could not refresh authorization. Reconnect this integration.")
        updates = {
            "encrypted_access_token": cipher.encrypt(data["access_token"].encode()).decode(),
            "token_expires_at": datetime.now(timezone.utc) + timedelta(seconds=int(data.get("expires_in", 3600))),
        }
        if data.get("refresh_token"):
            updates["encrypted_refresh_token"] = cipher.encrypt(data["refresh_token"].encode()).decode()
        await db.integrations.update_one({"id": doc["id"], "user_id": user_id}, {"$set": updates})
        return data["access_token"]
    return cipher.decrypt(doc["encrypted_access_token"].encode()).decode()


class SheetsExportBody(BaseModel):
    spreadsheet_id: str = Field(min_length=10, max_length=200)
    campaign_id: str | None = None
    range: str = Field(default="Sheet1!A1", max_length=100)


@router.post("/google_sheets/export")
async def export_to_google_sheets(body: SheetsExportBody, user: dict = Depends(current_user)):
    token = await _oauth_access_token(user["id"], "google_sheets")
    query = {"user_id": user["id"]}
    if body.campaign_id:
        query["campaign_id"] = body.campaign_id
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    values = [["Email", "First name", "Last name", "Company", "Job title", "Status", "Campaign ID", "Timezone"]]
    values.extend([[d.get("email", ""), d.get("first_name", ""), d.get("last_name", ""),
                    d.get("company", ""), d.get("title", ""), d.get("status", ""),
                    d.get("campaign_id", ""), d.get("timezone", "")] for d in leads])
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{body.spreadsheet_id}/values/{body.range}:append"
    response = await asyncio.to_thread(
        requests.post, url, params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
        headers={"Authorization": f"Bearer {token}"}, json={"values": values}, timeout=30,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Google Sheets export failed. Check the spreadsheet ID, tab name, and sharing permissions.")
    return {"ok": True, "exported": len(leads), "spreadsheet_id": body.spreadsheet_id}


@router.post("/hubspot/sync")
async def sync_to_hubspot(user: dict = Depends(current_user)):
    token = await _oauth_access_token(user["id"], "hubspot")
    leads = await db.leads.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    synced = 0
    errors = 0
    for lead in leads:
        props = {
            "email": lead.get("email", ""), "firstname": lead.get("first_name", ""),
            "lastname": lead.get("last_name", ""), "company": lead.get("company", ""),
            "jobtitle": lead.get("title", ""),
        }
        props = {k: v for k, v in props.items() if v}
        try:
            response = await asyncio.to_thread(
                requests.post, "https://api.hubapi.com/crm/v3/objects/contacts",
                headers={"Authorization": f"Bearer {token}"}, json={"properties": props}, timeout=20,
            )
            if response.status_code in (200, 201, 409):
                synced += 1
            else:
                errors += 1
        except requests.RequestException:
            errors += 1
    return {"ok": errors == 0, "synced": synced, "errors": errors}


@router.get("/calendly/events")
async def calendly_events(user: dict = Depends(current_user)):
    token = await _oauth_access_token(user["id"], "calendly")
    response = await asyncio.to_thread(
        requests.get, "https://api.calendly.com/users/me",
        headers={"Authorization": f"Bearer {token}"}, timeout=20,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not retrieve Calendly account details.")
    uri = (response.json().get("resource") or {}).get("uri")
    if not uri:
        raise HTTPException(status_code=502, detail="Calendly did not return a user resource.")
    events = await asyncio.to_thread(
        requests.get, "https://api.calendly.com/scheduled_events",
        params={"user": uri, "count": 100, "sort": "start_time:desc"},
        headers={"Authorization": f"Bearer {token}"}, timeout=20,
    )
    if events.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not retrieve scheduled Calendly events.")
    return {"events": events.json().get("collection", [])}
