"""Unit tests for the parts of ``app/ml/resume_matcher.py`` not already covered
by ``tests/test_parsing.py``.

``test_parsing.py`` exhaustively covers ``parse_llm_response`` /
``_run_llm_analysis`` / ``_clamp_score`` and the happy path of
``combine_scores``. This file fills the remaining gaps:

  * ``combine_scores``           - edge cases and the 70/30 weighting/clamping
  * small pure helpers           - ``_extract_text_content``, ``_safe_string_list``,
                                   ``_first_json_object``, ``_single_to_double_quotes``,
                                   ``_find_score_payload``, ``_is_quota_exhausted``
  * ``match_resume_to_job``      - the score-normalisation maths, with the SBERT
                                   model and cosine call faked out

Nothing here touches the network or downloads a model.
"""

from __future__ import annotations

import types

import pytest

from app.ml import resume_matcher
from app.ml.resume_matcher import (
    STATUS_MODEL_UNAVAILABLE,
    STATUS_PARSE_ERROR,
    STATUS_SCORED,
    ModelUnavailableError,
    combine_scores,
)

pytestmark = pytest.mark.unit

RESUME = "Backend engineer, 5 years Python and PostgreSQL."
JOB = "Backend engineer. Python, PostgreSQL, REST APIs."


@pytest.fixture()
def stub_semantic(monkeypatch: pytest.MonkeyPatch):
    """Return a setter that pins ``match_resume_to_job`` to a constant.

    ``combine_scores`` looks up ``match_resume_to_job`` as a module global, so
    replacing the attribute is enough to keep the test offline and deterministic.
    """

    def _set(value: float) -> None:
        monkeypatch.setattr(resume_matcher, "match_resume_to_job", lambda _r, _j: value)

    return _set


# ===========================================================================
# combine_scores  (gaps only)
# ===========================================================================
def test_none_llm_result_becomes_parse_error(stub_semantic) -> None:
    """
    Scenario: combine_scores is called with llm_result=None (e.g. an upstream
              bug passed nothing).
    Expected: status "parse_error" and every score field None - the semantic
              half is never allowed to stand in for a missing LLM half.

    Arrange: stub the semantic score (it should not matter).
    Act:     combine_scores(None, RESUME, JOB).
    Assert:  status is parse_error and final_score is None.
    """
    # Arrange
    stub_semantic(50.0)

    # Act
    result = combine_scores(None, RESUME, JOB)

    # Assert
    assert result["status"] == STATUS_PARSE_ERROR
    assert result["final_score"] is None


def test_scored_status_but_unreadable_score_becomes_parse_error(stub_semantic) -> None:
    """
    Scenario: The LLM result claims status "scored" but its "score" is junk
              ("not a number").
    Expected: combine_scores refuses to invent a number: status "parse_error",
              final_score None.

    Arrange: stub semantic score; build an llm_result with a non-numeric score.
    Act:     combine_scores(llm_result, RESUME, JOB).
    Assert:  parse_error / None.
    """
    # Arrange
    stub_semantic(50.0)
    llm_result = {"status": STATUS_SCORED, "score": "not a number"}

    # Act
    result = combine_scores(llm_result, RESUME, JOB)

    # Assert
    assert result["status"] == STATUS_PARSE_ERROR
    assert result["final_score"] is None


