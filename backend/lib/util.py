import uuid
from datetime import datetime, timedelta, timezone


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


def start_of_today() -> datetime:
    n = now()
    return n.replace(hour=0, minute=0, second=0, microsecond=0)


def days_ago(d: int) -> datetime:
    return now() - timedelta(days=d)


def pct(a: int, b: int) -> float:
    return round(a * 100.0 / b, 1) if b else 0.0


def warmup_info(s: dict) -> tuple[int, int]:
    """(effective daily limit, warm-up day) — ramps start + increment/day up to daily_limit."""
    limit = int(s.get("daily_limit") or 1)
    if not s.get("warmup_enabled"):
        return limit, 0
    started = s.get("warmup_started_at") or s.get("created_at") or now()
    days = max(0, (now() - started).days)
    return min(limit, int(s.get("warmup_start", 5)) + int(s.get("warmup_increment", 3)) * days), days + 1
