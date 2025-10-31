export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  position: string;
  department: string;
  experience: string;
  location: string;
  matchScore: number;
  stage: 'applied' | 'screening' | 'interview' | 'final' | 'hired' | 'rejected' | 'drop-off';
  appliedDate: string;
  resumeUrl?: string;
  skills: string[];
  notes: Note[];
  salary: string;
  availability: string;
}

export interface Note {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: string; // Can be default tags or custom tags
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  candidates: Candidate[];
}

export const mockCandidates: Candidate[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '+1 (555) 123-4567',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b9562932?w=150&h=150&fit=crop&crop=face',
    position: 'Senior Frontend Developer',
    department: 'Engineering',
    experience: '5+ years',
    location: 'San Francisco, CA',
    matchScore: 95,
    stage: 'interview',
    appliedDate: '2024-01-15',
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
    salary: '$120,000 - $140,000',
    availability: 'Immediate',
    notes: [
      {
        id: 'n1',
        author: 'Mike Patterson (Tech Lead)',
        content: 'Had a great technical interview. Sarah demonstrated excellent problem-solving skills and deep knowledge of React patterns. She walked through her recent work on performance optimization that resulted in a 40% improvement in load times. Very impressed!',
        timestamp: '2024-01-20T14:30:00Z',
        type: 'Approved'
      },
      {
        id: 'n1b',
        author: 'Jennifer Lee (HR)',
        content: 'Phone screening completed. Candidate has strong communication skills and shows genuine interest in our company mission. Salary expectations align with our budget. Recommended for technical interview.',
        timestamp: '2024-01-17T10:15:00Z',
        type: 'Awaiting Feedback'
      },
      {
        id: 'n1c',
        author: 'Tom Richards (Engineering Manager)',
        content: 'Resume looks very promising. Strong background in frontend development with relevant experience in our tech stack. Let\'s move forward with phone screening.',
        timestamp: '2024-01-16T09:00:00Z',
        type: 'Need Approval'
      }
    ]
  },
  {
    id: '2',
    name: 'Michael Chen',
    email: 'michael.chen@email.com',
    phone: '+1 (555) 234-5678',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    position: 'Full Stack Developer',
    department: 'Engineering',
    experience: '3+ years',
    location: 'Seattle, WA',
    matchScore: 88,
    stage: 'screening',
    appliedDate: '2024-01-14',
    skills: ['Node.js', 'Python', 'PostgreSQL', 'Docker'],
    salary: '$95,000 - $115,000',
    availability: '2 weeks notice',
    notes: [
      {
        id: 'n2',
        author: 'Alex Chen (Senior Developer)',
        content: 'Reviewed coding assessment. Strong backend fundamentals and clean code structure. However, frontend test showed some gaps in modern React patterns. Suggest a follow-up conversation about frontend experience.',
        timestamp: '2024-01-19T11:45:00Z',
        type: 'Awaiting Feedback'
      },
      {
        id: 'n2b',
        author: 'Sarah Martinez (Recruiter)',
        content: 'Initial screening call went well. Michael has 3 years at a fast-paced startup with good tech stack overlap. He seems eager to learn and grow. Moving to technical assessment.',
        timestamp: '2024-01-15T16:30:00Z',
        type: 'Need Approval'
      }
    ]
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@email.com',
    phone: '+1 (555) 345-6789',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    position: 'UX Designer',
    department: 'Design',
    experience: '4+ years',
    location: 'Austin, TX',
    matchScore: 92,
    stage: 'final',
    appliedDate: '2024-01-12',
    skills: ['Figma', 'Adobe Creative Suite', 'User Research', 'Prototyping'],
    salary: '$85,000 - $105,000',
    availability: 'Immediate',
    notes: [
      {
        id: 'n3',
        author: 'Rachel Kim (Design Director)',
        content: 'Final interview complete. Emily presented her portfolio with confidence and articulated her design decisions brilliantly. Her case study on improving checkout flow UX was particularly impressive. Strong recommendation to extend offer.',
        timestamp: '2024-01-22T15:20:00Z',
        type: 'Approved'
      },
      {
        id: 'n3b',
        author: 'David Park (Product Lead)',
        content: 'Second round interview - discussed collaboration approach. Emily has excellent cross-functional communication skills and understands the business side of design. She asked thoughtful questions about our product roadmap.',
        timestamp: '2024-01-18T13:45:00Z',
        type: 'Awaiting Feedback'
      },
      {
        id: 'n3c',
        author: 'Lisa Wong (Senior Designer)',
        content: 'Portfolio review: Outstanding work! Her design system contributions and user research methodology are exactly what we need. Love her attention to accessibility. Definitely want to move her forward.',
        timestamp: '2024-01-15T10:30:00Z',
        type: 'Need Approval'
      }
    ]
  },
  {
    id: '4',
    name: 'David Thompson',
    email: 'david.thompson@email.com',
    phone: '+1 (555) 456-7890',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    position: 'DevOps Engineer',
    department: 'Engineering',
    experience: '6+ years',
    location: 'Denver, CO',
    matchScore: 90,
    stage: 'applied',
    appliedDate: '2024-01-16',
    skills: ['AWS', 'Kubernetes', 'Terraform', 'CI/CD'],
    salary: '$130,000 - $150,000',
    availability: '1 month notice',
    notes: [
      {
        id: 'n4a',
        author: 'Chris Taylor (DevOps Manager)',
        content: 'Just received application. Resume shows impressive DevOps background with extensive AWS and Kubernetes experience. His infrastructure-as-code projects look solid. Let\'s schedule a screening call ASAP.',
        timestamp: '2024-01-16T17:00:00Z',
        type: 'Need Approval'
      }
    ]
  },
  {
    id: '5',
    name: 'Lisa Park',
    email: 'lisa.park@email.com',
    phone: '+1 (555) 567-8901',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    position: 'Product Manager',
    department: 'Product',
    experience: '7+ years',
    location: 'New York, NY',
    matchScore: 87,
    stage: 'hired',
    appliedDate: '2024-01-08',
    skills: ['Product Strategy', 'Agile', 'Data Analysis', 'Stakeholder Management'],
    salary: '$140,000 - $160,000',
    availability: 'Started',
    notes: [
      {
        id: 'n5a',
        author: 'Rebecca Stone (HR Director)',
        content: 'Offer accepted! Lisa will be joining us on January 29th. All paperwork completed. She\'s very excited about the role and the team. Onboarding schedule has been sent.',
        timestamp: '2024-01-24T16:45:00Z',
        type: 'Approved'
      },
      {
        id: 'n5b',
        author: 'Mark Johnson (VP Product)',
        content: 'Final executive interview complete. Lisa demonstrated exceptional strategic thinking and has a clear vision for product development. Her experience scaling products at previous companies is exactly what we need. Strongly recommend making an offer.',
        timestamp: '2024-01-22T14:20:00Z',
        type: 'Approved'
      },
      {
        id: 'n5c',
        author: 'Emma Wilson (Product Manager)',
        content: 'Had a great conversation about product strategy. Lisa has deep experience with data-driven decision making and really understands our market. She shared insightful ideas about our roadmap. Moving to final round.',
        timestamp: '2024-01-19T11:00:00Z',
        type: 'Awaiting Feedback'
      },
      {
        id: 'n5d',
        author: 'Kevin Brown (Recruiter)',
        content: 'Initial screening went excellent. Lisa has 7 years of PM experience with impressive track record. She led product launches that generated significant revenue. Cultural fit seems strong. Scheduling team interviews.',
        timestamp: '2024-01-15T09:30:00Z',
        type: 'Need Approval'
      }
    ]
  }
];

