"""Resume texts used by the eval fixtures.

Each constant is plain extracted text, i.e. what ``extract_resume_text`` hands to
``analyze_resume`` after PyMuPDF has flattened the PDF.
"""

# --------------------------------------------------------------------------
# Strong matches
# --------------------------------------------------------------------------

STRONG_SENIOR_FRONTEND = """Somchai Pattanakul
Senior Frontend Developer | Bangkok, TH | somchai.p@example.com

SUMMARY
Frontend engineer with 7 years building and shipping production React applications.

SKILLS
React, TypeScript, Redux Toolkit, Context API, Next.js, Tailwind CSS, Jest,
React Testing Library, Webpack, Vite, responsive design, web performance.

EXPERIENCE
Senior Frontend Developer, FinCore (2021-present)
- Led a team of 5 frontend engineers on a Next.js trading dashboard.
- Cut initial bundle size 42% via code splitting and route-level lazy loading.
- Built and maintained the shared design system consumed by 12 product teams.
- Raised Jest + React Testing Library coverage from 31% to 84%.
Frontend Developer, Siam Digital (2018-2021)
- Migrated a legacy jQuery admin console to React + TypeScript.
- Implemented responsive layouts supporting mobile through 4K.

EDUCATION
B.Eng Computer Engineering, Chulalongkorn University
"""

STRONG_DEVOPS = """Anan Wong
DevOps Engineer | anan.w@example.com

SUMMARY
Infrastructure engineer with 6 years running containerised workloads on AWS.

SKILLS
AWS (EC2, EKS, S3, IAM, RDS), Kubernetes, Docker, Terraform, CloudFormation,
Jenkins, GitHub Actions, GitLab CI, Python, Bash, Prometheus, Grafana, ELK.

EXPERIENCE
DevOps Engineer, LogiChain (2020-present)
- Operate 4 production EKS clusters serving 300M requests/month.
- Authored the Terraform modules that provision all staging and prod environments.
- Migrated 60+ Jenkins jobs to GitHub Actions, cutting pipeline time from 22m to 7m.
- Built Prometheus/Grafana alerting; reduced mean time to detect from 18m to 3m.
Systems Engineer, Nimbus Host (2018-2020)
- Managed Docker Swarm fleet and centralised logging on the ELK stack.

EDUCATION
B.Sc Computer Science, Kasetsart University
"""

STRONG_UX_DESIGNER = """Ploy Srisai
UX Designer | ploy.s@example.com

SUMMARY
User experience designer with 5 years designing B2B and consumer products.

SKILLS
Figma, Sketch, Adobe XD, user research, wireframing, prototyping, usability testing,
information architecture, WCAG 2.1 accessibility, design systems.

EXPERIENCE
UX Designer, HealthBridge (2021-present)
- Ran 60+ moderated usability sessions; redesign lifted task completion 34%.
- Own the Figma component library used by 3 squads.
- Drove WCAG 2.1 AA remediation across the patient portal.
UX Designer, Bloom Studio (2019-2021)
- Led discovery research, wireframes and clickable prototypes for 9 client projects.

PORTFOLIO
ploysrisai.design
"""

# --------------------------------------------------------------------------
# Partial matches - right domain, missing 2-3 required skills
# --------------------------------------------------------------------------

PARTIAL_FRONTEND_NO_TESTING = """Kittipong Meesap
Frontend Developer | kittipong.m@example.com

SUMMARY
Frontend developer with 5 years of React experience in e-commerce.

SKILLS
React, TypeScript, Redux, CSS Modules, SASS, REST APIs, responsive design, Webpack.

EXPERIENCE
Frontend Developer, ShopNow (2020-present)
- Build and maintain the customer-facing storefront in React + TypeScript.
- Manage global cart state with Redux across 40+ screens.
- Improved Lighthouse performance score from 54 to 89.
Junior Frontend Developer, WebFirst (2019-2020)
- Converted design mockups into responsive HTML/CSS/JS.

NOTE: no professional experience with Next.js, Tailwind CSS, or automated testing.

EDUCATION
B.Sc Information Technology, Mahidol University
"""

PARTIAL_FULLSTACK_NO_CLOUD = """Nattaya Chaiyaporn
Full Stack Developer | nattaya.c@example.com

SUMMARY
Full stack developer with 4 years across Node.js services and React frontends.

SKILLS
Node.js, Express, React, JavaScript, PostgreSQL, MongoDB, REST APIs, Git.

EXPERIENCE
Full Stack Developer, BookLoop (2021-present)
- Built REST APIs in Node/Express backed by PostgreSQL for a booking platform.
- Developed the React customer portal and internal admin tool.
- Designed the MongoDB schema for the reviews service.
Backend Developer, DataPoint (2020-2021)
- Maintained Express services and wrote SQL reporting queries.

All infrastructure was managed by a separate platform team; no hands-on Docker,
GraphQL, or AWS/GCP work.

EDUCATION
B.Eng Software Engineering, KMUTT
"""

