*** Settings ***
Documentation     Collaboration Notes: add a note to a candidate, filter, delete.
...               Needs demo data: python scripts/seed_candidates.py --confirm
Resource          ../resources/notes.resource
Test Setup        Open Notes Page
Test Teardown     Close Context

*** Test Cases ***
Add a note to a candidate
    [Tags]    P1    notes    smoke
    ${body}=    Add Note    Alice    Approved
    Note Should Appear In Feed    ${body}
    [Teardown]    Run Keywords    Delete First Note    AND    Close Context

Filter notes by tag
    [Tags]    P1    notes
    ${body}=    Add Note    Bob    Need Approval
    Note Should Appear In Feed    ${body}
    Filter Notes By Tag    Need Approval
    Note Should Appear In Feed    ${body}
    [Teardown]    Run Keywords    Delete First Note    AND    Close Context

Delete a note
    [Tags]    P1    notes
    ${body}=    Add Note    Carol    Rejected
    Note Should Appear In Feed    ${body}
    Delete First Note
    Wait For Elements State    text=${body}    detached    timeout=${DEFAULT_TIMEOUT}
