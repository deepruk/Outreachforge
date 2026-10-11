"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "senders": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "campaigns": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"), IndexModel([("status", ASCENDING)], name="status")],
    "leads": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("campaign_id", ASCENDING), ("status", ASCENDING), ("next_send_at", ASCENDING)], name="camp_status_next"), IndexModel([("user_id", ASCENDING), ("email", ASCENDING)], name="user_email")],
    "messages": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("campaign_id", ASCENDING), ("sent_at", DESCENDING)], name="camp_sent"), IndexModel([("user_id", ASCENDING), ("sent_at", DESCENDING)], name="user_sent"), IndexModel([("sender_id", ASCENDING), ("sent_at", DESCENDING)], name="sender_sent"), IndexModel([("lead_id", ASCENDING)], name="lead"), IndexModel([("message_id_header", ASCENDING)], name="msgid")],
    "threads": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("user_id", ASCENDING), ("last_at", DESCENDING)], name="user_last"), IndexModel([("lead_id", ASCENDING)], name="lead")],
    "notifications": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"), IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "unsubscribes": [IndexModel([("user_id", ASCENDING), ("email", ASCENDING)], name="user_email", unique=True)],
    "thread_messages": [IndexModel([("thread_id", ASCENDING), ("at", ASCENDING)], name="thread_at"), IndexModel([("message_id", ASCENDING)], name="msgid")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