PARTIAL_DEVOPS_NO_IAC = """Peerapat Boonmee
Cloud Operations Engineer | peerapat.b@example.com

SUMMARY
Operations engineer with 5 years supporting AWS production workloads.

SKILLS
AWS (EC2, S3, RDS, CloudWatch), Docker, Bash, Python, Jenkins, Nagios, Linux admin.

EXPERIENCE
Cloud Operations Engineer, Tellus (2020-present)
- Operate 80+ EC2 instances and RDS databases; on-call rotation.
- Containerised 15 legacy services with Docker.
- Maintain Jenkins CI pipelines and deployment scripts in Bash.
Linux Administrator, Orion IT (2018-2020)
- Patched and monitored a 200-server RHEL fleet.

Infrastructure is still provisioned manually through the AWS console; no Terraform,
CloudFormation, or Kubernetes experience.

EDUCATION
B.Sc Computer Science, Burapha University
"""

# --------------------------------------------------------------------------
# Wrong domain - should score very low
# --------------------------------------------------------------------------

WRONG_DOMAIN_NURSE = """Malee Sukhum
Registered Nurse | malee.s@example.com

SUMMARY
ICU nurse with 8 years of critical care experience.

SKILLS
Patient assessment, IV therapy, ventilator management, triage, medication
administration, EMR charting, ACLS and BLS certified, patient family counselling.

EXPERIENCE
Senior Staff Nurse, Bangkok General Hospital (2018-present)
- Manage a 12-bed intensive care unit across rotating shifts.
- Precept new graduate nurses through their first clinical year.
Staff Nurse, Rajavithi Hospital (2016-2018)
- Provided post-operative care on the surgical ward.

EDUCATION
B.N.S Nursing Science, Mahidol University
Licence: Thailand Nursing and Midwifery Council
"""

WRONG_DOMAIN_CHEF = """Thanawat Rungrueang
Executive Chef | thanawat.r@example.com

SUMMARY
Classically trained chef with 12 years in fine dining kitchens.

SKILLS
Menu development, French and Thai cuisine, butchery, pastry, food cost control,
kitchen brigade management, HACCP food safety, supplier negotiation, plating.

EXPERIENCE
Executive Chef, Saffron House (2019-present)
- Lead a brigade of 18 across two services daily.
- Rewrote the seasonal tasting menu quarterly; food cost down from 34% to 27%.
Sous Chef, Le Jardin (2015-2019)
- Ran the saucier and garde manger stations.

EDUCATION
Diplome de Cuisine, Le Cordon Bleu Dusit
"""

WRONG_DOMAIN_ACCOUNTANT = """Suwanna Thongdee
Senior Accountant | suwanna.t@example.com

SUMMARY
Certified accountant with 9 years in statutory reporting and audit.

SKILLS
IFRS, Thai FRS, month-end close, consolidation, accounts payable and receivable,
tax filing (VAT, withholding), SAP FICO, QuickBooks, Excel modelling, audit liaison.

EXPERIENCE
Senior Accountant, Meridian Group (2019-present)
- Own the month-end close for three legal entities.
- Prepare consolidated statements and coordinate the annual external audit.
Accountant, PTT Retail (2016-2019)
- Handled AP/AR ledgers and monthly VAT submissions.

CERTIFICATION
Certified Public Accountant (Thailand)
"""

# --------------------------------------------------------------------------
# Overqualified - far more experience than the role calls for
# --------------------------------------------------------------------------

OVERQUALIFIED_PRINCIPAL_FRONTEND = """Wichai Tangsakul
Principal Frontend Engineer | wichai.t@example.com

SUMMARY
Frontend architect with 16 years of experience, 6 of them at principal level.

SKILLS
React, TypeScript, Next.js, Redux, Tailwind CSS, Jest, Playwright, micro-frontends,
web performance, accessibility, technical strategy, mentoring, hiring.

EXPERIENCE
Principal Frontend Engineer, Aeon Systems (2019-present)
- Set frontend technical direction for an org of 60 engineers.
- Designed the micro-frontend architecture now serving 9 product lines.
- Chair of the frontend hiring committee; mentor 8 senior engineers.
Staff Frontend Engineer, Vertex (2014-2019)
- Rebuilt the flagship SPA in React; led the TypeScript migration.
Frontend Developer, various (2009-2014)

EDUCATION
M.Sc Computer Science, Chulalongkorn University
"""

OVERQUALIFIED_DIRECTOR_DEVOPS = """Prasert Ittipon
Director of Platform Engineering | prasert.i@example.com

SUMMARY
Infrastructure leader with 17 years across platform, SRE and DevOps organisations.

SKILLS
AWS, GCP, Kubernetes, Docker, Terraform, Jenkins, GitHub Actions, Python, Go,
Prometheus, Grafana, ELK, capacity planning, budget ownership, org design.

EXPERIENCE
Director of Platform Engineering, Northwind (2020-present)
- Own a 34-person platform organisation and a $6M annual infrastructure budget.
- Sponsored the multi-region Kubernetes migration; 99.98% availability achieved.
Head of SRE, Kestrel (2016-2020)
- Built the SRE practice from 2 to 15 engineers; introduced Terraform everywhere.
Senior Systems Engineer, various (2008-2016)

EDUCATION
B.Eng Electrical Engineering, KMITL
"""

