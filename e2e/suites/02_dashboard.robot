*** Settings ***
Documentation     Dashboard renders for an authenticated admin.
Resource          ../resources/browser.resource
Test Setup        Open Authenticated Page    /dashboard
Test Teardown     Close Context

*** Test Cases ***
Dashboard shows the welcome banner
    [Tags]    P0    dashboard    smoke
    Wait For Elements State    css=#app-scroll-root h2 >> text="Dashboard"    visible
    Wait For Elements State    text="Welcome back,"              visible
    Wait For Elements State    css=span >> text=${ADMIN_EMAIL}   visible

Dashboard renders every metric card
    [Tags]    P0    dashboard
    FOR    ${title}    IN
    ...    Total Candidates    Active Positions    Bottleneck
    ...    Hired This Month    Avg. Time to Hire    Drop-off Rate
        Wait For Elements State    text="${title}"    visible
    END

Dashboard renders the charts section
    [Tags]    P1    dashboard
    Wait For Elements State    text="Applications & Hires"    visible
    Wait For Elements State    text="Recent Candidates"      visible
