"""Integration tests for /notes, including the author/admin delete permission rule."""

from .conftest import register_user


def _create_candidate(client):
    resp = client.post("/candidates", json={"name": "Note Target", "email": "note-target@example.com"})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_notes_require_login(client):
    resp = client.get("/notes")
    assert resp.status_code == 401


def test_create_and_list_note(client, recruiter):
    candidate_id = _create_candidate(client)

    create_resp = client.post(
        "/notes",
        params={"candidate_id": candidate_id, "content": "Strong React background", "type": "Interview"},
    )
    assert create_resp.status_code == 200, create_resp.text
    note = create_resp.json()
    assert note["candidate_id"] == candidate_id
    assert note["content"] == "Strong React background"
    assert note["author"] == "recruiter@example.com"

    list_resp = client.get("/notes", params={"candidate_id": candidate_id})
    assert list_resp.status_code == 200
    assert [n["id"] for n in list_resp.json()] == [note["id"]]

    by_candidate_resp = client.get(f"/notes/candidate/{candidate_id}")
    assert by_candidate_resp.status_code == 200
    assert len(by_candidate_resp.json()) == 1


def test_create_note_rejects_blank_content(client, recruiter):
    candidate_id = _create_candidate(client)
    resp = client.post("/notes", params={"candidate_id": candidate_id, "content": "   ", "type": "Interview"})
    assert resp.status_code == 400


def test_create_note_invalid_candidate_id(client, recruiter):
    resp = client.post("/notes", params={"candidate_id": "not-an-id", "content": "hi", "type": "Interview"})
    assert resp.status_code == 400


def test_author_can_delete_own_note(client, recruiter):
    candidate_id = _create_candidate(client)
    note = client.post(
        "/notes", params={"candidate_id": candidate_id, "content": "mine", "type": "Interview"}
    ).json()

    delete_resp = client.delete(f"/notes/{note['id']}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["deleted"] is True


def test_non_author_recruiter_cannot_delete_note(client, recruiter, second_recruiter):
    candidate_id = _create_candidate(client)
    note = client.post(
        "/notes", params={"candidate_id": candidate_id, "content": "mine", "type": "Interview"}
    ).json()

    other_client = second_recruiter["client"]
    delete_resp = other_client.delete(f"/notes/{note['id']}")
    assert delete_resp.status_code == 403

    # Note still exists.
    assert client.get(f"/notes/candidate/{candidate_id}").json()


def test_admin_can_delete_any_note(client, recruiter):
    # Author the note as the recruiter first...
    candidate_id = _create_candidate(client)
    note = client.post(
        "/notes", params={"candidate_id": candidate_id, "content": "mine", "type": "Interview"}
    ).json()

    # ...then switch the same client's session to an ADMIN account and delete it.
    register_user(client, email="admin2@example.com", role="ADMIN")
    admin_login = client.post("/auth/login", json={"email": "admin2@example.com", "password": "Password123!"})
    assert admin_login.status_code == 200
    assert admin_login.json()["otp_required"] is False

    delete_resp = client.delete(f"/notes/{note['id']}")
    assert delete_resp.status_code == 200


def test_delete_note_not_found(client, recruiter):
    resp = client.delete("/notes/000000000000000000000000")
    assert resp.status_code == 404
