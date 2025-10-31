#!/usr/bin/env python
"""
Simple resume analyzer script.
Usage: python analyze_resume.py /path/to/resume.pdf

This script extracts text from the PDF and performs a minimal keyword-based
skill extraction. It prints a JSON object to stdout with fields like:
 - skills: list[str]
 - text: extracted text (truncated)
 - experience_years: optional int (best-effort)

Replace or extend this script with your ML model as needed.
"""
import sys
import json
import re
from pathlib import Path

try:
    from PyPDF2 import PdfReader
except Exception:
    PdfReader = None


SKILLS = [
    "python", "java", "javascript", "react", "node", "django", "flask",
    "aws", "docker", "kubernetes", "sql", "postgresql", "mongodb",
    "tensorflow", "pytorch", "machine learning", "data science", "excel",
    "rest", "graphql", "typescript", "html", "css"
]


def extract_text(path: Path) -> str:
    if PdfReader is None:
        raise RuntimeError("PyPDF2 is not installed")
    reader = PdfReader(str(path))
    texts = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(texts)


def find_skills(text: str):
    text_low = text.lower()
    found = set()
    for s in SKILLS:
        if s in text_low:
            found.add(s)
    return sorted(found)


def find_experience_years(text: str):
    # naive search for patterns like '5 years', '5+ years', '5 yrs'
    m = re.findall(r"(\d{1,2})\s*\+?\s*(?:years|yrs|year)", text.lower())
    if not m:
        return None
    nums = [int(x) for x in m]
    return max(nums)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no file provided"}))
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.exists():
        print(json.dumps({"error": "file not found"}))
        sys.exit(1)

    try:
        text = extract_text(path)
    except Exception as e:
        print(json.dumps({"error": f"extract_failed: {e}"}))
        sys.exit(1)

    skills = find_skills(text)
    exp = find_experience_years(text)

    out = {
        "skills": skills,
        "experience_years": exp,
        "text_snippet": text[:2000]
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
