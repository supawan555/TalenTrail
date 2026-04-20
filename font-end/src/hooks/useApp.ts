// hooks/useApp.ts

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { Candidate } from '../lib/mock-data';

const normalizeStage = (value?: string | null): Candidate['stage'] => {
  const raw = (value ?? '').toString().trim().toLowerCase();
  if (!raw) return 'applied';

  if (raw === 'dropoff' || raw === 'dropped') return 'drop-off';
  if (raw === 'final-round' || raw === 'final round') return 'final';

  const validStages: Candidate['stage'][] = [
    'applied',
    'screening',
    'interview',
    'final',
    'hired',
    'rejected',
    'drop-off',
    'archived'
  ];

  return validStages.includes(raw as Candidate['stage'])
    ? (raw as Candidate['stage'])
    : 'applied';
};

export const useCandidates = (user: any, authLoading: boolean) => {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  // normalize
  const normalizeCandidate = useCallback((raw: any): Candidate => {
    const toIsoString = (value?: string | Date | null) => {
      if (!value) return undefined;
      try {
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return undefined;
        return d.toISOString();
      } catch {
        return undefined;
      }
    };

    const normalizeDepartment = (value?: string | null): string => {
      const normalized = (value ?? '').toString().trim();
      return normalized || 'Unspecified';
    };

    const normalizeStageHistory = (history: any): Candidate['stageHistory'] => {
      if (!Array.isArray(history)) {
        return [];
      }

      return history
        .map((entry) => {
          const stage = normalizeStage(entry?.stage ?? entry?.state);
          const enteredAt = toIsoString(entry?.entered_at ?? entry?.enteredAt);
          const exitedAt = toIsoString(entry?.exited_at ?? entry?.exitedAt);
          if (!enteredAt) {
            return null;
          }

          return {
            stage,
            enteredAt,
            exitedAt: exitedAt ?? null
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    };

    const appliedIso =
      toIsoString(raw?.applied_at ?? raw?.appliedAt ?? raw?.created_at ?? raw?.createdAt) ??
      new Date().toISOString();

    const parsedMatchScore = typeof raw?.matchScore === 'number'
      ? raw.matchScore
      : Number.parseFloat(raw?.matchScore ?? '0');

    return {
      id: raw?.id ?? crypto.randomUUID(),
      name: raw?.name ?? '',
      email: raw?.email ?? '',
      phone: raw?.phone ?? '',
      avatar: raw?.avatar ?? '',
      position: raw?.position ?? '',
      department: normalizeDepartment(raw?.department),
      experience: raw?.experience ?? '',
      location: raw?.location ?? '',
      matchScore: Number.isFinite(parsedMatchScore) ? parsedMatchScore : 0,
      stage: normalizeStage(raw?.stage ?? raw?.current_state),
      appliedDate: appliedIso,
      appliedAt: appliedIso,
      screeningAt: toIsoString(raw?.screening_at ?? raw?.screeningAt),
      interviewAt: toIsoString(raw?.interview_at ?? raw?.interviewAt),
      finalAt: toIsoString(raw?.final_at ?? raw?.finalAt),
      hiredAt: toIsoString(raw?.hired_at ?? raw?.hiredAt),
      rejectedAt: toIsoString(raw?.rejected_at ?? raw?.rejectedAt),
      droppedAt: toIsoString(raw?.dropped_at ?? raw?.dropoff_at ?? raw?.droppedAt),
      archivedDate: toIsoString(raw?.archived_date ?? raw?.archivedDate),
      skills: raw?.skills ?? [],
      notes: raw?.notes ?? [],
      salary: raw?.salary ?? '',
      availability: raw?.availability ?? '',
      resumeUrl: raw?.resume_url ?? raw?.resumeUrl ?? '',
      stageHistory: normalizeStageHistory(raw?.stageHistory ?? raw?.state_history)
    };
  }, []);

  // fetch
  const fetchCandidates = useCallback(async () => {
    try {
      const res = await api.get('/candidates');
      const items = Array.isArray(res.data)
        ? res.data.map(normalizeCandidate)
        : [];
      setCandidates(items);
    } catch {
      toast.error('Failed to load candidates');
    }
  }, [normalizeCandidate]);

  // hydrate
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setBootstrapping(false);
      setCandidates([]);
      return;
    }

    let cancel = false;

    const load = async () => {
      setBootstrapping(true);
      await fetchCandidates();
      if (!cancel) setBootstrapping(false);
    };

    load();
    return () => { cancel = true };
  }, [user, authLoading, fetchCandidates]);

  // ===== HANDLERS =====

  const handleAddCandidate = async () => {
    await fetchCandidates();
    toast.success('Candidate added');
  };

  const handleEditCandidate = (updated: Candidate) => {
    setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedCandidate(updated);
  };

  const handleDeleteCandidate = async (id: string) => {
    await api.delete(`/candidates/${id}`);
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedCandidate(null);
  };

  const handleNextStage = (id: string) => {
    const order: Candidate['stage'][] = ['applied','screening','interview','final','hired'];

    setCandidates(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const i = order.indexOf(c.stage);
        if (i >= 0 && i < order.length - 1) {
          return { ...c, stage: order[i + 1] };
        }
        return c;
      })
    );
  };

  const handleRejectCandidate = (id: string, reason: string) => {
    setCandidates(prev =>
      prev.map(c => c.id === id
        ? { ...c, stage: 'rejected', archiveReason: reason }
        : c
      )
    );
  };

  const handleDropOffCandidate = (id: string, reason: string) => {
    setCandidates(prev =>
      prev.map(c => c.id === id
        ? { ...c, stage: 'drop-off', archiveReason: reason }
        : c
      )
    );
  };

  const handleRestoreCandidate = (id: string) => {
    setCandidates(prev =>
      prev.map(c => c.id === id
        ? { ...c, stage: 'applied' }
        : c
      )
    );
  };

  return {
    candidates,
    selectedCandidate,
    setSelectedCandidate,
    bootstrapping,

    handleAddCandidate,
    handleEditCandidate,
    handleDeleteCandidate,
    handleNextStage,
    handleRejectCandidate,
    handleDropOffCandidate,
    handleRestoreCandidate,
  };
};