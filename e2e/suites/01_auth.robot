*** Settings ***
Documentation     Authentication flows: admin login, bad credentials, protected-route
...               guard, logout, and (P2) OTP login / register / forgot-password.
Resource          ../resources/auth.resource
Test Teardown     Close Context

*** Test Cases ***
Admin login lands on the dashboard
    [Tags]    P0    auth    smoke
    Open Anonymous Page    /login
    Log In As Admin
    Get Text    css=header h2    ==    Dashboard

Invalid credentials show an error
    [Tags]    P0    auth
    Open Anonymous Page    /login
    Wait For Login Form
    Submit Login Form    ${ADMIN_EMAIL}    definitely-wrong-password
    Login Error Should Be Visible
    Current URL Should Contain    /login

Protected route redirects to login when logged out
    [Tags]    P0    auth
    Open Anonymous Page       /candidates
    Wait Until URL Contains    /login
    Wait For Elements State    id=email    visible    timeout=${HEALTH_TIMEOUT}

Logout ends the session
    [Tags]    P0    auth
    Log Out Via Settings
    # Session cookie is gone: a protected deep-link now bounces to /login.
    Go To    ${BASE_URL}/dashboard
    Wait Until URL Contains    /login

OTP login via the static dev secret
    [Tags]    P2    auth    otp
    [Documentation]    Requires: pyotp installed AND a non-admin user whose TOTP
    ...                secret is ${TOTP_SECRET}. Skips cleanly if pyotp is missing.
    ${has_pyotp}=    Run Keyword And Return Status    Compute Totp    ${TOTP_SECRET}
    Skip If    not ${has_pyotp}    pyotp not installed - see e2e/lib/OtpLibrary.py
    Skip    Enable after seeding a known non-admin user (see e2e/README.md).
