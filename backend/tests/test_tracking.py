import pytest

from routers import analytics
from lib import mailer


class UpdateResult:
    def __init__(self, modified_count=1):
        self.modified_count = modified_count


class FakeMessages:
    def __init__(self, row):
        self.row = row
        self.updates = []

    async def find_one(self, query, projection=None):
        return self.row

    async def update_one(self, query, update):
        self.updates.append((query, update))
        return UpdateResult(1 if "$or" in query else 0)


class FakeCollection:
    def __init__(self):
        self.updates = []

    async def update_one(self, query, update):
        self.updates.append((query, update))
        return UpdateResult()


class FakeDB:
    def __init__(self, row):
        self.messages = FakeMessages(row)
        self.leads = FakeCollection()
        self.campaigns = FakeCollection()


@pytest.mark.asyncio
async def test_open_tracking_records_first_and_repeat_open(monkeypatch):
    fake = FakeDB({"id": "m1", "lead_id": "l1", "campaign_id": "c1", "opened_at": None})
    monkeypatch.setattr(analytics, "db", fake)
    monkeypatch.setattr(analytics, "now", lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc))
    resp = await analytics.track_open("m1", type("Req", (), {"headers": {"user-agent": "Mozilla/5.0"}})())
    assert resp.media_type == "image/gif"
    assert any("$inc" in update and update["$inc"].get("open_count") == 1 for _, update in fake.messages.updates)
    assert len(fake.leads.updates) == 1
    assert fake.campaigns.updates[0][1]["$inc"]["unique_opens"] == 1


@pytest.mark.asyncio
async def test_open_tracking_ignores_identified_security_scanner(monkeypatch):
    fake = FakeDB({"id": "m1", "lead_id": "l1", "campaign_id": "c1", "opened_at": None})
    monkeypatch.setattr(analytics, "db", fake)
    req = type("Req", (), {"headers": {"user-agent": "Proofpoint Security Scanner"}})()
    resp = await analytics.track_open("m1", req)
    assert resp.media_type == "image/gif"
    assert fake.messages.updates == []


def test_html_tracking_pixel_and_safe_click_links():
    html = mailer.build_html("Hi <Sam>\nVisit https://example.com/path", "m1", "https://outreachforge.onrender.com", True, True)
    assert 'src="https://outreachforge.onrender.com/api/t/o/m1.gif"' in html
    assert "/api/t/c/m1?u=https%3A%2F%2Fexample.com%2Fpath" in html
    assert "Hi &lt;Sam&gt;" in html
