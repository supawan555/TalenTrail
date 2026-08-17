"""Startup healthcheck for the resume-scoring stack.

A missing python package and an unreachable Ollama used to be swallowed inside
``_run_llm_analysis`` and reported as ``score: 0`` for every candidate, capping
every final score at 30. Scoring now reports those as an explicit
``model_unavailable`` status, but the failure should still be caught at boot
rather than discovered one candidate at a time.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Optional

from app.ml.resume_matcher import OLLAMA_BASE_URL, OLLAMA_MODEL

logger = logging.getLogger("talenttrail.ml.health")

# OLLAMA_BASE_URL is imported, not redefined. The healthcheck must probe the
# exact endpoint the scoring call uses - when the two drifted apart, boot
# reported "resume scoring ready" while every candidate failed with
# model_unavailable / Connection refused.

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
            digest = (self.model_digest or "")[:12]
            return f"resume scoring ready (model={self.model} digest={digest})"
        return "resume scoring UNAVAILABLE:\n  - " + "\n  - ".join(self.problems)


def _list_ollama_models(timeout: float) -> list[dict]:
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags"
    with urllib.request.urlopen(url, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("models", [])


def check_llm_stack(timeout: float = 5.0) -> HealthReport:
    """Verify imports, Ollama reachability, the pulled model, and SBERT."""
    problems: list[str] = []
    model_digest: Optional[str] = None

    try:
        import langchain_core.prompts  # noqa: F401
        import langchain_ollama  # noqa: F401
    except ImportError as exc:
        problems.append(
            f"langchain import failed ({exc}). Run: pip install -r requirements.txt"
        )

    try:
        models = _list_ollama_models(timeout)
        names = {m.get("name") for m in models}
        if OLLAMA_MODEL not in names:
            available = ", ".join(sorted(n for n in names if n)) or "none"
            problems.append(
                f"model {OLLAMA_MODEL!r} is not pulled (available: {available}). "
                f"Run: ollama pull {OLLAMA_MODEL}"
            )
        else:
            model_digest = next(
                (m.get("digest") for m in models if m.get("name") == OLLAMA_MODEL),
                None,
            )
    except (urllib.error.URLError, OSError, ValueError) as exc:
        problems.append(
            f"Ollama unreachable at {OLLAMA_BASE_URL} ({exc}). Run: ollama serve"
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
        model=OLLAMA_MODEL,
        model_digest=model_digest,
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