# --------------------------------------------------------------------------
# Underqualified - well below the seniority bar
# --------------------------------------------------------------------------

UNDERQUALIFIED_INTERN_FRONTEND = """Nicha Pongsakorn
Frontend Intern | nicha.p@example.com

SUMMARY
Final-year computer science student seeking frontend work. 6 months internship.

SKILLS
HTML, CSS, JavaScript, basic React, Git. Currently learning TypeScript.

EXPERIENCE
Frontend Intern, Codelab Thailand (Jun 2024 - Dec 2024)
- Built three internal pages in React under close supervision.
- Fixed CSS layout bugs reported by the QA team.

PROJECTS
- University todo-list app in React (course project).
- Personal portfolio site in plain HTML/CSS.

EDUCATION
B.Sc Computer Science (expected 2025), Thammasat University
"""

UNDERQUALIFIED_JUNIOR_DEVOPS = """Chaiwat Nan
Junior Systems Administrator | chaiwat.n@example.com

SUMMARY
Systems administrator with 1 year of experience supporting internal servers.

SKILLS
Linux basics, Windows Server, Bash scripting fundamentals, Docker (tutorials),
ticket handling, hardware setup.

EXPERIENCE
Junior Systems Administrator, Thanapat Co. (2024-present)
- Provision user accounts and reset passwords in Active Directory.
- Run scheduled backups and monitor disk usage.
- Assisted a contractor with a small Docker Compose deployment.

EDUCATION
Diploma in Information Technology, Rajamangala University
"""

# --------------------------------------------------------------------------
# Career switchers - transferable skills, no direct title match
# --------------------------------------------------------------------------

SWITCHER_QA_TO_FRONTEND = """Duangjai Sawat
QA Automation Engineer | duangjai.s@example.com

SUMMARY
QA automation engineer with 6 years testing React web applications, now moving into
frontend development.

SKILLS
JavaScript, TypeScript, Cypress, Playwright, Jest, React Testing Library, HTML, CSS,
REST API testing, CI pipelines (GitHub Actions), Git.

EXPERIENCE
QA Automation Engineer, Vantage Retail (2020-present)
- Wrote and maintain 900+ Cypress and Playwright specs against a React storefront.
- Read and debug the React + Redux source daily to write reliable selectors.
- Contributed component-level fixes to the frontend repo (37 merged PRs).
- Own the GitHub Actions test pipeline.
Manual QA Analyst, Vantage Retail (2018-2020)

PROJECTS
- Built a React + TypeScript dashboard that visualises test-suite flakiness.

EDUCATION
B.Sc Information Systems, Chiang Mai University
"""

SWITCHER_ANALYST_TO_PM = """Rattana Vibul
Senior Data Analyst | rattana.v@example.com

SUMMARY
Data analyst with 6 years partnering with product teams, seeking a product management
role.

SKILLS
SQL, Python (pandas), Amplitude, Mixpanel, Looker, A/B testing, funnel analysis,
stakeholder presentations, roadmap input, requirements gathering.

EXPERIENCE
Senior Data Analyst, Fleetwise (B2B SaaS) (2021-present)
- Embedded analyst for two product squads; co-authored the FY24 roadmap.
- Designed and read out 40+ A/B tests that shaped shipped features.
- Ran 25 customer discovery interviews alongside the PM.
- Wrote the requirements doc for the self-serve onboarding revamp.
Data Analyst, Kanda Logistics (2019-2021)
- Built the executive KPI dashboards in Looker.

EDUCATION
B.Econ, Thammasat University
"""

# --------------------------------------------------------------------------
# Keyword stuffing - adversarial, every JD keyword but no real experience
# --------------------------------------------------------------------------

STUFFED_FRONTEND_KEYWORD_LIST = """Somsak K.
somsak.k@example.com

SKILLS
React, TypeScript, JavaScript, Next.js, Tailwind CSS, Redux, Context API, Jest,
React Testing Library, responsive design, state management, performance optimization,
modern frontend frameworks, agile, problem-solving, Senior Frontend Developer,
5+ years experience, Redux Toolkit, Webpack, Vite, CSS-in-JS, SSR, hydration.

EXPERIENCE
- Interested in frontend development.

EDUCATION
High school diploma.
"""

STUFFED_FRONTEND_REPETITION = """Anucha T.
anucha.t@example.com
Senior Frontend Developer Senior Frontend Developer Senior Frontend Developer

React React React TypeScript TypeScript TypeScript Next.js Next.js Tailwind CSS
Tailwind CSS Jest Jest React Testing Library React Testing Library Redux Redux
Context API state management performance optimization responsive design agile
5+ years of experience with React, TypeScript, and modern frontend frameworks
5+ years of experience with React, TypeScript, and modern frontend frameworks

WORK HISTORY
2019 - 2024: Family business (retail shop assistant).

EDUCATION
Vocational certificate, general studies.
"""

