"""Resume extraction module: parse PDF/DOCX resumes into structured fields.

Contract:
    extract_resume_data(path: str) -> dict with keys:
        name, email, phone, skills(list[str]), experience(str), raw_text(str)

Implementation Notes:
- Uses pdfplumber for PDF text extraction.
- Falls back to PyPDF2 if pdfplumber fails.
- Basic regex for email / phone.
- spaCy NER (PERSON) for name; first PERSON occurrence assumed candidate name.
- Skills keyword matching (case-insensitive) from a configurable list.

If spaCy model is missing, name extraction will be skipped gracefully.
"""
from __future__ import annotations
import re
from pathlib import Path
from typing import List, Dict, Any

try:
    import pdfplumber  # type: ignore
except Exception:  # pragma: no cover
    pdfplumber = None

try:
    from PyPDF2 import PdfReader  # type: ignore
except Exception:  # pragma: no cover
    PdfReader = None

# Lazy spaCy load to avoid import overhead if not installed
_spacy_nlp = None

def _load_spacy():
    global _spacy_nlp
    if _spacy_nlp is not None:
        return _spacy_nlp
    try:
        import spacy  # type: ignore
        _spacy_nlp = spacy.load("en_core_web_sm")
    except Exception:
        _spacy_nlp = None
    return _spacy_nlp

SKILL_KEYWORDS = [
    'Python', 'Java', 'C++', 'SQL', 'TensorFlow', 'Keras', 'Pandas', 'NumPy',
    'Machine Learning', 'AI', 'Deep Learning', 'HTML', 'CSS', 'JavaScript',
    'React', 'Node', 'Django', 'Flask', 'AWS', 'Docker', 'Kubernetes'
]

EMAIL_RE = re.compile(r'[\w\.-]+@[\w\.-]+')
PHONE_RE = re.compile(r'(\+?\d[\d\s-]{8,15}\d)')


def _extract_text_pdf(path: Path) -> str:
    """Extract text from a PDF using pdfplumber then PyPDF2 as fallback."""
    if pdfplumber is not None:
        try:
            text_parts: List[str] = []
            with pdfplumber.open(str(path)) as pdf:
                for page in pdf.pages:
                    try:
                        page_text = page.extract_text() or ''
                    except Exception:
                        page_text = ''
                    text_parts.append(page_text + '\n')
            if any(text_parts):
                return ''.join(text_parts)
        except Exception:
            pass
    if PdfReader is not None:
        try:
            reader = PdfReader(str(path))
            pages = []
            for p in reader.pages:
                try:
                    pages.append(p.extract_text() or '')
                except Exception:
                    pages.append('')
            return '\n'.join(pages)
        except Exception:
            pass
    return ''


def _extract_name(text: str) -> str | None:
    nlp = _load_spacy()
    if not nlp:
        return None
    try:
        doc = nlp(text[:10000])  # limit for performance
        for ent in doc.ents:
            if ent.label_ == 'PERSON':
                name = ent.text.strip()
                # remove line breaks inside name
                name = ' '.join(name.split())
                return name
    except Exception:
        return None
    return None


def _extract_skills(text: str) -> List[str]:
    found = []
    for skill in SKILL_KEYWORDS:
        if re.search(r'\b' + re.escape(skill) + r'\b', text, re.IGNORECASE):
            found.append(skill)
    return sorted(set(found))


def _extract_experience_lines(text: str) -> str:
    lines = []
    for line in text.split('\n'):
        if re.search(r'experience|worked|intern|ประสบการณ์|บริษัท', line, re.IGNORECASE):
            lines.append(line.strip())
    return '\n'.join(lines) if lines else ''


def extract_resume_data(path: str) -> Dict[str, Any]:
    p = Path(path)
    raw_text = ''
    if p.suffix.lower() == '.pdf':
        raw_text = _extract_text_pdf(p)
    # (DOCX support could be added here if needed.)

    email_matches = EMAIL_RE.findall(raw_text)
    phone_matches = PHONE_RE.findall(raw_text)
    name = _extract_name(raw_text) or ''
    skills = _extract_skills(raw_text)
    experience = _extract_experience_lines(raw_text)

    return {
        'name': name or None,
        'email': email_matches[0] if email_matches else None,
        'phone': phone_matches[0] if phone_matches else None,
        'skills': skills,
        'experience': experience or None,
        'raw_text': raw_text,
    }

__all__ = ['extract_resume_data']
