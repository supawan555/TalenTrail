"""Response parsing, repair, and the status contract. Never touches the network.

The rule this file enforces: **zero silent zeros**. Every malformed model output
resolves to either a valid score or an explicit non-scored status. Nothing is
allowed to produce a number the model did not actually give.
"""

from __future__ import annotations

import json

import pytest

from app.ml import resume_matcher
from app.ml.resume_matcher import (
    STATUS_INPUT_INVALID,
    STATUS_MODEL_UNAVAILABLE,
    STATUS_PARSE_ERROR,
    STATUS_SCORED,
    parse_llm_response,
)
from tests.eval.mocks import fixed_responder, install_fake_langchain, sequence_responder

pytestmark = pytest.mark.parsing

RESUME = "Senior Frontend Developer, 7 years React and TypeScript."
JOB = "Senior Frontend Developer. Required: 5+ years React, TypeScript."

WELL_FORMED = {"score": 85, "strengths": ["React", "TypeScript"], "missing_skills": ["Next.js"]}
GOOD_JSON = json.dumps(WELL_FORMED)


def analyze(raw: str) -> dict:
    """Feed a raw model response through the real parser, twice if it retries."""
    with install_fake_langchain(fixed_responder(raw)):
        return resume_matcher._run_llm_analysis(RESUME, JOB)


class TestParsingHandled:
    """Shapes that parse without any repair."""

    def test_plain_json(self) -> None:
        result = analyze(GOOD_JSON)
        assert result["status"] == STATUS_SCORED
        assert result["score"] == 85
        assert result["repair"] is None

    def test_json_fenced_block(self) -> None:
        assert analyze(f"```json\n{GOOD_JSON}\n```")["score"] == 85

    def test_bare_fenced_block(self) -> None:
        assert analyze(f"```\n{GOOD_JSON}\n```")["score"] == 85

    def test_uppercase_fence_language(self) -> None:
        assert analyze(f"```JSON\n{GOOD_JSON}\n```")["score"] == 85

    def test_surrounding_whitespace(self) -> None:
        assert analyze(f"\n\n  {GOOD_JSON}  \n\n")["score"] == 85

    def test_score_as_numeric_string(self) -> None:
        assert analyze('{"score": "85", "strengths": [], "missing_skills": []}')["score"] == 85

    def test_score_as_float(self) -> None:
        assert analyze('{"score": 85.7, "strengths": [], "missing_skills": []}')["score"] == 85

    def test_score_above_100_is_clamped(self) -> None:
        assert analyze('{"score": 150, "strengths": [], "missing_skills": []}')["score"] == 100

    def test_negative_score_is_clamped(self) -> None:
        assert analyze('{"score": -20, "strengths": [], "missing_skills": []}')["score"] == 0

    def test_extra_keys_ignored(self) -> None:
        raw = '{"score": 72, "strengths": [], "missing_skills": [], "verdict": "hire"}'
        assert analyze(raw)["score"] == 72

    def test_non_string_list_items_coerced(self) -> None:
        result = analyze('{"score": 60, "strengths": [1, null, "React", "  "], "missing_skills": []}')
        assert result["strengths"] == ["1", "None", "React"]

    def test_strengths_not_a_list_becomes_empty(self) -> None:
        result = analyze('{"score": 60, "strengths": "React and TS", "missing_skills": []}')
        assert result["strengths"] == []


