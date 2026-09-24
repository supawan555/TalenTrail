# Integration Tests

Integration test suite ของ Backend (FastAPI + MongoDB) — ทดสอบ router, service และ database layer ทำงานร่วมกันจริง ผ่าน `TestClient` โดยใช้ `mongomock` แทน MongoDB จริง (ไม่ต้องมี MongoDB/Ollama รันอยู่ก็เทสได้)

> Unit test เป็นความรับผิดชอบของทีมอีกฝั่ง — โฟลเดอร์นี้มีแต่ integration test

## วิธีรัน

```bash
cd BackEnd
python -m pytest tests/
```

ต้องใช้ Python environment ที่ติดตั้ง dependencies ของโปรเจกต์ครบ (ดู `requirements.txt` — มี `pytest`, `httpx`, `mongomock` เพิ่มเข้ามาสำหรับเทสโดยเฉพาะ)

## Infrastructure ([conftest.py](conftest.py))

- Patch `pymongo.MongoClient` → `mongomock.MongoClient` **ก่อน** import แอป ทำให้รันได้แบบ hermetic ไม่ต้องพึ่ง MongoDB จริง
- ตั้ง `TALENTRAIL_ALLOW_DEGRADED_LLM=1` เพื่อข้าม LLM/Ollama healthcheck ตอน startup (ไม่มี Ollama รันอยู่ตอนเทส)
- ใช้ `TestClient` แบบ session scope (startup event ทำงานครั้งเดียวต่อการรันทั้งหมด) แต่มี autouse fixture ล้าง **database ทุก collection และ cookie jar ก่อน/หลังทุกเทส** เพื่อไม่ให้ state รั่วไหลข้ามเทส
- fixtures ที่ใช้ร่วมกัน: `register_user`, `login_with_otp`, `recruiter` (user login แล้ว), `admin` (login แบบข้าม OTP), `second_recruiter` (session แยกต่างหาก สำหรับเทสสิทธิ์ข้าม user)

## รายการเทสทั้งหมด (50 tests)

### [test_auth.py](test_auth.py) — 16 tests
Router `/auth`: สมัคร, ล็อกอิน, OTP, ลืมรหัสผ่าน

| Test | ตรวจอะไร |
|---|---|
| `test_register_returns_provisioning_uri_and_secret` | สมัครสำเร็จ → ได้ `otpauth_url` และ `secret` กลับมา |
| `test_register_duplicate_email_is_rejected` | สมัครอีเมลซ้ำ → 409 |
| `test_register_missing_password_is_rejected` | ไม่ใส่รหัสผ่าน → 400 |
| `test_login_unknown_email_is_unauthorized` | ล็อกอินอีเมลที่ไม่มีในระบบ → 401 |
| `test_login_wrong_password_is_unauthorized` | รหัสผ่านผิด → 401 |
| `test_non_admin_login_requires_otp` | user ทั่วไปล็อกอินสำเร็จ → `otp_required=True` + `pendingToken`, ยังไม่มี cookie จนกว่าจะยืนยัน OTP |
| `test_full_otp_login_sets_cookie_and_unlocks_protected_route` | flow เต็ม: สมัคร → login → generate TOTP code จริงด้วย `pyotp` → verify-otp → cookie ถูกตั้ง → เข้าหน้า protected ได้ |
| `test_verify_otp_rejects_wrong_code` | ใส่ OTP ผิด → 401 |
| `test_verify_otp_rejects_unknown_pending_token` | ใช้ pendingToken มั่ว → 401 |
| `test_admin_login_skips_otp_and_sets_cookie_immediately` | role ADMIN ล็อกอินแล้วข้าม OTP ได้ cookie ทันที |
| `test_logout_clears_cookie_and_blocks_protected_route` | logout แล้วเข้าหน้า protected ไม่ได้อีก |
| `test_protected_route_without_login_is_unauthorized` | ยังไม่ login เข้าหน้า protected → 401 |
| `test_forgot_password_unknown_email_returns_generic_message` | ขอ reset ด้วยอีเมลไม่มีอยู่ → ข้อความทั่วไปเหมือนกัน (กัน enumeration) |
| `test_forgot_password_full_reset_flow` | flow เต็ม: forgot-password → ดัก code ที่จะถูกส่งอีเมล (mock) → verify-reset-otp ได้ resetToken → reset-password → รหัสเก่าใช้ไม่ได้, รหัสใหม่ใช้ล็อกอินได้ |
| `test_verify_reset_otp_rejects_wrong_code` | OTP reset ผิด → 401/400 |
| `test_reset_password_rejects_unknown_token` | resetToken ปลอม → 401 |

### [test_jobs.py](test_jobs.py) — 7 tests
Router `/jobs` (CRUD ตำแหน่งงาน) + legacy path `/job-descriptions`

- สร้าง + list งาน
- แก้ไขงาน (เช็คว่า `createdDate` ไม่เปลี่ยนตอน update)
- แก้ไข/ลบงานที่ไม่มีอยู่ → 404
- ใช้ id ผิดรูปแบบ → 400
- ลบสำเร็จแล้วหายจาก list
- endpoint เก่า (`/job-descriptions`) กับใหม่ (`/jobs`) ใช้ข้อมูลชุดเดียวกันจริง

