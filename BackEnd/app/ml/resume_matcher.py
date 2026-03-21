import logging
import json
from typing import Any, Dict

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


def _clamp_score(value: Any) -> int:
    """Convert any score-like value to a safe integer in range 0..100."""
    try:
        score = int(value)
    except Exception:
        score = 0
    return max(0, min(100, score))


def _safe_string_list(value: Any) -> list[str]:
    """Normalize a mixed value to a clean list of non-empty strings."""
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _default_llm_result() -> Dict[str, Any]:
    """Fallback payload for LLM-only analysis."""
    return {
        "score": 0,
        "strengths": [],
        "missing_skills": [],
    }


def _default_hybrid_result() -> Dict[str, Any]:
    """Fallback payload for hybrid scoring response."""
    return {
        "final_score": 0,
        "llm_score": 0,
        "semantic_score": 0.0,
        "strengths": [],
        "missing_skills": [],
    }


def _run_llm_analysis(resume_text: str, job_description: str) -> Dict[str, Any]:
    """Run LangChain + Ollama analysis and return normalized LLM output only.

    This function is intentionally isolated so hybrid orchestration can remain
    service-level and easy to test.
    """
    fallback = _default_llm_result()

    # Keep prompt size bounded for predictable latency and cost.
    resume_limited = (resume_text or "")[:3000]
    job_limited = (job_description or "")[:1500]
    if not resume_limited.strip() or not job_limited.strip():
        return fallback

    try:
        # Local LLM via Ollama only. No OpenAI dependency.
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_ollama import ChatOllama  # type: ignore

        prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a professional HR recruiter. Compare a candidate resume against a job description. "
        "Return ONLY valid JSON with this exact schema: "
        "{{\"score\": integer 0-100, \"strengths\": string[], \"missing_skills\": string[]}}. "
        "No markdown, no commentary, no extra keys, no code fences.",
    ),
    (
        "human",
        "Job Description:\n{job_description}\n\nResume:\n{resume_text}",
    ),
])

        llm = ChatOllama(model="mistral", temperature=0)
        response = (prompt | llm).invoke(
            {
                "resume_text": resume_limited,
                "job_description": job_limited,
            }
        )

        # Parse JSON response defensively.
        raw_content = getattr(response, "content", "")
        if isinstance(raw_content, list):
            raw_content = "".join(str(part) for part in raw_content)
        raw_content = str(raw_content).strip()

        # Gracefully handle occasional fenced output.
        if raw_content.startswith("```"):
            raw_content = raw_content.strip("`")
            if raw_content.lower().startswith("json"):
                raw_content = raw_content[4:].strip()

        parsed = json.loads(raw_content)
        return {
            "score": _clamp_score(parsed.get("score", 0)),
            "strengths": _safe_string_list(parsed.get("strengths", [])),
            "missing_skills": _safe_string_list(parsed.get("missing_skills", [])),
        }
    except Exception as e:
        logger.warning("LLM resume analysis failed, using fallback: %s", e)
        return fallback


def combine_scores(llm_result: Dict[str, Any], resume_text: str, job_description: str) -> Dict[str, Any]:
    """Combine LLM score with SBERT semantic score into a single hybrid score.

    Formula:
        final_score = (llm_score * 0.7) + (semantic_score * 0.3)
    """
    fallback = _default_hybrid_result()
    try:
        llm_score = _clamp_score((llm_result or {}).get("score", 0))
        strengths = _safe_string_list((llm_result or {}).get("strengths", []))
        missing_skills = _safe_string_list((llm_result or {}).get("missing_skills", []))

        # Reuse existing semantic function to avoid API/behavior drift.
        semantic_score = float(match_resume_to_job(resume_text, job_description))
        semantic_score = max(0.0, min(100.0, semantic_score))

        final_score = int(round((llm_score * 0.7) + (semantic_score * 0.3)))
        final_score = _clamp_score(final_score)

        result = {
            "final_score": final_score,
            "llm_score": llm_score,
            "semantic_score": round(semantic_score, 2),
            "strengths": strengths,
            "missing_skills": missing_skills,
        }
        logger.debug("Hybrid resume score computed: %s", result)
        return result
    except Exception as e:
        logger.error("combine_scores failed, using fallback: %s", e)
        return fallback


