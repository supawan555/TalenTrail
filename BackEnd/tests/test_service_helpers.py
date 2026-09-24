"""Unit tests for small pure/near-pure helpers in the services layer:

    app/services/user.py       - to_profile_payload, get_user_by_email_or_404
    app/services/candidates.py - init_candidate_metadata

Testing strategy
----------------
* ``to_profile_payload`` and ``init_candidate_metadata`` are pure dict
  transforms - call them directly.
* ``get_user_by_email_or_404`` reads ``auth_users_collection``; we monkeypatch
  that module-level handle with a MagicMock and steer ``find_one``.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import candidates as candidates_service
from app.services import user as user_service

pytestmark = pytest.mark.unit


# ===========================================================================
# to_profile_payload
# ===========================================================================
class TestToProfilePayload:
    """Shape a raw user document into the {name, email, role} API payload."""

    def test_maps_the_three_fields_and_drops_the_rest(self) -> None:
        """
        Scenario: A full user document with extra keys.
        Expected: Only name / email / role come through.

        Arrange: a user dict with an extra "password_hash" key.
        Act:     to_profile_payload(user).
        Assert:  exactly {"name", "email", "role"} with the right values.
        """
        user = {
            "name": "Jane",
            "email": "jane@example.com",
            "role": "hr",
            "password_hash": "should-not-appear",
        }
        assert user_service.to_profile_payload(user) == {
            "name": "Jane",
            "email": "jane@example.com",
            "role": "hr",
        }

    def test_missing_name_and_email_default_to_empty_string(self) -> None:
        """
        Scenario: The document has no "name" and no "email".
        Expected: Both come back as "" (not missing, not None) so the frontend
                  can bind to them safely.

        Arrange: a dict with only "role".
        Act:     to_profile_payload(user).
        Assert:  name == "" and email == "".
        """
        out = user_service.to_profile_payload({"role": "hr"})
        assert out["name"] == ""
        assert out["email"] == ""

    def test_missing_role_defaults_to_none(self) -> None:
        """
        Scenario: The document has no "role".
        Expected: role is None (the code uses .get("role") with no default).

        Arrange: a dict with name + email only.
        Act:     to_profile_payload(user).
        Assert:  role is None.
        """
        out = user_service.to_profile_payload({"name": "Jane", "email": "jane@example.com"})
        assert out["role"] is None


# ===========================================================================
# get_user_by_email_or_404
# ===========================================================================
class TestGetUserByEmailOr404:
    def test_returns_the_document_when_found(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: A user with that email exists.
        Expected: The raw document is returned, and the lookup used the email
                  as the filter.

        Arrange: MagicMock collection whose find_one returns a doc.
        Act:     get_user_by_email_or_404("jane@example.com").
        Assert:  the doc comes back; find_one was called with {"email": ...}.
        """
        # Arrange
        collection = MagicMock()
        collection.find_one.return_value = {"email": "jane@example.com", "name": "Jane"}
        monkeypatch.setattr(user_service, "auth_users_collection", collection)

        # Act
        result = user_service.get_user_by_email_or_404("jane@example.com")

        # Assert
        assert result["name"] == "Jane"
        collection.find_one.assert_called_once_with({"email": "jane@example.com"})

    def test_raises_404_when_not_found(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        Scenario: No user matches the email.
        Expected: HTTPException(404).

        Arrange: MagicMock collection whose find_one returns None.
        Act:     get_user_by_email_or_404("ghost@example.com").
        Assert:  HTTPException with status_code 404.
        """
        # Arrange
        collection = MagicMock()
        collection.find_one.return_value = None
        monkeypatch.setattr(user_service, "auth_users_collection", collection)

        # Act / Assert
        with pytest.raises(HTTPException) as exc_info:
            user_service.get_user_by_email_or_404("ghost@example.com")
        assert exc_info.value.status_code == 404


# ===========================================================================
# init_candidate_metadata
# ===========================================================================
class TestInitCandidateMetadata:
    """Merge lifecycle defaults into a new candidate document."""

    def test_applies_the_default_lifecycle_fields(self) -> None:
        """
        Scenario: A brand-new candidate dict is initialised.
        Expected: current_state="applied", status="active", and the three
                  outcome timestamps (hired_at / rejected_at / interview_at)
                  start as None.

        Arrange: empty input dict.
        Act:     init_candidate_metadata({}).
        Assert:  each default field has the expected value.
        """
        out = candidates_service.init_candidate_metadata({})
        assert out["current_state"] == "applied"
        assert out["status"] == "active"
        assert out["hired_at"] is None
        assert out["rejected_at"] is None
        assert out["interview_at"] is None

    def test_state_history_starts_with_one_open_applied_entry(self) -> None:
        """
        Scenario: Fresh candidate.
        Expected: state_history has exactly one entry: state "applied", a real
                  entered_at datetime, and exited_at still None (the stage is
                  "open").

        Arrange: empty input.
        Act:     init_candidate_metadata({}).
        Assert:  single entry with the expected fields.
        """
        history = candidates_service.init_candidate_metadata({})["state_history"]
        assert len(history) == 1
        assert history[0]["state"] == "applied"
        assert history[0]["exited_at"] is None
        assert isinstance(history[0]["entered_at"], datetime)

    def test_created_at_is_iso_string_and_applied_at_is_datetime(self) -> None:
        """
        Scenario: Fresh candidate.
        Expected: created_at is an ISO-8601 *string* (JSON-friendly), while
                  applied_at is a raw datetime object. This asymmetry is
                  intentional in the source, so the test pins it.

        Arrange: empty input.
        Act:     init_candidate_metadata({}).
        Assert:  created_at parses via datetime.fromisoformat; applied_at is a datetime.
        """
        out = candidates_service.init_candidate_metadata({})
        assert isinstance(out["created_at"], str)
        datetime.fromisoformat(out["created_at"])  # raises if not valid ISO
        assert isinstance(out["applied_at"], datetime)

    def test_caller_supplied_business_fields_are_preserved(self) -> None:
        """
        Scenario: The input already carries real data (name, role).
        Expected: Those keys survive untouched alongside the injected defaults.

        Arrange: input dict with name + role.
        Act:     init_candidate_metadata(data).
        Assert:  name and role are unchanged.
        """
        out = candidates_service.init_candidate_metadata({"name": "Jane", "role": "Developer"})
        assert out["name"] == "Jane"
        assert out["role"] == "Developer"

    def test_defaults_win_over_caller_supplied_lifecycle_keys(self) -> None:
        """
        Scenario: The caller passes their own status / current_state values.
        Expected: They are overridden. The source does `{**data, **defaults}`, so
                  `defaults` is spread LAST and therefore wins on any key clash.
                  This test documents that precedence.

        Arrange: input dict with status="archived", current_state="hired".
        Act:     init_candidate_metadata(data).
        Assert:  status is back to "active", current_state back to "applied".
        """
        out = candidates_service.init_candidate_metadata(
            {"status": "archived", "current_state": "hired"}
        )
        assert out["status"] == "active"
        assert out["current_state"] == "applied"
