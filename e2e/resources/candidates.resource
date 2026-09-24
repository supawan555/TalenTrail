*** Settings ***
Documentation    Page-object keywords for the Candidates list, the Add Candidate
...              modal, and the Candidate Profile page.
Resource         browser.resource
Resource         common.resource

*** Variables ***
${CANDIDATE_CARD}       a[href^="/candidate/"]
${SEARCH_INPUT}         input[placeholder="Search candidates..."]
${STAGE_BADGE}          xpath=(//span[contains(@class,'capitalize')])[1]

*** Keywords ***
Open Candidates List
    Open Authenticated Page    /candidates
    Wait For Elements State     text="All Candidates"    visible    timeout=${DEFAULT_TIMEOUT}

Search Candidates
    [Arguments]    ${query}
    Fill Text      ${SEARCH_INPUT}    ${query}
    Sleep          400ms    reason=debounce on the client-side filter

Candidate Card Should Be Visible
    [Arguments]    ${name}
    Wait For Elements State    ${CANDIDATE_CARD} >> text=${name}    visible    timeout=${DEFAULT_TIMEOUT}

Candidate Card Should Not Be Present
    [Arguments]    ${name}
    Wait For Elements State    ${CANDIDATE_CARD} >> text=${name}    detached    timeout=${DEFAULT_TIMEOUT}

Add Candidate Via Modal
    [Documentation]    Drives the real UI modal. Returns the generated name.
    [Arguments]    ${resume_path}=${EMPTY}
    ${name}=       Unique Name    E2E Cand
    Click                        button >> text="Add Candidate"
    Wait For Elements State      role=dialog >> text="Add New Candidate"    visible    timeout=${DEFAULT_TIMEOUT}
    Fill Text                    role=dialog >> id=name    ${name}
    Select First Radix Option    role=dialog >> id=position
    IF    "${resume_path}" != ""
        Upload File By Selector    role=dialog >> id=resume-upload    ${resume_path}
        Wait For Elements State    role=dialog >> css=.text-primary    visible    timeout=${DEFAULT_TIMEOUT}
    END
    Click                        role=dialog >> button >> text="Add Candidate"
    Toast Should Contain         Candidate added successfully
    Capture Evidence             candidate-added-${name}
    Wait For Elements State      role=dialog    detached    timeout=${DEFAULT_TIMEOUT}
    RETURN    ${name}

Attempt Non PDF Resume Upload
    [Documentation]    Negative case: the Add Candidate modal's client-side check
    ...                (font-end AddCandidateModal.handleFileChange) rejects any
    ...                file whose type/extension isn't PDF with a toast error and
    ...                never attaches it - no upload request, no candidate saved.
    [Arguments]    ${invalid_file_path}
    ${name}=       Unique Name    E2E Rejected
    Click                        button >> text="Add Candidate"
    Wait For Elements State      role=dialog >> text="Add New Candidate"    visible    timeout=${DEFAULT_TIMEOUT}
    Fill Text                    role=dialog >> id=name    ${name}
    Select First Radix Option    role=dialog >> id=position
    Upload File By Selector      role=dialog >> id=resume-upload    ${invalid_file_path}
    Toast Should Contain         Please upload a PDF file
    # Drop zone must still show the empty-state prompt, i.e. no file was accepted.
    Wait For Elements State      role=dialog >> text="Drag and drop a PDF file here, or"    visible    timeout=${DEFAULT_TIMEOUT}
    Capture Evidence             candidate-invalid-resume-rejected-${name}
    Click                        role=dialog >> button >> text="Cancel"
    Wait For Elements State      role=dialog    detached    timeout=${DEFAULT_TIMEOUT}
    RETURN    ${name}

Open Candidate Profile
    [Arguments]    ${name}
    Click                      ${CANDIDATE_CARD} >> text=${name}
    Wait Until URL Contains    /candidate/
    Wait For Elements State    text="Back to Candidates"    visible    timeout=${DEFAULT_TIMEOUT}

Profile Stage Badge Should Be
    [Documentation]    Compares case-insensitively: the badge's raw DOM text is
    ...                the lowercase stage value, but Browser's Get Text reflects
    ...                the CSS text-transform:capitalize actually rendered.
    [Arguments]    ${stage}
    Wait Until Keyword Succeeds    10x    1s    Stage Badge Text Should Be    ${stage}

Stage Badge Text Should Be
    [Arguments]    ${stage}
    ${actual}=      Get Text            ${STAGE_BADGE}
    ${actual}=      Convert To Lower Case    ${actual}
    ${expected}=    Convert To Lower Case    ${stage}
    Should Be Equal    ${actual}    ${expected}

Advance Candidate Stage
    Click                      button >> text="Next Stage"
    Wait For Elements State    role=alertdialog >> text="Move to Next Stage"    visible    timeout=${DEFAULT_TIMEOUT}
    Click                      role=alertdialog >> button >> text="Confirm"
    Wait For Elements State    role=alertdialog    detached    timeout=${DEFAULT_TIMEOUT}

Archive Candidate
    [Arguments]    ${choice}=Reject    ${reason}=Not a fit for this role (E2E).
    Select Radix Option        role=combobox    ${choice}
    Wait For Elements State     role=alertdialog >> id=archive-reason    visible    timeout=${DEFAULT_TIMEOUT}
    Fill Text                   role=alertdialog >> id=archive-reason    ${reason}
    Click                       role=alertdialog >> button >> text="${choice} Candidate"
    Wait For Elements State     role=alertdialog    detached    timeout=${DEFAULT_TIMEOUT}

Delete Candidate From Profile
    Click                      button >> text="Delete"
    Wait For Elements State    role=alertdialog >> text="Delete Candidate"    visible    timeout=${DEFAULT_TIMEOUT}
    Click                      role=alertdialog >> button >> text="Delete"
    Wait For Elements State    role=alertdialog    detached    timeout=${DEFAULT_TIMEOUT}
    Wait Until URL Contains    /candidates

Resume Analysis Card Should Resolve
    [Documentation]    In degraded-LLM mode the score may be null; assert only that
    ...                the analysis card reached a real state (skills rendered, OR
    ...                the explicit "no analysis" message) - never a crash/spinner.
    ${resolved}=    Set Variable    ${False}
    FOR    ${i}    IN RANGE    30
        ${skills}=      Get Element Count    text="Detected Skills"
        ${empty_msg}=   Get Element Count    text="No analysis available for this candidate."
        IF    ${skills} > 0 or ${empty_msg} > 0
            ${resolved}=    Set Variable    ${True}
            BREAK
        END
        Sleep    2s
    END
    Capture Evidence    resume-analysis-resolved
    Should Be True    ${resolved}    Resume Analysis card never resolved within timeout.
