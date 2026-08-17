import logging
import json
import os
import re
from typing import Any, Dict, Optional, Tuple

# Lazy import to avoid heavy dependencies at module import time
try:
    from sentence_transformers import SentenceTransformer, util  # type: ignore
except Exception:  # pragma: no cover
    SentenceTransformer = None  # type: ignore
    util = None  # type: ignore

# ตั้งค่า Logger
logger = logging.getLogger("talenttrail.ml")

# Global model placeholder for lazy initialization
_MODEL = None

# --------------------------------------------------------------------------
# Result status contract
#
# A score of 0 used to mean four different things: a genuinely terrible
# candidate, a missing python package, an unreachable Ollama, or a response the
# parser threw away. Callers could not tell them apart, so every failure looked
# like a hiring verdict. Status makes the difference explicit, and any status
# other than SCORED carries score=None rather than a number.
# --------------------------------------------------------------------------

STATUS_SCORED = "scored"
STATUS_PARSE_ERROR = "parse_error"
STATUS_MODEL_UNAVAILABLE = "model_unavailable"
STATUS_INPUT_INVALID = "input_invalid"

NON_SCORED_STATUSES = frozenset(
    {STATUS_PARSE_ERROR, STATUS_MODEL_UNAVAILABLE, STATUS_INPUT_INVALID}
)

# Explicit tag rather than the bare "mistral" alias, so the resolved model is
# visible in logs and the healthcheck can verify the exact tag is pulled.
OLLAMA_MODEL = "mistral:latest"
OLLAMA_TIMEOUT_S = 120.0


def _resolve_ollama_base_url() -> str:
    """Resolve the Ollama endpoint for the environment we are running in.

    Inside a container ``localhost`` is the container itself, so an Ollama
    running on the host machine is only reachable through
    ``host.docker.internal``. Getting this wrong produces
    ``[Errno 111] Connection refused`` on every scoring call.

    This is the single source of truth: ``health.py`` imports it too, so the
    startup healthcheck probes exactly the endpoint scoring will use. When the
    two disagreed, the healthcheck reported "ready" and every candidate then
    failed with model_unavailable.
    """
    configured = os.environ.get("OLLAMA_BASE_URL")
    if configured:
        return configured.rstrip("/")
    if os.path.exists("/.dockerenv"):
        return "http://host.docker.internal:11434"
    return "http://localhost:11434"


OLLAMA_BASE_URL = _resolve_ollama_base_url()

# Keep prompt size bounded for predictable latency and cost.
RESUME_CHAR_BUDGET = 3000
JOB_CHAR_BUDGET = 1500


class ModelUnavailableError(RuntimeError):
    """Raised when a scoring model cannot be reached or loaded."""


def _clamp_score(value: Any) -> Optional[int]:
    """Coerce a score-like value to an int in 0..100, or None if it is not one.

    Returns None rather than 0 for unusable input. A caller that cannot tell
    "the model said zero" from "there was no usable number" cannot report
    honestly, which is the bug this replaces.
    """
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        number: float = float(value)
    elif isinstance(value, str):
        text = value.strip().rstrip("%").strip()
        if not text:
            return None
        try:
            number = float(text)
        except ValueError:
            return None
    else:
        return None

    if number != number or number in (float("inf"), float("-inf")):
        return None

    return max(0, min(100, int(number)))


def _safe_string_list(value: Any) -> list[str]:
    """Normalize a mixed value to a clean list of non-empty strings."""
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _llm_failure(status: str, error: str, raw: Optional[str] = None) -> Dict[str, Any]:
    """Non-scored LLM outcome. Score is None, never 0."""
    return {
        "status": status,
        "score": None,
        "strengths": [],
        "missing_skills": [],
        "error": error,
        "raw_response": raw,
        "repair": None,
        "attempts": 0,
    }


def _hybrid_failure(status: str, error: str) -> Dict[str, Any]:
    """Non-scored hybrid outcome. Every score field is None, never 0."""
    return {
        "status": status,
        "final_score": None,
        "llm_score": None,
        "semantic_score": None,
        "strengths": [],
        "missing_skills": [],
        "error": error,
    }


# --------------------------------------------------------------------------
# Response repair
#
# mistral at temperature 0 still wraps JSON in prose, fences it, uses single
# quotes, or writes "85%". None of that is a scoring signal, so repair it
# before giving up. What is NOT repaired: anything where the score itself is
# absent or unreadable. Those become parse_error, never a guessed number.
# --------------------------------------------------------------------------

_FENCE_RE = re.compile(r"^\s*```[a-zA-Z0-9_-]*\s*|\s*```\s*$")
_TRAILING_COMMA_RE = re.compile(r",\s*([}\]])")
_UNQUOTED_KEY_RE = re.compile(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)")


