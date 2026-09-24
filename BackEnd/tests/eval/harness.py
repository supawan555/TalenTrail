"""Runs eval cases through the production scoring path and collects statistics.

Two modes, both of which call the real ``app.ml.resume_matcher`` code:

live
    ``analyze_resume`` end to end, hitting Gemini and SBERT for real. Raw model output
    is recorded on a best-effort basis so parse failures can be told apart from
    scoring failures.

offline
    langchain is swapped for the fakes in ``mocks``, so the real prompt template, the
    real fence stripping, the real ``json.loads`` and the real combining maths still
    run. Only the network call and the SBERT model are stubbed.
"""

from __future__ import annotations

import contextlib
import json
import statistics
import time
from dataclasses import dataclass, field
from typing import Iterator, Optional

from app.ml import resume_matcher

from .fixtures.cases import EvalCase
from .mocks import CallRecorder, fixed_responder, install_fake_langchain, stub_semantic_score

LIVE = "live"
OFFLINE = "offline"


@dataclass
class ScoreOutcome:
    """One scoring run of one case.

    Scores are Optional: a non-scored status carries None, never 0. Treating an
    unavailable model as a zero is the exact confusion this harness exists to
    detect, so it must not be reintroduced here.
    """

    case_name: str
    category: str
    expected_band: tuple[int, int]
    mode: str
    status: str
    final_score: Optional[float]
    llm_score: Optional[float]
    semantic_score: Optional[float]
    strengths: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    raw_response: Optional[str] = None
    prompt_sent: Optional[str] = None
    duration_s: float = 0.0
    error: Optional[str] = None

    @property
    def scored(self) -> bool:
        return self.status == "scored" and self.final_score is not None

    @property
    def passed(self) -> bool:
        if not self.scored:
            return False
        low, high = self.expected_band
        return low <= self.final_score <= high

    @property
    def band_miss(self) -> Optional[float]:
        """Signed distance outside the band, or None when nothing was scored."""
        if not self.scored:
            return None
        low, high = self.expected_band
        if self.final_score < low:
            return self.final_score - low
        if self.final_score > high:
            return self.final_score - high
        return 0.0

    @property
    def llm_returned_zero(self) -> bool:
        """True when the LLM half scored a literal 0 (a verdict, not a failure)."""
        return self.llm_score == 0


@dataclass
class CaseStats:
    """Aggregate of N runs of one case (STEP 5)."""

    case_name: str
    category: str
    expected_band: tuple[int, int]
    outcomes: list[ScoreOutcome]

    @property
    def scores(self) -> list[float]:
        """Only scored runs. Non-scored runs are counted by ``not_scored``."""
        return [o.final_score for o in self.outcomes if o.scored]

    @property
    def not_scored(self) -> int:
        return sum(1 for o in self.outcomes if not o.scored)

    @property
    def mean(self) -> float:
        return statistics.fmean(self.scores) if self.scores else 0.0

    @property
    def stdev(self) -> float:
        return statistics.stdev(self.scores) if len(self.scores) > 1 else 0.0

    @property
    def minimum(self) -> float:
        return min(self.scores) if self.scores else 0.0

    @property
    def maximum(self) -> float:
        return max(self.scores) if self.scores else 0.0

    @property
    def spread(self) -> float:
        return self.maximum - self.minimum

    @property
    def pass_rate(self) -> float:
        if not self.outcomes:
            return 0.0
        return sum(1 for o in self.outcomes if o.passed) / len(self.outcomes)

    @property
    def mean_in_band(self) -> bool:
        if not self.scores:
            return False
        low, high = self.expected_band
        return low <= self.mean <= high

    def unstable(self, threshold: float) -> bool:
        return self.spread > threshold


# --------------------------------------------------------------------------
# Live-mode response recording (best effort)
# --------------------------------------------------------------------------


@contextlib.contextmanager
def record_live_llm() -> Iterator[CallRecorder]:
    """Record raw model output in live mode without altering behaviour.

    Subclasses the real ChatGoogleGenerativeAI so the production code path is
    untouched apart from an observation hook. If the subclass cannot be built
    for any reason the block still runs; the recorder simply stays empty.
    """
    recorder = CallRecorder()
    try:
        import langchain_google_genai

        real_cls = langchain_google_genai.ChatGoogleGenerativeAI

        class _RecordingChatGoogleGenerativeAI(real_cls):  # type: ignore[misc, valid-type]
            def invoke(self, input, config=None, **kwargs):  # type: ignore[override]
                result = super().invoke(input, config=config, **kwargs)
                content = getattr(result, "content", "")
                if isinstance(content, list):
                    content = "".join(str(part) for part in content)
                recorder.calls.append(
                    _lightweight_call(str(content), str(input))
                )
                return result

        langchain_google_genai.ChatGoogleGenerativeAI = _RecordingChatGoogleGenerativeAI
        try:
            yield recorder
        finally:
            langchain_google_genai.ChatGoogleGenerativeAI = real_cls
    except Exception:
        yield recorder


