*** Settings ***
Documentation    Central configuration for the TalenTrail E2E suite.
...              Every value here is overridable from the command line, e.g.
...              robot --variable BASE_URL:http://localhost:5173 ...

*** Variables ***
# --- Targets ---------------------------------------------------------------
${BASE_URL}              http://localhost:3000
${API_URL}               http://127.0.0.1:8000

# --- Credentials (created by scripts/create_admin.py) --------------------
${ADMIN_EMAIL}           admin@test.com
${ADMIN_PASSWORD}        Admin1234

# --- 2FA (only used by the P2 OTP test) ---------------------------------
# Must match TALENTTAIL_TOTP_STATIC_SECRET the backend was started with.
${TOTP_SECRET}           JBSWY3DPEHPK3PXP

# --- Browser ------------------------------------------------------------
${HEADLESS}              ${True}
${BROWSER_CHANNEL}       chromium
${VIEWPORT_WIDTH}        ${1440}
${VIEWPORT_HEIGHT}       ${900}

# --- Timeouts ---------------------------------------------------------------
${DEFAULT_TIMEOUT}       15s
# The login page is gated behind a backend /health poll (every 5s), so the
# first render of the form can lag well behind page load.
${HEALTH_TIMEOUT}        60s
# First /match/analyze downloads a ~90MB SBERT model.
${SLOW_TIMEOUT}          180s

# --- Shared state --------------------------------------------------------
# Populated by e2e/__init__.robot Suite Setup (Playwright storageState json).
${STATE_FILE}            ${EMPTY}