STUFFED_DEVOPS_SKILLS_ONLY = """P. Wattana
p.wattana@example.com

TECHNICAL SKILLS
AWS, Azure, GCP, Kubernetes, Docker, container orchestration, Terraform,
CloudFormation, infrastructure as code, Jenkins, GitLab CI, GitHub Actions, CI/CD,
Python, Bash, PowerShell, Prometheus, Grafana, ELK stack, monitoring, logging,
4+ years of experience.

PROFESSIONAL EXPERIENCE
Currently seeking my first role in technology.

EDUCATION
Completed several online courses in cloud computing.
"""

# --------------------------------------------------------------------------
# Formatting noise - same substance as the strong matches, mangled extraction
# --------------------------------------------------------------------------

NOISY_STRONG_FRONTEND = """﻿Somchai      Pattanakul\r\n\r\n
S e n i o r   F r o n t e n d   D e v e l o p e r
|  Bangkok,  TH  |  somchai.p@example.com  |


\t\tSUMMARY\t\t
Frontend engineer with 7 years building and shipping production React
applications.\x0c

+----------------------+----------------------+----------------------+
| SKILL                | LEVEL                | YEARS                |
+----------------------+----------------------+----------------------+
| React                | Expert               | 7                    |
| TypeScript           | Expert               | 6                    |
| Next.js              | Advanced             | 4                    |
| Redux Toolkit        | Advanced             | 5                    |
| Tailwind CSS         | Advanced             | 3                    |
| Jest / RTL           | Advanced             | 5                    |
+----------------------+----------------------+----------------------+

EXPERIENCE
•\tSenior Frontend Developer, FinCore (2021–present)
    ●  Led  a  team  of  5  frontend  engineers  on  a  Next.js  trading
       dashboard.
    ●  Cut initial bundle size 42% via code splitting and route-level lazy
       loading.
    ●  Built  and  maintained  the  shared  design  system  consumed  by  12
       product teams.
    ●  Raised Jest + React Testing Library coverage from 31% to 84%.
•\tFrontend Developer, Siam Digital (2018–2021)
    ●  Migrated a legacy jQuery admin console to React + TypeScript.
    ●  Implemented responsive layouts supporting mobile through 4K.

                                                                    Page 1 of 2
_______________________________________________________________________________

EDUCATION
B.Eng   Computer   Engineering,   Chulalongkorn   University
"""

NOISY_STRONG_DEVOPS = """Anan Wong | DevOps Engineer | anan.w@example.com

  SUMMARY
  Infrastructure engineer with 6 years running containerised workloads on AWS.

  ┌─────────────────────────────┬───────────────────────────────────────────┐
  │ AREA                        │ TOOLING                                   │
  ├─────────────────────────────┼───────────────────────────────────────────┤
  │ Cloud                       │ AWS (EC2, EKS, S3, IAM, RDS)              │
  │ Orchestration               │ Kubernetes, Docker                        │
  │ IaC                         │ Terraform, CloudFormation                 │
  │ CI/CD                       │ Jenkins, GitHub Actions, GitLab CI        │
  │ Observability               │ Prometheus, Grafana, ELK                  │
  │ Scripting                   │ Python, Bash                              │
  └─────────────────────────────┴───────────────────────────────────────────┘

  EXPERIENCE
  DevOps Engineer,  LogiChain   (2020‐present)
  ▪ Operate 4 production EKS clusters serving 300M requests/month.
  ▪ Authored the Terraform modules that provision all staging and prod
     environments.
  ▪ Migrated 60+ Jenkins jobs to GitHub Actions, cutting pipeline time from
     22m to 7m.
  ▪ Built Prometheus/Grafana alerting; reduced mean time to detect 18m → 3m.
  Systems Engineer,  Nimbus Host   (2018‐2020)
  ▪ Managed Docker Swarm fleet and centralised logging on the ELK stack.

  EDUCATION
  B.Sc Computer Science, Kasetsart University
"""

# --------------------------------------------------------------------------
# Three-tier demo: one job description, three clearly separated quality tiers.
#
# Deliberately simple and directly comparable - same role, same format, same
# length, only the depth of experience changes. Use this set to eyeball what a
# score actually means before reading the harder fixtures above.
# --------------------------------------------------------------------------

