"""Score every resume in tests/resumeTest against a job description.

Standalone script (not pytest) - runs the real analyze_resume end to end
(real Gemini + real SBERT), same as app/ml/test_resume.py but over the PDF
fixtures instead of a hardcoded string.

Usage:
    BackEnd/.venv/Scripts/python -m tests.resumeTest.run_match_test
"""

from __future__ import annotations

import glob
import os

from app.ml.resume_extractor import extract_resume_text
from app.ml.resume_matcher import analyze_resume
from tests.eval.fixtures.jobs import FULL_STACK

RESUME_DIR = os.path.dirname(os.path.abspath(__file__))


def main() -> None:
    pdf_paths = sorted(glob.glob(os.path.join(RESUME_DIR, "*.pdf")))
    if not pdf_paths:
        print(f"No PDF resumes found in {RESUME_DIR}")
        return

    print(f"Job description: Full Stack Developer\n{'=' * 70}")

    for path in pdf_paths:
        name = os.path.basename(path)
        resume_text = extract_resume_text(path)

        if not resume_text.strip():
            print(f"\n{name}\n  -> failed to extract text (empty PDF content)")
            continue

        result = analyze_resume(resume_text, FULL_STACK)

        print(f"\n{name}")
        print(f"  status         : {result['status']}")
        if result["status"] == "scored":
            print(f"  final_score    : {result['final_score']}")
            print(f"  llm_score      : {result['llm_score']}")
            print(f"  semantic_score : {result['semantic_score']}")
            print(f"  strengths      : {result['strengths']}")
            print(f"  missing_skills : {result['missing_skills']}")
        else:
            print(f"  error          : {result['error']}")


if __name__ == "__main__":
    main()
