*** Settings ***
Documentation     Every sidebar route reachable by an ADMIN renders - both by
...               direct URL navigation and by clicking the sidebar links.
Resource          ../resources/navigation.resource

*** Test Cases ***
Direct navigation renders each route
    [Tags]    P0    navigation    smoke
    FOR    ${path}    ${label}    IN
    ...    /dashboard             Dashboard
    ...    /pipeline               Pipeline
    ...    /candidates             Candidates
    ...    /archived-candidates    Archived Candidates
    ...    /job-descriptions       Job Descriptions
    ...    /analytics              Analytics
    ...    /notes                  Notes
    ...    /settings               Settings
        Route Should Render    ${path}    ${label}
        Close Context
    END

Sidebar links move between all sections
    [Tags]    P1    navigation
    Open Authenticated Page    /dashboard
    FOR    ${path}    ${label}    IN
    ...    /pipeline               Pipeline
    ...    /candidates             Candidates
    ...    /archived-candidates    Archived Candidates
    ...    /job-descriptions       Job Descriptions
    ...    /analytics              Analytics
    ...    /notes                  Notes
    ...    /settings               Settings
        Navigate Via Sidebar       ${path}
        Header Heading Should Be    ${label}
        Wait For App Shell
    END
    [Teardown]    Close Context