TIER_STRONG = """Kanya Thepwong
Senior Frontend Developer | kanya.t@example.com | Bangkok

SUMMARY
7 years building production React applications, 4 of them at senior level.

SKILLS
React, TypeScript, Redux Toolkit, Context API, Next.js, Tailwind CSS,
Jest, React Testing Library, responsive design, web performance.

EXPERIENCE
Senior Frontend Developer, Orbit Pay (2021-present)
- Own the React + TypeScript merchant dashboard used by 40,000 businesses.
- Rebuilt routing on Next.js; largest contentful paint down from 4.1s to 1.3s.
- Manage global state with Redux Toolkit across 60+ screens.
- Introduced Jest + React Testing Library; coverage 22% to 81% over 18 months.
- Migrated the styling layer to Tailwind CSS and authored the design tokens.
Frontend Developer, Klong Digital (2018-2021)
- Built responsive customer-facing pages in React from Figma specs.
- Mentored two junior developers through their first year.

EDUCATION
B.Eng Computer Engineering, Chiang Mai University
"""

TIER_MEDIUM = """Woraphon Jitkasem
Frontend Developer | woraphon.j@example.com | Bangkok

SUMMARY
3 years of frontend development, mostly on internal business tools.

SKILLS
React, JavaScript, CSS, SASS, REST APIs, Git, responsive design.
Some exposure to TypeScript on one project.

EXPERIENCE
Frontend Developer, Thanakorn Systems (2022-present)
- Build internal admin screens in React and plain JavaScript.
- Consume REST APIs and handle form validation across 12 screens.
- Converted the reporting module to a responsive layout.
Junior Frontend Developer, Thanakorn Systems (2021-2022)
- Fixed UI bugs and implemented designs handed over by the design team.

Not used professionally: TypeScript at scale, Next.js, Tailwind CSS,
Redux, or any automated testing framework.

EDUCATION
B.Sc Information Technology, Rangsit University
"""

TIER_LOW = """Somphon Klahan
IT Support Specialist | somphon.k@example.com | Bangkok

SUMMARY
5 years of desktop and network support for office environments.

SKILLS
Windows troubleshooting, Active Directory, printer and network setup,
hardware repair, helpdesk ticketing, basic HTML, batch scripting.

EXPERIENCE
IT Support Specialist, Pattana Group (2020-present)
- Resolve 40+ helpdesk tickets weekly for 300 office staff.
- Install and maintain desktop hardware and peripherals.
- Troubleshoot network connectivity and VPN issues.
- Edited a few static HTML pages on the company intranet.
IT Support Assistant, Nakorn Trading (2019-2020)
- Set up new employee workstations and user accounts.

EDUCATION
Diploma in Information Technology, Rajamangala University
"""


# --------------------------------------------------------------------------
# Edge cases
# --------------------------------------------------------------------------

EDGE_EMPTY = ""

EDGE_ONE_LINE = "Somchai Pattanakul - Senior Frontend Developer, 7 years React."

EDGE_MIXED_LANGUAGE = """สมชาย พัฒนกุล (Somchai Pattanakul)
ตำแหน่ง: Senior Frontend Developer | somchai.p@example.com

สรุปโดยย่อ
วิศวกรฝ่าย Frontend ประสบการณ์ 7 ปี ในการพัฒนาเว็บแอปพลิเคชันด้วย React
และ TypeScript สำหรับระบบการเงิน

ทักษะ (SKILLS)
React, TypeScript, Redux Toolkit, Next.js, Tailwind CSS, Jest,
React Testing Library, การออกแบบ responsive, การเพิ่มประสิทธิภาพเว็บ

ประสบการณ์ทำงาน (EXPERIENCE)
Senior Frontend Developer, FinCore (2564-ปัจจุบัน)
- นำทีมวิศวกร Frontend จำนวน 5 คน พัฒนา dashboard ด้วย Next.js
- ลดขนาด bundle เริ่มต้นลง 42% ด้วยเทคนิค code splitting
- ดูแล design system ที่ใช้งานร่วมกัน 12 ทีมผลิตภัณฑ์
- เพิ่ม test coverage จาก 31% เป็น 84% ด้วย Jest และ React Testing Library

Frontend Developer, Siam Digital (2561-2564)
- ย้ายระบบ admin เดิมจาก jQuery ไปเป็น React + TypeScript

การศึกษา (EDUCATION)
วศ.บ. วิศวกรรมคอมพิวเตอร์ จุฬาลงกรณ์มหาวิทยาลัย
"""


# --------------------------------------------------------------------------
# QA objectivity suite (TC-01 .. TC-18), Full Stack Developer baseline.
#
# Four axes the earlier fixtures did not probe: full-stack keyword stuffing,
# a missing non-negotiable skill, vague unverifiable writing, and seniority
# whose technical currency has decayed.
# --------------------------------------------------------------------------

# --- Keyword stuffing (TC-01 .. TC-04) ------------------------------------

FS_STUFFED_SKILL_WALL = """Somsak Charoenkul
somsak.c@example.com

TECHNICAL SKILLS
React, Node.js, Python, Go, PostgreSQL, MongoDB, RESTful APIs, GraphQL, Docker,
Kubernetes, AWS, GCP, CI/CD, microservices, Redux, TypeScript, Express, FastAPI,
Redis, Kafka, Terraform, Jenkins, GitHub Actions, Agile, Scrum, TDD.

EXPERIENCE
Freelance Developer (2019 - present)
- Various projects.

EDUCATION
Bachelor of Business Administration.
"""

