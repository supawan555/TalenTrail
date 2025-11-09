"""Resume-to-Job matching module.

Contract:
    compute_match(extracted: dict, job: dict | str) -> dict
Returns:
    {
      'score': int (0-100),
      'details': { 'skills_overlap': float, 'text_similarity': float, 'explanation': str }
    }

Heuristic:
- skills_overlap: Jaccard similarity between extracted.skills and tokens from job description.
- text_similarity: TF-IDF cosine similarity between extracted.raw_text (or text_snippet) and job.description.
- Final score: 60% text_similarity + 40% skills_overlap, scaled to 0-100.
"""
from __future__ import annotations
from typing import Dict, Any
import math
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

WORD_RE = re.compile(r"[A-Za-z0-9_+#.-]+")


def _tokenize(s: str) -> set[str]:
    return set(w.lower() for w in WORD_RE.findall(s or ""))


def _skills_overlap(extracted_skills: list[str], job_text: str) -> float:
    a = set(s.lower() for s in (extracted_skills or []))
    b = _tokenize(job_text)
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _text_similarity(resume_text: str, job_text: str) -> float:
    resume_text = (resume_text or '').strip()
    job_text = (job_text or '').strip()
    if not resume_text or not job_text:
        return 0.0
    vec = TfidfVectorizer(stop_words='english', max_features=5000)
    tfidf = vec.fit_transform([resume_text, job_text])
    sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    # clamp to [0,1]
    return max(0.0, min(1.0, float(sim)))


def compute_match(extracted: Dict[str, Any], job: Dict[str, Any] | str) -> Dict[str, Any]:
    job_text = job if isinstance(job, str) else (job.get('description') or '')
    resume_text = extracted.get('raw_text') or extracted.get('text_snippet') or ''
    skills = extracted.get('skills') or []

    so = _skills_overlap(skills, job_text)
    ts = _text_similarity(resume_text, job_text)

    score = int(round((0.4 * so + 0.6 * ts) * 100))
    return {
        'score': max(0, min(100, score)),
        'details': {
            'skills_overlap': so,
            'text_similarity': ts,
            'explanation': '40% skills overlap, 60% TF-IDF cosine similarity.'
        }
    }

__all__ = ['compute_match']