class TestRepairRecovers:
    """The shapes that previously collapsed to a silent 0 and now parse.

    Each of these is a real mistral behaviour: it wraps JSON in prose, fences it,
    uses python-style quoting, or writes a percentage.
    """

    @pytest.mark.parametrize(
        "label,raw,expected",
        [
            ("prose preamble", f"Here is the analysis:\n{GOOD_JSON}", 85),
            ("trailing commentary", f"{GOOD_JSON}\n\nHope this helps!", 85),
            ("prose both sides", f"Sure!\n{GOOD_JSON}\nLet me know.", 85),
            ("markdown bold wrapper", f"**Result:**\n{GOOD_JSON}", 85),
            (
                "single quotes",
                "{'score': 85, 'strengths': [], 'missing_skills': []}",
                85,
            ),
            (
                "trailing comma",
                '{"score": 85, "strengths": [], "missing_skills": [],}',
                85,
            ),
            (
                "unquoted keys",
                '{score: 85, strengths: [], missing_skills: []}',
                85,
            ),
            (
                "score with percent sign",
                '{"score": "85%", "strengths": [], "missing_skills": []}',
                85,
            ),
            ("nested under a wrapper", f'{{"result": {GOOD_JSON}}}', 85),
            ("two json objects", f"{GOOD_JSON}\n{GOOD_JSON}", 85),
            ("fenced with prose", f"Analysis below.\n```json\n{GOOD_JSON}\n```\nDone.", 85),
        ],
    )
    def test_repaired_to_valid_score(self, label: str, raw: str, expected: int) -> None:
        result = analyze(raw)
        assert result["status"] == STATUS_SCORED, f"{label} -> {result['status']}"
        assert result["score"] == expected, label
        assert result["repair"] is not None, f"{label} should record a repair strategy"


class TestUnrecoverableBecomesParseError:
    """No score is recoverable, so the result is parse_error - never a number."""

    @pytest.mark.parametrize(
        "label,raw",
        [
            ("empty response", ""),
            ("whitespace only", "   \n\t "),
            ("plain refusal", "I cannot evaluate this resume."),
            ("score spelled out", '{"score": "eighty-five", "strengths": []}'),
            ("null score", '{"score": null, "strengths": [], "missing_skills": []}'),
            ("missing score key", '{"strengths": ["React"], "missing_skills": []}'),
            ("prose with a number but no json", "I would rate this candidate 85 out of 100."),
            ("truncated mid-json", '{"score": 85, "strengths": ["Rea'),
        ],
    )
    def test_returns_parse_error_not_zero(self, label: str, raw: str) -> None:
        result = analyze(raw)
        assert result["status"] == STATUS_PARSE_ERROR, label
        assert result["score"] is None, f"{label} produced a score of {result['score']}"
        assert result["error"]

    def test_no_silent_zeros_anywhere(self) -> None:
        """The headline guarantee of Step 1, asserted over every bad shape."""
        bad_shapes = [
            "",
            "   ",
            "I cannot evaluate this resume.",
            '{"score": "eighty-five"}',
            '{"score": null}',
            '{"strengths": []}',
            "I would rate this candidate 85 out of 100.",
            '{"score": 85, "strengths": ["Rea',
        ]
        for raw in bad_shapes:
            result = analyze(raw)
            assert result["score"] is not 0, raw  # noqa: F632 - identity is the point
            assert result["score"] is None, raw
            assert result["status"] != STATUS_SCORED, raw


class TestStrictRetry:
    """One retry with a format-only instruction, then give up."""

    def test_retry_recovers_a_bad_first_response(self) -> None:
        with install_fake_langchain(
            sequence_responder(["I cannot produce JSON.", GOOD_JSON])
        ) as rec:
            result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["status"] == STATUS_SCORED
        assert result["score"] == 85
        assert result["attempts"] == 2
        assert rec.count == 2

    def test_retry_uses_constrained_json_and_a_format_only_reminder(self) -> None:
        with install_fake_langchain(
            sequence_responder(["not json", GOOD_JSON])
        ) as rec:
            resume_matcher._run_llm_analysis(RESUME, JOB)

        first, second = rec.calls
        assert first.kwargs.get("response_mime_type") is None, "attempt 1 must be unconstrained"
        assert second.kwargs.get("response_mime_type") == "application/json", "retry should constrain decoding"
        assert "could not be parsed" in second.rendered_prompt
        # The retry must not change how scoring is judged, only the output format.
        assert "professional HR recruiter" in second.rendered_prompt

    def test_only_one_retry(self) -> None:
        with install_fake_langchain(
            sequence_responder(["nope", "still nope", GOOD_JSON])
        ) as rec:
            result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["status"] == STATUS_PARSE_ERROR
        assert result["score"] is None
        assert rec.count == 2, "should stop after one retry, not keep trying"

    def test_good_first_response_does_not_retry(self) -> None:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["attempts"] == 1
        assert rec.count == 1


