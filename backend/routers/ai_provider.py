from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from lib.auth import current_user
from lib.db import db
from lib.ai_provider import GROQ_MODELS, _fernet, get_ai_config, groq_completion
import os

router = APIRouter(prefix="/ai", tags=["ai settings"])

class ProviderUpdate(BaseModel):
    provider: str = Field(pattern="^(gemini|groq)$")
    api_key: str = Field(default="", max_length=500)
    model: str = Field(default=GROQ_MODELS[0], max_length=120)

@router.get("/provider-settings")
async def read_provider_settings(user=Depends(current_user)):
    cfg = await get_ai_config(user["id"])
    doc = await db.ai_provider_settings.find_one({"user_id":user["id"]},{"_id":0,"encrypted_api_key":0})
    return {"provider":cfg["provider"],"model":cfg["model"],"has_api_key":bool(doc and doc.get("encrypted_api_key")),"models":GROQ_MODELS,"encryption_configured":bool(os.getenv("AI_CREDENTIALS_ENCRYPTION_KEY"))}

@router.put("/provider-settings")
async def save_provider_settings(body:ProviderUpdate,user=Depends(current_user)):
    if body.provider == "gemini":
        await db.ai_provider_settings.delete_one({"user_id":user["id"]})
        return {"ok":True,"provider":"gemini","has_api_key":False}
    if body.model not in GROQ_MODELS:
        raise HTTPException(400,"Choose a supported Groq model.")
    existing=await db.ai_provider_settings.find_one({"user_id":user["id"]},{"_id":0})
    if not body.api_key.strip() and not (existing and existing.get("encrypted_api_key")):
        raise HTTPException(400,"Enter your Groq API key.")
    update={"provider":"groq","model":body.model}
    if body.api_key.strip():
        update["encrypted_api_key"]=_fernet().encrypt(body.api_key.strip().encode()).decode()
    await db.ai_provider_settings.update_one({"user_id":user["id"]},{"$set":update,"$setOnInsert":{"user_id":user["id"]}},upsert=True)
    return {"ok":True,"provider":"groq","model":body.model,"has_api_key":True}

@router.post("/provider-settings/test")
async def test_provider_settings(user=Depends(current_user)):
    cfg=await get_ai_config(user["id"])
    if cfg["provider"]!="groq" or not cfg["api_key"]:
        raise HTTPException(400,"Save a Groq provider and API key before testing.")
    await groq_completion(cfg["api_key"],cfg["model"],"You are a connection test. Reply with the exact word OK.","Say OK.",0,False)
    return {"ok":True,"message":"Groq connection successful."}
