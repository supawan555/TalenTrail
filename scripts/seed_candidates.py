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
    def cand(name: str, email: str, position: str, applied_days_ago: int, state: str,
             stage_days: int = 0, hired: bool = False, rejected: bool = False, dropped: bool = False) -> Dict[str, Any]:
        applied_at = now - timedelta(days=applied_days_ago)
        state_entered_at = now - timedelta(days=stage_days) if stage_days > 0 else applied_at
        doc: Dict[str, Any] = {
            "seed_tag": SEED_TAG,
            "name": name,
            "email": email,
            "position": position,
            "status": "active",
            "created_at": now.isoformat(),
            "applied_at": applied_at,
            "current_state": state,
            "hired_at": None,
            "rejected_at": None,
            "dropped_at": None,
            "state_history": [
                {"state": "applied", "entered_at": applied_at, "exited_at": state_entered_at if state != "applied" else None}
            ],
            "matchScore": 60,
        }
        if state != "applied":
            doc["state_history"].append({"state": state, "entered_at": state_entered_at, "exited_at": None})
        if hired:
            doc["current_state"] = "hired"
            doc["hired_at"] = now - timedelta(days=max(0, stage_days - 1))
            # close last state
            if doc["state_history"]:
                doc["state_history"][-1]["exited_at"] = doc["hired_at"]
            doc["state_history"].append({"state": "hired", "entered_at": doc["hired_at"], "exited_at": None})
        if rejected:
            doc["current_state"] = "rejected"
            doc["rejected_at"] = now - timedelta(days=max(0, stage_days - 1))
            if doc["state_history"]:
                doc["state_history"][-1]["exited_at"] = doc["rejected_at"]
            doc["state_history"].append({"state": "rejected", "entered_at": doc["rejected_at"], "exited_at": None})
        if dropped:
            doc["current_state"] = "dropped"
            doc["dropped_at"] = now - timedelta(days=max(0, stage_days - 1))
            if doc["state_history"]:
                doc["state_history"][-1]["exited_at"] = doc["dropped_at"]
            doc["state_history"].append({"state": "dropped", "entered_at": doc["dropped_at"], "exited_at": None})
        return doc

    return [
        cand("Alice Johnson", "alice.demo@example.com", "Frontend Engineer", 20, "screening", stage_days=12),
        cand("Bob Smith", "bob.demo@example.com", "Backend Engineer", 35, "interview", stage_days=10),
        cand("Carol Lee", "carol.demo@example.com", "Data Scientist", 10, "applied"),
        cand("David Park", "david.demo@example.com", "QA Engineer", 50, "final", stage_days=8, hired=True),
        cand("Eva Gomez", "eva.demo@example.com", "Product Manager", 28, "interview", stage_days=6, rejected=True),
        cand("Frank Wu", "frank.demo@example.com", "DevOps Engineer", 18, "screening", stage_days=9, dropped=True),
        # A hire this month
        cand("Grace Kim", "grace.demo@example.com", "UI/UX Designer", 7, "final", stage_days=6, hired=True),
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