def test_sbert_failure_propagates_as_model_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Scenario: The LLM scored fine, but the SBERT model is unavailable and
              match_resume_to_job raises ModelUnavailableError.
    Expected: status "model_unavailable", final_score None, and the error text
              mentions sbert.

    Arrange: monkeypatch match_resume_to_job to raise ModelUnavailableError.
    Act:     combine_scores(a scored llm_result, RESUME, JOB).
    Assert:  model_unavailable / None / "sbert" in error.
    """
    # Arrange
    def _boom(_r, _j):
        raise ModelUnavailableError("model file missing")

    monkeypatch.setattr(resume_matcher, "match_resume_to_job", _boom)

    # Act
    result = combine_scores({"status": STATUS_SCORED, "score": 80}, RESUME, JOB)

    # Assert
    assert result["status"] == STATUS_MODEL_UNAVAILABLE
    assert result["final_score"] is None
    assert "sbert" in result["error"].lower()


def test_semantic_score_above_100_is_clamped(stub_semantic) -> None:
    """
    Scenario: The semantic scorer returns 250 (out of range).
    Expected: It is clamped to 100 before being blended, and reported as 100.0.

    Arrange: stub semantic score = 250.0; llm score = 100.
    Act:     combine_scores(...).
    Assert:  semantic_score == 100.0 and final_score == 100
             (round(100*0.7 + 100*0.3)).
    """
    # Arrange
    stub_semantic(250.0)

    # Act
    result = combine_scores({"status": STATUS_SCORED, "score": 100}, RESUME, JOB)

    # Assert
    assert result["semantic_score"] == 100.0
    assert result["final_score"] == 100


def test_semantic_score_is_rounded_to_two_decimals(stub_semantic) -> None:
    """
    Scenario: The semantic scorer returns a long float (33.33333).
    Expected: The reported semantic_score is rounded to 2 dp (33.33).

    Arrange: stub semantic score = 33.33333.
    Act:     combine_scores(...).
    Assert:  result["semantic_score"] == 33.33.
    """
    stub_semantic(33.33333)
    result = combine_scores({"status": STATUS_SCORED, "score": 90}, RESUME, JOB)
    assert result["semantic_score"] == 33.33


@pytest.mark.parametrize(
    "llm_score, semantic_score, expected_final",
    [
        pytest.param(90, 40, 75, id="63.0 + 12.0"),
        pytest.param(80, 60, 74, id="56.0 + 18.0"),
        pytest.param(50, 100, 65, id="35.0 + 30.0"),
        pytest.param(100, 0, 70, id="70.0 + 0.0"),
    ],
)
def test_final_score_is_weighted_70_llm_30_semantic(
    stub_semantic, llm_score: int, semantic_score: float, expected_final: int
) -> None:
    """
    Scenario: Both halves scored; check the blend.
    Expected: final_score == round(llm*0.7 + semantic*0.3).

    We deliberately choose pairs whose blend is a whole number. Blends that land
    exactly on x.5 are avoided on purpose: floating-point noise (0.7 and 0.3 are
    not exact in binary) makes "round half to even" non-deterministic there, and
    a test should not depend on it.

    Arrange: stub the semantic score; pick an llm score.
    Act:     combine_scores(...).
    Assert:  final_score equals the hand-computed blend.
    """
    stub_semantic(semantic_score)
    result = combine_scores({"status": STATUS_SCORED, "score": llm_score}, RESUME, JOB)
    assert result["final_score"] == expected_final


def test_strengths_and_missing_skills_are_normalised(stub_semantic) -> None:
    """
    Scenario: The LLM result's list fields contain noise: a number, None, and a
              whitespace-only string.
    Expected: combine_scores runs them through _safe_string_list: every item is
              str()-ed and stripped, and blank items are dropped. Note that None
              becomes the literal string "None" (it is stringified, not removed).

    Arrange: stub semantic score; llm_result with messy lists.
    Act:     combine_scores(...).
    Assert:  strengths == ["1", "None", "React"], missing_skills == ["Go"].
    """
    # Arrange
    stub_semantic(50.0)
    llm_result = {
        "status": STATUS_SCORED,
        "score": 70,
        "strengths": [1, None, "React", "   "],
        "missing_skills": ["  Go  "],
    }

    # Act
    result = combine_scores(llm_result, RESUME, JOB)

    # Assert
    assert result["strengths"] == ["1", "None", "React"]
    assert result["missing_skills"] == ["Go"]


# ===========================================================================
# _extract_text_content
# ===========================================================================
@pytest.mark.parametrize(
    "content, expected",
    [
        pytest.param("plain string", "plain string", id="str-passthrough"),
        pytest.param(
            [{"type": "text", "text": "hello "}, {"type": "text", "text": "world"}],
            "hello world",
            id="gemini-style-content-blocks-joined",
        ),
        pytest.param(
            [{"type": "text", "text": "a"}, {"type": "image", "url": "x"}],
            "a",
            id="dict-without-text-key-skipped",
        ),
        pytest.param(["bare", "items"], "bareitems", id="non-dict-items-stringified"),
        pytest.param(None, "", id="none-becomes-empty"),
        pytest.param(123, "123", id="other-type-stringified"),
    ],
)
def test_extract_text_content(content, expected: str) -> None:
    """
    Scenario: LangChain message .content comes in several shapes - a plain
              string (old Ollama), or a list of block dicts (Gemini).
    Expected: _extract_text_content flattens all of them to the concatenated
              text, and returns "" for None.

    Arrange/Act/Assert: parametrized input -> expected string.
    """
    assert resume_matcher._extract_text_content(content) == expected


# ===========================================================================
# _safe_string_list
# ===========================================================================
@pytest.mark.parametrize(
    "value, expected",
    [
        pytest.param(["a", "b"], ["a", "b"], id="already-clean"),
        pytest.param([" a ", "", "  ", "b"], ["a", "b"], id="strips-and-drops-blanks"),
        pytest.param([1, None, "x"], ["1", "None", "x"], id="stringifies-non-strings"),
        pytest.param("not a list", [], id="non-list-becomes-empty"),
        pytest.param(None, [], id="none-becomes-empty"),
        pytest.param({"a": 1}, [], id="dict-becomes-empty"),
    ],
)
def test_safe_string_list(value, expected: list[str]) -> None:
    """
    Scenario: Normalise a value that should be a list of strings but might not be.
    Expected: A list of non-empty, stripped strings; anything that is not a list
              yields [].
    """
    assert resume_matcher._safe_string_list(value) == expected


# ===========================================================================
# _first_json_object
# ===========================================================================
class TestFirstJsonObject:
    """Extract the first balanced {...} block from a noisy string."""

    def test_returns_none_when_there_is_no_brace(self) -> None:
        """No '{' at all -> None."""
        assert resume_matcher._first_json_object("no json here") is None

    def test_extracts_a_simple_block_between_prose(self) -> None:
        """Prose on both sides -> just the object."""
        assert resume_matcher._first_json_object('prefix {"a": 1} suffix') == '{"a": 1}'

    def test_handles_nested_braces(self) -> None:
        """Depth counting keeps nested objects intact."""
        assert resume_matcher._first_json_object('{"a": {"b": 2}} trailing') == '{"a": {"b": 2}}'

    def test_ignores_braces_that_live_inside_a_string(self) -> None:
        """A '}' inside a JSON string value must not end the block early."""
        raw = '{"a": "has a } brace inside"}'
        assert resume_matcher._first_json_object(raw) == raw

    def test_handles_an_escaped_quote_inside_a_string(self) -> None:
        r"""An escaped \" must not be read as the end of the string."""
        raw = '{"a": "quote \\" then } brace"}'
        assert resume_matcher._first_json_object(raw) == raw

    def test_returns_the_first_of_two_objects(self) -> None:
        """Two concatenated objects -> the first one wins."""
        assert resume_matcher._first_json_object('{"a": 1}{"b": 2}') == '{"a": 1}'

    def test_returns_none_when_the_object_never_closes(self) -> None:
        """Unbalanced (no closing '}') -> None."""
        assert resume_matcher._first_json_object('{"a": 1, "b": [1, 2') is None