FS_STUFFED_JD_ECHO = """Nopadon Srivichai
nopadon.s@example.com | Full Stack Developer

PROFILE
Full Stack Developer with strong backend and frontend experience.

EXPERIENCE
Software Developer, Self-employed (2020 - present)
- 3+ years with Node.js, Python, or Go.
- Proficiency in React or Vue.js.
- Experience with PostgreSQL, MongoDB, or similar databases.
- Knowledge of RESTful APIs, GraphQL, Docker, and cloud platforms (AWS/GCP).
- Familiarity with CI/CD pipelines and microservices architecture.
- Owns features end to end, from schema to UI.

EDUCATION
Certificate in Web Development, online.
"""

FS_STUFFED_FOOTER_REPEAT = """Arthit Kaewsai
arthit.k@example.com

SUMMARY
Detail-oriented professional seeking a Full Stack Developer position.

WORK EXPERIENCE
Data Entry Clerk, Siam Insurance (2019 - 2024)
- Entered policy records into the internal system.
- Verified customer documents for completeness.
- Maintained filing accuracy above 99%.

Administrative Assistant, Thonburi Trading (2017 - 2019)
- Scheduled meetings and managed correspondence.

TECHNOLOGIES
React Node.js PostgreSQL Docker AWS GraphQL React Node.js PostgreSQL Docker AWS
GraphQL React Node.js PostgreSQL Docker AWS GraphQL React Node.js PostgreSQL
Docker AWS GraphQL microservices CI/CD REST API full stack developer
"""

FS_STUFFED_CERT_FARM = """Pimchanok Wongse
pimchanok.w@example.com

CERTIFICATIONS
- React - The Complete Guide (Udemy, 2023)
- Node.js Developer Course (Udemy, 2023)
- PostgreSQL Bootcamp (Udemy, 2023)
- Docker Mastery (Udemy, 2024)
- AWS Certified Cloud Practitioner (2024)
- GraphQL with React (Udemy, 2024)
- Python for Everybody (Coursera, 2023)
- Microservices Architecture (Coursera, 2024)
- CI/CD with GitHub Actions (Udemy, 2024)

SKILLS
React, Node.js, PostgreSQL, Docker, AWS, GraphQL, Python, microservices, CI/CD

EXPERIENCE
No professional software development experience yet. Actively seeking my first
developer role.

EDUCATION
B.A. Communication Arts, Bangkok University
"""

# --- Missing core skill (TC-05 .. TC-08) ----------------------------------

FS_MISSING_REACT = """Thanakrit Somboon
Senior Software Engineer | thanakrit.s@example.com

SUMMARY
6 years building production web applications end to end.

SKILLS
Angular, TypeScript, RxJS, NgRx, Node.js, Express, NestJS, PostgreSQL, Redis,
Docker, AWS (ECS, RDS, S3), REST, GraphQL, GitHub Actions.

EXPERIENCE
Senior Software Engineer, Logistica (2021 - present)
- Own the Angular 15 shipment-tracking console used by 200 logistics partners.
- Built the NestJS backend behind it: 40+ REST endpoints, PostgreSQL, Redis caching.
- Containerised the stack and deployed to AWS ECS; set up GitHub Actions CI/CD.
- Designed the GraphQL gateway aggregating three internal services.
Software Engineer, Bangkok Softworks (2019 - 2021)
- Full stack Angular + Node.js delivery for enterprise clients.

EDUCATION
B.Eng Computer Engineering, KMUTT

Note: no professional React experience. All frontend work has been Angular.
"""

FS_MISSING_BACKEND = """Waraporn Chindarat
Frontend Engineer | waraporn.c@example.com

SUMMARY
5 years of React development for consumer products.

SKILLS
React, TypeScript, Redux Toolkit, React Query, Next.js, Tailwind CSS, Jest,
React Testing Library, Storybook, Figma handoff, web accessibility.

EXPERIENCE
Frontend Engineer, ShopLine (2021 - present)
- Own the React + TypeScript storefront; 1.2M monthly active users.
- Built the component library consumed by four squads.
- Reduced bundle size 38% and LCP from 3.4s to 1.5s.
- Consume REST endpoints provided by the platform team.
Frontend Developer, Pixel Studio (2020 - 2021)
- Implemented responsive React interfaces from Figma designs.

EDUCATION
B.Sc Computer Science, Chiang Mai University
"""

FS_MISSING_DATABASE = """Kridsada Nithiwat
Full Stack Developer | kridsada.n@example.com

SUMMARY
4 years building React frontends and Node.js services.

SKILLS
React, TypeScript, Redux, Node.js, Express, REST, GraphQL, Docker, AWS Lambda,
API Gateway, S3, GitHub Actions, Jest.

EXPERIENCE
Full Stack Developer, Feedly Co. (2021 - present)
- Build React dashboards and the Node.js/Express APIs behind them.
- All persistence is handled by a separate data team; I integrate against their
  service endpoints and have never designed a schema or written SQL.
- Deployed serverless functions on AWS Lambda behind API Gateway.
- Containerised local development with Docker Compose.
Junior Developer, Feedly Co. (2020 - 2021)

EDUCATION
B.Sc Information Technology, Mahidol University
"""

