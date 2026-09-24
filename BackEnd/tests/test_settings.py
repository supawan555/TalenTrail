"""Integration tests for /settings (profile + password change)."""


def test_settings_require_login(client):
    resp = client.get("/settings/profile")
    assert resp.status_code == 401


def test_get_profile(client, recruiter):
    resp = client.get("/settings/profile")
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "recruiter@example.com"
    assert body["name"] == "Test User"


def test_update_profile_name(client, recruiter):
    resp = client.put("/settings/profile", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"

    # Persisted.
    assert client.get("/settings/profile").json()["name"] == "New Name"


def test_update_profile_rejects_email_change(client, recruiter):
    resp = client.put("/settings/profile", json={"email": "different@example.com"})
    assert resp.status_code == 400


def test_update_profile_rejects_empty_payload(client, recruiter):
    resp = client.put("/settings/profile", json={})
    assert resp.status_code == 400


def test_change_password_success_and_relogin(client, recruiter):
    resp = client.put("/settings/password", json={
        "current_password": "Password123!",
        "new_password": "BrandNewPass1!",
    })
    assert resp.status_code == 200

    client.post("/auth/logout")

    old_login = client.post("/auth/login", json={"email": "recruiter@example.com", "password": "Password123!"})
    assert old_login.status_code == 401

    new_login = client.post("/auth/login", json={"email": "recruiter@example.com", "password": "BrandNewPass1!"})
    assert new_login.status_code == 200


def test_change_password_rejects_wrong_current_password(client, recruiter):
    resp = client.put("/settings/password", json={
        "current_password": "totally-wrong",
        "new_password": "BrandNewPass1!",
    })
    assert resp.status_code == 400


def test_change_password_rejects_same_password(client, recruiter):
    resp = client.put("/settings/password", json={
        "current_password": "Password123!",
        "new_password": "Password123!",
    })
    assert resp.status_code == 400
