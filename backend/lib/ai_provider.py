import os
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from lib.db import db

GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3-32b"]

def _fernet():
    key = (os.getenv("AI_CREDENTIALS_ENCRYPTION_KEY") or "").strip()
    if not key:
        raise HTTPException(503, "Set AI_CREDENTIALS_ENCRYPTION_KEY on the backend before saving provider keys.")
    try:
        return Fernet(key.encode())
    except Exception:
        raise HTTPException(503, "AI_CREDENTIALS_ENCRYPTION_KEY must be a valid Fernet key.")

async def get_ai_config(user_id):
    doc = await db.ai_provider_settings.find_one({"user_id": user_id}, {"_id": 0})
    if not doc or doc.get("provider") != "groq":
        return {"provider":"gemini","model":(os.getenv("GEMINI_MODEL") or "gemini-3.8-flash").strip(),"api_key":(os.getenv("GEMINI_API_KEY") or "").strip()}
    try:
        key = _fernet().decrypt(doc["encrypted_api_key"].encode()).decode()
    except (InvalidToken, KeyError, ValueError):
        raise HTTPException(500, "Saved Groq key could not be decrypted. Please save it again.")
    return {"provider":"groq","model":doc.get("model",GROQ_MODELS[0]),"api_key":key}

async def groq_completion(api_key, model, system, prompt, temperature=0.4, json_mode=True):
    payload = {"model":model,"messages":[{"role":"system","content":system},{"role":"user","content":prompt}],"temperature":temperature}
    if json_mode:
        payload["response_format"] = {"type":"json_object"}
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.groq.com/openai/v1/chat/completions",headers={"Authorization":f"Bearer {api_key}"},json=payload)
    except httpx.TimeoutException:
        raise HTTPException(504,"Groq timed out. Please try again.")
    except httpx.HTTPError:
        raise HTTPException(502,"Could not connect to Groq.")
    if response.status_code in (401,403):
        raise HTTPException(400,"Groq rejected the API key. Check it in Settings → AI Provider.")
    if response.status_code == 429:
        raise HTTPException(429,"Groq rate limit or quota reached. Please retry later.")
    if response.is_error:
        raise HTTPException(502,f"Groq request failed ({response.status_code}). Check the selected model.")
    try:
        return response.json()["choices"][0]["message"]["content"]
    except (ValueError,KeyError,IndexError,TypeError):
        raise HTTPException(502,"Groq returned an unexpected response.")