FS_MISSING_CLOUD = """Supattra Leelawat
Full Stack Developer | supattra.l@example.com

SUMMARY
5 years full stack development in a regulated on-premise environment.

SKILLS
React, TypeScript, Node.js, Express, PostgreSQL, MySQL, Redis, REST, GraphQL,
Jenkins, Nginx, Linux, bare-metal deployment.

EXPERIENCE
Full Stack Developer, Krung Thai Systems (2020 - present)
- Build React + TypeScript interfaces for internal banking operations tools.
- Own the Node.js/Express services and the PostgreSQL schemas behind them.
- Wrote the Jenkins pipelines that deploy to on-premise Linux servers.
- Optimised Postgres queries; cut the nightly reconciliation job from 4h to 25m.

Regulatory policy prohibits public cloud; all systems run on-premise. No AWS or
GCP experience.

EDUCATION
B.Eng Computer Engineering, Chulalongkorn University
"""

# --- Vague (TC-09 .. TC-12) -----------------------------------------------

FS_VAGUE_NO_STACK = """Chalerm Boonsong
Software Engineer | chalerm.b@example.com

SUMMARY
Experienced software engineer with a track record of delivering high-quality
solutions in fast-paced environments.

EXPERIENCE
Software Engineer, Technology Company (2020 - present)
- Built scalable systems to support business growth.
- Improved application performance significantly.
- Worked closely with stakeholders to deliver key features.
- Participated in the full software development lifecycle.
- Resolved complex technical issues.
Software Engineer, Previous Employer (2018 - 2020)
- Developed and maintained web applications.
- Contributed to architecture decisions.

EDUCATION
B.Sc Computer Science
"""

FS_VAGUE_BUZZWORDS = """Nutthawut Piriyapong
Technical Professional | nutthawut.p@example.com

PROFILE
Results-driven technology professional passionate about innovation and delivering
business value through technology-enabled transformation.

EXPERIENCE
Senior Associate, Digital Solutions (2019 - present)
- Drove strategic initiatives that delivered measurable business impact.
- Collaborated cross-functionally with diverse stakeholder groups.
- Leveraged cutting-edge technologies to optimise operational efficiency.
- Championed best practices and a culture of continuous improvement.
- Spearheaded digital transformation workstreams.
Associate, Digital Solutions (2017 - 2019)
- Supported delivery of client-facing technology engagements.

EDUCATION
B.B.A. Management Information Systems
"""

FS_VAGUE_STACK_NO_CONTRIBUTION = """Jirawat Panyakul
Full Stack Developer | jirawat.p@example.com

SUMMARY
Full stack developer with experience in modern web technologies.

SKILLS
React, Node.js, PostgreSQL, Docker, AWS

EXPERIENCE
Developer, Nexus Digital (2021 - present)
- Worked on projects using React and Node.js.
- Involved in database work with PostgreSQL.
- Used Docker and AWS as part of the development process.
- Part of a team that delivered several applications.
Developer, Startup (2020 - 2021)
- Used various web technologies to build features.

EDUCATION
B.Sc Computer Science, Rangsit University
"""

FS_VAGUE_UNANCHORED_METRICS = """Ratchanon Meesuk
Software Engineer | ratchanon.m@example.com

SUMMARY
Engineer focused on performance and scale.

EXPERIENCE
Software Engineer, Velocity Corp (2020 - present)
- Improved system performance by 300%.
- Reduced costs by 40% through optimisation.
- Increased reliability to 99.99%.
- Scaled the platform to handle 10x traffic.
- Cut deployment time by 80%.
- Boosted team productivity by 50%.
Software Engineer, Prior Role (2018 - 2020)
- Delivered 25% efficiency improvement.

EDUCATION
B.Eng Computer Engineering
"""

# --- Overqualified (TC-13 .. TC-15) ---------------------------------------

FS_OVERQUALIFIED_CTO = """Vichien Ratanakorn
Chief Technology Officer | vichien.r@example.com

SUMMARY
Technology executive with 20 years in software, 8 at C-level. Scaled two
engineering organisations through acquisition.

EXPERIENCE
Chief Technology Officer, Vertex Commerce (2018 - present)
- Own technology strategy for a 140-person engineering organisation.
- Accountable for a $22M annual technology budget.
- Led the platform re-architecture to microservices on AWS; 99.98% availability.
- Report to the board on technical risk and diligence.
VP Engineering, Pacific Software (2013 - 2018)
- Grew engineering from 12 to 65 across four teams.
Principal Engineer, various (2005 - 2013)
- Hands-on React, Node.js, PostgreSQL delivery.

EDUCATION
M.Sc Computer Science, AIT
"""

