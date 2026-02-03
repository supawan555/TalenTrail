import logging

# Lazy import to avoid heavy dependencies at module import time
try:
    from sentence_transformers import SentenceTransformer, util  # type: ignore
except Exception:  # pragma: no cover
    SentenceTransformer = None  # type: ignore
    util = None  # type: ignore

# ตั้งค่า Logger
logger = logging.getLogger("talenttrail.ml")

# Global model placeholder for lazy initialization
_MODEL = None

def get_model():
    """Initialize SBERT model on first use and reuse thereafter.

    Ensures FastAPI can start instantly without loading the model at import time.
    """
    global _MODEL
    if _MODEL is None:
        if SentenceTransformer is None:
            logger.error("sentence-transformers is not available")
            raise RuntimeError("sentence-transformers is not available")
        logger.info("⏳ [ML] Loading SBERT model 'all-MiniLM-L6-v2' on first use...")
        _MODEL = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✅ [ML] SBERT model loaded successfully")
    return _MODEL

def match_resume_to_job(resume_text: str, job_description: str) -> float:
    """
    Calculate semantic similarity between resume and job description.
    Returns a score between 0 and 100.
    """
    # Safety Check
    if not resume_text or not job_description:
        return 0.0

    # Lazy-load model on first use
    try:
        model = get_model()
    except Exception:
        logger.warning("Model not available, returning 0")
        return 0.0

    try:
        # ✅ 2. แปลงข้อความเป็น Vector (Embeddings)
        # convert_to_tensor=True เพื่อให้คำนวณได้เร็วขึ้น
        resume_embedding = model.encode(resume_text, convert_to_tensor=True)
        job_embedding = model.encode(job_description, convert_to_tensor=True)

        # ✅ 3. คำนวณ Cosine Similarity (ความเหมือนของ Vector)
        # ค่าที่ได้จะอยู่ระหว่าง -1 ถึง 1
        if util is None:
            logger.warning("sentence_transformers.util not available, returning 0")
            return 0.0
        score = util.cos_sim(resume_embedding, job_embedding)
        
        # ดึงค่าออกมาจาก Tensor
        raw_score = score.item()

        # ✅ 4. ปรับจูนคะแนน (Score Normalization) - สำคัญมาก!
        # SBERT ปกติจะให้คะแนนความเหมือนข้อความยาวๆ อยู่ที่ช่วง 0.2 - 0.7 
        # ถ้าได้ 0.6-0.7 คือเนื้อหาตรงกันมากแล้ว เราจึงต้อง Map สเกลใหม่ให้เป็น 0-100% ที่มนุษย์เข้าใจ
        
        # สูตร: ถ้า Raw Score < 0 ให้เป็น 0
        if raw_score < 0: raw_score = 0
        
        # Linear Scaling: 
        # กำหนดว่า Raw Score 0.15 = 0% (ไม่เหมือนเลย)
        # กำหนดว่า Raw Score 0.75 = 100% (เหมือนเป๊ะ)
        min_threshold = 0.15
        max_threshold = 0.75
        
        normalized_score = (raw_score - min_threshold) / (max_threshold - min_threshold)
        
        # Clamp ค่าให้อยู่ระหว่าง 0 ถึง 1
        normalized_score = max(0.0, min(1.0, normalized_score))
        
        # แปลงเป็นเปอร์เซ็นต์
        final_percentage = round(normalized_score * 100, 2)

        return final_percentage

    except Exception as e:
        logger.error(f"Error matching resume: {e}")
        return 0.0
    