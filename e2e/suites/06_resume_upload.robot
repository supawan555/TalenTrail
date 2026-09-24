*** Settings ***
Documentation     Resume upload plumbing through the Add Candidate modal.
...               The backend runs with a degraded LLM in E2E, so the match score
...               may be null - this suite asserts the upload + analysis card
...               resolve, NOT any score value.
...               Tagged 'slow': the first /match/analyze downloads a ~90MB model.
Resource          ../resources/candidates.resource
Test Setup        Open Candidates List
Test Teardown     Close Context

*** Test Cases ***
Add a candidate with a resume PDF
    [Tags]    P2    candidates    resume    slow
    ${resume}=    Normalize Path    ${CURDIR}/../fixtures/sample_resume.pdf
    File Should Exist    ${resume}
    ${name}=      Add Candidate Via Modal    ${resume}
    Search Candidates          ${name}
    Open Candidate Profile     ${name}
    Wait For Elements State     iframe[title="Resume PDF"]    attached    timeout=${SLOW_TIMEOUT}
    Resume Analysis Card Should Resolve
    [Teardown]    Run Keywords
    ...    Delete Candidate From Profile    AND    Close Context
