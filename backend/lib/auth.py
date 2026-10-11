"""Password hashing + JWT session cookie."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request, Response
from passlib.hash import pbkdf2_sha256

from lib.db import db

COOKIE = "of_session"
SECRET = os.environ.get("JWT_SECRET", "change-me-outreachforge-secret")
TTL_DAYS = 14


def hash_password(pw: str) -> str:
    return pbkdf2_sha256.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return pbkdf2_sha256.verify(pw, hashed)
    except Exception:
        return False


def set_session(response: Response, request: Request, user_id: str) -> None:
    token = jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=TTL_DAYS)},
        SECRET,
        algorithm="HS256",
    )
    secure = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    response.set_cookie(
        COOKIE, token, httponly=True, samesite="lax", secure=secure,
        max_age=TTL_DAYS * 86400, path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
