"""Resume-to-Job matching module aligned with MachineLearning/PercentMatch.py.

Contract:
    compute_match(extracted: dict, job: dict | str) -> dict
Returns (compatible shape):
    {
      'score': int (0-100),
      'details': {
          'jd_match_pct': float,         # 0..100
          'skill_overlap_pct': float,    # 0..100
          'text_similarity': float,      # 0..1 (jd_match_pct / 100)
          'jd_skills': list[str],
          'cv_skills': list[str],
          'reason': str,
          'explanation': str
      }
    }

Algorithm (from PercentMatch.py):
- Clean text (lowercase, strip URLs/emails, non-alnum filter) for both resume and JD.
- If resume too short (< MIN_WORDS), return 0.
- Embedding similarity via SentenceTransformer('all-MiniLM-L6-v2'), normalized embeddings.
- Subtract BASELINE_COS, clip to [0,1]; apply NEGATIVE_PENALTY when negative words appear.
- Extract skills by SKILL_VOCAB presence; compute overlap ratio vs JD skills.
- Final score = 0.6 * JD_Match_% + 0.4 * SkillOverlap_%.
"""
from __future__ import annotations
from typing import Dict, Any
import re
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

try:
    from sentence_transformers import SentenceTransformer  # type: ignore
except Exception:  # pragma: no cover - fallback import error path
    SentenceTransformer = None  # type: ignore


# Hyperparameters (kept identical to PercentMatch.py)
BASELINE_COS = 0.20
MIN_WORDS = 50
NEGATIVE_PENALTY = 0.5

NEGATIVE_WORDS = {
    "accounting","nurse","warehouse","driver","logistics",
    "cashier","factory","mechanical","chefs","culinary"
}

SKILL_VOCAB = {
    # Frontend
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
    s = str(s or "").lower()
    s = re.sub(r"http\S+|www\S+|\S+@\S+", " ", s)
    s = re.sub(r"[^a-z0-9\s\.\+\#]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


_MODEL: Any | None = None  # lazy-loaded model


def _get_model():
    global _MODEL
    if _MODEL is None:
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers is not available")
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _MODEL


def _extract_skills(text: str) -> set[str]:
    t = (text or "").lower()
    return {skill for skill in SKILL_VOCAB if skill.lower() in t}


def compute_match(extracted: Dict[str, Any], job: Dict[str, Any] | str) -> Dict[str, Any]:
    """Compute match using the same logic as PercentMatch.py for a single JD text.

    extracted: should contain raw_text (or text_snippet) and optional skills list.
    job: job dict with 'description' or a plain string description.
    """
    job_text_raw = job if isinstance(job, str) else (job.get('description') or '')
    resume_text_raw = extracted.get('raw_text') or extracted.get('text_snippet') or ''

    resume_clean = _clean_text(resume_text_raw)
    jd_clean = _clean_text(job_text_raw)

    # Short/irrelevant resume guard
    if len(resume_clean.split()) < MIN_WORDS:
        return {
            'score': 0,
            'details': {
                'jd_match_pct': 0.0,
                'skill_overlap_pct': 0.0,
                'text_similarity': 0.0,
                'jd_skills': [],
                'cv_skills': [],
                'reason': 'resume too short/irrelevant',
                'explanation': 'MIN_WORDS guard; not enough content to match.'
            }
        }

    # Embeddings + similarity
    model = _get_model()
    res_emb = model.encode([resume_clean], normalize_embeddings=True)
    jd_emb = model.encode([jd_clean], normalize_embeddings=True)
    sims = cosine_similarity(res_emb, jd_emb)[0]
    sim = float(sims[0])
    # baseline adjustment and clamp to [0,1]
    sim_adj = max(0.0, min(1.0, sim - BASELINE_COS))
    jd_match_pct = sim_adj * 100.0

    # Negative penalty
    if any(w in resume_clean for w in NEGATIVE_WORDS):
        jd_match_pct *= NEGATIVE_PENALTY

    # Skills overlap
    jd_skills = _extract_skills(jd_clean)
    cv_skills = _extract_skills(resume_clean)
    if jd_skills:
        skill_overlap_pct = len(jd_skills & cv_skills) / len(jd_skills) * 100.0
    else:
        skill_overlap_pct = 0.0

    # Final score
    final_pct = FINAL_W_JD * jd_match_pct + FINAL_W_SKILL * skill_overlap_pct
    score_int = int(round(final_pct))

    return {
        'score': max(0, min(100, score_int)),
        'details': {
            'jd_match_pct': round(jd_match_pct, 2),
            'skill_overlap_pct': round(skill_overlap_pct, 2),
            'text_similarity': round(sim_adj, 4),
            'jd_skills': sorted(jd_skills),
            'cv_skills': sorted(cv_skills),
            'reason': 'ok',
            'explanation': '60% JD semantic similarity (MiniLM) with baseline subtraction and penalty; 40% skill overlap.'
        }
    }

__all__ = ['compute_match']
