"""Criterion: Login with demo account via auth form lands on /dashboard (API-backed)."""

import httpx


def test_login_demo_account_succeeds(client: httpx.Client):
    resp = client.post("/auth/login", json={"email": "demo@outreachforge.io", "password": "Demo@1234"})
    assert resp.status_code == 200, f"login failed: {resp.status_code} {resp.text[:300]}"
    body = resp.json()
    assert body.get("email") == "demo@outreachforge.io"
    assert "of_session" in resp.cookies

    # /auth/me with the session cookie should confirm the logged-in user
    me = client.get("/auth/me", cookies=resp.cookies)
    assert me.status_code == 200, f"/auth/me failed: {me.status_code} {me.text[:300]}"
    assert me.json().get("email") == "demo@outreachforge.io"


def test_login_wrong_password_rejected(client: httpx.Client):
    resp = client.post("/auth/login", json={"email": "demo@outreachforge.io", "password": "WrongPassword123"})
    assert resp.status_code in (400, 401), f"expected rejection, got {resp.status_code} {resp.text[:300]}"
