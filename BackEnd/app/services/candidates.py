from datetime import datetime, timezone
import os
from app.ml.resume_matcher import analyze_resume
from app.ml.resume_extractor import extract_resume_text, extract_resume_data
from app.db import candidate_collection, job_collection

#ml process
async def process_candidate_ml_pipeline(candidate_data: dict, resume_path: str = None):
    position = candidate_data.get("position")
    
    # 1. ป้องกัน KeyError: สร้าง dict เปล่ารอไว้ก่อนเลยถ้ายังไม่มี
    if not isinstance(candidate_data.get("resumeAnalysis"), dict):
        candidate_data["resumeAnalysis"] = {}

    # 2. Extract Text & ML Data
    resume_text = ""
    if resume_path and os.path.exists(resume_path):
        try:
            resume_text = extract_resume_text(resume_path)
            extracted = extract_resume_data(resume_text) or {}

            # เติมข้อมูลที่ขาด
            for field in ["email", "phone", "skills"]:
                if extracted.get(field): # ถ้า AI แกะเจอ ให้เอาค่าจาก AI เป็นหลัก
                    candidate_data[field] = extracted[field]
            candidate_data["resumeAnalysis"].update(extracted)
        except Exception as e:
            print(f"ML Extraction Error: {e}")

    # 3. Matching Score
    if position and resume_text:
        try:
            job_doc = job_collection.find_one({"role": {"$regex": f"^{position}$", "$options": "i"}})
            if job_doc:
                analysis_result = analyze_resume(resume_text, job_doc.get("description", ""))
                score = round(float(analysis_result.get("final_score", 0)), 2)
                
                candidate_data["matchScore"] = score
                
                # เช็คก่อนว่า resumeAnalysis เป็น dict มั้ย ถ้าเป็น None ให้เสกเป็น dict ใหม่เลย
                if not isinstance(candidate_data.get("resumeAnalysis"), dict):
                    candidate_data["resumeAnalysis"] = {}
                candidate_data["resumeAnalysis"]["match"] = analysis_result
                candidate_data.setdefault("department", job_doc.get("department"))
        except Exception as e:
            print(f"Matching Error: {e}")
    return candidate_data

#เตรียมโครงสร้างข้อมูล 
def init_candidate_metadata(data: dict) -> dict:
    now = datetime.now(timezone.utc)
    defaults = {
        "created_at": now.isoformat(),
        "applied_at": now,
        "current_state": "applied",
        "status": "active",
        "state_history": [{"state": "applied", "entered_at": now, "exited_at": None}],
        "hired_at": None, "rejected_at": None, "interview_at": None # เซ็ตให้ครบที่นี่
    }
    return {**data, **defaults}