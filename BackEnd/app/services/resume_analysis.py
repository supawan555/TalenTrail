"""Resume analysis service / ML orchestration.

Existing functionality:
- Invokes external analyzer script (analyze_resume.py) for lightweight skill extraction.

New integration:
- Uses production modules `resume_extraction` and `resume_matching` to build a richer
    candidate analysis and match score against a chosen job description.
"""
from __future__ import annotations
import json
import os
import subprocess
from datetime import datetime
from typing import Any, Dict, Optional

from ..db import resume_analyses_collection, job_collection
from .resume_extraction import extract_resume_data
from .resume_matching import compute_match


def run_external_analyzer(local_path: str) -> Dict[str, Any]:
    """Run analyze_resume.py script if present, returning parsed analysis or error info."""
    try:
        base_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "MachineLearning"))
        script = os.path.join(base_dir, "analyze_resume.py")
        if not os.path.exists(script):
            return {"error": "analyzer_not_found", "path": script}
        proc = subprocess.run([os.sys.executable, script, local_path], capture_output=True, text=True, timeout=30)
        if proc.returncode != 0:
            return {"error": "analyzer_failed", "stderr": proc.stderr}
        if not proc.stdout:
            return {"error": "empty_output"}
        try:
            return json.loads(proc.stdout)
        except Exception:
            return {"error": "invalid_json", "raw": proc.stdout}
    except Exception as e:
        return {"error": "exception", "detail": str(e)}


def persist_resume_analysis(original_filename: str, server_path: str, public_url: str, content_type: str, job_role: Optional[str] = None) -> Optional[str]:
    """Persist analysis metadata using both legacy analyzer and new ML pipeline.

    Args:
        original_filename: uploaded filename
        server_path: local server path where file is stored
        public_url: URL served by FastAPI static mount
        content_type: MIME type
        job_role: optional job role string to match against job_collection
    Returns:
        Inserted document id as string or None on failure
    """
    try:
        size_bytes = None
        try:
            size_bytes = os.path.getsize(server_path)
        except Exception:
            pass
        legacy = run_external_analyzer(server_path)

        # Enhanced extraction
        extracted = extract_resume_data(server_path)

        # Attempt matching if job_role provided
        match_result = None
        if job_role:
            job_doc = job_collection.find_one({"role": job_role})
            if job_doc:
                match_result = compute_match(extracted, job_doc)

        record = {
            "file_name": original_filename,
            "server_path": server_path,
            "public_url": public_url,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "legacy_analysis": legacy,
            "extracted": extracted,
            "match": match_result,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        inserted = resume_analyses_collection.insert_one(record)
        return str(inserted.inserted_id)
    except Exception:
        return None


def analyze_and_match_resume(server_path: str, job_role: Optional[str] = None) -> Dict[str, Any]:
    """Convenience function returning combined extraction + match output (without persistence)."""
    extracted = extract_resume_data(server_path)
    match_result = None
    if job_role:
        job_doc = job_collection.find_one({"role": job_role})
        if job_doc:
            match_result = compute_match(extracted, job_doc)
    return {
        "extracted": extracted,
        "match": match_result
    }
