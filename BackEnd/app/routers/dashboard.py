from fastapi import APIRouter, Depends
from datetime import datetime
from app.db import candidate_collection
from app.services.auth import get_current_user_from_cookie


router = APIRouter(prefix="/dashboard", tags=["dashboard"]) 


@router.get("/profile") 
async def get_dashboard_root(current_user: dict = Depends(get_current_user_from_cookie)):
    return current_user


@router.get("/metrics")
async def get_dashboard_metrics(current_user: dict = Depends(get_current_user_from_cookie)):
    """Return dashboard metrics computed from REAL MongoDB data.

    Response:
    {
      "bottleneck": {"state": str | None, "avg_days": float},
      "hired_this_month": int,
      "avg_time_to_hire": float,
      "drop_off_rate": float
    }
    """
    # Time boundaries for current month (UTC)
    now = datetime.utcnow()
    start_month = datetime(now.year, now.month, 1)
    next_month = datetime(now.year + (1 if now.month == 12 else 0), 1 if now.month == 12 else now.month + 1, 1)

    # Hired this month (includes both active hired and archived hired candidates)
    # Counts candidates where hired_at is within this month, regardless of current stage
    hired_this_month = candidate_collection.count_documents({
        "hired_at": {"$gte": start_month, "$lt": next_month}
    })

    # Avg time to hire (days)
    avg_time_result = list(candidate_collection.aggregate([
        {"$match": {"hired_at": {"$ne": None}, "applied_at": {"$ne": None}}},
        {"$project": {
            "diffDays": {
                "$dateDiff": {"startDate": "$applied_at", "endDate": "$hired_at", "unit": "day"}
            }
        }},
        {"$group": {"_id": None, "avgDays": {"$avg": "$diffDays"}}}
    ]))
    avg_time_to_hire = round(float(avg_time_result[0]["avgDays"]) if avg_time_result else 0.0, 2)

    # Drop-off rate: (rejected + dropped)/total * 100
    total_candidates = candidate_collection.count_documents({})
    dropped_rejected = candidate_collection.count_documents({"current_state": {"$in": ["rejected", "dropped", "drop-off"]}})
    drop_off_rate = round((dropped_rejected / total_candidates) * 100, 2) if total_candidates > 0 else 0.0

    # Bottleneck: average days in current state for active candidates (exclude terminal states)
    bottleneck_pipeline = [
        {"$match": {"current_state": {"$nin": ["hired", "rejected", "dropped", "drop-off", "archived"]}}},
        {"$project": {
            "current_state": 1,
            # Find the active state entry in state_history for current_state
            "active_entry": {
                "$first": {
                    "$filter": {
                        "input": "$state_history",
                        "as": "s",
                        "cond": {"$and": [
                            {"$eq": ["$$s.state", "$current_state"]},
                            {"$eq": ["$$s.exited_at", None]}
                        ]}
                    }
                }
            },
            "applied_at": 1
        }},
        {"$addFields": {
            "entered_at_for_calc": {"$ifNull": ["$active_entry.entered_at", "$applied_at"]}
        }},
        {"$project": {
            "state": "$current_state",
            "days_in_state": {"$dateDiff": {"startDate": "$entered_at_for_calc", "endDate": "$$NOW", "unit": "day"}}
        }},
        {"$group": {"_id": "$state", "avg_days": {"$avg": "$days_in_state"}}},
        {"$sort": {"avg_days": -1}},
        {"$limit": 1}
    ]

    b_result = list(candidate_collection.aggregate(bottleneck_pipeline))
    bottleneck_state = b_result[0]["_id"] if b_result else None
    bottleneck_avg = round(float(b_result[0]["avg_days"]) if b_result else 0.0, 2)

    return {
        "bottleneck": {"state": bottleneck_state, "avg_days": bottleneck_avg},
        "hired_this_month": int(hired_this_month),
        "avg_time_to_hire": avg_time_to_hire,
        "drop_off_rate": drop_off_rate,
    }


@router.get("/analytics")
async def get_dashboard_analytics(current_user: dict = Depends(get_current_user_from_cookie)):
    """Return applications and hires grouped by month for last 6 months.

    Shape:
    { "applicationsByMonth": [ {"month": "YYYY-MM", "applications": int, "hires": int }, ... ] }
    """
    now = datetime.utcnow()
    # Build last 6 months keys including current month
    months = []
    y, m = now.year, now.month
    for i in range(5, -1, -1):  # 6 entries
        mm = m - i
        yy = y
        while mm <= 0:
            mm += 12
            yy -= 1
        months.append(f"{yy:04d}-{mm:02d}")

    # Applications grouped by YYYY-MM from applied_at
    apps_pipeline = [
        {"$match": {"applied_at": {"$ne": None}}},
        {"$project": {"ym": {"$dateToString": {"format": "%Y-%m", "date": "$applied_at"}}}},
        {"$group": {"_id": "$ym", "applications": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    # Hires pipeline - counts all candidates who were hired (including auto-archived)
    # based on hired_at timestamp, regardless of current stage
    hires_pipeline = [
        {"$match": {"hired_at": {"$ne": None}}},
        {"$project": {"ym": {"$dateToString": {"format": "%Y-%m", "date": "$hired_at"}}}},
        {"$group": {"_id": "$ym", "hires": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]

    apps = {r["_id"]: r["applications"] for r in candidate_collection.aggregate(apps_pipeline)}
    hires = {r["_id"]: r["hires"] for r in candidate_collection.aggregate(hires_pipeline)}

    # Merge and fill zeros for missing months
    result = [{
        "month": mon,
        "applications": int(apps.get(mon, 0)),
        "hires": int(hires.get(mon, 0))
    } for mon in months]

    return {"applicationsByMonth": result}