def _lightweight_call(raw_response: str, rendered_prompt: str):
    from .mocks import LLMCall

    return LLMCall(
        model=resume_matcher.GEMINI_MODEL,
        temperature=0,
        kwargs={},
        rendered_prompt=rendered_prompt,
        variables={},
        raw_response=raw_response,
    )


# --------------------------------------------------------------------------
# Running a case
# --------------------------------------------------------------------------


def _offline_responder(case: EvalCase):
    if case.mock_raw_override is not None:
        return fixed_responder(case.mock_raw_override)
    payload = json.dumps(
        {
            "score": case.mock_llm_score,
            "strengths": [f"evidence for {case.name}"],
            "missing_skills": [] if case.mock_llm_score >= 70 else ["gap"],
        }
    )
    return fixed_responder(payload)


def run_case(case: EvalCase, *, mode: str = OFFLINE) -> ScoreOutcome:
    """Score one case through ``analyze_resume``."""
    started = time.perf_counter()

    if mode == LIVE:
        with record_live_llm() as recorder:
            result = resume_matcher.analyze_resume(case.resume, case.job_description)
        raw = recorder.calls[-1].raw_response if recorder.calls else None
        prompt = recorder.calls[-1].rendered_prompt if recorder.calls else None
    else:
        responder = _offline_responder(case)
        with install_fake_langchain(responder) as recorder:
            with stub_semantic_score(resume_matcher, case.mock_semantic):
                result = resume_matcher.analyze_resume(case.resume, case.job_description)
        raw = recorder.calls[-1].raw_response if recorder.calls else None
        prompt = recorder.calls[-1].rendered_prompt if recorder.calls else None

    elapsed = time.perf_counter() - started

    def _opt(key: str) -> Optional[float]:
        value = result.get(key)
        return None if value is None else float(value)

    return ScoreOutcome(
        case_name=case.name,
        category=case.category,
        expected_band=case.expected_band,
        mode=mode,
        status=str(result.get("status", "unknown")),
        final_score=_opt("final_score"),
        llm_score=_opt("llm_score"),
        semantic_score=_opt("semantic_score"),
        strengths=list(result.get("strengths", [])),
        missing_skills=list(result.get("missing_skills", [])),
        raw_response=raw or result.get("raw_response"),
        prompt_sent=prompt,
        duration_s=elapsed,
        error=result.get("error"),
    )


def run_case_n(case: EvalCase, runs: int = 5, *, mode: str = OFFLINE) -> CaseStats:
    """Score one case ``runs`` times (STEP 5)."""
    outcomes = [run_case(case, mode=mode) for _ in range(max(1, runs))]
    return CaseStats(
        case_name=case.name,
        category=case.category,
        expected_band=case.expected_band,
        outcomes=outcomes,
    )


def run_all(cases: list[EvalCase], *, mode: str = OFFLINE) -> list[ScoreOutcome]:
    return [run_case(case, mode=mode) for case in cases]


def run_all_n(cases: list[EvalCase], runs: int = 5, *, mode: str = OFFLINE) -> list[CaseStats]:
    return [run_case_n(case, runs, mode=mode) for case in cases]


# --------------------------------------------------------------------------
# Score cache - keeps the pytest suite from re-billing the LLM per assertion
# --------------------------------------------------------------------------


class ScoreCache:
    """Scores each case at most once per session, so ordering tests are cheap.

    Ordering assertions (STEP 4) reference the same case from several tests. Under
    --live a re-run would cost another few seconds of inference each time, and would
    also compare scores from different samples, which muddies the comparison.
    """

    def __init__(self, mode: str = OFFLINE) -> None:
        self.mode = mode
        self._outcomes: dict[str, ScoreOutcome] = {}

    def get(self, case: EvalCase) -> ScoreOutcome:
        if case.name not in self._outcomes:
            self._outcomes[case.name] = run_case(case, mode=self.mode)
        return self._outcomes[case.name]

    def score(self, case: EvalCase) -> float:
        outcome = self.get(case)
        if not outcome.scored:
            raise AssertionError(
                f"{case.name} produced no score: status={outcome.status} "
                f"error={outcome.error}"
            )
        return outcome.final_score

    @property
    def collected(self) -> list[ScoreOutcome]:
        return list(self._outcomes.values())
