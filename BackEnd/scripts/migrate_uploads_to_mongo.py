"""
Copy resume files from BackEnd/uploads into the resume_files collection.

Resumes used to be written to the local disk of whichever machine ran the
backend. This script moves the ones still on this machine into MongoDB so
every deployment can serve them. It:
1. Finds every key that a candidate links to (resume_file, resumeUrl, resume_url)
2. Copies the matching file from BackEnd/uploads into resume_files
3. Reports the keys whose file exists nowhere, which must be re-uploaded

Runs as a dry run unless --apply is given. Files already in the collection are
skipped, so it is safe to run more than once.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402
from app.db import candidate_collection, resume_files_collection  # noqa: E402
from app.utils import storage  # noqa: E402
from app.utils.file_storage import UPLOAD_DIR  # noqa: E402


def linked_keys() -> set:
    """Storage keys referenced by any candidate."""
    keys = set()
    fields = {"resume_file": 1, "resumeUrl": 1, "resume_url": 1}
    for c in candidate_collection.find({}, fields):
        key = c.get("resume_file")
        if not storage.is_valid_key(key):
            key = storage.key_from_url(c.get("resumeUrl")) or storage.key_from_url(c.get("resume_url"))
        if key:
            keys.add(key)
    return keys


def migrate(apply: bool) -> None:
    settings.FILE_STORAGE = "mongo"
    keys = linked_keys()
    already = {d["_id"] for d in resume_files_collection.find({"_id": {"$in": list(keys)}}, {"_id": 1})}

    copied, missing = [], []
    for key in sorted(keys - already):
        path = os.path.join(UPLOAD_DIR, key)
        if not os.path.isfile(path):
            missing.append(key)
            continue
        if apply:
            with open(path, "rb") as fh:
                storage.save(key, fh.read())
        copied.append(key)

    print(f"Candidates link {len(keys)} resume files")
    print(f"  already in MongoDB:          {len(already)}")
    print(f"  {'copied' if apply else 'would copy'} from {UPLOAD_DIR}: {len(copied)}")
    print(f"  missing everywhere:          {len(missing)}")
    if not apply:
        print("\nDry run. Re-run with --apply to copy the files.")


if __name__ == "__main__":
    migrate(apply="--apply" in sys.argv)