def _strip_fences(text: str) -> str:
    if "```" not in text:
        return text
    without = _FENCE_RE.sub("", text)
    return without.replace("```", "").strip()


def _first_json_object(text: str) -> Optional[str]:
    """Return the first balanced {...} block, ignoring braces inside strings.

    Handles prose preamble/postamble, markdown wrappers, and a response that
    contains two objects (the first wins).
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return None


def _single_to_double_quotes(text: str) -> str:
    """Swap ' for " only when the block contains no double quotes already."""
    if '"' in text:
        return text
    return text.replace("'", '"')


def _find_score_payload(obj: Any) -> Optional[Dict[str, Any]]:
    """Locate the dict carrying a 'score' key, unwrapping one nesting level."""
    if isinstance(obj, dict):
        if "score" in obj:
            return obj
        for value in obj.values():
            if isinstance(value, dict) and "score" in value:
                return value
    if isinstance(obj, list):
        for item in obj:
            found = _find_score_payload(item)
            if found is not None:
                return found
    return None


def parse_llm_response(raw: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Parse a raw model response into a payload dict.

    Returns ``(payload, repair_name)``. ``payload`` is None when no usable score
    could be recovered. ``repair_name`` records which strategy succeeded, so the
    eval can report how often the model needs rescuing.
    """
    if isinstance(raw, list):
        raw = "".join(str(part) for part in raw)
    text = str(raw or "").strip()
    if not text:
        return None, None

    candidates: list[Tuple[str, str]] = [("direct", text)]

    unfenced = _strip_fences(text)
    if unfenced != text:
        candidates.append(("fence", unfenced))

    block = _first_json_object(unfenced)
    if block:
        candidates.append(("extract", block))
        candidates.append(("trailing_comma", _TRAILING_COMMA_RE.sub(r"\1", block)))
        quoted = _single_to_double_quotes(block)
        if quoted != block:
            candidates.append(("quotes", quoted))
            candidates.append(
                ("quotes+keys", _UNQUOTED_KEY_RE.sub(r'\1"\2"\3', quoted))
            )
        candidates.append(("keys", _UNQUOTED_KEY_RE.sub(r'\1"\2"\3', block)))

    for name, candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except Exception:
            continue
        payload = _find_score_payload(parsed)
        if payload is None:
            continue
        if _clamp_score(payload.get("score")) is None:
            # Structure recovered but the score is unreadable (null, prose,
            # missing). Repairing further would mean inventing a number.
            continue

        # Record every level at which the response needed rescuing: the JSON
        # itself, the payload location, and the score value.
        applied: list[str] = []
        if name != "direct":
            applied.append(name)
        if payload is not parsed:
            applied.append("unwrap")
        if isinstance(payload.get("score"), str):
            applied.append("score_coercion")

        return payload, ("+".join(applied) or None)

    return None, None


# --------------------------------------------------------------------------
# LLM analysis
# --------------------------------------------------------------------------

_RETRY_INSTRUCTION = (
    "Your previous reply could not be parsed as JSON. Reply with the JSON object "
    "only. Start your reply with {{ and end it with }}. No prose, no markdown, "
    "no code fences, no explanation."
)


def _build_prompt(chat_prompt_template, strict_retry: bool = False):
    """Construct the scoring prompt.

    The scoring instructions are unchanged. ``strict_retry`` appends a
    format-only reminder used for the single retry after a parse failure; it
    says nothing about how to score.
    """
    system = (
        "You are a professional HR recruiter. Compare a candidate resume against a job description. "
        "Return ONLY valid JSON with this exact schema: "
        "{{\"score\": integer 0-100, \"strengths\": string[], \"missing_skills\": string[]}}. "
        "No markdown, no commentary, no extra keys, no code fences."
    )
    if strict_retry:
        system = f"{system} {_RETRY_INSTRUCTION}"

    return chat_prompt_template.from_messages(
        [
            ("system", system),
            ("human", "Job Description:\n{job_description}\n\nResume:\n{resume_text}"),
        ]
    )


def _run_llm_analysis(resume_text: str, job_description: str) -> Dict[str, Any]:
    """Run LangChain + Ollama analysis and return a status-tagged result.

    Never returns a fabricated score. Every failure mode is reported as its own
    status with score=None.
    """
    if not isinstance(resume_text, str):
        raise ValueError(
            f"resume_text must be str, got {type(resume_text).__name__}"
        )
    if not isinstance(job_description, str):
        raise ValueError(
            f"job_description must be str, got {type(job_description).__name__}"
        )

    resume_limited = resume_text[:RESUME_CHAR_BUDGET]
    job_limited = job_description[:JOB_CHAR_BUDGET]
    if not resume_limited.strip():
        return _llm_failure(STATUS_INPUT_INVALID, "resume_text is empty")
    if not job_limited.strip():
        return _llm_failure(STATUS_INPUT_INVALID, "job_description is empty")

    try:
        # Local LLM via Ollama only. No OpenAI dependency.
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_ollama import ChatOllama  # type: ignore
    except ImportError as exc:
        # Previously swallowed and reported as score 0 for every candidate.
        logger.error("LLM dependencies unavailable: %s", exc)
        return _llm_failure(
            STATUS_MODEL_UNAVAILABLE,
            f"langchain import failed: {exc}. Install langchain and langchain-ollama.",
        )

    variables = {"resume_text": resume_limited, "job_description": job_limited}
    last_raw: Optional[str] = None
    attempts = 0

    for attempt in range(2):
        strict = attempt == 1
        try:
            llm = ChatOllama(
                model=OLLAMA_MODEL,
                # Without this, langchain defaults to localhost:11434, which
                # inside a container is the container itself.
                base_url=OLLAMA_BASE_URL,
                temperature=0,
                # Constrained decoding on the retry only, so the first attempt
                # measures the model's natural output.
                **({"format": "json"} if strict else {}),
                client_kwargs={"timeout": OLLAMA_TIMEOUT_S},
            )
            prompt = _build_prompt(ChatPromptTemplate, strict_retry=strict)
            response = (prompt | llm).invoke(variables)
        except Exception as exc:
            logger.error("Ollama call failed (attempt %d): %s", attempt + 1, exc)
            return _llm_failure(
                STATUS_MODEL_UNAVAILABLE,
                f"ollama request failed: {type(exc).__name__}: {exc}",
                last_raw,
            )

        attempts = attempt + 1
        raw_content = getattr(response, "content", "")
        payload, repair = parse_llm_response(raw_content)
        last_raw = str(raw_content)

        if payload is not None:
            score = _clamp_score(payload.get("score"))
            if repair:
                logger.info("Recovered model output via repair strategy '%s'", repair)
            return {
                "status": STATUS_SCORED,
                "score": score,
                "strengths": _safe_string_list(payload.get("strengths", [])),
                "missing_skills": _safe_string_list(payload.get("missing_skills", [])),
                "error": None,
                "raw_response": last_raw,
                "repair": repair,
                "attempts": attempts,
            }

        logger.warning(
            "Unparseable model output on attempt %d: %r", attempt + 1, last_raw[:300]
        )

    result = _llm_failure(
        STATUS_PARSE_ERROR,
        "model output could not be parsed as a score after one strict retry",
        last_raw,
    )
    result["attempts"] = attempts
    return result


def combine_scores(
    llm_result: Dict[str, Any], resume_text: str, job_description: str
) -> Dict[str, Any]:
    """Combine LLM score with SBERT semantic score into a single hybrid score.

    Formula:
        final_score = (llm_score * 0.7) + (semantic_score * 0.3)

    A non-scored LLM result propagates: there is no hybrid score without the
    LLM half, and substituting the semantic half alone silently caps every
    candidate at 30.
    """
    llm_result = llm_result or {}
    status = llm_result.get("status")

    if status in NON_SCORED_STATUSES:
        return _hybrid_failure(status, llm_result.get("error") or "llm did not score")

    llm_score = _clamp_score(llm_result.get("score"))
    if llm_score is None:
        return _hybrid_failure(
            STATUS_PARSE_ERROR, "llm result carried no usable score"
        )

    try:
        semantic_score = float(match_resume_to_job(resume_text, job_description))
    except ModelUnavailableError as exc:
        logger.error("Semantic model unavailable: %s", exc)
        return _hybrid_failure(STATUS_MODEL_UNAVAILABLE, f"sbert unavailable: {exc}")

    semantic_score = max(0.0, min(100.0, semantic_score))
    final_score = _clamp_score(round((llm_score * 0.7) + (semantic_score * 0.3)))

    result = {
        "status": STATUS_SCORED,
        "final_score": final_score,
        "llm_score": llm_score,
        "semantic_score": round(semantic_score, 2),
        "strengths": _safe_string_list(llm_result.get("strengths", [])),
        "missing_skills": _safe_string_list(llm_result.get("missing_skills", [])),
        "error": None,
    }
    logger.debug("Hybrid resume score computed: %s", result)
    return result


def analyze_resume(resume_text: str, job_description: str) -> Dict[str, Any]:
    """Main hybrid matching entrypoint.

    Steps:
    1) Run LLM analysis (LangChain + Ollama mistral)
    2) Combine with SBERT semantic score
    3) Return a single status-tagged response payload

    Raises ValueError on wrong argument types rather than degrading to zeros,
    so a caller passing the wrong shape finds out immediately.
    """
    if not isinstance(resume_text, str):
        raise ValueError(
            f"resume_text must be str, got {type(resume_text).__name__}"
        )
    if not isinstance(job_description, str):
        raise ValueError(
            "job_description must be str, got "
            f"{type(job_description).__name__}. Pass job['description'], not the job document."
        )

    llm_result = _run_llm_analysis(resume_text, job_description)
    return combine_scores(llm_result, resume_text, job_description)


def get_model():
    """Initialize SBERT model on first use and reuse thereafter.

    Ensures FastAPI can start instantly without loading the model at import time.
    """
    global _MODEL
    if _MODEL is None:
        if SentenceTransformer is None:
            logger.error("sentence-transformers is not available")
            raise ModelUnavailableError("sentence-transformers is not installed")
        logger.info("⏳ [ML] Loading SBERT model 'all-MiniLM-L6-v2' on first use...")
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("✅ [ML] SBERT model loaded successfully")
    return _MODEL


def match_resume_to_job(resume_text: str, job_description: str) -> float:
    """
    Calculate semantic similarity between resume and job description.
    Returns a score between 0 and 100.

    Raises ModelUnavailableError if the SBERT model cannot be loaded, rather
    than returning 0.0 and having it read as "no similarity".
    """
    # Safety Check
    if not resume_text or not job_description:
        return 0.0

    model = get_model()
    if util is None:
        raise ModelUnavailableError("sentence_transformers.util is not available")

    try:
        # ✅ 2. แปลงข้อความเป็น Vector (Embeddings)
        # convert_to_tensor=True เพื่อให้คำนวณได้เร็วขึ้น
        resume_embedding = model.encode(resume_text, convert_to_tensor=True)
        job_embedding = model.encode(job_description, convert_to_tensor=True)

        # ✅ 3. คำนวณ Cosine Similarity (ความเหมือนของ Vector)
        # ค่าที่ได้จะอยู่ระหว่าง -1 ถึง 1
        score = util.cos_sim(resume_embedding, job_embedding)

        # ดึงค่าออกมาจาก Tensor
        raw_score = score.item()
    except Exception as exc:
        logger.error("SBERT encoding failed: %s", exc)
        raise ModelUnavailableError(f"sbert encoding failed: {exc}") from exc

    # ✅ 4. ปรับจูนคะแนน (Score Normalization) - สำคัญมาก!
    # SBERT ปกติจะให้คะแนนความเหมือนข้อความยาวๆ อยู่ที่ช่วง 0.2 - 0.7
    # ถ้าได้ 0.6-0.7 คือเนื้อหาตรงกันมากแล้ว เราจึงต้อง Map สเกลใหม่ให้เป็น 0-100% ที่มนุษย์เข้าใจ

    # สูตร: ถ้า Raw Score < 0 ให้เป็น 0
    if raw_score < 0:
        raw_score = 0

    # Linear Scaling:
    # กำหนดว่า Raw Score 0.15 = 0% (ไม่เหมือนเลย)
    # กำหนดว่า Raw Score 0.75 = 100% (เหมือนเป๊ะ)
    min_threshold = 0.15
    max_threshold = 0.75

    normalized_score = (raw_score - min_threshold) / (max_threshold - min_threshold)
    normalized_score = max(0.0, min(1.0, normalized_score))

    # power scaling
    final_percentage = (normalized_score**1.5) * 100

    return final_percentage


def raw_cosine_similarity(resume_text: str, job_description: str) -> float:
    """Un-normalized cosine similarity, for diagnosing the mapping (Step 4)."""
    if not resume_text or not job_description:
        return 0.0
    model = get_model()
    if util is None:
        raise ModelUnavailableError("sentence_transformers.util is not available")
    resume_embedding = model.encode(resume_text, convert_to_tensor=True)
    job_embedding = model.encode(job_description, convert_to_tensor=True)
    return float(util.cos_sim(resume_embedding, job_embedding).item())


__all__ = [
    "analyze_resume",
    "combine_scores",
    "match_resume_to_job",
    "parse_llm_response",
    "raw_cosine_similarity",
    "ModelUnavailableError",
    "STATUS_SCORED",
    "STATUS_PARSE_ERROR",
    "STATUS_MODEL_UNAVAILABLE",
    "STATUS_INPUT_INVALID",
    "NON_SCORED_STATUSES",
    "OLLAMA_MODEL",
    "OLLAMA_BASE_URL",
]