def analyze_resume(resume_text: str, job_description: str) -> Dict[str, Any]:
    """Main hybrid matching entrypoint.

    Steps:
    1) Run LLM analysis (LangChain + Ollama mistral)
    2) Combine with SBERT semantic score
    3) Return a single hybrid response payload
    """
    try:
        llm_result = _run_llm_analysis(resume_text, job_description)
        return combine_scores(llm_result, resume_text, job_description)
    except Exception as e:
        logger.error("analyze_resume failed unexpectedly: %s", e)
        return _default_hybrid_result()

def get_model():
    """Initialize SBERT model on first use and reuse thereafter.

    Ensures FastAPI can start instantly without loading the model at import time.
    """
    global _MODEL
    if _MODEL is None:
        if SentenceTransformer is None:
            logger.error("sentence-transformers is not available")
            raise RuntimeError("sentence-transformers is not available")
        logger.info("⏳ [ML] Loading SBERT model 'all-MiniLM-L6-v2' on first use...")
        _MODEL = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✅ [ML] SBERT model loaded successfully")
    return _MODEL

def match_resume_to_job(resume_text: str, job_description: str) -> float:
    """
    Calculate semantic similarity between resume and job description.
    Returns a score between 0 and 100.
    """
    # Safety Check
    if not resume_text or not job_description:
        return 0.0

    # Lazy-load model on first use
    try:
        model = get_model()
    except Exception:
        logger.warning("Model not available, returning 0")
        return 0.0

    try:
        # ✅ 2. แปลงข้อความเป็น Vector (Embeddings)
        # convert_to_tensor=True เพื่อให้คำนวณได้เร็วขึ้น
        resume_embedding = model.encode(resume_text, convert_to_tensor=True)
        job_embedding = model.encode(job_description, convert_to_tensor=True)

        # ✅ 3. คำนวณ Cosine Similarity (ความเหมือนของ Vector)
        # ค่าที่ได้จะอยู่ระหว่าง -1 ถึง 1
        if util is None:
            logger.warning("sentence_transformers.util not available, returning 0")
            return 0.0
        score = util.cos_sim(resume_embedding, job_embedding)
        
        # ดึงค่าออกมาจาก Tensor
        raw_score = score.item()

        # ✅ 4. ปรับจูนคะแนน (Score Normalization) - สำคัญมาก!
        # SBERT ปกติจะให้คะแนนความเหมือนข้อความยาวๆ อยู่ที่ช่วง 0.2 - 0.7 
        # ถ้าได้ 0.6-0.7 คือเนื้อหาตรงกันมากแล้ว เราจึงต้อง Map สเกลใหม่ให้เป็น 0-100% ที่มนุษย์เข้าใจ
        
        # สูตร: ถ้า Raw Score < 0 ให้เป็น 0
        if raw_score < 0: raw_score = 0
        
        # Linear Scaling: 
        # กำหนดว่า Raw Score 0.15 = 0% (ไม่เหมือนเลย)
        # กำหนดว่า Raw Score 0.75 = 100% (เหมือนเป๊ะ)
        min_threshold = 0.15
        max_threshold = 0.75
        
        normalized_score = (raw_score - min_threshold) / (max_threshold - min_threshold)
        normalized_score = max(0.0, min(1.0, normalized_score))
        
        # power scaling
        final_percentage = (normalized_score ** 1.5) * 100

        return final_percentage

    except Exception as e:
        logger.error(f"Error matching resume: {e}")
        return 0.0


__all__ = [
    "analyze_resume",
    "combine_scores",
    "match_resume_to_job",
]
