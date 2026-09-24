"""Integration tests for /candidates.

Candidate creation is exercised through the JSON body path (same as the real
frontend, which always sends `application/json` -- see
font-end/src/hooks/useCandidates.ts). No resume file is attached, so the ML
scoring pipeline (services.candidates.process_candidate_ml_pipeline) is a
no-op and these tests stay hermetic.
"""


def _candidate_payload(**overrides):
    payload = {
        "name": "Jamie Lee",
        "email": "jamie@example.com",
        "phone": "0800000000",
        "position": "Backend Developer",
        "experience": "3 years",
    }
    payload.update(overrides)
    return payload


def test_candidates_require_login(client):
    resp = client.post("/candidates", json=_candidate_payload())
    assert resp.status_code == 401


def test_create_candidate_sets_defaults(client, recruiter):
    resp = client.post("/candidates", json=_candidate_payload())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"]
    assert body["name"] == "Jamie Lee"
    assert body["current_state"] == "applied"
    assert body["status"] == "active"
    assert len(body["state_history"]) == 1
    assert body["state_history"][0]["state"] == "applied"


def test_list_and_get_candidate(client, recruiter):
    created = client.post("/candidates", json=_candidate_payload()).json()

    list_resp = client.get("/candidates")
    assert list_resp.status_code == 200
    ids = [c["id"] for c in list_resp.json()]
    assert created["id"] in ids

    get_resp = client.get(f"/candidates/{created['id']}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["id"] == created["id"]
    assert body["notes"] == []


def test_get_candidate_not_found(client, recruiter):
    resp = client.get("/candidates/000000000000000000000000")
    assert resp.status_code == 404


def test_get_candidate_invalid_id(client, recruiter):
    resp = client.get("/candidates/not-an-object-id")
    assert resp.status_code == 400


def test_update_candidate_stage_transition_records_history(client, recruiter):
    created = client.post("/candidates", json=_candidate_payload()).json()

    update_resp = client.put(f"/candidates/{created['id']}", json={"stage": "interview"})
    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["current_state"] == "interview"
    assert body["interview_at"] is not None

    states = [entry["state"] for entry in body["state_history"]]
    assert states == ["applied", "interview"]
    # The "applied" entry should now be closed.
    applied_entry = next(e for e in body["state_history"] if e["state"] == "applied")
    assert applied_entry["exited_at"] is not None
    interview_entry = next(e for e in body["state_history"] if e["state"] == "interview")
    assert interview_entry["exited_at"] is None


def test_update_candidate_to_hired_sets_status(client, recruiter):
    created = client.post("/candidates", json=_candidate_payload()).json()

    update_resp = client.put(f"/candidates/{created['id']}", json={"stage": "hired"})
    assert update_resp.status_code == 200
    body = update_resp.json()
    assert body["status"] == "hired"
    assert body["hired_at"] is not None


def test_update_candidate_not_found(client, recruiter):
    resp = client.put("/candidates/000000000000000000000000", json={"stage": "interview"})
    assert resp.status_code == 404


def test_delete_candidate(client, recruiter):
    created = client.post("/candidates", json=_candidate_payload()).json()

    delete_resp = client.delete(f"/candidates/{created['id']}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["deleted"] is True

    get_resp = client.get(f"/candidates/{created['id']}")
    assert get_resp.status_code == 404


def test_delete_candidate_not_found(client, recruiter):
    resp = client.delete("/candidates/000000000000000000000000")
    assert resp.status_code == 404