FS_PRINCIPAL_HANDS_ON = """Anchalee Thammawong
Principal Software Engineer | anchalee.t@example.com

SUMMARY
14 years building production systems; 5 at principal level, still hands-on daily.

SKILLS
React, TypeScript, Node.js, Go, PostgreSQL, MongoDB, GraphQL, Docker, Kubernetes,
AWS, GCP, Terraform, CI/CD, distributed systems.

EXPERIENCE
Principal Software Engineer, Meridian Tech (2019 - present)
- Design and personally implement core services in Go and Node.js.
- Built the GraphQL federation layer serving 12 React applications.
- Own the PostgreSQL schema design and query performance for the billing domain.
- Mentor 6 engineers; still review and write production code weekly.
Senior Software Engineer, Aurora Systems (2014 - 2019)
- Full stack React + Node.js product delivery.

EDUCATION
B.Eng Computer Engineering, Chulalongkorn University
"""

FS_EM_STALE_HANDS_ON = """Kamol Siriwattana
Engineering Manager | kamol.s@example.com

SUMMARY
Engineering leader with 13 years in software, 7 in people management.

EXPERIENCE
Engineering Manager, Horizon Digital (2019 - present)
- Manage three squads totalling 21 engineers.
- Own hiring, performance reviews, and quarterly roadmap planning.
- Facilitate architecture review; I do not write production code in this role.
- Partner with Product on prioritisation and delivery forecasting.
Senior Developer, Horizon Digital (2016 - 2019)
- Built AngularJS frontends and Java Spring backends.
Developer, Thai Systems (2012 - 2016)
- PHP and jQuery web applications.

EDUCATION
B.Sc Computer Science, Kasetsart University
"""

# --- Consistency baselines (TC-16 .. TC-18) -------------------------------

FS_CONSISTENCY_HIGH = """Netnapa Sirikul
Full Stack Developer | netnapa.s@example.com

SUMMARY
7 years building full stack web applications end to end.

SKILLS
React, TypeScript, Node.js, Express, Python, PostgreSQL, MongoDB, REST, GraphQL,
Docker, AWS (ECS, RDS, S3), GitHub Actions, Jest.

EXPERIENCE
Full Stack Developer, Bluewave Systems (2020 - present)
- Own the React + TypeScript customer portal serving 85,000 monthly users.
- Built and maintain the Node.js/Express API layer behind it: 70+ endpoints.
- Designed the PostgreSQL schema for the billing domain; cut the monthly
  invoicing job from 90 minutes to 11 by reworking three queries and adding
  covering indexes.
- Introduced the GraphQL gateway that replaced six chatty REST calls on load.
- Containerised the stack with Docker and deployed to AWS ECS via GitHub Actions.
Software Developer, Chao Phraya Tech (2018 - 2020)
- Built Python/Flask services and React interfaces for a logistics product.

EDUCATION
B.Eng Computer Engineering, Kasetsart University
"""

FS_CONSISTENCY_BORDERLINE = """Patcharin Wongchai
Full Stack Developer | patcharin.w@example.com

SUMMARY
3 years full stack development.

SKILLS
React, JavaScript, Node.js, Express, MongoDB, REST, Git. Learning TypeScript.

EXPERIENCE
Full Stack Developer, Bright Apps (2022 - present)
- Build React interfaces and Node.js/Express APIs for three internal products.
- Designed the MongoDB collections for the scheduling module.
- Integrated a third-party payments API end to end.
Junior Developer, Bright Apps (2021 - 2022)
- Fixed bugs and implemented small features across the stack.

No experience with: GraphQL, Docker, AWS/GCP, PostgreSQL, CI/CD.

EDUCATION
B.Sc Computer Science, Sripatum University
"""


def _padding(paragraphs: int) -> str:
    """Filler that is topically plausible but carries no qualifying signal."""
    block = (
        "During this period the team followed a standard agile delivery process with "
        "two-week sprints, regular retrospectives, and a shared on-call rotation. "
        "Documentation was maintained in the internal wiki and updated each release. "
        "Cross-functional coordination happened in weekly syncs with design and QA. "
    )
    return "\n\n".join(f"NOTES SECTION {i + 1}\n{block * 3}" for i in range(paragraphs))


# Qualifications appear first, then ~35k characters of filler.
EDGE_LONG_FRONT_LOADED = STRONG_SENIOR_FRONTEND + "\n\n" + _padding(60)

# Same content, inverted: ~35k characters of filler, qualifications only at the end.
# The production path keeps resume_text[:3000], so the qualifications never reach
# the model. Kept deliberately so the eval can prove truncation is the mechanism.
EDGE_LONG_BACK_LOADED = _padding(60) + "\n\n" + STRONG_SENIOR_FRONTEND

# Sentinel that only exists in the back-loaded tail; used by test_truncation.py.
TRUNCATION_SENTINEL = "Raised Jest + React Testing Library coverage from 31% to 84%."