### [test_candidates.py](test_candidates.py) — 10 tests
Router `/candidates` — สร้าง candidate ผ่าน JSON path เหมือนที่ frontend จริงใช้ (ไม่แนบไฟล์ resume จึงไม่โดน ML pipeline)

- ต้อง login ก่อนถึงเรียกได้ (401 ถ้าไม่ login)
- สร้างแล้วได้ default ที่ถูกต้อง (`current_state="applied"`, `status="active"`, `state_history` มี entry แรก)
- list/get ทำงานถูก, get ที่ไม่มีจริง → 404, id ผิดรูปแบบ → 400
- **เปลี่ยน stage** (`applied` → `interview`): `state_history` ปิด entry เก่า (`exited_at` ถูกเซ็ต) และเปิด entry ใหม่ถูกต้อง
- เปลี่ยนเป็น `hired` → `status`/`hired_at` ถูกเซ็ตตาม business rule
- update ที่ไม่มีจริง → 404, ลบสำเร็จแล้ว get ไม่เจอ, ลบที่ไม่มีจริง → 404

### [test_notes.py](test_notes.py) — 8 tests
Router `/notes` — เน้นตรรกะสิทธิ์การลบโน้ต

- ต้อง login ก่อน, สร้าง+list โน้ตของ candidate ได้ถูกต้อง, content ว่าง → 400, candidate_id ผิดรูปแบบ → 400
- คนที่เขียนโน้ตเอง ลบโน้ตตัวเองได้
- **recruiter อีกคน (ไม่ใช่เจ้าของ) ลบไม่ได้ → 403** (ใช้ session/cookie แยกจำลอง user คนละคนจริง)
- **admin ลบโน้ตของคนอื่นได้แม้ไม่ใช่เจ้าของ** (สร้างโน้ตด้วย session recruiter ก่อน แล้วสลับ session เดิมเป็น admin ค่อยลบ เพื่อพิสูจน์ cross-author permission จริง ไม่ใช่แค่ admin ลบโน้ตตัวเอง)
- ลบโน้ตที่ไม่มีจริง → 404

### [test_settings.py](test_settings.py) — 7 tests
Router `/settings` (profile + เปลี่ยนรหัสผ่าน)

- ต้อง login ก่อน, get/update profile (เปลี่ยนชื่อได้และ persist จริง)
- ห้ามเปลี่ยนอีเมลผ่าน endpoint นี้ → 400
- ส่ง payload ว่าง → 400
- เปลี่ยนรหัสผ่านสำเร็จแล้ว logout/login ใหม่: รหัสเก่าใช้ไม่ได้ รหัสใหม่ใช้ได้ (เทส end-to-end จริง)
- รหัสผ่านปัจจุบันผิด → 400, ตั้งรหัสใหม่เหมือนรหัสเดิม → 400

### [test_smoke.py](test_smoke.py) — 1 test
`/health` ตอบ 200 — sanity check ว่า infrastructure (mongomock patch, TestClient, startup hooks) ทำงานได้ก่อนเชื่อผลเทสอื่น

## ขอบเขตที่ไม่ได้ครอบคลุม

- **ML/matching pipeline** (`analyze_resume`, resume extraction) และ endpoint upload ไฟล์จริง — ต้องพึ่ง Ollama/sentence-transformers ซึ่งไม่มีในสภาพแวดล้อมเทส
- **Dashboard metrics/analytics** (`/dashboard/metrics`, `/dashboard/analytics`) — ใช้ MongoDB aggregation ขั้นสูง (`$dateDiff`, `$filter` ฯลฯ) ที่ mongomock รองรับไม่แน่นอน จึงข้ามไปเพื่อไม่ให้เทสหลอก (false positive/negative)
- **Frontend (React)** — ยังไม่มี test framework ติดตั้ง (ไม่มี Vitest/RTL ในโปรเจกต์ตอนนี้)

## บั๊กที่พบระหว่างเขียนเทส (ยังไม่ได้แก้)

`create_candidate` ใน [`app/routers/candidates.py:81`](../app/routers/candidates.py#L81) เรียก `handle_candidate_uploads(resume, avatar)` แต่ฟังก์ชันจริงใน [`app/utils/file_handler.py:5`](../app/utils/file_handler.py#L5) รับพารามิเตอร์แค่ตัวเดียว (`resume`) — ทุก request ที่ส่งเป็น `multipart/form-data` ไปยัง endpoint นี้จะเจอ `TypeError` → 500 แน่นอน

ไม่กระทบผู้ใช้จริงในตอนนี้ เพราะ frontend ปัจจุบันส่งเป็น JSON เสมอ (`font-end/src/hooks/useCandidates.ts` — อัปโหลด resume แยกผ่าน `/upload/resume` ก่อน แล้วค่อยส่ง `resumeUrl` เป็น JSON) แต่เป็น dead/broken code path ที่ควรแก้หรือลบทิ้ง
