*** Settings ***
Documentation    Authentication keywords: admin login (no 2FA), OTP login,
...              logout, and login-page assertions.
Library          ${CURDIR}/../lib/OtpLibrary.py
Resource         browser.resource

*** Keywords ***
Wait For Login Form
    [Documentation]    Clears the backend /health skeleton gate.
    Wait For Elements State    id=email       visible    timeout=${HEALTH_TIMEOUT}
    Wait For Elements State    id=email       enabled    timeout=${HEALTH_TIMEOUT}
    Wait For Elements State    id=password    enabled    timeout=${HEALTH_TIMEOUT}

Submit Login Form
    [Arguments]    ${email}    ${password}
    Fill Text    id=email       ${email}
    Fill Text    id=password    ${password}
    Click        button[type="submit"] >> text="Sign In"

Log In As Admin
    [Documentation]    ADMIN role bypasses 2FA; one POST /auth/login sets the cookie
    ...                and the SPA navigates straight to /dashboard.
    Wait For Login Form
    Submit Login Form    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}
    Wait Until URL Contains    /dashboard
    Wait For App Shell
    Capture Evidence    admin-login-success

Establish Admin Session
    [Documentation]    Logs in on a throwaway context and returns the path to a
    ...                Playwright storageState json for reuse across suites.
    Open Anonymous Page    /login
    Log In As Admin
    ${state}=              Save Storage State
    Close Context
    RETURN                ${state}

Log In With OTP
    [Documentation]    Non-admin flow: password -> OTP dialog -> verify.
    ...                Needs the backend started with a known static TOTP secret.
    [Arguments]    ${email}    ${password}    ${secret}=${TOTP_SECRET}
    Wait For Login Form
    Submit Login Form    ${email}    ${password}
    Wait For Elements State    role=dialog >> id=otp    visible    timeout=${DEFAULT_TIMEOUT}
    ${code}=    Compute Totp    ${secret}
    Fill Text    id=otp    ${code}
    Click        role=dialog >> text="Verify"
    Wait Until URL Contains    /dashboard
    Wait For App Shell

Log Out Via Settings
    Open Authenticated Page    /settings
    Click                      button >> text="Sign Out"
    Wait For Elements State     role=alertdialog >> text="Sign out?"    visible    timeout=${DEFAULT_TIMEOUT}
    Click                      role=alertdialog >> text="Confirm Sign Out"
    Wait Until URL Contains     /login

Login Error Should Be Visible
    Wait For Elements State    p.text-red-600    visible    timeout=${DEFAULT_TIMEOUT}
    Capture Evidence           login-invalid-credentials
