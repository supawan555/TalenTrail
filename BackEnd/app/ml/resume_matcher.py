"""High-level resume-to-job matching API.

This version adapts the improved logic from MachineLearning/PercentMatch.py:
- SentenceTransformer (all-MiniLM-L6-v2) embeddings for semantic similarity
- Skill vocabulary overlap scoring
- Negative keyword penalty
- Final score: 60% semantic JD match + 40% skill overlap

Graceful fallback: if the transformer model cannot be loaded, it will fall back
to the older TF-IDF/cosine method via app.services.resume_matching.compute_match.
"""
from __future__ import annotations
from typing import Any
import re
import math

from sklearn.metrics.pairwise import cosine_similarity

# Lazy import for SentenceTransformer to avoid startup overhead and allow fallback
_st_model = None
def _load_st_model():
    global _st_model
    if _st_model is not None:
        return _st_model
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        _st_model = None
    return _st_model


# Hyperparameters adapted from PercentMatch.py
BASELINE_COS = 0.20
MIN_WORDS = 50
NEGATIVE_PENALTY = 0.5

NEGATIVE_WORDS = {
    "accounting","nurse","warehouse","driver","logistics",
    "cashier","factory","mechanical","chefs","culinary"
}

SKILL_VOCAB = {
    # Engineering / Frontend
    "html", "css", "javascript", "typescript",
    "react", "next.js", "nextjs", "redux", "context api",
    "tailwind", "tailwind css", "vite", "webpack",
    "responsive design", "state management",
    "jest", "react testing library", "vitest", "enzyme",
    # Backend / Full Stack
    "node.js", "nodejs", "express", "python", "django", "flask",
    "go", "golang", "java", "spring", "spring boot",
    "rest api", "graphql", "microservices", "monolith",
    "postgresql", "mysql", "sqlite", "mongodb", "firebase",
    "redis", "docker", "kubernetes", "container",
    "aws", "gcp", "azure", "lambda", "cloud run", "ec2",
    "terraform", "cloudformation", "ansible",
    "jenkins", "gitlab ci", "github actions", "ci/cd",
    "prometheus", "grafana", "elk", "logstash", "kibana",
    "bash", "shell", "powershell", "scripting",
    # Design
    "figma", "sketch", "adobe xd", "adobe creative suite",
    "photoshop", "illustrator", "indesign",
    "wireframe", "prototype", "prototyping",
    "design system", "typography", "color theory",
    "visual hierarchy", "layout", "usability testing",
    "accessibility", "wcag", "user research",
    "user-centered design", "interaction design",
    # Product
    "product management", "roadmap", "product strategy",
    "agile", "scrum", "kanban",
    "stakeholder management", "user stories", "sprint planning",
    "analytics", "data-driven", "okrs", "kpis",
    # Marketing
    "seo", "sem", "google analytics", "google ads", "facebook ads",
    "content marketing", "email marketing", "newsletter",
    "social media", "instagram", "linkedin", "twitter", "tiktok",
    "campaign", "brand awareness", "conversion rate",
    "semrush", "ahrefs", "meta ads manager",
    "crm", "hubspot", "salesforce",
    "copywriting", "blog", "landing page", "a/b testing",
    "digital marketing", "marketing automation",
}

FINAL_W_JD = 0.6
FINAL_W_SKILL = 0.4


def _clean_text(s: str) -> str:
    s = (s or "")
    s = s.lower()
    s = re.sub(r"http\S+|www\S+|\S+@\S+", " ", s)
    s = re.sub(r"[^a-z0-9\s\.\+\#]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _extract_vocab_skills(text: str) -> set[str]:
    low = (text or "").lower()
    return {v for v in SKILL_VOCAB if v in low}


def _jd_match_semantic(resume_clean: str, jd_clean: str) -> float:
    """Return semantic match percentage [0,100] using SBERT, with baseline and clamp.
    Falls back to 0 if model unavailable.
    """
    model = _load_st_model()
    if model is None:
        return 0.0
    try:
        res_emb = model.encode([resume_clean], normalize_embeddings=True)
        jd_emb = model.encode([jd_clean], normalize_embeddings=True)
        sim = float(cosine_similarity(res_emb, jd_emb)[0][0])
        sim = max(0.0, min(1.0, sim - BASELINE_COS))
        return sim * 100.0
    except Exception:
        return 0.0


def match_resume_to_job(resume_text: str, job_description_text: str) -> float:
    """Compute final percentage [0,100] combining semantic JD match and skill overlap.

    - Cleans both texts
    - Checks minimum word count
    - Applies negative keyword penalty
    - Combines scores with FINAL_W_JD and FINAL_W_SKILL
    - If transformer model is unavailable, falls back to legacy TF-IDF method
    """
    resume_clean = _clean_text(resume_text)
    jd_clean = _clean_text(job_description_text)

    # If transformer available path fails entirely, use legacy fallback
    model = _load_st_model()
    use_legacy = model is None

    if not use_legacy:
        # 1) Short resume guard
        if len(resume_clean.split()) < MIN_WORDS:
            # Mostly irrelevant/too short
            return 0.0

        # 2) Semantic similarity
        jd_match_pct = _jd_match_semantic(resume_clean, jd_clean)

        # 3) Negative domain penalty
        if any(w in resume_clean for w in NEGATIVE_WORDS):
            jd_match_pct *= NEGATIVE_PENALTY

        # 4) Skill overlap
        jd_skills = _extract_vocab_skills(jd_clean)
        cv_skills = _extract_vocab_skills(resume_clean)
        if jd_skills:
            skill_overlap_pct = len(jd_skills & cv_skills) / max(1, len(jd_skills)) * 100.0
        else:
            skill_overlap_pct = 0.0

        # 5) Final score
        final_pct = FINAL_W_JD * jd_match_pct + FINAL_W_SKILL * skill_overlap_pct
        return max(0.0, min(100.0, round(final_pct, 2)))

    # ===== Legacy fallback: use prior TF-IDF matcher if transformer isn't available =====
    try:
        from app.services.resume_matching import compute_match as legacy_compute_match  # type: ignore
        extracted = {"raw_text": resume_text or "", "skills": []}
        job_doc: dict[str, Any] = {"description": job_description_text or ""}
        result = legacy_compute_match(extracted, job_doc)
        return float(result.get("score", 0))
    except Exception:
        return 0.0


__all__ = ["match_resume_to_job"]