class TestStatusContract:
    def test_empty_resume_is_input_invalid(self) -> None:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            result = resume_matcher._run_llm_analysis("", JOB)
        assert result["status"] == STATUS_INPUT_INVALID
        assert result["score"] is None
        assert rec.count == 0, "the model was called despite an empty resume"

    def test_empty_job_description_is_input_invalid(self) -> None:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            result = resume_matcher._run_llm_analysis(RESUME, "")
        assert result["status"] == STATUS_INPUT_INVALID
        assert result["score"] is None
        assert rec.count == 0

    def test_whitespace_only_resume_is_input_invalid(self) -> None:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            result = resume_matcher._run_llm_analysis("   \n\t  ", JOB)
        assert result["status"] == STATUS_INPUT_INVALID
        assert rec.count == 0

    def test_missing_langchain_is_model_unavailable(self, monkeypatch) -> None:
        """A missing package must never look like a bad candidate."""
        import builtins

        real_import = builtins.__import__

        def blocked(name, *args, **kwargs):
            if name.startswith("langchain"):
                raise ImportError(f"No module named {name!r}")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", blocked)
        result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["status"] == STATUS_MODEL_UNAVAILABLE
        assert result["score"] is None
        assert "langchain" in result["error"]

    def test_missing_api_key_is_model_unavailable(self, monkeypatch) -> None:
        """A missing GEMINI_API_KEY must never look like a bad candidate."""
        monkeypatch.setattr(resume_matcher.settings, "GEMINI_API_KEY", "")
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["status"] == STATUS_MODEL_UNAVAILABLE
        assert result["score"] is None
        assert "GEMINI_API_KEY" in result["error"]
        assert rec.count == 0, "the model was called despite a missing API key"

    def test_llm_call_failure_is_model_unavailable(self) -> None:
        def explode(_prompt: str) -> str:
            raise ConnectionError("connection refused")

        with install_fake_langchain(explode):
            result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["status"] == STATUS_MODEL_UNAVAILABLE
        assert result["score"] is None
        assert "connection refused" in result["error"]

    def test_quota_exhaustion_is_reported_distinctly(self, caplog) -> None:
        """A 429 must be told apart from an outage so the fix (billing, not a retry) is obvious."""

        class FakeClientError(Exception):
            code = 429
            status = "RESOURCE_EXHAUSTED"

        def explode(_prompt: str) -> str:
            try:
                raise FakeClientError("quota exceeded")
            except FakeClientError as cause:
                raise RuntimeError(f"Error calling model: 429 RESOURCE_EXHAUSTED: {cause}") from cause

        with install_fake_langchain(explode):
            result = resume_matcher._run_llm_analysis(RESUME, JOB)
        assert result["status"] == STATUS_MODEL_UNAVAILABLE
        assert result["score"] is None
        assert "quota" in result["error"].lower()
        assert "GEMINI QUOTA EXCEEDED" in caplog.text

    def test_non_scored_llm_result_propagates_through_combine(self) -> None:
        """The semantic half must not rescue a failed LLM half."""
        for status in (STATUS_PARSE_ERROR, STATUS_MODEL_UNAVAILABLE, STATUS_INPUT_INVALID):
            result = resume_matcher.combine_scores(
                {"status": status, "score": None, "error": "boom"}, RESUME, JOB
            )
            assert result["status"] == status
            assert result["final_score"] is None
            assert result["llm_score"] is None
            assert result["semantic_score"] is None

    def test_scored_result_carries_all_three_numbers(self, monkeypatch) -> None:
        monkeypatch.setattr(resume_matcher, "match_resume_to_job", lambda r, j: 60.0)
        result = resume_matcher.combine_scores(
            {"status": STATUS_SCORED, "score": 80, "strengths": [], "missing_skills": []},
            RESUME,
            JOB,
        )
        assert result["status"] == STATUS_SCORED
        assert result["llm_score"] == 80
        assert result["semantic_score"] == 60.0
        assert result["final_score"] == 74  # 80*0.7 + 60*0.3


