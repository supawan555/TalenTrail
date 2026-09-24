# TalenTrail E2E tests (Robot Framework + Browser / Playwright)

Browser-driven end-to-end tests that exercise the real frontend against a real
backend + database.

## Layout

```
e2e/
  __init__.robot        Suite setup: 1 Chromium, log in once as ADMIN, save storageState
  resources/            Page-object keyword files (locators live here, not in suites)
  suites/               01_auth 02_dashboard 03_navigation 04_candidates 05_notes 06_resume_upload
  lib/OtpLibrary.py     Optional pyotp helper for the P2 OTP-login test
  args/                 local.args (dev) / ci.args (headless, JUnit)
  env/e2e.env.example   Backend env used for the run (Mongo URI, degraded LLM, static TOTP)
  fixtures/             sample_resume.pdf
  run.ps1               One-command orchestrator (Docker Mongo + servers + robot + teardown)
  results/              Robot output.xml / log.html / report.html / screenshots (gitignored)
```

## Prerequisites

- The Robot venv at repo-root `venv/` (`robotframework==7.4.2`, `robotframework-browser`,
  `rfbrowser init` already run).
- A **BackEnd virtualenv** with `BackEnd/requirements.txt` installed (`BackEnd/.venv` or `BackEnd/env`).
- **Docker Desktop** running (for the disposable Mongo container). First run pulls `mongo:7`.
- Node + npm (frontend dev server).

## Run everything (recommended)

```powershell
# Works in Windows PowerShell 5.1 (PowerShell 7 `pwsh` also fine):
powershell -ExecutionPolicy Bypass -File e2e\run.ps1                 # P0 + P1, headless
powershell -ExecutionPolicy Bypass -File e2e\run.ps1 -Headed         # visible browser
powershell -ExecutionPolicy Bypass -File e2e\run.ps1 -- --include P0 # extra args -> robot
powershell -ExecutionPolicy Bypass -File e2e\run.ps1 -NoSeed         # skip demo-candidate seeding
powershell -ExecutionPolicy Bypass -File e2e\run.ps1 -KeepServers    # leave Mongo/servers up
```

`run.ps1` backs up `BackEnd/.env`, swaps in `e2e/env/e2e.env` (falls back to
`e2e.env.example`), seeds `admin@test.com` / `Admin1234`, starts uvicorn + vite,
waits for `/health`, runs Robot, then tears it all down and restores `BackEnd/.env`.

## Run against servers you started yourself

```powershell
# Backend must be healthy at :8000 and frontend at :3000 first.
venv\Scripts\robot.exe --argumentfile e2e/args/local.args e2e

# One headed test while authoring:
venv\Scripts\robot.exe --outputdir e2e/results -v HEADLESS:False ^
  -t "Admin login lands on the dashboard" e2e/suites/01_auth.robot

# Syntax / keyword-resolution check, no browser:
venv\Scripts\robot.exe --dryrun e2e
```

## Screenshots

Two layers, both land as PNGs referenced inline in `e2e/results/log.html`:

- **Automatic on-failure** - the Browser library's default `run_on_failure=Take Screenshot`
  fires whenever any keyword fails, no setup needed.
- **Explicit evidence** - `Capture Evidence <label>` (in `resources/common.resource`) is
  called at key checkpoints regardless of pass/fail, saved to `e2e/results/screenshots/`:
  admin login success, an invalid-login error, a candidate successfully added, and the
  resume-analysis card resolving. `04_candidates.robot :: Uploading a non-PDF resume is
  rejected` is the dedicated negative-case test - it selects `fixtures/invalid_resume.jpg`
  in the Add Candidate modal, asserts the real client-side validation (toast "Please upload
  a PDF file", drop zone unchanged, no candidate created), and captures a screenshot at the
  point of rejection.

## Tags

`P0` smoke · `P1` core · `P2` extended · `slow` (SBERT model download) · `flaky`
Default run = `P0` + `P1`. CI (`ci.args`) additionally excludes `slow` and `flaky`.

## Notes / gotchas

- **Mongo container uses port 27057, not 27017.** If your machine already runs a
  native MongoDB service on 27017 (common on dev boxes), Docker's port-forward
  silently loses that bind race - `docker run` still reports success, but the
  container never actually receives traffic, and everything ends up hitting your
  real local Mongo under a `talentrail_e2e` database instead of a disposable
  container. `run.ps1` avoids this entirely with a dedicated port.
- **Chromium only.** On `localhost` the auth cookie is `SameSite=None; Secure`,
  which Firefox/WebKit reject over http.
- The login page shows a skeleton until `GET /health` returns healthy; keywords
  wait up to `${HEALTH_TIMEOUT}` (60s) for `#email`.
- Backend runs with `TALENTRAIL_ALLOW_DEGRADED_LLM=1`, so `matchScore` is `null`.
  The resume suite asserts the analysis card *resolves*, not any score.
- Candidate/notes suites need demo data (`scripts/seed_candidates.py --confirm`,
  done by `run.ps1`). They reference seeded names `Alice Johnson`, `Bob Smith`, `Carol Lee`.
- P2 `OTP login via the static dev secret` self-skips unless `pyotp` is installed
  (`venv\Scripts\python.exe -m pip install pyotp`) and a non-admin user with TOTP
  secret `JBSWY3DPEHPK3PXP` exists.
