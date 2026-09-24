"""Integration tests for /jobs (and its /job-descriptions legacy alias)."""


def _job_payload(**overrides):
    payload = {
        "department": "Engineering",
        "role": "Backend Developer",
        "description": "Python, FastAPI, MongoDB",
        "isHidden": False,
    }
    payload.update(overrides)
    return payload


def test_create_and_list_job(client):
    create_resp = client.post("/jobs", json=_job_payload())
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    assert created["id"]
    assert created["department"] == "Engineering"
    assert created["role"] == "Backend Developer"
    assert created["createdDate"]

    list_resp = client.get("/jobs")
    assert list_resp.status_code == 200
    jobs = list_resp.json()
    assert len(jobs) == 1
    assert jobs[0]["id"] == created["id"]


def test_update_job(client):
    created = client.post("/jobs", json=_job_payload()).json()

    update_resp = client.put(f"/jobs/{created['id']}", json=_job_payload(role="Senior Backend Developer"))
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["role"] == "Senior Backend Developer"
    assert updated["id"] == created["id"]
    # createdDate is preserved across an update.
    assert updated["createdDate"] == created["createdDate"]


def test_update_job_not_found(client):
    resp = client.put("/jobs/000000000000000000000000", json=_job_payload())
    assert resp.status_code == 404


def test_update_job_invalid_id(client):
    resp = client.put("/jobs/not-an-object-id", json=_job_payload())
    assert resp.status_code == 400


def test_delete_job(client):
    created = client.post("/jobs", json=_job_payload()).json()

    delete_resp = client.delete(f"/jobs/{created['id']}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["deleted"] is True

    list_resp = client.get("/jobs")
    assert list_resp.json() == []


def test_delete_job_not_found(client):
    resp = client.delete("/jobs/000000000000000000000000")
    assert resp.status_code == 404


def test_legacy_job_descriptions_alias_shares_same_data(client):
    created = client.post("/job-descriptions", json=_job_payload()).json()

    via_canonical = client.get("/jobs").json()
    via_legacy = client.get("/job-descriptions").json()
    assert len(via_canonical) == 1
    assert len(via_legacy) == 1
    assert via_canonical[0]["id"] == created["id"] == via_legacy[0]["id"]

    delete_resp = client.delete(f"/job-descriptions/{created['id']}")
    assert delete_resp.status_code == 200
    assert client.get("/jobs").json() == []
