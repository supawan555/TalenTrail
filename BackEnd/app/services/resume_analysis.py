"""Resume analysis service: invoke external analyzer and persist results."""
from __future__ import annotations
import json
import os
import subprocess
from datetime import datetime
from typing import Any, Dict, Optional

from ..db import resume_analyses_collection


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


def persist_resume_analysis(original_filename: str, server_path: str, public_url: str, content_type: str) -> Optional[str]:
    """Persist analysis metadata and return inserted document id (as string) or None."""
    try:
        size_bytes = None
        try:
            size_bytes = os.path.getsize(server_path)
        except Exception:
            pass
        analysis = run_external_analyzer(server_path)
        record = {
            "file_name": original_filename,
            "server_path": server_path,
            "public_url": public_url,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "analysis": analysis,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        inserted = resume_analyses_collection.insert_one(record)
        return str(inserted.inserted_id)
    except Exception:
        return None
