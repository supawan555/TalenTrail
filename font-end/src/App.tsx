import { useState, useEffect, useCallback } from 'react';
import api from './lib/api';
import { Routes, Route, useNavigate, useParams, Navigate, Outlet } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
// --- Context & Auth ---
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { Candidate } from './lib/mock-data';

const FullScreenLoader = ({ message }: { message: string }) => (
  <div
    role="status"
    aria-live="polite"
    style={{
      position: 'relative',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      background: 'radial-gradient(circle at 25% 25%, #0f172a, #020617)',
      color: '#f8fafc',
      textAlign: 'center',
      padding: '2rem'
    }}
  >
    <svg width="72" height="72" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="rgba(148, 163, 184, 0.35)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
    <div>
      <p style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>TalentTail</p>
      <p style={{ opacity: 0.8 }}>{message}</p>
    </div>
    <span
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        border: 0,
        margin: -1,
        clip: 'rect(0, 0, 0, 0)',
        overflow: 'hidden'
      }}
    >
      Loading
    </span>
  </div>
);

// Main App Content Component
function AppContent() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Helper to normalize backend payload to frontend Candidate shape
  const normalizeCandidate = useCallback((raw: any): Candidate => {
    const applied = raw?.appliedDate ?? raw?.applied_at ?? raw?.created_at ?? new Date().toISOString();
    const appliedDate = (() => {
      try {
        const d = new Date(applied);
        return Number.isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
      } catch {
        return new Date().toISOString().split('T')[0];
      }
    })();
    const stage = (raw?.stage ?? raw?.current_state ?? 'applied') as Candidate['stage'];
    const matchScore = typeof raw?.matchScore === 'number'
      ? raw.matchScore
      : (typeof raw?.resumeAnalysis?.match?.score === 'number' ? Math.round(raw.resumeAnalysis.match.score) : 0);

    const base: any = {
      id: raw?.id ?? raw?._id ?? crypto.randomUUID(),
      name: raw?.name ?? '',
      email: raw?.email ?? '',
      phone: raw?.phone ?? '',
      avatar: raw?.avatar ?? undefined,
      position: raw?.position ?? raw?.role ?? '',
      department: raw?.department ?? '',
      experience: raw?.experience ?? '',
      location: raw?.location ?? '',
      matchScore,
      stage,
      appliedDate,
      resumeUrl: raw?.resume_url ?? raw?.resumeUrl ?? undefined,
      archivedDate: raw?.archivedDate ?? raw?.archived_date ?? undefined,
      archiveReason: raw?.archiveReason ?? raw?.archive_reason ?? undefined,
      skills: Array.isArray(raw?.skills) ? raw.skills : [],
      notes: Array.isArray(raw?.notes) ? raw.notes : [],
      salary: raw?.salary ?? '',
      availability: raw?.availability ?? '',
    };
    // Preserve resumeAnalysis if present so Resume Analysis section can render
    if (raw?.resumeAnalysis) {
      base.resumeAnalysis = raw.resumeAnalysis;
    }
    return base as Candidate;
  }, []);

  // Fetch candidates from API when the session is ready
  const fetchCandidates = useCallback(async () => {
    try {
      const res = await api.get('/candidates');
      const items = Array.isArray(res.data) ? res.data.map(normalizeCandidate) : [];
      setCandidates(items); // map ให้ตรง type ฝั่งหน้าเว็บ
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
      toast.error("Failed to load candidates");
    }
  }, [normalizeCandidate]);

  // Hydrate candidates only after auth is ready and a session exists
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setBootstrapping(false);
      setCandidates([]);
      setSelectedCandidate(null);
      return;
    }

    let isCancelled = false;

    const hydrate = async () => {
      setBootstrapping(true);
      try {
        await fetchCandidates();
      } finally {
        if (!isCancelled) {
          setBootstrapping(false);
        }
      }
    };

    hydrate();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, user, fetchCandidates]);

  if (authLoading || bootstrapping) {
    const loaderMessage = authLoading ? 'Checking your session…' : 'Loading your workspace…';
    return <FullScreenLoader message={loaderMessage} />;
  }

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

  /* ===== Root Redirect ===== */
  const RootRedirect = () => {
    const { user, loading } = useAuth();

    if (loading) return null;

    return <Navigate to={user ? "/dashboard" : "/login"} replace />;
  };

  // --- Routing Structure ---
  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={<RootRedirect />} />


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
          
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/pipeline" element={<Pipeline onCandidateSelect={handleCandidateSelect} />} />
          <Route path="/candidates" element={<Candidates onCandidateSelect={handleCandidateSelect} />} />
          <Route path="/archived-candidates" element={<ArchivedCandidates candidates={candidates} onRestore={handleRestoreCandidate} />} />

          <Route path="/job-descriptions" element={<JobDescriptions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/settings" element={<Settings onLogout={() => {/* Logout จัดการใน AuthContext */ }} />} />

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