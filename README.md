# 🌟 TalentTrail

A full‑stack recruiting app built with React (Vite) and FastAPI, backed by MongoDB. Manage job descriptions and candidates, upload resumes, run basic analysis, and enable 2FA (TOTP) during sign‑in.

---

## 🧩 Requirements / Prerequisites

- Node.js 18+ and npm
- Python 3.10+ and pip
- MongoDB (local or remote), default URI: `mongodb://localhost:27017`

Helpful URLs
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend (FastAPI docs): [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ⚙️ Frontend Setup (React)

Folder: `font-end/`

```bash
# 1) Install dependencies
cd font-end
npm install

# 2) (Optional) Tell the UI where your API is (defaults to http://localhost:8000)
# macOS/Linux (bash)
export VITE_API_URL="http://localhost:8000"

# 3) Start the dev server
npm run dev
# → Open http://localhost:3000
```

Windows PowerShell (optional env var)
```powershell
$env:VITE_API_URL = "http://localhost:8000"
```

Notes
- The app reads `import.meta.env.VITE_API_URL`. If not set, it uses `http://localhost:8000`.
- Vite dev server runs on port 3000 (see `font-end/vite.config.ts`).
- Production builds are written to `font-end/build` (custom `outDir`).

---

## 🚀 Backend Setup (FastAPI)

Folder: `BackEnd/`

```bash
# 1) Create & activate a virtual environment
cd BackEnd
python -m venv env

# macOS/Linux (bash)
source env/bin/activate

# 2) Install dependencies
pip install -r requirements.txt

# 3) (Optional) Dev-time TOTP secret so OTPs are predictable across users
export TALENTTAIL_TOTP_STATIC_SECRET="JBSWY3DPEHPK3PXP"

# 4) Run the API (new modular entry)
uvicorn app.main:app --reload --port 8000
# → Open http://localhost:8000/docs
```

Windows PowerShell (activate venv + optional env var)
```powershell
.\env\Scripts\Activate.ps1
$env:TALENTTAIL_TOTP_STATIC_SECRET = "JBSWY3DPEHPK3PXP"
uvicorn app.main:app --reload --port 8000
```

What’s inside
- Auth endpoints (password hashing via PBKDF2 + TOTP via pyotp)
- Job descriptions + candidates CRUD
- File uploads (PDF resumes, images) mounted at `/uploads`
- Basic resume analysis integration hooks (optional)

---

## 🧠 Run Both Together

Use two terminals:

- Terminal A (backend)
```bash
cd BackEnd
uvicorn app.main:app --reload --port 8000
```

- Terminal B (frontend)
```bash
cd font-end
npm run dev
```

Then open:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🗂 Project Structure

```text
TalentTrail/
├─ BackEnd/
│  ├─ app/
│  │  ├─ main.py               # FastAPI app (includes routers)
│  │  ├─ config.py, db.py      # Settings and Mongo client/collections
│  │  ├─ routers/              # auth, candidates, jobs, matching, uploads, dashboard
│  │  │  ├─ auth.py
│  │  │  ├─ candidates.py
│  │  │  ├─ job_descriptions.py
│  │  │  ├─ matching.py
│  │  │  ├─ uploads.py
│  │  │  └─ dashboard.py       # metrics + analytics endpoints for Dashboard
│  │  ├─ services/             # auth, job_preload, resume_analysis
│  │  └─ utils/                # file_storage
│  ├─ auth.py                 
│  ├─ mock_job_descriptions.json
│  ├─ requirements.txt
│  └─ uploads/                 # Saved files (served at /uploads)
├─ font-end/                   # React (Vite) app
│  ├─ src/
│  │  ├─ components/
│  │  │  └─ ui/                # Radix-based UI components
│  │  ├─ lib/
│  │  │  └─ api.ts             # Axios client configured for backend
│  │  ├─ main.tsx, App.tsx, ...
│  ├─ vite.config.ts
│  └─ package.json
│
├─ MachineLearning/            # Optional helpers
│  ├─ analyze_resume.py
│  └─ ml_helpers.py
│
└─ README.md
```

---

## 🧰 Environments & Build Artifacts

- Frontend build output: `font-end/build` (configured via `outDir` in `vite.config.ts`). You can delete it locally if not used; regenerate with `npm run build`.
- Python bytecode cache: `__pycache__/` can be safely deleted; Python will recreate it on next run.
- Tests folder: `BackEnd/tests` is for pytest; delete only if you don’t run tests/CI.

### Python virtual environments
- Avoid duplicate venvs. Prefer a single environment, e.g. `BackEnd/env`.
- If you have both `BackEnd/env` and `BackEnd/app/env`, keep one and remove the other after verifying the app runs.
- Optional: You can also use a workspace‑level `.venv` managed by VS Code; just ensure `pip install -r BackEnd/requirements.txt` is done in the chosen env.

---

## 💡 Tips

- MongoDB
	- Default connection: `mongodb://localhost:27017`
	- Ensure MongoDB is running (as a service or via `mongod`) before the backend.
- Ports
	- Frontend (Vite): 3000 in this repo (customized)
	- Backend (FastAPI): 8000 by default
	- If a port is busy, change it (e.g., `--port 8001`).
- CORS
	- The backend allows localhost/127.0.0.1 by default; if you change ports, restart the API.
- Env variables
	- Frontend: `VITE_API_URL` to point to your API (e.g., `http://localhost:8000`).
	- Backend: `TALENTTAIL_TOTP_STATIC_SECRET` (Base32) for predictable OTP during dev.
- Uploads
	- PDF resumes and images are served from `/uploads` (e.g., `http://localhost:8000/uploads/<file>`).
- Auth (TOTP)
	- After register, you’ll see an OTP setup modal with an `otpauth://` link, QR code, and Base32 secret.

---

## 🧩 Tech Stack

| Area       | Tech            | Notes                                 |
|------------|------------------|----------------------------------------|
| Frontend   | React + Vite     | Fast dev server, TypeScript support    |
| UI         | Radix + shadcn   | Dialogs, inputs, consistent styling    |
| Backend    | FastAPI          | Modern async Python API framework      |
| Database   | MongoDB          | Collections: candidates, jobs, auth    |
| Auth       | PBKDF2 + pyotp   | Password hashing + TOTP 2FA            |
| Uploads    | FastAPI Static   | Serves files under `/uploads`          |
| ML (opt.)  | Python scripts   | Resume analysis hooks (PyPDF2, etc.)   |

---

## 👨‍💻 Author

TalentTrail by @supawan555

 - Repo: TalentTrail
- Happy building! If you want a one‑click dev script to start both servers, we can add it next.
