"""
Diagnostic script to identify candidates with missing department information.
This script will:
1. Find all candidates where department field is null/missing
2. Show which job descriptions exist and their departments
3. Identify candidates currently showing as 'Unknown' in Analytics
4. Suggest how to fix the data by linking candidates to job departments
"""

import sys
import os
from pymongo import MongoClient
from datetime import datetime
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config

def diagnose_departments():
    """Analyze department data issues in the database."""
    
    client = MongoClient(config.MONGO_URL)
    primary_db = client[config.PRIMARY_DB]
    candidate_collection = primary_db["candidates"]
    job_collection = primary_db["job_descriptions"]
    
    print("=" * 80)
    print("DEPARTMENT DATA DIAGNOSTIC REPORT")
    print("=" * 80)
    print(f"Generated: {datetime.now().isoformat()}")
    print()
    
    # 1. Check job descriptions and their departments
    print("📋 JOB DESCRIPTIONS AND DEPARTMENTS:")
    print("-" * 80)
    job_dept_map = {}
    all_jobs = list(job_collection.find())
    
    if not all_jobs:
        print("⚠️  No job descriptions found in database!")
    else:
        for job in all_jobs:
            role = job.get("role", "Unknown Role")
            dept = job.get("department", None)
            job_dept_map[role.lower()] = dept
            print(f"  Role: {role:40s} → Department: {dept or 'MISSING'}")
    
    print()
    
    # 2. Analyze candidates
    print("👥 CANDIDATE DEPARTMENT ANALYSIS:")
    print("-" * 80)
    
    all_candidates = list(candidate_collection.find())
    total_candidates = len(all_candidates)
    
    # Count candidates by department field status
    has_dept_field = 0
    missing_dept_field = 0
    dept_is_null = 0
    dept_is_empty = 0
    dept_is_unknown = 0
    
    # Track which candidates are showing as 'Unknown'
    unknown_candidates = []
    candidates_by_position = defaultdict(list)
    
    for candidate in all_candidates:
        name = candidate.get("name", "Unnamed")
        position = candidate.get("position") or candidate.get("role", "No Position")
        dept = candidate.get("department")
        candidate_id = str(candidate.get("_id"))
        
        candidates_by_position[position].append({
            "id": candidate_id,
            "name": name,
            "department": dept
        })
        
        if "department" not in candidate:
            missing_dept_field += 1
            unknown_candidates.append({
                "id": candidate_id,
                "name": name,
                "position": position,
                "reason": "Missing 'department' field"
            })
        elif dept is None:
            dept_is_null += 1
            unknown_candidates.append({
                "id": candidate_id,
                "name": name,
                "position": position,
                "reason": "Department is null"
            })
        elif dept == "":
            dept_is_empty += 1
            unknown_candidates.append({
                "id": candidate_id,
                "name": name,
                "position": position,
                "reason": "Department is empty string"
            })
        elif dept.lower() == "unknown":
            dept_is_unknown += 1
            unknown_candidates.append({
                "id": candidate_id,
                "name": name,
                "position": position,
                "reason": "Department is 'Unknown'"
            })
        else:
            has_dept_field += 1
    
    print(f"Total Candidates: {total_candidates}")
    print(f"  ✅ With valid department: {has_dept_field}")
    print(f"  ❌ Missing 'department' field: {missing_dept_field}")
    print(f"  ❌ Department is null: {dept_is_null}")
    print(f"  ❌ Department is empty: {dept_is_empty}")
    print(f"  ⚠️  Department is 'Unknown': {dept_is_unknown}")
    print()
    
    # 3. Show candidates that will appear as 'Unknown' in Analytics
    if unknown_candidates:
        print("🚨 CANDIDATES SHOWING AS 'UNKNOWN' IN ANALYTICS:")
        print("-" * 80)
        for i, cand in enumerate(unknown_candidates, 1):
            print(f"{i}. {cand['name']} (ID: {cand['id']})")
            print(f"   Position: {cand['position']}")
            print(f"   Reason: {cand['reason']}")
            
            # Check if we can link to a job description
            position_lower = cand['position'].lower() if cand['position'] else ""
            if position_lower in job_dept_map:
                expected_dept = job_dept_map[position_lower]
                print(f"   💡 Can be linked to department: {expected_dept}")
            else:
                print(f"   ⚠️  No matching job description found for position: {cand['position']}")
            print()
    else:
        print("✅ No candidates with 'Unknown' department!")
        print()
    
    # 4. SQL-like aggregate query results
    print("📊 CANDIDATES GROUPED BY POSITION:")
    print("-" * 80)
    for position, cands in sorted(candidates_by_position.items()):
        count = len(cands)
        dept_statuses = [c.get('department') or 'MISSING' for c in cands]
        unique_depts = set(dept_statuses)
        print(f"Position: {position}")
        print(f"  Count: {count}")
        print(f"  Departments: {', '.join(unique_depts)}")
        print()
    
    # 5. Generate SQL-like queries
    print("=" * 80)
    print("EQUIVALENT SQL-LIKE QUERIES:")
    print("=" * 80)
    print()
    print("-- Find candidates with null, empty, or missing department:")
    print("db.candidates.find({")
    print('  "$or": [')
    print('    {"department": {"$exists": false}},')
    print('    {"department": null},')
    print('    {"department": ""},')
    print('    {"department": "Unknown"}')
    print('  ]')
    print("})")
    print()
    
    print("-- Count candidates by position and department status:")
    print("db.candidates.aggregate([")
    print("  {")
    print('    "$group": {')
    print('      "_id": {')
    print('        "position": "$position",')
    print('        "has_department": {"$cond": [{"$ifNull": ["$department", false]}, true, false]}')
    print("      },")
    print('      "count": {"$sum": 1}')
    print("    }")
    print("  }")
    print("])")
    print()
    
    # 6. Recommendations
    print("=" * 80)
    print("RECOMMENDATIONS:")
    print("=" * 80)
    print()
    print("1. UPDATE CANDIDATE CREATION LOGIC:")
    print("   When a candidate is created and matched to a job description,")
    print("   also copy the 'department' field from the job to the candidate.")
    print()
    print("2. BACKFILL EXISTING DATA:")
    print("   Run a migration script to populate department field for existing")
    print("   candidates based on their position field.")
    print()
    print("3. MIGRATION QUERY:")
    print("   for position, dept in job_dept_map.items():")
    print("       candidate_collection.update_many(")
    print('           {"position": position, "$or": [{"department": {"$exists": false}}, {"department": null}, {"department": ""}]},')
    print('           {"$set": {"department": dept}}')
    print("       )")
    print()
    
    client.close()
    
    return len(unknown_candidates)


if __name__ == "__main__":
    try:
        unknown_count = diagnose_departments()
        sys.exit(0 if unknown_count == 0 else 1)
    except Exception as e:
        print(f"❌ Error running diagnostic: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(2)
