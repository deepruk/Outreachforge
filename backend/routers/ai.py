"""AI Copywriter — rewrites a sequence step using Google's Gemini API.

Keeps the user's template variables intact and returns a strict JSON payload
the frontend swaps straight into the editor. The API key stays server-side.
"""
from __future__ import annotations

import json
import os
import re
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.auth import current_user

router = APIRouter(prefix="/ai", tags=["ai"])


Tone = Literal["professional", "casual", "friendly", "direct"]
Goal = Literal["cold_intro", "followup", "breakup"]
Length = Literal["short", "medium"]


class RewriteStep(BaseModel):
    subject: str = ""
    subject_b: str = ""
    body: str = ""
    preheader: str = ""


class RewriteRequest(BaseModel):
    step: RewriteStep
    tone: Tone = "professional"
    goal: Goal = "cold_intro"
    length: Length = "short"
    product: str = Field(default="", max_length=400)
    audience: str = Field(default="", max_length=200)


class RewriteResponse(BaseModel):
    subject: str
    body: str
    preheader: str


_SYSTEM = """You are a world-class cold-email copywriter.
Rules you MUST follow:
- Return ONLY compact JSON with keys: subject, body, preheader. No markdown, no commentary.
- Preserve every template variable the author uses EXACTLY — tokens like {{first_name}}, {{company}}, {{title}}, {{sender_first_name}} and any {{...}} must appear verbatim.
- Preserve {unsubscribe_link} if present.
- Spintax like {Hi|Hey|Hello} is allowed — keep or write as plain text, never invent new spintax braces.
- No emojis, no exclamation floods, no all-caps lines, no "click here".
- Short subject lines (under 55 chars), lowercase feel.
- Body = plain text, 2–5 short paragraphs separated by blank lines.
- Preheader = ≤90 chars, a specific concrete hook — not a repeat of the subject.
- Do NOT invent facts about the recipient's company; stay generic unless the author provided specifics."""


_LENGTH_HINT = {
    "short": "Body is 60–110 words. Three short paragraphs max.",
    "medium": "Body is 110–180 words. Up to five short paragraphs.",
}
_GOAL_HINT = {
    "cold_intro": "This is a first-touch cold email. Open with a specific hook, land one clear value promise, close with a single soft question.",
    "followup": "This is a follow-up to a previous email that got no reply. Keep it short, reference the prior note briefly, add one new angle, re-ask the same question.",
    "breakup": "This is a break-up / permission-to-close-the-loop email. Acknowledge no reply, offer one final value nudge, make it easy to say 'not now' or 'send later'.",
}


def _build_prompt(req: RewriteRequest) -> str:
    parts = [
        f"Tone: {req.tone}.",
        f"Goal: {req.goal.replace('_', ' ')}.",
        _GOAL_HINT[req.goal],
        _LENGTH_HINT[req.length],
    ]
    if req.product.strip():
        parts.append(f"What we're pitching: {req.product.strip()}")
    if req.audience.strip():
        parts.append(f"Target reader: {req.audience.strip()}")
    original = req.step.body.strip() or "(no draft yet — write from scratch)"
    original_subject = req.step.subject.strip() or "(no draft)"
    parts.append(f"\nOriginal subject:\n{original_subject}")
    parts.append(f"\nOriginal body:\n{original}")
    parts.append("\nReturn ONLY the JSON object now.")
    return "\n".join(parts)


_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _parse_llm_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = text.rstrip("`").rstrip()
    match = _JSON_BLOCK.search(text)
    if not match:
        raise ValueError("no JSON object in model output")
    return json.loads(match.group(0))


@router.post("/rewrite-step", response_model=RewriteResponse)
async def rewrite_step(req: RewriteRequest, _user=Depends(current_user)) -> RewriteResponse:
    api_key = (os.environ.get("GEMINI_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="AI email writing is not configured. Add GEMINI_API_KEY to the backend service's environment variables.",
        )

    # Use a free-tier eligible Gemini model by default. Override with GEMINI_MODEL
    # if Google changes model availability for the project's region/tier.
    model = (os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": _build_prompt(req)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.7,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(
                url,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Gemini took too long to respond. Please try again.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to Google's Gemini API. Please try again.")

    if response.status_code in (400, 401, 403):
        raise HTTPException(
            status_code=400,
            detail="Google rejected the Gemini API request. Check GEMINI_API_KEY, model availability, and API access in Google AI Studio.",
        )
    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Gemini API quota or rate limit reached. Wait a little and try again; free-tier limits apply.",
        )
    if response.status_code >= 500:
        raise HTTPException(status_code=502, detail="Google's Gemini service is temporarily unavailable. Please try again.")
    if response.is_error:
        raise HTTPException(status_code=502, detail=f"Gemini API request failed with status {response.status_code}.")

    try:
        result = response.json()
        parts = result["candidates"][0]["content"]["parts"]
        reply = "".join(part.get("text", "") for part in parts)
        data = _parse_llm_json(reply)
    except (ValueError, KeyError, IndexError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=502, detail="Gemini returned a response we couldn't parse. Try again.")

    return RewriteResponse(
        subject=str(data.get("subject", "")).strip()[:200],
        body=str(data.get("body", "")).strip(),
        preheader=str(data.get("preheader", "")).strip()[:140],
    )
