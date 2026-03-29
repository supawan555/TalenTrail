# app/ml/resume_extractor.py
import fitz  # PyMuPDF
import re
import os
from typing import Dict, Any

# 1. โหลด Skills จากไฟล์ text (Dynamic!)
KNOWN_SKILLS = set()
try:
    # หาไฟล์ skills.txt ในโฟลเดอร์เดียวกันหรือใกล้เคียง
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir)) # ถอยกลับไปหา root
    skills_path = os.path.join(current_dir, "skills.txt") 
    
    # ถ้าหาไม่เจอ ลองหาที่ root
    if not os.path.exists(skills_path):
        skills_path = "skills.txt"

    with open(skills_path, "r", encoding="utf-8") as f:
        for line in f:
            skill = line.strip().lower()
            if skill:
                KNOWN_SKILLS.add(skill)
    print(f"[ML] Loaded {len(KNOWN_SKILLS)} skills from file.")
except Exception as e:
    print(f"[ML] Warning: skills.txt not found ({e}). Using default set.")
    KNOWN_SKILLS = {'python', 'java', 'sql', 'react', 'javascript'} # Default กันตาย

# 2. ฟังก์ชันทำความสะอาด (จาก Code ของเรา)
def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s\+]', '', text) # เก็บ + ไว้ให้ C++
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# 3. ฟังก์ชันอ่าน PDF (แก้ปัญหา svc_extract หายไป)
def extract_resume_text(file_path: str) -> str:
    text_content = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text_content += page.get_text() + "\n"
        doc.close()
        return text_content
    except Exception as e:
        print(f"[ML] Error reading PDF: {e}")
        return ""

# 4. ฟังก์ชันสกัดข้อมูล (รวมร่าง)
def extract_resume_data(resume_text: str) -> Dict[str, Any]:
    cleaned = clean_text(resume_text)
    
    # หา Skills
    words = set(cleaned.split())
    found_skills = list(words.intersection(KNOWN_SKILLS))

    # หา Email
    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', resume_text)
    
    # หา Phone (ใช้ Regex ใหม่ที่คุณทดสอบแล้วว่าเวิร์ค)
    phone_match = re.search(r'(\+66|66|0)\s?\d{1,2}[-.\s]?\d{3}[-.\s]?\d{4}', resume_text)

    # หา Name (แบบง่าย)
    name = None
    lines = resume_text.split('\n')
    for line in lines:
        l = line.strip()
        if l and "resume" not in l.lower() and len(l) < 50:
            name = l
            break

    return {
        'name': name,
        'email': email_match.group(0) if email_match else None,
        'phone': phone_match.group(0) if phone_match else None,
        'skills': found_skills,
        'experience': None, # ไว้ทำเวอร์ชันหน้า
        'raw_text': resume_text,
    }

__all__ = ['extract_resume_text', 'extract_resume_data']