# ===========================================================================
# _single_to_double_quotes
# ===========================================================================
@pytest.mark.parametrize(
    "text, expected",
    [
        pytest.param("{'a': 1}", '{"a": 1}', id="swaps-when-no-double-quotes"),
        pytest.param('{"a": 1}', '{"a": 1}', id="untouched-when-already-double-quoted"),
        pytest.param("{'a': \"x\"}", "{'a': \"x\"}", id="untouched-when-any-double-quote-present"),
    ],
)
def test_single_to_double_quotes(text: str, expected: str) -> None:
    """
    Scenario: Some models emit Python-style single-quoted pseudo-JSON.
    Expected: _single_to_double_quotes swaps ' for " ONLY when the block has no
              double quote already (swapping a mixed block would corrupt it).
    """
    assert resume_matcher._single_to_double_quotes(text) == expected


# ===========================================================================
# _find_score_payload
# ===========================================================================
class TestFindScorePayload:
    """Locate the dict that actually carries a "score" key."""

    def test_returns_the_object_itself_when_it_has_score(self) -> None:
        """Top-level dict with "score" -> that same dict."""
        obj = {"score": 5, "strengths": []}
        assert resume_matcher._find_score_payload(obj) is obj

    def test_unwraps_one_level_of_nesting(self) -> None:
        """{"result": {"score": ...}} -> the inner dict."""
        inner = {"score": 5}
        assert resume_matcher._find_score_payload({"result": inner}) is inner

    def test_finds_a_scored_dict_inside_a_list(self) -> None:
        """A list containing a scored dict -> that dict."""
        inner = {"score": 5}
        assert resume_matcher._find_score_payload([{"nope": 1}, inner]) is inner

    def test_returns_none_when_no_score_anywhere_reachable(self) -> None:
        """Nested two levels deep is out of reach -> None."""
        assert resume_matcher._find_score_payload({"a": {"b": {"score": 5}}}) is None


