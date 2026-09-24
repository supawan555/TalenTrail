from datetime import datetime, timezone
from app.ml.resume_matcher import analyze_resume
from app.ml.resume_extractor import extract_resume_text, extract_resume_data
from app.db import candidate_collection, job_collection
from app.utils import storage

#ml process
async def process_candidate_ml_pipeline(candidate_data: dict, resume_key: str = None):
    """``resume_key`` is a storage key (see app.utils.storage), not a disk path."""
    position = candidate_data.get("position")

    # 1. ป้องกัน KeyError: สร้าง dict เปล่ารอไว้ก่อนเลยถ้ายังไม่มี
    if not isinstance(candidate_data.get("resumeAnalysis"), dict):
        candidate_data["resumeAnalysis"] = {}

    # 2. Extract Text & ML Data
    resume_text = ""
    if resume_key:
        try:
            # PyMuPDF needs a real file; with Blob storage this is a temp copy
            with storage.local_copy(resume_key) as path:
                if path:
                    resume_text = extract_resume_text(path)
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

                # Never coerce a non-scored result into a number. A null
                # matchScore means "not scored"; 0 means "scored zero".
                final_score = analysis_result.get("final_score")
                score = round(float(final_score), 2) if final_score is not None else None
                if score is None:
                    print(
                        f"Matching not scored ({analysis_result.get('status')}): "
                        f"{analysis_result.get('error')}"
                    )

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