class TestScoreCoercion:
    @pytest.mark.parametrize(
        "value,expected",
        [
            (85, 85), (85.7, 85), ("85", 85), ("85%", 85), (" 85 ", 85),
            ("85.0", 85), (150, 100), (-20, 0), (0, 0), ("0", 0),
            (None, None), ("", None), ("eighty-five", None), (True, None),
            ([], None), ({}, None), ("abc", None), (float("nan"), None),
        ],
    )
    def test_clamp_score(self, value, expected) -> None:
        assert resume_matcher._clamp_score(value) == expected


class TestPromptContract:
    def _rendered(self) -> str:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            resume_matcher._run_llm_analysis(RESUME, JOB)
        return rec.last.rendered_prompt

    def test_schema_braces_survive_escaping(self) -> None:
        prompt = self._rendered()
        assert '{"score": integer 0-100' in prompt

    def test_both_inputs_reach_the_model(self) -> None:
        prompt = self._rendered()
        assert RESUME in prompt
        assert JOB in prompt

    def test_model_is_pinned_to_an_explicit_tag(self) -> None:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            resume_matcher._run_llm_analysis(RESUME, JOB)
        assert rec.last.model == resume_matcher.GEMINI_MODEL
        assert rec.last.temperature == 0

    def test_timeout_is_configured(self) -> None:
        """An unreachable Gemini must fail, not hang forever."""
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            resume_matcher._run_llm_analysis(RESUME, JOB)
        assert rec.last.kwargs.get("timeout")

    def test_api_key_is_passed_explicitly(self) -> None:
        with install_fake_langchain(fixed_responder(GOOD_JSON)) as rec:
            resume_matcher._run_llm_analysis(RESUME, JOB)
        assert rec.last.kwargs.get("google_api_key")


class TestModelAgreement:
    """The healthcheck must score against the model scoring actually uses.

    When these drifted apart, boot logged "resume scoring ready" while every
    candidate failed with model_unavailable - the worst possible combination,
    because the healthcheck gave false confidence.
    """

    def test_health_and_scoring_share_one_model(self) -> None:
        from app.ml import health

        assert health.GEMINI_MODEL == resume_matcher.GEMINI_MODEL


class TestParseHelper:
    """parse_llm_response in isolation."""

    def test_returns_repair_name(self) -> None:
        payload, repair = parse_llm_response(f"Here you go:\n{GOOD_JSON}")
        assert payload["score"] == 85
        assert repair == "extract"

    def test_returns_none_for_garbage(self) -> None:
        payload, repair = parse_llm_response("nope")
        assert payload is None
        assert repair is None

    def test_handles_list_content(self) -> None:
        payload, _ = parse_llm_response([GOOD_JSON])
        assert payload["score"] == 85

    def test_braces_inside_strings_do_not_break_extraction(self) -> None:
        raw = '{"score": 70, "strengths": ["uses {curly} braces"], "missing_skills": []}'
        payload, _ = parse_llm_response(raw)
        assert payload["score"] == 70


class TestTypeGuards:
    """Wrong argument types raise instead of degrading to zeros."""

    def test_dict_job_description_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="job_description must be str"):
            resume_matcher.analyze_resume(RESUME, {"description": JOB})

    def test_dict_resume_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="resume_text must be str"):
            resume_matcher.analyze_resume({"text": RESUME}, JOB)

    def test_none_job_description_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="job_description must be str"):
            resume_matcher.analyze_resume(RESUME, None)

    def test_error_message_names_the_fix(self) -> None:
        """The message should point at the actual caller bug."""
        with pytest.raises(ValueError, match=r"job\['description'\]"):
            resume_matcher.analyze_resume(RESUME, {"description": JOB})