export const pipelineStages: PipelineStage[] = [
  {
    id: 'applied',
    name: 'Applied',
    color: 'bg-blue-50 border-blue-200',
    candidates: mockCandidates.filter(c => c.stage === 'applied')
  },
  {
    id: 'screening',
    name: 'Screening',
    color: 'bg-yellow-50 border-yellow-200',
    candidates: mockCandidates.filter(c => c.stage === 'screening')
  },
  {
    id: 'interview',
    name: 'Interview',
    color: 'bg-purple-50 border-purple-200',
    candidates: mockCandidates.filter(c => c.stage === 'interview')
  },
  {
    id: 'final',
    name: 'Final Round',
    color: 'bg-orange-50 border-orange-200',
    candidates: mockCandidates.filter(c => c.stage === 'final')
  },
  {
    id: 'hired',
    name: 'Hired',
    color: 'bg-green-50 border-green-200',
    candidates: mockCandidates.filter(c => c.stage === 'hired')
  }
];

export const dashboardMetrics = {
  totalCandidates: mockCandidates.length,
  activePositions: 8,
  interviewsThisWeek: 12,
  hiredThisMonth: 3,
  averageTimeToHire: 18,
  conversionRate: 0.24
};

export const analyticsData = {
  applicationsByMonth: [
    { month: 'Jan', applications: 45, hires: 3 },
    { month: 'Feb', applications: 52, hires: 4 },
    { month: 'Mar', applications: 38, hires: 2 },
    { month: 'Apr', applications: 61, hires: 5 },
    { month: 'May', applications: 49, hires: 3 },
    { month: 'Jun', applications: 56, hires: 4 }
  ],
  sourceBreakdown: [
    { source: 'LinkedIn', count: 35, percentage: 42 },
    { source: 'Company Website', count: 25, percentage: 30 },
    { source: 'Referrals', count: 15, percentage: 18 },
    { source: 'Job Boards', count: 8, percentage: 10 }
  ],
  positionTypes: [
    { position: 'Engineering', count: 28, fill: '#3b82f6' },
    { position: 'Design', count: 15, fill: '#10b981' },
    { position: 'Product', count: 12, fill: '#f59e0b' },
    { position: 'Marketing', count: 8, fill: '#8b5cf6' }
  ]
};

