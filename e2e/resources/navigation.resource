*** Settings ***
Documentation    Sidebar navigation helpers. The layout header <h2> always shows
...              the active nav item's label, so it is a uniform per-route anchor.
Resource         browser.resource

*** Variables ***
# path -> header label rendered by font-end/src/hooks/layout.tsx for an ADMIN user
&{ROUTE_LABELS}
...    /dashboard=Dashboard
...    /pipeline=Pipeline
...    /candidates=Candidates
...    /archived-candidates=Archived Candidates
...    /job-descriptions=Job Descriptions
...    /analytics=Analytics
...    /notes=Notes
...    /settings=Settings

*** Keywords ***
Navigate Via Sidebar
    [Arguments]    ${path}
    Click                      css=[data-slot="sidebar"] a[href="${path}"]
    Wait Until URL Contains    ${path}

Header Heading Should Be
    [Arguments]    ${label}
    Wait For Elements State    css=header h2 >> text=${label}    visible    timeout=${DEFAULT_TIMEOUT}

Route Should Render
    [Documentation]    Direct-navigates to ${path} in a fresh authed page and
    ...                asserts URL + header label + app shell.
    [Arguments]    ${path}    ${label}
    Open Authenticated Page    ${path}
    Current URL Should Contain    ${path}
    Header Heading Should Be      ${label}
