"""Background service to auto-archive hired candidates after 7 days."""
import asyncio
from datetime import datetime, timedelta
from fastapi import FastAPI
from .. import db

# Auto-archive hired candidates after 7 days
HIRED_ARCHIVE_DAYS = 7


async def auto_archive_hired_candidates():
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=HIRED_ARCHIVE_DAYS)
        
        # Find candidates who are hired and hired_at is older than 7 days
        query = {
            "$or": [
                {"stage": "hired"},
                {"current_state": "hired"}
            ],
            "hired_at": {"$ne": None, "$lt": cutoff_date}
        }
        
        candidates_to_archive = list(db.candidate_collection.find(query))
        
        if not candidates_to_archive:
            print(f"[Auto-Archive] No hired candidates to archive (older than {HIRED_ARCHIVE_DAYS} days)")
            return
        
        archived_count = 0
        for candidate in candidates_to_archive:
            # Update to archived while preserving hired status
            update_payload = {
                "stage": "archived",
                "current_state": "archived",
                "archived_date": datetime.utcnow(),
                "archiveReason": f"Auto-archived after {HIRED_ARCHIVE_DAYS} days in hired status",
                "status": "hired",  # Keep hired status
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update state history
            history = candidate.get("state_history", [])
            # Close the current hired state
            for entry in history:
                if entry.get("state") in ["hired"] and entry.get("exited_at") is None:
                    entry["exited_at"] = datetime.utcnow()
            
            # Add archived state to history
            history.append({
                "state": "archived",
                "entered_at": datetime.utcnow(),
                "exited_at": None
            })
            update_payload["state_history"] = history
            
            db.candidate_collection.update_one(
                {"_id": candidate["_id"]},
                {"$set": update_payload}
            )
            archived_count += 1
        
        print(f"[Auto-Archive] Successfully archived {archived_count} hired candidate(s) older than {HIRED_ARCHIVE_DAYS} days")
        
    except Exception as e:
        print(f"[Auto-Archive] Error during auto-archive process: {e}")


async def periodic_auto_archive():
    """Run auto-archive task every 24 hours."""
    while True:
        try:
            await auto_archive_hired_candidates()
        except Exception as e:
            print(f"[Auto-Archive] Error in periodic task: {e}")
        
        # Wait 24 hours before next run
        await asyncio.sleep(24 * 60 * 60)


def register_auto_archive(app: FastAPI) -> None:
    """Register the auto-archive background task with FastAPI startup."""
    @app.on_event("startup")
    async def startup_auto_archive():
        """Start the auto-archive background task on application startup."""
        # Run immediately on startup
        await auto_archive_hired_candidates()
        
        # Schedule periodic task
        asyncio.create_task(periodic_auto_archive())
        print(f"[Auto-Archive] Background task registered - will check every 24 hours")
