// hooks/useDashboard.ts

import { KeyboardEvent, useEffect, useMemo, useState } from 'react'
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

type StageDelay = {
  stage: StageKey
  averageDays: number
  longestDays: number
  longestCandidateId?: string
  longestCandidateName?: string
}

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
  const currentMonthCandidateCount = useMemo(() => {
    const now = new Date();
    return candidates.filter((candidate) => {
      const appliedDate =
        parseDateValue(candidate?.applied_at) ??
        parseDateValue(candidate?.appliedAt) ??
        parseDateValue(candidate?.created_at) ??
        parseDateValue(candidate?.createdAt);

      return appliedDate ? isSameMonth(appliedDate, now.getFullYear(), now.getMonth()) : false;
    }).length;
  }, [candidates]);

  const hiredThisMonthCount = useMemo(() => {
    if (typeof metrics?.hired_this_month === 'number') {
      return metrics.hired_this_month;
    }

    const now = new Date();
    return candidates.filter((candidate) => {
      const hiredDate = parseDateValue(candidate?.hired_at ?? candidate?.hiredAt);
      return hiredDate ? isSameMonth(hiredDate, now.getFullYear(), now.getMonth()) : false;
    }).length;
  }, [metrics, candidates]);

  const avgTimeToHire = useMemo(() => {
    if (typeof metrics?.avg_time_to_hire === 'number') {
      return metrics.avg_time_to_hire;
    }

    const durations = candidates
      .map((candidate) => {
        const start = parseDateValue(candidate?.applied_at ?? candidate?.appliedAt ?? candidate?.created_at ?? candidate?.createdAt);
        const end = parseDateValue(candidate?.hired_at ?? candidate?.hiredAt);
        if (!start || !end || end <= start) return null;
        return diffInDays(end, start);
      })
      .filter((value): value is number => typeof value === 'number');

    if (!durations.length) return null;
    const total = durations.reduce((sum, value) => sum + value, 0);
    return total / durations.length;
  }, [metrics, candidates]);

  const dropOffRate = useMemo(() => {
    if (typeof metrics?.drop_off_rate === 'number') {
      return metrics.drop_off_rate;
    }

    if (!candidates.length) return 0;
    const droppedCount = candidates.filter((candidate) => {
      const stage = String(candidate?.current_state ?? candidate?.stage ?? '').toLowerCase();
      return stage === 'rejected' || stage === 'drop-off' || stage === 'dropoff' || stage === 'dropped';
    }).length;

    return (droppedCount / candidates.length) * 100;
  }, [metrics, candidates]);

  const getCurrentStageEnteredDate = (candidate: any, stage: StageKey): Date | null => {
    const history = candidate?.state_history ?? candidate?.stageHistory;

    if (Array.isArray(history)) {
      const openEntry = [...history].reverse().find((entry) => {
        const entryStage = normalizeStage(entry?.state ?? entry?.stage);
        const exited = entry?.exited_at ?? entry?.exitedAt;
        const isOpen = exited === null || exited === undefined || String(exited).trim() === '';
        return entryStage === stage && isOpen;
      });

      const enteredAt = parseDateValue(openEntry?.entered_at ?? openEntry?.enteredAt);
      if (enteredAt) return enteredAt;

      const latestMatching = [...history].reverse().find((entry) => normalizeStage(entry?.state ?? entry?.stage) === stage);
      const latestEnteredAt = parseDateValue(latestMatching?.entered_at ?? latestMatching?.enteredAt);
      if (latestEnteredAt) return latestEnteredAt;
    }

    const stageDateMap: Partial<Record<StageKey, Date | null>> = {
      applied: parseDateValue(candidate?.applied_at ?? candidate?.appliedAt ?? candidate?.created_at ?? candidate?.createdAt),
      screening: parseDateValue(candidate?.screening_at ?? candidate?.screeningAt),
      interview: parseDateValue(candidate?.interview_at ?? candidate?.interviewAt),
      final: parseDateValue(candidate?.final_at ?? candidate?.finalAt),
      hired: parseDateValue(candidate?.hired_at ?? candidate?.hiredAt)
    };

    return stageDateMap[stage] ?? null;
  };

  const stageDelays = useMemo<StageDelay[]>(() => {
    const now = new Date();

    return BOTTLENECK_STAGES.map((stage) => {
      const stageCandidates = candidates.filter(
        (candidate) => normalizeStage(candidate?.current_state ?? candidate?.stage) === stage
      );

      const delayRows = stageCandidates
        .map((candidate) => {
          const enteredAt = getCurrentStageEnteredDate(candidate, stage);
          if (!enteredAt || enteredAt > now) return null;

          return {
            id: String(candidate?.id ?? candidate?._id ?? ''),
            name: String(candidate?.name ?? 'Unknown'),
            days: diffInDays(now, enteredAt)
          };
        })
        .filter((row): row is { id: string; name: string; days: number } => Boolean(row));

      if (!delayRows.length) {
        return {
          stage,
          averageDays: 0,
          longestDays: 0
        };
      }

      const totalDays = delayRows.reduce((sum, row) => sum + row.days, 0);
      const longest = delayRows.reduce((prev, current) => (current.days > prev.days ? current : prev), delayRows[0]);

      return {
        stage,
        averageDays: totalDays / delayRows.length,
        longestDays: longest.days,
        longestCandidateId: longest.id || undefined,
        longestCandidateName: longest.name || undefined
      };
    });
  }, [candidates]);

  const currentStageData = useMemo<StageDelay>(() => {
    const withData = stageDelays.filter((row) => row.averageDays > 0);
    if (!withData.length) {
      return {
        stage: 'applied',
        averageDays: 0,
        longestDays: 0
      };
    }

    return withData.reduce((prev, current) =>
      current.averageDays > prev.averageDays ? current : prev
    );
  }, [stageDelays]);

  const currentStageColor = STAGE_COLORS[currentStageData.stage] ?? STAGE_COLORS.applied;

  const currentBottleneckDays = currentStageData.averageDays;

  const bottleneckReason = currentStageData.averageDays > 0
    ? `${currentStageColor.name} has the highest average waiting time`
    : 'No bottleneck data';

  const stageSampleLabel = currentStageData.longestCandidateName
    ? `Longest: ${currentStageData.longestCandidateName} (${Math.round(currentStageData.longestDays)}d)`
    : 'Insufficient data';

  const canNavigateToBottleneck = Boolean(currentStageData.longestCandidateId);

  const recentCandidates = [...candidates]
    .sort((a, b) => {
      const aDate = parseDateValue(a?.created_at ?? a?.applied_at ?? a?.appliedAt)?.getTime() ?? 0;
      const bDate = parseDateValue(b?.created_at ?? b?.applied_at ?? b?.appliedAt)?.getTime() ?? 0;
      return bDate - aDate;
    })
    .slice(0, 5);

  const navigateToBottleneckCandidate = (id?: string) => {
    if (!id) return;
    navigate(`/candidate/${id}`);
  };

  const handleBottleneckClick = () => {
    if (!currentStageData.longestCandidateId) return;
    navigateToBottleneckCandidate(currentStageData.longestCandidateId);
  };

  const handleBottleneckKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canNavigateToBottleneck) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBottleneckClick();
    }
  };

  return {
    user,
    metrics,
    candidates,
    applicationsByMonth,
    jobsCount,
    currentMonthCandidateCount,
    hiredThisMonthCount,
    avgTimeToHire,
    dropOffRate,
    currentStageData,
    currentStageColor,
    currentBottleneckDays,
    bottleneckReason,
    stageSampleLabel,
    canNavigateToBottleneck,
    handleBottleneckClick,
    handleBottleneckKeyDown,
    recentCandidates,
    setIsHovered,
    navigateToBottleneckCandidate
  };
};
