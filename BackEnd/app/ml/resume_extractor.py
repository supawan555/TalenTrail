"""High-level resume extraction API expected by the app.

Functions:
- extract_resume_text(file_path: str) -> str
- extract_resume_data(resume_text: str) -> dict

Implementation bridges to existing services-based extractors for consistency.
"""
from __future__ import annotations
import re
from typing import Dict, Any
from pathlib import Path

# Reuse existing extraction logic to read PDFs
from app.services import resume_extraction as svc_extract

EMAIL_RE = re.compile(r'[\w\.-]+@[\w\.-]+')
PHONE_RE = re.compile(r'(\+?\d[\d\s-]{8,15}\d)')

SKILL_KEYWORDS = [
    'Python', 'Java', 'C++', 'SQL', 'TensorFlow', 'Keras', 'Pandas', 'NumPy',
    'Machine Learning', 'AI', 'Deep Learning', 'HTML', 'CSS', 'JavaScript',
    'React', 'Node', 'Django', 'Flask', 'AWS', 'Docker', 'Kubernetes'
]


def extract_resume_text(file_path: str) -> str:
    """Extract raw text from a resume file (PDF supported)."""
    p = Path(file_path)
    raw_text = ''
    if p.suffix.lower() == '.pdf':
        # Use the same PDF path extractor used by services module
        raw_text = svc_extract._extract_text_pdf(p)  # type: ignore[attr-defined]
    # Could add DOCX or other formats here if needed.
    return raw_text or ''


def _extract_skills(text: str) -> list[str]:
    found = []
    for skill in SKILL_KEYWORDS:
        if re.search(r'\b' + re.escape(skill) + r'\b', text, re.IGNORECASE):
            found.append(skill)
    return sorted(set(found))


def _extract_experience_lines(text: str) -> str:
    lines = []
    for line in (text or '').split('\n'):
        if re.search(r'experience|worked|intern|ประสบการณ์|บริษัท', line, re.IGNORECASE):
            lines.append(line.strip())
    return '\n'.join(lines) if lines else ''


def extract_resume_data(resume_text: str) -> Dict[str, Any]:
    """Extract structured data from already extracted resume text."""
    resume_text = resume_text or ''
    emails = EMAIL_RE.findall(resume_text)
    phones = PHONE_RE.findall(resume_text)

    # Try spaCy PERSON via existing services loader (graceful fallback if missing)
    name = None
    try:
        name = svc_extract._extract_name(resume_text)  # type: ignore[attr-defined]
    except Exception:
        name = None

    return {
        'name': name,
        'email': emails[0] if emails else None,
        'phone': phones[0] if phones else None,
        'skills': _extract_skills(resume_text),
        'experience': _extract_experience_lines(resume_text) or None,
        'raw_text': resume_text,
    }

__all__ = ['extract_resume_text', 'extract_resume_data']
