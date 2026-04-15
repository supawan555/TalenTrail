// hooks/useDashboard.ts

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api'

const STAGE_COLORS = {
  applied: { bg: '#E3F2FD', text: '#2196F3', name: 'Applied' },
  screening: { bg: '#FFF9C4', text: '#FBC02D', name: 'Screening' },
  interview: { bg: '#F3E5F5', text: '#7E57C2', name: 'Interview' },
  final: { bg: '#FFE0B2', text: '#FB8C00', name: 'Final Round' },
  hired: { bg: '#E8F5E9', text: '#43A047', name: 'Hired' }
}

type StageKey = keyof typeof STAGE_COLORS;

const BOTTLENECK_STAGES: StageKey[] = ['applied', 'screening', 'interview', 'final']

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const diffInDays = (end: Date, start: Date) => {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
};

const isSameMonth = (date: Date, year: number, month: number) =>
  date.getFullYear() === year && date.getMonth() === month;

const normalizeStage = (value: unknown): StageKey | null => {
  if (!value) return null;
  const stage = String(value).toLowerCase();
  if (stage.includes('screen')) return 'screening';
  if (stage.includes('interview')) return 'interview';
  if (stage.includes('final') || stage.includes('offer')) return 'final';
  if (stage.includes('hire')) return 'hired';
  if (stage.includes('applied')) return 'applied';
  return null;
};

export const useDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [applicationsByMonth, setApplicationsByMonth] = useState<any[]>([]);
  const [jobsCount, setJobsCount] = useState<number>(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // ===== DATA FETCH =====
  useEffect(() => {
    let ignore = false;
    const fetchAll = async () => {
      try {
        const [metricsRes, candidatesRes, jobsRes, analyticsRes] = await Promise.all([
          api.get('/dashboard/metrics'),
          api.get('/candidates'),
          api.get('/jobs'),
          api.get('/dashboard/analytics'),
        ]);
        if (!ignore) {
          setMetrics(metricsRes.data);
          setCandidates(candidatesRes.data || []);
          const jobsData = jobsRes.data || [];
          setJobsCount(jobsData.filter((j: any) => !j?.isHidden).length);
          setApplicationsByMonth(analyticsRes.data?.applicationsByMonth || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchAll();
    return () => { ignore = true; };
  }, []);

  // ===== COMPUTE =====
  const currentMonthCandidateCount = candidates.length;

  const recentCandidates = candidates.slice(0, 5);

  const navigateToBottleneckCandidate = (id?: string) => {
    if (!id) return;
    navigate(`/candidate/${id}`);
  };

  return {
    user,
    metrics,
    candidates,
    applicationsByMonth,
    jobsCount,
    currentMonthCandidateCount,
    recentCandidates,
    setIsHovered,
    navigateToBottleneckCandidate
  };
};
