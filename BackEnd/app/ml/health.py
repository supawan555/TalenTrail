"""Startup healthcheck for the resume-scoring stack.

A missing python package and an unreachable/misconfigured LLM used to be
swallowed inside ``_run_llm_analysis`` and reported as ``score: 0`` for every
candidate, capping every final score at 30. Scoring now reports those as an
explicit ``model_unavailable`` status, but the failure should still be caught
at boot rather than discovered one candidate at a time.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Optional

from app.config import settings
from app.ml.resume_matcher import GEMINI_MODEL

logger = logging.getLogger("talenttrail.ml.health")

# Escape hatch for frontend-only development. Safe now only because scoring
# reports model_unavailable explicitly instead of returning silent zeros.
ALLOW_DEGRADED = os.environ.get("TALENTRAIL_ALLOW_DEGRADED_LLM") == "1"


@dataclass
class HealthReport:
    ok: bool
    problems: list[str] = field(default_factory=list)
    model: Optional[str] = None
    model_digest: Optional[str] = None
    sbert_available: bool = False

    def summary(self) -> str:
        if self.ok:
            return f"resume scoring ready (model={self.model})"
        return "resume scoring UNAVAILABLE:\n  - " + "\n  - ".join(self.problems)


def check_llm_stack(timeout: float = 5.0) -> HealthReport:
    """Verify imports, the Gemini API key, and SBERT."""
    problems: list[str] = []

    try:
        import langchain_core.prompts  # noqa: F401
        from langchain_google_genai import ChatGoogleGenerativeAI  # noqa: F401
    except ImportError as exc:
        problems.append(
            f"langchain import failed ({exc}). Run: pip install -r requirements.txt"
        )

    if not settings.GEMINI_API_KEY:
        problems.append(
            "GEMINI_API_KEY is not set. Add it to the backend .env file."
        )
    else:
        try:
            from google import genai
            from google.genai.types import HttpOptions

            client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options=HttpOptions(timeout=int(timeout * 1000)),
            )
            # Cheap call that both confirms the API key is valid and that the
            # configured model name actually exists.
            client.models.get(model=GEMINI_MODEL)
        except Exception as exc:
            problems.append(
                f"Gemini unreachable or misconfigured (model={GEMINI_MODEL}): {exc}"
            )

    try:
        from sentence_transformers import SentenceTransformer  # noqa: F401

        sbert_available = True
    except ImportError as exc:
        sbert_available = False
        problems.append(
            f"sentence-transformers import failed ({exc}). "
            "Run: pip install -r requirements.txt"
        )

    return HealthReport(
        ok=not problems,
        problems=problems,
        model=GEMINI_MODEL,
        sbert_available=sbert_available,
    )


def register_llm_healthcheck(app) -> None:
    """Fail fast on boot when the scoring stack is not usable."""

    @app.on_event("startup")
    async def _verify_llm_stack() -> None:  # pragma: no cover - startup hook
        report = check_llm_stack()
        app.state.llm_health = report

        if report.ok:
            logger.info("✅ [ML] %s", report.summary())
            return

        if ALLOW_DEGRADED:
            logger.warning(
                "⚠️  [ML] %s\nTALENTRAIL_ALLOW_DEGRADED_LLM=1 is set, so boot continues. "
                "Scoring will return status=model_unavailable with score=null.",
                report.summary(),
            )
            return

        raise RuntimeError(
            f"{report.summary()}\n\n"
            "Fix the above, or set TALENTRAIL_ALLOW_DEGRADED_LLM=1 to boot anyway "
            "(scoring will return status=model_unavailable with score=null)."
        )
