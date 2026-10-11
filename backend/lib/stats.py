"""Campaign/analytics aggregation helpers."""
from datetime import timedelta

from lib.db import db
from lib.util import now, pct

PROJ = {"_id": 0, "campaign_id": 1, "step_index": 1, "sent_at": 1, "opened_at": 1, "open_count": 1, "click_count": 1,
        "clicked_at": 1, "replied_at": 1, "bounced": 1, "lead_id": 1, "unsubscribed": 1, "variant": 1}


def totals_from(msgs: list[dict], leads: int) -> dict:
    sent = len(msgs)
    lead_ids = {m["lead_id"] for m in msgs}
    opened = len({m["lead_id"] for m in msgs if m.get("opened_at")})
    clicked = len({m["lead_id"] for m in msgs if m.get("clicked_at")})
    replied = len({m["lead_id"] for m in msgs if m.get("replied_at")})
    bounced = len({m["lead_id"] for m in msgs if m.get("bounced")})
    unsubscribed = len({m["lead_id"] for m in msgs if m.get("unsubscribed")})
    contacted = len(lead_ids)
    return {
        "leads": leads, "contacted": contacted, "sent": sent, "opened": opened, "clicked": clicked,
        "replied": replied, "bounced": bounced, "unsubscribed": unsubscribed,
        "open_rate": pct(opened, contacted), "click_rate": pct(clicked, contacted),
        "reply_rate": pct(replied, contacted), "bounce_rate": pct(bounced, contacted),
    }


async def campaign_totals(user_id: str, campaign_ids: list[str]) -> dict[str, dict]:
    msgs = await db.messages.find({"user_id": user_id, "campaign_id": {"$in": campaign_ids}}, PROJ).to_list(200000)
    lead_counts: dict[str, int] = {}
    async for row in db.leads.aggregate([
        {"$match": {"user_id": user_id, "campaign_id": {"$in": campaign_ids}}},
        {"$group": {"_id": "$campaign_id", "n": {"$sum": 1},
                    "done": {"$sum": {"$cond": [{"$in": ["$status", ["completed", "replied", "bounced", "unsubscribed"]]}, 1, 0]}}}},
    ]):
        lead_counts[row["_id"]] = row["n"]
        lead_counts[row["_id"] + ":done"] = row["done"]
    by: dict[str, list[dict]] = {cid: [] for cid in campaign_ids}
    for m in msgs:
        by.setdefault(m["campaign_id"], []).append(m)
    out = {}
    for cid in campaign_ids:
        t = totals_from(by.get(cid, []), lead_counts.get(cid, 0))
        total = lead_counts.get(cid, 0)
        t["_progress"] = pct(lead_counts.get(cid + ":done", 0), total)
        out[cid] = t
    return out


def build_series(msgs: list[dict], days: int) -> list[dict]:
    today = now().date()
    keys = [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    series = {k: {"date": k, "sent": 0, "opened": 0, "clicked": 0, "replied": 0} for k in keys}
    for m in msgs:
        for field, key in (("sent_at", "sent"), ("opened_at", "opened"), ("clicked_at", "clicked"), ("replied_at", "replied")):
            dt = m.get(field)
            if dt:
                k = dt.date().isoformat()
                if k in series:
                    series[k][key] += 1
    return list(series.values())


def build_steps(msgs: list[dict], steps: list[dict]) -> list[dict]:
    out = []
    for i, st in enumerate(steps):
        ms = [m for m in msgs if m.get("step_index") == i]
        out.append({
            "step": i + 1, "subject": st.get("subject") or f"Follow-up {i}",
            "sent": len(ms), "opened": sum(1 for m in ms if m.get("opened_at")),
            "clicked": sum(1 for m in ms if m.get("clicked_at")),
            "replied": sum(1 for m in ms if m.get("replied_at")),
            "ab_winner": st.get("ab_winner"),
            "variants": variant_stats(ms, st) if (st.get("subject_b") or "").strip() else [],
        })
    return out


def variant_stats(ms: list[dict], st: dict) -> list[dict]:
    out = []
    for v, subj in (("a", st.get("subject") or ""), ("b", st.get("subject_b") or "")):
        vm = [m for m in ms if (m.get("variant") or "a") == v]
        opened = sum(1 for m in vm if m.get("opened_at"))
        out.append({"variant": v, "subject": subj, "sent": len(vm), "opened": opened, "open_rate": pct(opened, len(vm))})
    return out
