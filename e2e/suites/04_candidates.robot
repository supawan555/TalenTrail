*** Settings ***
Documentation     Candidate lifecycle through the real UI: list, search, add,
...               open profile, advance stage, archive, delete.
...               Needs demo data: python scripts/seed_candidates.py --confirm
Resource          ../resources/candidates.resource
Test Setup        Open Candidates List
Test Teardown     Close Context

*** Test Cases ***
Candidates list loads seeded data
    [Tags]    P0    candidates    smoke
    Candidate Card Should Be Visible    Alice Johnson

Search narrows the candidate list
    [Tags]    P1    candidates
    Search Candidates    Alice
    Candidate Card Should Be Visible        Alice Johnson
    Candidate Card Should Not Be Present    Bob Smith

Add a candidate and see it in the list
    [Tags]    P1    candidates
    ${name}=    Add Candidate Via Modal
    Search Candidates    ${name}
    Candidate Card Should Be Visible    ${name}
    [Teardown]    Run Keywords
    ...    Open Candidate Profile    ${name}    AND
    ...    Delete Candidate From Profile    AND
    ...    Close Context

Advance a candidate to the next stage
    [Tags]    P1    candidates
    ${name}=    Add Candidate Via Modal
    Search Candidates          ${name}
    Open Candidate Profile     ${name}
    Profile Stage Badge Should Be    applied
    Advance Candidate Stage
    Profile Stage Badge Should Be    screening
    [Teardown]    Run Keywords
    ...    Delete Candidate From Profile    AND    Close Context

Archive a candidate with a reason
    [Tags]    P1    candidates
    ${name}=    Add Candidate Via Modal
    Search Candidates          ${name}
    Open Candidate Profile     ${name}
    Archive Candidate          Reject    Position filled by another candidate (E2E).
    Open Candidates List
    Search Candidates                  ${name}
    Candidate Card Should Not Be Present    ${name}

Delete a candidate
    [Tags]    P1    candidates
    ${name}=    Add Candidate Via Modal
    Search Candidates          ${name}
    Open Candidate Profile     ${name}
    Delete Candidate From Profile
    Search Candidates                  ${name}
    Candidate Card Should Not Be Present    ${name}

Uploading a non-PDF resume is rejected
    [Documentation]    Negative case. Selecting a .jpg in the resume dropzone must
    ...                show a validation error, never attach the file, and never
    ...                create a candidate - screenshot captured at the point of
    ...                rejection as evidence.
    [Tags]    P1    candidates    negative
    ${invalid}=    Normalize Path    ${CURDIR}/../fixtures/invalid_resume.jpg
    File Should Exist    ${invalid}
    ${name}=    Attempt Non PDF Resume Upload    ${invalid}
    Search Candidates                       ${name}
    Candidate Card Should Not Be Present    ${name}
