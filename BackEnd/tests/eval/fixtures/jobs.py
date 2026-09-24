"""Job descriptions used by the eval fixtures.

Wording follows the real postings in BackEnd/mock_job_descriptions.json so the
eval measures the model on text shaped like production input.
"""

SENIOR_FRONTEND = """Position: Senior Frontend Developer
Department: Engineering

We are seeking an experienced Frontend Developer to join our engineering team.
Required skills: 5+ years of experience with React, TypeScript, and modern frontend
frameworks. Strong understanding of responsive design, state management
(Redux/Context API), and performance optimization. Experience with Next.js,
Tailwind CSS, and testing frameworks (Jest, React Testing Library) is highly valued.
Must have excellent problem-solving skills and ability to work in an agile environment.
"""

JUNIOR_FRONTEND = """Position: Junior Frontend Developer
Department: Engineering

Entry-level role for a developer starting their career. Required: 0-2 years of
experience. Familiarity with HTML, CSS, JavaScript and basic React. Willingness to
learn TypeScript and modern tooling. You will work under the guidance of senior
engineers on well-scoped tickets. No prior professional experience required.
"""

LEAD_DEVOPS = """Position: Lead DevOps Engineer
Department: Engineering

Lead DevOps Engineer to own and optimize our infrastructure. Required: 8+ years of
experience with AWS, Azure, or GCP, including 3+ years leading a team. Strong knowledge
of Kubernetes, Docker, and container orchestration. Expertise in infrastructure as code
(Terraform, CloudFormation). Experience with CI/CD tools (Jenkins, GitLab CI, GitHub
Actions). Strong scripting skills in Python, Bash, or PowerShell. Understanding of
monitoring and logging tools (Prometheus, Grafana, ELK stack). Must set technical
direction and mentor engineers.
"""

MID_DEVOPS = """Position: DevOps Engineer
Department: Engineering

DevOps Engineer to manage and optimize our infrastructure. Required: 4+ years of
experience with AWS, Azure, or GCP. Strong knowledge of Kubernetes, Docker, and
container orchestration. Expertise in infrastructure as code (Terraform,
CloudFormation). Experience with CI/CD tools (Jenkins, GitLab CI, GitHub Actions).
Strong scripting skills in Python, Bash, or PowerShell. Understanding of monitoring
and logging tools (Prometheus, Grafana, ELK stack).
"""

FULL_STACK = """Position: Full Stack Developer
Department: Engineering

Looking for a Full Stack Developer with strong backend and frontend experience.
Requirements: 3+ years with Node.js, Python, or Go. Proficiency in React or Vue.js.
Experience with PostgreSQL, MongoDB, or similar databases. Knowledge of RESTful APIs,
GraphQL, Docker, and cloud platforms (AWS/GCP). Familiarity with CI/CD pipelines and
microservices architecture is a plus.
"""

# FULL_STACK above is deliberately soft ("React *or* Vue.js") and cannot express a
# non-negotiable. This variant states hard gates explicitly so the missing-core-skill
# cases have something to be gated against.
FULL_STACK_HARD_REQUIREMENTS = """Position: Full Stack Developer
Department: Engineering

MUST HAVE (non-negotiable - candidates without these are not considered):
- 3+ years professional React (this team's entire frontend is React; an equivalent
  in Angular or Vue does not substitute)
- 3+ years backend service development in Node.js, Python, or Go
- Production experience with a relational database (PostgreSQL preferred)

STRONGLY PREFERRED:
- Docker, and deployment on AWS or GCP
- RESTful API design; GraphQL a plus
- CI/CD pipelines

You will own features end to end, from schema to UI.
"""

JUNIOR_FULL_STACK = """Position: Junior Full Stack Developer
Department: Engineering

Entry-level role. Required: 0-2 years experience. Familiarity with JavaScript, basic
React, and any backend language. You will work on well-scoped tickets under the
guidance of senior engineers. We expect to invest in your growth; this is not a role
with architectural or people-leadership responsibility.
"""

UX_DESIGNER = """Position: UX Designer
Department: Design

UX Designer to create intuitive and engaging user experiences. Requirements: 4+ years
of UX design experience. Proficiency in Figma, Sketch, or Adobe XD. Strong portfolio
demonstrating user-centered design process. Experience with user research, wireframing,
prototyping, and usability testing. Understanding of accessibility standards (WCAG).
"""

PRODUCT_MANAGER = """Position: Product Manager
Department: Product

Product Manager to own product strategy and delivery. Requirements: 4+ years in product
management or a closely related analytical role. Experience defining roadmaps, writing
specs, and running discovery interviews. Comfortable with SQL and product analytics.
Strong stakeholder communication. Experience shipping B2B SaaS is a plus.
"""