export interface JobDescription {
  id: string;
  department: string;
  role: string;
  description: string;
  createdDate: string;
}

export const mockJobDescriptions: JobDescription[] = [
  {
    id: 'jd1',
    department: 'Engineering',
    role: 'Senior Frontend Developer',
    description: 'We are seeking an experienced Frontend Developer to join our engineering team. Required skills: 5+ years of experience with React, TypeScript, and modern frontend frameworks. Strong understanding of responsive design, state management (Redux/Context API), and performance optimization. Experience with Next.js, Tailwind CSS, and testing frameworks (Jest, React Testing Library) is highly valued. Must have excellent problem-solving skills and ability to work in an agile environment.',
    createdDate: '2024-01-10'
  },
  {
    id: 'jd2',
    department: 'Engineering',
    role: 'Full Stack Developer',
    description: 'Looking for a Full Stack Developer with strong backend and frontend experience. Requirements: 3+ years with Node.js, Python, or Go. Proficiency in React or Vue.js. Experience with PostgreSQL, MongoDB, or similar databases. Knowledge of RESTful APIs, GraphQL, Docker, and cloud platforms (AWS/GCP). Familiarity with CI/CD pipelines and microservices architecture is a plus.',
    createdDate: '2024-01-08'
  },
  {
    id: 'jd3',
    department: 'Engineering',
    role: 'DevOps Engineer',
    description: 'DevOps Engineer to manage and optimize our infrastructure. Required: 4+ years of experience with AWS, Azure, or GCP. Strong knowledge of Kubernetes, Docker, and container orchestration. Expertise in infrastructure as code (Terraform, CloudFormation). Experience with CI/CD tools (Jenkins, GitLab CI, GitHub Actions). Strong scripting skills in Python, Bash, or PowerShell. Understanding of monitoring and logging tools (Prometheus, Grafana, ELK stack).',
    createdDate: '2024-01-05'
  },
  {
    id: 'jd4',
    department: 'Design',
    role: 'UX Designer',
    description: 'UX Designer to create intuitive and engaging user experiences. Requirements: 4+ years of UX design experience. Proficiency in Figma, Sketch, or Adobe XD. Strong portfolio demonstrating user-centered design process. Experience with user research, wireframing, prototyping, and usability testing. Understanding of accessibility standards (WCAG). Excellent communication and collaboration skills. Experience with design systems is a plus.',
    createdDate: '2024-01-12'
  },
  {
    id: 'jd5',
    department: 'Design',
    role: 'UI Designer',
    description: 'Creative UI Designer to craft beautiful and functional interfaces. Required: 3+ years of UI design experience. Expert knowledge of design tools (Figma, Adobe Creative Suite). Strong understanding of typography, color theory, and visual hierarchy. Experience creating and maintaining design systems. Ability to collaborate with developers and product teams. Portfolio showcasing modern, clean design work required.',
    createdDate: '2024-01-15'
  },
  {
    id: 'jd6',
    department: 'Product',
    role: 'Product Manager',
    description: 'Product Manager to drive product strategy and execution. Requirements: 5+ years of product management experience. Strong analytical and data-driven decision-making skills. Experience with agile methodologies and product roadmap planning. Excellent stakeholder management and communication abilities. Background in SaaS or tech products preferred. MBA or technical degree is a plus. Proven track record of launching successful products.',
    createdDate: '2024-01-03'
  },
  {
    id: 'jd7',
    department: 'Product',
    role: 'Product Designer',
    description: 'Product Designer to bridge design and product strategy. Required: 4+ years combining UX/UI design with product thinking. Experience working closely with product managers and engineers. Strong understanding of user research and data analysis. Proficiency in Figma and prototyping tools. Ability to advocate for users while balancing business goals. Portfolio demonstrating end-to-end product design process.',
    createdDate: '2024-01-18'
  },
  {
    id: 'jd8',
    department: 'Marketing',
    role: 'Digital Marketing Manager',
    description: 'Digital Marketing Manager to lead our online marketing efforts. Requirements: 5+ years of digital marketing experience. Expertise in SEO, SEM, social media marketing, and email campaigns. Strong analytical skills with Google Analytics, SEMrush, or similar tools. Experience managing marketing budgets and ROI analysis. Excellent content creation and copywriting skills. Knowledge of marketing automation platforms (HubSpot, Marketo). Proven ability to drive growth and engagement.',
    createdDate: '2024-01-20'
  }
];