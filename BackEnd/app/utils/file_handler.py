import os
import shutil
from pathlib import Path

from app.utils.file_storage import unique_name

def handle_candidate_uploads(resume):
    """จัดการไฟล์เรซูเม่และคืนค่า Path (สำหรับ AI) และ URL (สำหรับ Frontend)"""
    res_path, res_url = None, None

    # 1. ตั้งค่า Root ของ Upload ให้ชัดเจน
    # ใช้ Path(__file__) เพื่อให้มันอ้างอิงจากตำแหน่งไฟล์นี้เสมอ ไม่หลงโฟลเดอร์
    BASE_DIR = Path(__file__).resolve().parent.parent # ถอยกลับไปที่ root project
    UPLOAD_DIR = BASE_DIR / "uploads" / "resumes"

    # 2. สร้างโฟลเดอร์รอไว้เลยถ้าไม่มี
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    if resume and resume.filename:
        # 3. สร้างชื่อไฟล์และที่อยู่แบบเต็ม (Absolute Path)
        # Never use the client's filename as a path: "../../x" would escape
        # UPLOAD_DIR. unique_name() returns a bare "resume_<uuid><ext>".
        filename = unique_name("resume", resume.filename, ".pdf")
        file_destination = UPLOAD_DIR / filename

        # 4. เขียนไฟล์แบบ FastAPI (ใช้ shutil ก๊อปปี้ stream)
        with open(file_destination, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)

        # 5. คืนค่าส่งออก
        # res_path ต้องเป็น String ของ Path เต็มๆ เพื่อให้ AI (os.path.exists) หาเจอ
        res_path = str(file_destination.absolute())
        # res_url คือทางเดินสำหรับหน้าบ้าน (Frontend)
        res_url = f"/uploads/resumes/{filename}"
    return res_path, res_url