# ===========================================================================
# _is_quota_exhausted
# ===========================================================================
class TestIsQuotaExhausted:
    """Tell a Gemini 429 (RESOURCE_EXHAUSTED) apart from a generic outage."""

    def test_true_when_the_exception_has_code_429(self) -> None:
        """A structured error object with code == 429."""

        class ClientError(Exception):
            code = 429

        assert resume_matcher._is_quota_exhausted(ClientError("quota")) is True

    def test_true_when_a_cause_in_the_chain_has_the_status(self) -> None:
        """LangChain wraps the real error; walk __cause__ for status."""

        class Inner(Exception):
            status = "RESOURCE_EXHAUSTED"

        try:
            try:
                raise Inner("inner")
            except Inner as cause:
                raise RuntimeError("wrapped by langchain") from cause
        except RuntimeError as exc:
            assert resume_matcher._is_quota_exhausted(exc) is True

    def test_true_when_only_the_message_text_mentions_it(self) -> None:
        """Fallback: the phrase appears in str(exc) even with no structured fields."""
        exc = RuntimeError("Error calling model: 429 RESOURCE_EXHAUSTED: ...")
        assert resume_matcher._is_quota_exhausted(exc) is True

    def test_false_for_an_unrelated_error(self) -> None:
        """A plain ValueError is not a quota problem."""
        assert resume_matcher._is_quota_exhausted(ValueError("bad input")) is False


# ===========================================================================
# match_resume_to_job  -  score normalisation maths
# ===========================================================================
class _FakeModel:
    """Its encode() output is opaque; the fake util.cos_sim ignores it anyway."""

    def encode(self, _text, convert_to_tensor=False):
        return object()


class _FakeCosSim:
    """Mimics the tensor returned by sentence_transformers.util.cos_sim."""

    def __init__(self, value: float) -> None:
        self._value = value

    def item(self) -> float:
        return self._value


