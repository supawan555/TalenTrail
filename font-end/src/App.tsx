import { useState } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import { Dashboard } from './components/dashboard';
import { Pipeline } from './components/pipeline';
import { Candidates } from './components/candidates';
import { CandidateProfile } from './components/candidate-profile';
import { ArchivedCandidates } from './components/archived-candidates';
import { JobDescriptions } from './components/job-descriptions';
import { Analytics } from './components/analytics';
import { Notes } from './components/notes';
import { Settings } from './components/settings';
import { Login } from './components/login';
import { Register } from './components/register';
import { Candidate, mockCandidates } from './lib/mock-data';
import { toast } from 'sonner';

// Add archived candidates
const archivedCandidates: Candidate[] = [
  {
    id: 'archived-6',
    name: 'Robert Martinez',
    email: 'robert.martinez@email.com',
    phone: '+1 (555) 678-9012',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    position: 'Backend Developer',
    department: 'Engineering',
    experience: '4+ years',
    location: 'Chicago, IL',
    matchScore: 76,
    stage: 'rejected',
    appliedDate: '2024-01-10',
    skills: ['Node.js', 'MongoDB', 'Express', 'REST APIs'],
    salary: '$95,000 - $115,000',
    availability: '2 weeks notice',
    archiveReason: 'Skills did not match requirements - needed more experience with microservices architecture',
    archivedDate: '2024-01-15',
    notes: [
      {
        id: 'n6',
        author: 'Alex Chen (Senior Developer)',
        content: 'Technical interview revealed gaps in system design knowledge. Candidate struggled with scalability questions.',
        timestamp: '2024-01-15T14:00:00Z',
        type: 'Rejected'
      }
    ]
  },
  {
    id: 'archived-7',
    name: 'Jennifer Walsh',
    email: 'jennifer.walsh@email.com',
    phone: '+1 (555) 789-0123',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    position: 'Product Designer',
    department: 'Design',
    experience: '3+ years',
    location: 'Portland, OR',
    matchScore: 81,
    stage: 'drop-off',
    appliedDate: '2024-01-12',
    skills: ['Figma', 'Prototyping', 'User Research', 'Wireframing'],
    salary: '$80,000 - $95,000',
    availability: 'Immediate',
    archiveReason: 'Candidate accepted offer from another company',
    archivedDate: '2024-01-18',
    notes: [
      {
        id: 'n7',
        author: 'Rachel Kim (Design Director)',
        content: 'Strong portfolio, but candidate informed us they accepted another offer before our final interview.',
        timestamp: '2024-01-18T10:30:00Z',
        type: 'Withdrawn'
      }
    ]
  },
  {
    id: 'archived-8',
    name: 'Kevin Nguyen',
    email: 'kevin.nguyen@email.com',
    phone: '+1 (555) 890-1234',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
    position: 'Data Scientist',
    department: 'Data Science',
    experience: '5+ years',
    location: 'Boston, MA',
    matchScore: 72,
    stage: 'rejected',
    appliedDate: '2024-01-05',
    skills: ['Python', 'Machine Learning', 'SQL', 'TensorFlow'],
    salary: '$110,000 - $130,000',
    availability: '1 month notice',
    archiveReason: 'Cultural fit concerns - preferred independent work over team collaboration',
    archivedDate: '2024-01-20',
    notes: [
      {
        id: 'n8',
        author: 'Sarah Martinez (Recruiter)',
        content: 'After team interviews, consensus was that candidate preferred solo work and may not thrive in our collaborative environment.',
        timestamp: '2024-01-20T15:45:00Z',
        type: 'Rejected'
      }
    ]
  },
  {
    id: 'archived-9',
    name: 'Amanda Sullivan',
    email: 'amanda.sullivan@email.com',
    phone: '+1 (555) 901-2345',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
    position: 'Marketing Specialist',
    department: 'Marketing',
    experience: '2+ years',
    location: 'Miami, FL',
    matchScore: 68,
    stage: 'rejected',
    appliedDate: '2024-01-08',
    skills: ['SEO', 'Content Marketing', 'Social Media', 'Analytics'],
    salary: '$60,000 - $75,000',
    availability: 'Immediate',
    archiveReason: 'Insufficient experience with B2B marketing strategies',
    archivedDate: '2024-01-12',
    notes: [
      {
        id: 'n9',
        author: 'Tom Richards (Marketing Manager)',
        content: 'Candidate has strong B2C background but limited B2B experience which is critical for this role.',
        timestamp: '2024-01-12T11:20:00Z',
        type: 'Rejected'
      }
    ]
  },
  {
    id: 'archived-10',
    name: 'Daniel Cooper',
    email: 'daniel.cooper@email.com',
    phone: '+1 (555) 012-3456',
    avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face',
    position: 'Full Stack Developer',
    department: 'Engineering',
    experience: '6+ years',
    location: 'Seattle, WA',
    matchScore: 85,
    stage: 'drop-off',
    appliedDate: '2024-01-03',
    skills: ['React', 'Node.js', 'Python', 'AWS'],
    salary: '$120,000 - $140,000',
    availability: '3 weeks notice',
    archiveReason: 'Candidate withdrew due to relocation concerns',
    archivedDate: '2024-01-14',
    notes: [
      {
        id: 'n10',
        author: 'Jennifer Lee (HR)',
        content: 'Candidate was initially interested but withdrew after learning we require in-office presence 3 days/week.',
        timestamp: '2024-01-14T09:15:00Z',
        type: 'Withdrawn'
      }
    ]
  }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([...mockCandidates, ...archivedCandidates]);
  const navigate = useNavigate();

  const handleCandidateSelect = (candidate: Candidate) => {
    // Find the latest version of the candidate from state
    const latestCandidate = candidates.find(c => c.id === candidate.id) || candidate;
    setSelectedCandidate(latestCandidate);
    navigate(`/candidate/${latestCandidate.id}`);
  };

  const handleBackToPipeline = () => {
    setSelectedCandidate(null);
    navigate('/pipeline');
  };

  const handleAddCandidate = (newCandidate: Candidate) => {
    setCandidates(prev => [newCandidate, ...prev]);
    toast.success('Candidate added successfully!');
  };

  const handleEditCandidate = (updatedCandidate: Candidate) => {
    setCandidates(prev => 
      prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c)
    );
    setSelectedCandidate(updatedCandidate);
    toast.success('Candidate updated successfully!');
  };

  const handleDeleteCandidate = (candidateId: string) => {
    setCandidates(prev => prev.filter(c => c.id !== candidateId));
    setSelectedCandidate(null);
    navigate('/pipeline');
    toast.success('Candidate deleted successfully!');
  };

  const handleNextStage = (candidateId: string) => {
    const stageOrder: Candidate['stage'][] = ['applied', 'screening', 'interview', 'final', 'hired'];
    
    setCandidates(prev => 
      prev.map(c => {
        if (c.id === candidateId) {
          const currentIndex = stageOrder.indexOf(c.stage);
          if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
            const newStage = stageOrder[currentIndex + 1];
            const updatedCandidate = { ...c, stage: newStage };
            setSelectedCandidate(updatedCandidate);
            return updatedCandidate;
          }
        }
        return c;
      })
    );
    toast.success('Candidate moved to next stage!');
  };

  const handleRejectCandidate = (candidateId: string, reason: string) => {
    setCandidates(prev => 
      prev.map(c => {
        if (c.id === candidateId) {
          const updatedCandidate = { 
            ...c, 
            stage: 'rejected' as Candidate['stage'],
            archivedDate: new Date().toISOString().split('T')[0],
            archiveReason: reason
          };
          setSelectedCandidate(updatedCandidate);
          return updatedCandidate;
        }
        return c;
      })
    );
    toast.success('Candidate has been rejected and archived');
  };

  const handleDropOffCandidate = (candidateId: string, reason: string) => {
    setCandidates(prev => 
      prev.map(c => {
        if (c.id === candidateId) {
          const updatedCandidate = { 
            ...c, 
            stage: 'drop-off' as Candidate['stage'],
            archivedDate: new Date().toISOString().split('T')[0],
            archiveReason: reason
          };
          setSelectedCandidate(updatedCandidate);
          return updatedCandidate;
        }
        return c;
      })
    );
    toast.success('Candidate marked as drop-off and archived');
  };

  const handleRestoreCandidate = (candidateId: string) => {
    setCandidates(prev =>
      prev.map(c => {
        if (c.id === candidateId) {
          return {
            ...c,
            stage: 'applied' as Candidate['stage'],
            archiveReason: undefined,
            archivedDate: undefined
          };
        }
        return c;
      })
    );
  };

  const CandidateProfileWrapper = () => {
    const { id } = useParams();
    let seed = candidates.find(c => c.id === id) || selectedCandidate;
    if (!id) return <Navigate to="/pipeline" replace />;
    // If seed not found in local state, create a minimal placeholder so component can fetch from backend
    if (!seed) {
      seed = {
        id,
        name: 'Loading…',
        email: '',
        phone: '',
        avatar: '',
        position: '',
        department: '',
        experience: '',
        location: '',
        matchScore: 0,
        stage: 'applied',
        appliedDate: new Date().toISOString().split('T')[0],
        skills: [],
        notes: [],
        salary: '',
        availability: ''
      };
    }
    return (
      <CandidateProfile
        candidate={seed}
        onBack={handleBackToPipeline}
        onEdit={handleEditCandidate}
        onDelete={handleDeleteCandidate}
        onNextStage={handleNextStage}
        onReject={handleRejectCandidate}
        onDropOff={handleDropOffCandidate}
      />
    );
  };

  const renderRoutes = () => (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/pipeline" element={<Pipeline onCandidateSelect={handleCandidateSelect} candidates={candidates} />} />
      <Route path="/candidates" element={<Candidates onCandidateSelect={handleCandidateSelect} />} />
      <Route path="/archived-candidates" element={<ArchivedCandidates candidates={candidates} onRestore={handleRestoreCandidate} />} />
      <Route path="/job-descriptions" element={<JobDescriptions />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/notes" element={<Notes />} />
      <Route path="/settings" element={<Settings onLogout={() => setIsAuthenticated(false)} />} />
      <Route path="/candidate/:id" element={<CandidateProfileWrapper />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );

  // Unauthenticated routes: login & register
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <Login
              onLogin={() => {
                setIsAuthenticated(true);
                navigate('/');
              }}
              onShowRegister={() => navigate('/register')}
            />
          }
        />
        <Route
          path="/register"
          element={
            <Register
              onRegister={() => {
                toast.success('Account created successfully! Please sign in.');
                navigate('/login');
              }}
              onBackToLogin={() => navigate('/login')}
            />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      {renderRoutes()}
    </Layout>
  );
}