"""
ML helper functions for resume–job matching and basic profile extraction.

Functions:
 - compute_match_score(resume_text: str, job_desc: str) -> float
     Uses TfidfVectorizer (english stop words) + cosine similarity.
     Returns a percentage 0–100 rounded to 2 decimals.

 - extract_profile(text: str) -> dict
     Extracts email, Thai phone number, and detects skills from a fixed list.
     Returns: { "email": str|None, "phone": str|None, "skills": list[str] }

Note: This module has no FastAPI code. It's pure Python and can be imported
from other scripts or services.
Additionally provides:
 - preprocess_text(text: str) -> str
     Lowercases, removes punctuation, and collapses extra spaces.
"""
from __future__ import annotations

import math
import re
from typing import List, Dict, Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


_PUNCT_REGEX = re.compile(r"[^\w\s]", re.UNICODE)


def preprocess_text(text: str) -> str:
    """Lowercase, remove punctuation, and normalize whitespace.

    Returns an empty string for falsy input.
    """
    if not text:
        return ""
    s = text.lower()
    s = _PUNCT_REGEX.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def compute_match_score(resume_text: str, job_desc: str) -> float:
    """Compute resume–job match score (0–100) using TF-IDF cosine similarity.

    - Vectorizes both texts with english stop words.
    - Computes cosine similarity between the two tf-idf vectors.
    - Returns percentage 0–100, rounded to 2 decimals.

    Edge cases:
    - If either text is empty/whitespace only, returns 0.0.
    - If similarity is NaN or cannot be computed, returns 0.0.
    """
    if not resume_text or not resume_text.strip() or not job_desc or not job_desc.strip():
        return 0.0

    docs = [resume_text, job_desc]
    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        tfidf = vectorizer.fit_transform(docs)
        sim = float(cosine_similarity(tfidf[0], tfidf[1])[0, 0])
    except Exception:
        return 0.0

    if math.isnan(sim) or sim < 0:
        return 0.0
    return round(sim * 100.0, 2)


_EMAIL_REGEX = re.compile(r"[\w\.-]+@[\w\.-]+")
# Thai phone: +66XXXXXXXXX or 0XXXXXXXXX (8 or 9 digits after prefix)
_TH_PHONE_REGEX = re.compile(r"(?:\+66|0)\d{8,9}")
_SKILLS = [
    "python", "fastapi", "aws", "docker", "git", "react", "node", "mongodb",
]


def extract_profile(text: str) -> Dict[str, Optional[object]]:
    """Extract simple profile fields from free-text.

    - Email using regex: r"[\w\.-]+@[\w\.-]+"
    - Thai phone using regex: r"(?:\+66|0)\d{8,9}"
    - Skills: match as standalone words (case-insensitive) from the fixed list.

    Returns dict: { "email": str|None, "phone": str|None, "skills": list[str] }
    """
    if not text:
        return {"email": None, "phone": None, "skills": []}

    # Email
    email_match = _EMAIL_REGEX.search(text)
    email = email_match.group(0) if email_match else None

    # Thai phone
    phone_match = _TH_PHONE_REGEX.search(text)
    phone = phone_match.group(0) if phone_match else None

    # Skills (word-boundary match, case-insensitive)
    skills_found: List[str] = []
    text_lower = text.lower()
    for sk in _SKILLS:
        # word boundary for typical tokens; for technologies like 'node', ensure not matching substrings inside larger words
        pattern = re.compile(rf"\b{re.escape(sk)}\b", re.IGNORECASE)
        if pattern.search(text_lower):
            skills_found.append(sk)

    # Unique and sorted for stable output
    skills_unique_sorted = sorted(set(skills_found))

    return {
        "email": email,
        "phone": phone,
        "skills": skills_unique_sorted,
    }


__all__ = ["preprocess_text", "compute_match_score", "extract_profile"]
