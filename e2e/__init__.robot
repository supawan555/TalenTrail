*** Settings ***
Documentation     TalenTrail E2E - top-level suite.
...
...               Prerequisites (handled by e2e/run.ps1, or do it yourself):
...                 * MongoDB reachable at the URI the backend was started with
...                 * Backend up & healthy   : GET ${API_URL}/health -> {"status":"healthy"}
...                 * Frontend up            : ${BASE_URL} serves the SPA
...                 * Admin user exists      : python scripts/create_admin.py
...                 * Demo data (optional)   : python scripts/seed_candidates.py --confirm
...
...               This suite setup opens one Chromium instance, logs in once as the
...               ADMIN user, and saves a Playwright storageState that every child
...               suite reuses (New Context storageState=${STATE_FILE}).
Resource          resources/auth.resource
Suite Setup       Prepare E2E Run
Suite Teardown    Close Browser

*** Keywords ***
Prepare E2E Run
    New Browser              ${BROWSER_CHANNEL}    headless=${HEADLESS}
    Set Browser Timeout      ${DEFAULT_TIMEOUT}
    ${state}=                Establish Admin Session
    Set Global Variable      ${STATE_FILE}    ${state}
    Log To Console           \nAdmin storageState saved to: ${state}
