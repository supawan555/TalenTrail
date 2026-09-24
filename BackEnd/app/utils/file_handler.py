from app.utils import storage
from app.utils.file_storage import unique_name


def handle_candidate_uploads(resume):
    """เก็บไฟล์เรซูเม่ แล้วคืนค่า (storage key สำหรับ AI, URL สำหรับ Frontend)

    The client's filename is never used as a path: the key is always a fresh
    "resume_<uuid>.pdf", so "../../x" cannot escape the store.
    """
    if not (resume and resume.filename):
        return None, None
    key = unique_name("resume", "resume.pdf", ".pdf")
    storage.save(key, storage.read_upload(resume), "application/pdf")
    return key, storage.url_for(key)
