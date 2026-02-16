"""
Migration script to populate department field for candidates.

This script:
1. Reads all job descriptions and builds a position → department mapping
2. Updates all candidates to add the department field based on their position
3. Handles case-insensitive matching
4. Reports progress and results
"""

import sys
import os
from pymongo import MongoClient
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import config


def migrate_candidate_departments():
    """Populate department field for all candidates based on their position."""
    
    client = MongoClient(config.MONGO_URL)
    primary_db = client[config.PRIMARY_DB]
    candidate_collection = primary_db["candidates"]
    job_collection = primary_db["job_descriptions"]
    
    print("=" * 80)
    print("CANDIDATE DEPARTMENT MIGRATION")
    print("=" * 80)
    print(f"Started: {datetime.now().isoformat()}")
    print()
    
    # Step 1: Build position → department mapping from job descriptions
    print("📋 Building position → department mapping...")
    job_dept_map = {}
    
    for job in job_collection.find():
        role = job.get("role", "")
        dept = job.get("department", "Unknown")
        
        if role:
            # Store both exact match and lowercase for case-insensitive lookup
            job_dept_map[role] = dept
            job_dept_map[role.lower()] = dept
            print(f"  {role} → {dept}")
    
    print(f"\n✅ Found {len(set(job_dept_map.values()))} unique departments")
    print()
    
    # Step 2: Find candidates needing department field
    print("👥 Finding candidates without department...")
    candidates_to_update = list(candidate_collection.find({
        "$or": [
            {"department": {"$exists": False}},
            {"department": None},
            {"department": ""},
            {"department": "Unknown"}
        ]
    }))
    
    print(f"Found {len(candidates_to_update)} candidates to update")
    print()
    
    if not candidates_to_update:
        print("✅ All candidates already have department field!")
        client.close()
        return 0
    
    # Step 3: Update candidates
    print("🔄 Updating candidates...")
    updated_count = 0
    skipped_count = 0
    position_not_found = set()
    
    for candidate in candidates_to_update:
        candidate_id = candidate["_id"]
        name = candidate.get("name", "Unnamed")
        position = candidate.get("position") or candidate.get("role", "")
        
        # Try exact match first, then case-insensitive
        department = None
        if position in job_dept_map:
            department = job_dept_map[position]
        elif position.lower() in job_dept_map:
            department = job_dept_map[position.lower()]
        
        if department:
            # Update the candidate with the department
            result = candidate_collection.update_one(
                {"_id": candidate_id},
                {"$set": {"department": department}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"  ✅ Updated: {name} ({position}) → {department}")
            else:
                skipped_count += 1
                print(f"  ⚠️  No change: {name} ({position})")
        else:
            skipped_count += 1
            position_not_found.add(position)
            print(f"  ❌ No job found: {name} ({position})")
    
    print()
    print("=" * 80)
    print("MIGRATION RESULTS:")
    print("=" * 80)
    print(f"Total candidates processed: {len(candidates_to_update)}")
    print(f"✅ Successfully updated: {updated_count}")
    print(f"⚠️  Skipped (no matching job): {skipped_count}")
    print()
    
    if position_not_found:
        print("⚠️  Positions without matching job descriptions:")
        for pos in sorted(position_not_found):
            print(f"  - {pos}")
        print()
        print("💡 TIP: These candidates will still show as 'Unknown' in Analytics.")
        print("   Consider creating job descriptions for these positions or")
        print("   manually setting a department for these candidates.")
        print()
    
    print(f"Completed: {datetime.now().isoformat()}")
    print("=" * 80)
    
    client.close()
    return updated_count


def verify_migration():
    """Verify the migration results."""
    
    client = MongoClient(config.MONGO_URL)
    primary_db = client[config.PRIMARY_DB]
    candidate_collection = primary_db["candidates"]
    
    print("\n🔍 VERIFICATION:")
    print("-" * 80)
    
    # Count candidates still without department
    still_missing = candidate_collection.count_documents({
        "$or": [
            {"department": {"$exists": False}},
            {"department": None},
            {"department": ""},
            {"department": "Unknown"}
        ]
    })
    
    # Count candidates with department
    with_dept = candidate_collection.count_documents({
        "department": {"$exists": True, "$ne": None, "$ne": "", "$ne": "Unknown"}
    })
    
    total = candidate_collection.count_documents({})
    
    print(f"Total candidates: {total}")
    print(f"✅ With department: {with_dept} ({100*with_dept/total if total > 0 else 0:.1f}%)")
    print(f"❌ Without department: {still_missing} ({100*still_missing/total if total > 0 else 0:.1f}%)")
    print()
    
    client.close()


if __name__ == "__main__":
    try:
        print("This script will populate the 'department' field for all candidates")
        print("based on their position and matching job descriptions.")
        print()
        
        response = input("Do you want to proceed? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("❌ Migration cancelled by user")
            sys.exit(0)
        
        print()
        updated = migrate_candidate_departments()
        verify_migration()
        
        if updated > 0:
            print("✅ Migration completed successfully!")
            print("   The Analytics charts should now show proper department names.")
        else:
            print("ℹ️  No updates needed")
        
        sys.exit(0)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
