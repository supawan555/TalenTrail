*** Settings ***
Documentation    Context / page lifecycle helpers. Two entry points:
...              - Open Anonymous Page : fresh context, no auth (login/register suites)
...              - Open Authenticated Page : context restored from the shared
...                admin storageState captured in e2e/__init__.robot
Resource         common.resource

*** Keywords ***
Open Anonymous Page
    [Arguments]    ${path}=/login
    New Context    viewport={'width': ${VIEWPORT_WIDTH}, 'height': ${VIEWPORT_HEIGHT}}
    New Page       ${BASE_URL}${path}

Open Authenticated Page
    [Documentation]    Requires ${STATE_FILE} (set by the parent suite setup).
    [Arguments]        ${path}=/dashboard
    Should Not Be Empty    ${STATE_FILE}
    ...    STATE_FILE is empty - the parent e2e/__init__.robot suite setup must run first.
    New Context    storageState=${STATE_FILE}
    ...            viewport={'width': ${VIEWPORT_WIDTH}, 'height': ${VIEWPORT_HEIGHT}}
    New Page       ${BASE_URL}${path}
    Wait For App Shell

Close Current Context
    Close Context

Current URL Should Contain
    [Arguments]    ${fragment}
    ${url}=    Get Url
    Should Contain    ${url}    ${fragment}

Wait Until URL Contains
    [Arguments]    ${fragment}    ${retry}=15x    ${interval}=0.5s
    Wait Until Keyword Succeeds    ${retry}    ${interval}    Current URL Should Contain    ${fragment}
