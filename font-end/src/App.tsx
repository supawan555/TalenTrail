import { useState, useEffect } from 'react';
import api from './lib/api';
import { Routes, Route, useNavigate, useParams, Navigate, Outlet } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
// --- Context & Auth ---
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
// --- Components ---
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
import { ScrollToTopOnCandidate } from './components/scroll-to-top-on-candidate';
// --- Data ---
import { Candidate, mockCandidates } from './lib/mock-data';

// Main App Content Component
function AppContent() {
  const navigate = useNavigate();

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
// Fetch candidates from API on mount
const fetchCandidates = async () => {
    try {
      const res = await api.get('/candidates');
      setCandidates(res.data); // เอาข้อมูลจริงใส่ State
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
      toast.error("Failed to load candidates");
    } finally {
      setIsLoading(false);
    }
  };

// เพิ่ม useEffect เพื่อเรียกข้อมูลตอนเข้าเว็บครั้งแรก
  useEffect(() => {
    fetchCandidates();
  }, []);

  // --- Handlers ---

  const handleCandidateSelect = (candidate: Candidate) => {
    const latestCandidate = candidates.find(c => c.id === candidate.id) || candidate;
    setSelectedCandidate(latestCandidate);
    navigate(`/candidate/${latestCandidate.id}`);
  };

  const handleBackToPipeline = () => {
    setSelectedCandidate(null);
    navigate('/pipeline');
  };

  const handleAddCandidate = async (newCandidate: Candidate) => {
    // ⚠️ ถ้าจะให้บันทึกลง Database จริง ต้องแก้ตรงนี้ให้เรียก api.post
    // แต่เบื้องต้นสั่งให้ Fetch ใหม่เพื่อให้ข้อมูล Sync กับ Server ก็ได้ครับ
    await fetchCandidates(); 
    toast.success('Candidate added successfully!');
  };

  const handleEditCandidate = async (updatedCandidate: Candidate) => {
    // ⚠️ ถ้าจะให้บันทึกลง Database จริง ต้องเรียก api.put ที่นี่
    // อัปเดต UI ไปก่อน
    setCandidates(prev => 
      prev.map(c => c.id === updatedCandidate.id ? updatedCandidate : c)
    );
    setSelectedCandidate(updatedCandidate);
    toast.success('Candidate updated successfully!');
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    try {
        // ✅ ตัวอย่างการลบข้อมูลจริง (เรียก API)
        await api.delete(`/candidates/${candidateId}`);
        
        // ลบออกจาก State
        setCandidates(prev => prev.filter(c => c.id !== candidateId));
        setSelectedCandidate(null);
        navigate('/candidates');
        toast.success('Candidate deleted successfully!');
    } catch (error) {
        toast.error('Failed to delete candidate');
    }
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
    toast.success('Candidate restored successfully');
  };

  // Wrapper Component for Candidate Profile
  const CandidateProfileWrapper = () => {
    const { id } = useParams();
    let seed = candidates.find(c => c.id === id) || selectedCandidate;
    
    if (!id) return <Navigate to="/pipeline" replace />;
    
    // Fallback seed
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

  // --- Routing Structure ---
  return (
    <Routes>
      {/* 1. Public Routes: Login & Register (เข้าได้เลยไม่ต้อง Login) */}
      <Route 
        path="/login" 
        element={
          <Login 
             // หมายเหตุ: Login ควรแก้ให้ใช้ useAuth().login() ภายในตัว Component เอง
             // แต่ใส่ prop นี้ไว้เผื่อ Navigate (ถ้าจำเป็น)
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

      {/* 2. Protected Routes: ต้อง Login ก่อนถึงจะเข้าได้ */}
      <Route element={<ProtectedRoute />}>
         {/* Layout จะถูกคลุมด้วย ProtectedRoute อัตโนมัติ */}
         <Route element={
            <Layout>
              <ScrollToTopOnCandidate />
              <Outlet /> {/* หน้าต่างๆ จะมาโผล่ตรงนี้ */}
            </Layout>
         }>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            <Route path="/pipeline" element={<Pipeline onCandidateSelect={handleCandidateSelect} />} />
            <Route path="/candidates" element={<Candidates onCandidateSelect={handleCandidateSelect} />} />
            <Route path="/archived-candidates" element={<ArchivedCandidates candidates={candidates} onRestore={handleRestoreCandidate} />} />
            
            <Route path="/job-descriptions" element={<JobDescriptions />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings onLogout={() => {/* Logout จัดการใน AuthContext */}} />} />
            
            <Route path="/candidate/:id" element={<CandidateProfileWrapper />} />
         </Route>
      </Route>

      {/* 3. Catch All: ถ้าไม่เจอหน้าไหน ให้ไป Login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// Main App Component
export default function App() {
  return (
    // ครอบด้วย AuthProvider เพื่อให้ Context ทำงานได้ทั้ง App
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}