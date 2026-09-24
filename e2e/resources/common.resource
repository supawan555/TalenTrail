*** Settings ***
Documentation    Shared low-level helpers: Browser library import, Radix
...              portal handling, toast handling, unique data generation.
Resource         config.resource
Library          Browser    auto_closing_level=SUITE
Library          String
Library          Collections
Library          OperatingSystem

*** Keywords ***
Wait For App Shell
    [Documentation]    Confirms we are inside the authenticated app layout.
    Wait For Elements State    css=#app-scroll-root        visible    timeout=${DEFAULT_TIMEOUT}
    Wait For Elements State    css=[data-slot="sidebar"] h1 >> text=TalentTrail    visible    timeout=${DEFAULT_TIMEOUT}

Unique Name
    [Documentation]    e.g. "E2E Cand 4F9K2ABQ" - stable prefix + random suffix.
    [Arguments]        ${prefix}=E2E
    ${suffix}=         Generate Random String    8    [UPPER][NUMBERS]
    RETURN            ${prefix} ${suffix}

Select Radix Option
    [Documentation]    Opens a Radix <Select> trigger and picks an option by text.
    [Arguments]        ${trigger}    ${option_text}
    Click                        ${trigger}
    Wait For Elements State      role=listbox                       visible    timeout=${DEFAULT_TIMEOUT}
    Click                        role=option >> text="${option_text}"
    Wait For Elements State      role=listbox                       hidden     timeout=${DEFAULT_TIMEOUT}

Select First Radix Option
    [Documentation]    Opens a Radix <Select> trigger and picks the first real option.
    ...                Returns the chosen option's visible text.
    [Arguments]        ${trigger}
    Click                        ${trigger}
    Wait For Elements State      role=option >> nth=0    visible    timeout=${DEFAULT_TIMEOUT}
    ${label}=                    Get Text               role=option >> nth=0
    Click                        role=option >> nth=0
    Wait For Elements State      role=listbox           hidden     timeout=${DEFAULT_TIMEOUT}
    RETURN                       ${label}

Toast Should Contain
    [Documentation]    Asserts a sonner toast with the given text appeared.
    [Arguments]        ${text}
    Wait For Elements State    [data-sonner-toast] >> text=${text}    visible    timeout=${DEFAULT_TIMEOUT}

Capture Evidence
    [Documentation]    Explicit, named screenshot saved under
    ...                <outputdir>/screenshots/<label>.png - independent of Browser's
    ...                automatic on-failure screenshot (run_on_failure, still active).
    ...                Embedded inline in log.html either way.
    [Arguments]    ${label}
    ${safe}=    Replace String Using Regexp    ${label}    [^A-Za-z0-9_-]+    _
    Take Screenshot    filename=screenshots/${safe}    fullPage=${True}

Dismiss Any Toast
    ${count}=    Get Element Count    [data-sonner-toast]
    IF    ${count} > 0
        Mouse Move    0    0
    END
