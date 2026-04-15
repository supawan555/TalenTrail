import { useState, useEffect, useCallback } from 'react';
import api from './lib/api';
import { Routes, Route, useNavigate, useParams, Navigate, Outlet } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
// --- Context & Auth ---
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './hooks/ProtectedRoute';
// --- Components ---
import { Layout } from './hooks/layout';
import { Dashboard } from './pages/Dashboard';
import { Pipeline } from './pages/Pipeline';
import { Candidates } from './pages/Candidates';
import { CandidateProfile } from './pages/CandidateProfile';
import ArchivedCandidates from './pages/ArchivedCandidates';
import JobDescriptions from './pages/JobDescriptions';
import { Analytics } from './pages/Analytics';
import { Notes } from './pages/Notes';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ScrollToTopOnCandidate } from './hooks/scroll-to-top-on-candidate';
//Hooks
import { useCandidates } from './hooks/useApp';
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
  
  //call hooks
  const { candidates,
     selectedCandidate, setSelectedCandidate, 
     bootstrapping, 
     handleAddCandidate, 
     handleEditCandidate, 
     handleDeleteCandidate, 
     handleNextStage, 
     handleRejectCandidate, 
     handleDropOffCandidate, 
     handleRestoreCandidate } = useCandidates(user, authLoading);
  if (authLoading || bootstrapping) {
    const loaderMessage = authLoading ? 'Checking your session…' : 'Loading your workspace…';
    return <FullScreenLoader message={loaderMessage} />;
  }

  // // --- Handlers ---
  const handleCandidateSelect = (candidate: Candidate) => {
    const latestCandidate = candidates.find(c => c.id === candidate.id) || candidate;
    setSelectedCandidate(latestCandidate);
    navigate(`/candidate/${latestCandidate.id}`);
  };

  const handleBackToPipeline = () => {
    setSelectedCandidate(null);
    navigate('/pipeline');
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

          <Route
            path="/pipeline"
            element={<Pipeline onCandidateSelect={handleCandidateSelect} candidates={candidates} />}
          />
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