@pytest.fixture()
def fake_sbert(monkeypatch: pytest.MonkeyPatch):
    """Return a setter that makes match_resume_to_job see a chosen raw cosine.

    We patch two module globals:
      * get_model  -> returns a fake model (no download)
      * util       -> a namespace whose cos_sim(...).item() is our chosen value
    """

    def _set(raw_cosine: float) -> None:
        monkeypatch.setattr(resume_matcher, "get_model", lambda: _FakeModel())
        monkeypatch.setattr(
            resume_matcher,
            "util",
            types.SimpleNamespace(cos_sim=lambda _a, _b: _FakeCosSim(raw_cosine)),
        )

    return _set


def test_falsy_input_returns_zero_without_loading_the_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Scenario: Either the resume text or the job text is empty.
    Expected: match_resume_to_job returns 0.0 immediately and never calls
              get_model() (no expensive model load for a no-op).

    Arrange: replace get_model with a spy that records if it was called.
    Act:     call with an empty resume, then an empty job.
    Assert:  both calls return 0.0 and the spy was never invoked.
    """
    # Arrange
    calls: list[int] = []
    monkeypatch.setattr(resume_matcher, "get_model", lambda: calls.append(1))

    # Act / Assert
    assert resume_matcher.match_resume_to_job("", "some job") == 0.0
    assert resume_matcher.match_resume_to_job("some resume", "") == 0.0
    assert calls == []


@pytest.mark.parametrize(
    "raw_cosine, expected",
    [
        pytest.param(0.15, 0.0, id="at-lower-threshold -> 0"),
        pytest.param(0.75, 100.0, id="at-upper-threshold -> 100"),
        pytest.param(0.05, 0.0, id="below-threshold clamps to 0"),
        pytest.param(0.95, 100.0, id="above-threshold clamps to 100"),
        pytest.param(-0.30, 0.0, id="negative cosine treated as 0"),
    ],
)
def test_normalisation_endpoints_and_clamping(fake_sbert, raw_cosine: float, expected: float) -> None:
    """
    Scenario: Drive match_resume_to_job with known raw cosine values.
    Expected: The raw cosine is mapped from the window [0.15, 0.75] onto [0, 1],
              clamped, then curved with ** 1.5 and scaled to 0-100. At the
              window edges and outside it the result is exactly 0.0 or 100.0.

    Arrange: fake_sbert(raw_cosine).
    Act:     match_resume_to_job("r", "j").
    Assert:  == expected.
    """
    fake_sbert(raw_cosine)
    assert resume_matcher.match_resume_to_job("r", "j") == pytest.approx(expected)


def test_midpoint_of_the_window_uses_the_power_curve(fake_sbert) -> None:
    """
    Scenario: raw cosine 0.45 sits exactly halfway across the [0.15, 0.75] window.
    Expected: normalised = 0.5, then final = (0.5 ** 1.5) * 100  (~35.36),
              i.e. the mapping is NOT linear - low-mid similarity is pushed down.

    Arrange: fake_sbert(0.45).
    Act:     match_resume_to_job("r", "j").
    Assert:  approx (0.5 ** 1.5) * 100.
    """
    fake_sbert(0.45)
    assert resume_matcher.match_resume_to_job("r", "j") == pytest.approx((0.5**1.5) * 100)


def test_encode_failure_raises_model_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Scenario: The model loads but .encode() blows up (e.g. out of memory).
    Expected: match_resume_to_job raises ModelUnavailableError rather than
              returning 0.0 (which would read as "no similarity").

    Arrange: get_model returns an object whose encode() raises; util is present
             (non-None) so we get past the early guard.
    Act:     match_resume_to_job("r", "j").
    Assert:  ModelUnavailableError is raised.
    """
    # Arrange
    class _BoomModel:
        def encode(self, *_a, **_k):
            raise RuntimeError("CUDA out of memory")

    monkeypatch.setattr(resume_matcher, "get_model", lambda: _BoomModel())
    monkeypatch.setattr(
        resume_matcher, "util", types.SimpleNamespace(cos_sim=lambda _a, _b: None)
    )

    # Act / Assert
    with pytest.raises(ModelUnavailableError):
        resume_matcher.match_resume_to_job("r", "j")
