*** Settings ***
Documentation    Page-object keywords for the Collaboration Notes page.
Resource         browser.resource
Resource         common.resource

*** Variables ***
${CANDIDATE_AUTOCOMPLETE}    input[placeholder="Search candidate..."]
${NOTE_TEXTAREA}             textarea[placeholder="Write your note here..."]
${NOTES_SEARCH}              input[placeholder="Search notes..."]

*** Keywords ***
Open Notes Page
    Open Authenticated Page    /notes
    Wait For Elements State     text="Collaboration Notes"    visible    timeout=${DEFAULT_TIMEOUT}

Add Note
    [Documentation]    Picks the first candidate suggestion, sets a tag, writes the
    ...                note, submits. Returns the note body used.
    [Arguments]    ${candidate_query}    ${tag}=Approved
    ${body}=       Unique Name    E2E note
    Fill Text                    ${CANDIDATE_AUTOCOMPLETE}    ${candidate_query}
    Wait For Elements State      css=.bg-popover button    visible    timeout=${DEFAULT_TIMEOUT}
    Click                        css=.bg-popover button >> nth=0
    Select Radix Option          role=combobox >> nth=0    ${tag}
    Fill Text                    ${NOTE_TEXTAREA}    ${body}
    Click                        button >> text="Add Note"
    Wait For Elements State      css=.bg-popover    detached    timeout=${DEFAULT_TIMEOUT}
    RETURN    ${body}

Note Should Appear In Feed
    [Arguments]    ${body}
    Wait For Elements State    text=${body}    visible    timeout=${DEFAULT_TIMEOUT}

Filter Notes By Tag
    [Arguments]    ${tag}
    Select Radix Option    role=combobox >> nth=1    ${tag}

Delete First Note
    Click                      button[aria-label="Delete note"] >> nth=0
    Wait For Elements State    role=alertdialog >> text="Delete note?"    visible    timeout=${DEFAULT_TIMEOUT}
    Click                      role=alertdialog >> button >> text="Delete Note"
    Wait For Elements State    role=alertdialog    detached    timeout=${DEFAULT_TIMEOUT}
