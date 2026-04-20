"""Seed sample candidates for dashboard testing (local/dev only).

Usage:
  python scripts/seed_candidates.py --confirm

This script is idempotent: it deletes previous documents tagged with seed_tag
before inserting fresh ones. Do NOT run in production.
"""
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Ensure BackEnd on path for app.* imports
ROOT = os.path.dirname(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(ROOT, "BackEnd")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.db import candidate_collection  # type: ignore

SEED_TAG = "dashboard-demo"


def build_candidates(now: datetime) -> List[Dict[str, Any]]:
    def dt(days_ago: int) -> datetime:
        return now - timedelta(days=days_ago)

    def mk_candidate(
        name: str,
        email: str,
        phone: str,
        position: str,
        department: str,
        match_score: int,
        timeline: List[tuple[str, int]],
    ) -> Dict[str, Any]:
        # timeline must start with ("applied", <days_ago>) and be ordered oldest -> newest
        state_history: List[Dict[str, Any]] = []
        for idx, (state, entered_days_ago) in enumerate(timeline):
            entered_at = dt(entered_days_ago)
            exited_at = dt(timeline[idx + 1][1]) if idx + 1 < len(timeline) else None
            state_history.append(
                {
                    "state": state,
                    "entered_at": entered_at,
                    "exited_at": exited_at,
                }
            )

        current_state = timeline[-1][0]
        applied_at = dt(timeline[0][1])

        doc: Dict[str, Any] = {
            "seed_tag": SEED_TAG,
            "name": name,
            "email": email,
            "phone": phone,
            "position": position,
            "department": department,
            "experience": "3+ years",
            "location": "Bangkok",
            "status": "active",
            "created_at": applied_at.isoformat(),
            "applied_at": applied_at,
            "current_state": current_state,
            "hired_at": None,
            "rejected_at": None,
            "dropped_at": None,
            "state_history": state_history,
            "matchScore": match_score,
        }

        stage_field_map = {
            "screening": "screening_at",
            "interview": "interview_at",
            "final": "final_at",
            "hired": "hired_at",
            "rejected": "rejected_at",
            "drop-off": "dropped_at",
            "dropped": "dropped_at",
        }

        for state, entered_days_ago in timeline:
            field = stage_field_map.get(state)
            if field:
                doc[field] = dt(entered_days_ago)

        if current_state in {"rejected", "drop-off", "dropped"}:
            doc["status"] = "inactive"
        if current_state == "hired":
            doc["status"] = "hired"

        return doc

    return [
        # Applied duration = 8 days, currently in Screening for 12 days
        mk_candidate(
            "Alice Johnson",
            "alice.demo@example.com",
            "0909101001",
            "Frontend Engineer",
            "Engineering",
            84,
            [("applied", 20), ("screening", 12)],
        ),
        # Applied 6 days -> Screening 14 days -> currently Interview 10 days
        mk_candidate(
            "Bob Smith",
            "bob.demo@example.com",
            "0909101002",
            "Backend Engineer",
            "Engineering",
            76,
            [("applied", 30), ("screening", 24), ("interview", 10)],
        ),
        # Fresh applied candidate for card/date verification
        mk_candidate(
            "Carol Lee",
            "carol.demo@example.com",
            "0909101003",
            "Data Scientist",
            "Product",
            68,
            [("applied", 5)],
        ),
        # Long pipeline and currently in Final
        mk_candidate(
            "David Park",
            "david.demo@example.com",
            "0909101004",
            "QA Engineer",
            "Engineering",
            72,
            [("applied", 40), ("screening", 32), ("interview", 21), ("final", 8)],
        ),
        # Hired candidate to provide completed stage transitions
        mk_candidate(
            "Grace Kim",
            "grace.demo@example.com",
            "0909101005",
            "UI/UX Designer",
            "Design",
            91,
            [("applied", 50), ("screening", 42), ("interview", 30), ("final", 15), ("hired", 3)],
        ),
        # Rejected branch for archived page/testing
        mk_candidate(
            "Eva Gomez",
            "eva.demo@example.com",
            "0909101006",
            "Product Manager",
            "Product",
            63,
            [("applied", 25), ("screening", 18), ("interview", 9), ("rejected", 2)],
        ),
        # Drop-off branch for archived page/testing
        mk_candidate(
            "Frank Wu",
            "frank.demo@example.com",
            "0909101007",
            "DevOps Engineer",
            "Engineering",
            58,
            [("applied", 16), ("screening", 11), ("drop-off", 4)],
        ),
    ]


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Seed candidates for dashboard testing")
    parser.add_argument("--confirm", action="store_true", help="Confirm seeding (required)")
    args = parser.parse_args()
    if not args.confirm:
        print("Refusing to seed without --confirm flag")
        sys.exit(1)

    now = datetime.utcnow()
    # Clean previous seeds
    deleted = candidate_collection.delete_many({"seed_tag": SEED_TAG}).deleted_count
    print(f"Removed {deleted} previous seeded candidates")

    docs = build_candidates(now)
    if docs:
        candidate_collection.insert_many(docs)
        print(f"Inserted {len(docs)} seeded candidates with tag '{SEED_TAG}'")
    else:
        print("No documents to insert")


if __name__ == "__main__":
    main()
