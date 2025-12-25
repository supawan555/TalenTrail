# filepath: app/ml/resume_matcher.py
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def _clean_text_for_match(text: str) -> str:
    """
    ฟังก์ชันทำความสะอาดเฉพาะกิจสำหรับ Matcher
    (เก็บตัว + ไว้สำหรับ C++ แต่ตัดอย่างอื่นทิ้ง)
    """
    if not text: 
        return ""
    text = text.lower()
    # เก็บ a-z, 0-9, ช่องว่าง และ + (สำหรับ C++)
    text = re.sub(r'[^a-z0-9\s\+]', ' ', text)
    # ยุบช่องว่างที่เกิน
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def match_resume_to_job(resume_text: str, job_description_text: str) -> float:
    """
    ฟังก์ชันคำนวณความเหมือน (0-100%) โดยใช้ TF-IDF & Cosine Similarity
    Logic เดียวกับที่เราเทสผ่านแล้วใน ai_engine.py
    """
    # 1. ป้องกันค่าว่าง (Safety Check)
    if not resume_text or not job_description_text:
        return 0.0

    # 2. ทำความสะอาด
    clean_resume = _clean_text_for_match(resume_text)
    clean_job = _clean_text_for_match(job_description_text)
    
    # ถ้าทำความสะอาดแล้วไม่เหลือตัวหนังสือเลย ให้ตอบ 0
    if not clean_resume or not clean_job:
        return 0.0
    
    documents = [clean_resume, clean_job]
    
    try:
        # 3. แปลงเป็นตัวเลข (Vectorization)
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(documents)
        
        # 4. วัดมุม (Cosine Similarity)
        # เปรียบเทียบ Resume (index 0) กับ Job (index 1)
        similarity_matrix = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
        
        # ดึงค่าออกมา (0.0 - 1.0)
        score_float = similarity_matrix[0][0]
        
        # 5. แปลงเป็น 0-100% (ปัดเศษ 2 ตำแหน่ง)
        final_score = round(score_float * 100, 2)
        
        return final_score
        
    except Exception as e:
        print(f"⚠️ [Matcher] Error calculating score: {e}")
        return 0.0

# Export ฟังก์ชันให้ candidates.py เรียกใช้ได้
__all__ = ["match_resume_to_job"]