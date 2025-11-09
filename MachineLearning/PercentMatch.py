import re
import numpy as np
import pandas as pd
from pypdf import PdfReader
from rapidfuzz import process, fuzz
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

CSV_PATH = "data/job_description.csv"
pdf_path = 'data/frontend_strong_real.pdf'
user_input_role = "frontend developer"

# === Job Description ===
df_jd = pd.read_csv(CSV_PATH, encoding_errors="ignore")
print(f"Loaded {len(df_jd)} job descriptions")
print(f"Columns: {df_jd.columns.tolist()}")

required_cols = {"Role", "JobDescription"}
missing = required_cols - set(df_jd.columns)
assert not missing, f"CSV is missing columns: {missing}"

def clean_text(s: str) -> str:
    s = str(s).lower()
    s = re.sub(r'http\S+|www\S+|\S+@\S+', ' ', s)
    s = re.sub(r'[^a-z0-9\s\.\+\#]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s
df_jd['CleanedJobDescription'] = df_jd['JobDescription'].apply(clean_text)

# === Resume Text ===
def read_pdf_text(pdf_path: str) -> str:
    try:
        reader = PdfReader(pdf_path)
        chunks = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            chunks.append(txt)
            fully_text = "\n".join(chunks).strip()
        return fully_text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""
    
resume_text = read_pdf_text(pdf_path)
print(f"Resume text length: {len(resume_text)}")
print(f"Resume text preview: {resume_text[:200]}...")

resume_clean = clean_text(resume_text)
print(f"Cleaned resume length: {len(resume_clean)}")
print(f"Cleaned resume preview: {resume_clean[:200]}...")

# === Normalize Role Input ===
ALLOWED_ROLES = sorted(df_jd["Role"].dropna().unique().tolist())

def normalize_role_input(user_role: str, choices=ALLOWED_ROLES, threshold=80):
    cand, score, _ = process.extractOne(user_role, choices, scorer=fuzz.WRatio)
    return (cand, score) if score >= threshold else (None, score)

matched_role, score = normalize_role_input(user_input_role)

print(f"User input role: {user_input_role}")
print(f"Matched role: {matched_role}")
print(f"Match score: {score}")
print(f"Available roles: {ALLOWED_ROLES[:5]}...")

if not matched_role:
    raise ValueError(f"Role '{user_input_role}' not recognized (best score={score}). Try one of: {ALLOWED_ROLES[:10]} ...")


# === Hyperparameters เดิมของคุณ ===
BASELINE_COS = 0.20
MIN_WORDS = 50
NEGATIVE_PENALTY = 0.5

NEGATIVE_WORDS = {
    "accounting","nurse","warehouse","driver","logistics",
    "cashier","factory","mechanical","chefs","culinary"
}

# === ใหม่: vocabulary ของ skills (เพิ่มเองได้เรื่อย ๆ) ===
SKILL_VOCAB = {
    # ---------- Engineering / Frontend ----------
    "html", "css", "javascript", "typescript",
    "react", "next.js", "nextjs", "redux", "context api",
    "tailwind", "tailwind css", "vite", "webpack",
    "responsive design", "state management",
    "jest", "react testing library", "vitest", "enzyme",

    # ---------- Backend / Full Stack ----------
    "node.js", "nodejs", "express", "python", "django", "flask",
    "go", "golang", "java", "spring", "spring boot",
    "rest api", "graphql", "microservices", "monolith",
    "postgresql", "mysql", "sqlite", "mongodb", "firebase",
    "redis", "docker", "kubernetes", "container",
    "aws", "gcp", "azure", "lambda", "cloud run", "ec2",
    "terraform", "cloudformation", "ansible",
    "jenkins", "gitlab ci", "github actions", "ci/cd",
    "prometheus", "grafana", "elk", "logstash", "kibana",
    "bash", "shell", "powershell", "scripting",

    # ---------- Design ----------
    "figma", "sketch", "adobe xd", "adobe creative suite",
    "photoshop", "illustrator", "indesign",
    "wireframe", "prototype", "prototyping",
    "design system", "typography", "color theory",
    "visual hierarchy", "layout", "usability testing",
    "accessibility", "wcag", "user research",
    "user-centered design", "interaction design",

    # ---------- Product ----------
    "product management", "roadmap", "product strategy",
    "agile", "scrum", "kanban",
    "stakeholder management", "user stories", "sprint planning",
    "analytics", "data-driven", "okrs", "kpis",

    # ---------- Marketing ----------
    "seo", "sem", "google analytics", "google ads", "facebook ads",
    "content marketing", "email marketing", "newsletter",
    "social media", "instagram", "linkedin", "twitter", "tiktok",
    "campaign", "brand awareness", "conversion rate",
    "semrush", "ahrefs", "meta ads manager",
    "crm", "hubspot", "salesforce",
    "copywriting", "blog", "landing page", "a/b testing",
    "digital marketing", "marketing automation",
}

# weight สำหรับรวมคะแนน
FINAL_W_JD = 0.6
FINAL_W_SKILL = 0.4

model = SentenceTransformer("all-MiniLM-L6-v2")

def extract_skills(text: str) -> set[str]:
    """
    ดึง skills จาก text โดยเช็คจาก SKILL_VOCAB แบบง่าย ๆ
    (ภายหลังคุณเพิ่ม vocab ได้ตามใจ)
    """
    text_low = text.lower()
    return {skill for skill in SKILL_VOCAB if skill.lower() in text_low}

def score_resume(resume_clean: str, matched_role: str, df_jd):
    # 1) กันกรณี resume สั้น/มั่ว
    if len(resume_clean.split()) < MIN_WORDS:
        return {
            "role": matched_role,
            "jd_match_pct": 0.0,
            "skill_overlap_pct": 0.0,
            "final_pct": 0.0,
            "reason": "resume too short/irrelevant",
            "jd_skills": [],
            "cv_skills": []
        }

    # 2) เลือก JD ตาม role จาก database
    # NOTE: df_jd uses column name "Role" (capital R) in this notebook
    sub = df_jd[df_jd["Role"].str.lower() == matched_role.lower()].copy()
    assert len(sub) > 0, f"No JD found for role: {matched_role}"

    # ใช้ CleanedJobDescription ซึ่งถูกเตรียมไว้แล้ว
    jd_texts = sub["CleanedJobDescription"].tolist()

    # 3) สร้าง embedding
    res_emb = model.encode([resume_clean], normalize_embeddings=True)
    jd_emb  = model.encode(jd_texts, batch_size=64, normalize_embeddings=True)

    # 4) JD Match (เหมือนเดิม)
    sims = cosine_similarity(res_emb, jd_emb)[0]
    sims = sims - BASELINE_COS
    sims = np.clip(sims, 0, 1)
    perc = sims * 100
    sub["JD_Match_%"] = perc

    # 5) ลงโทษถ้าเจอคำผิดสายงาน
    has_negative = any(w in resume_clean.lower() for w in NEGATIVE_WORDS)
    if has_negative:
        sub["JD_Match_%"] = sub["JD_Match_%"] * NEGATIVE_PENALTY

    # 6) เลือก JD ที่ match สูงสุด
    best_idx = sub["JD_Match_%"].idxmax()
    best_row = sub.loc[best_idx]
    jd_match_pct = float(best_row["JD_Match_%"])
    best_jd_text = best_row["CleanedJobDescription"]

    # 7) คำนวณ SkillOverlap_% จาก text JD + resume
    jd_skills = extract_skills(best_jd_text)
    cv_skills = extract_skills(resume_clean)

    if jd_skills:
        skill_overlap_pct = len(jd_skills & cv_skills) / len(jd_skills) * 100.0
    else:
        skill_overlap_pct = 0.0

    # 8) รวมคะแนนสุดท้าย
    final_pct = FINAL_W_JD * jd_match_pct + FINAL_W_SKILL * skill_overlap_pct

    return {
        "role": matched_role,
        "jd_match_pct": round(jd_match_pct, 2),
        "skill_overlap_pct": round(skill_overlap_pct, 2),
        "final_pct": round(final_pct, 2),
        "jd_skills": sorted(jd_skills),
        "cv_skills": sorted(cv_skills),
        "reason": "ok"
    }

# ตัวอย่างการเรียกใช้
result = score_resume(
    resume_clean=resume_clean,
    matched_role=matched_role,
    df_jd=df_jd
)

print("Role:", result["role"])
print("JD Match %:", result["jd_match_pct"])
print("Skill Overlap %:", result["skill_overlap_pct"])
print("Final %:", result["final_pct"])
print("JD skills:", result["jd_skills"])
print("Resume skills:", result["cv_skills"])