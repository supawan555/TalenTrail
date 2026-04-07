// hooks/useApp.ts

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { Candidate } from '../lib/mock-data';

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

    return {
      id: raw?.id ?? crypto.randomUUID(),
      name: raw?.name ?? '',
      email: raw?.email ?? '',
      phone: raw?.phone ?? '',
      position: raw?.position ?? '',
      department: raw?.department ?? '',
      experience: raw?.experience ?? '',
      location: raw?.location ?? '',
      matchScore: raw?.matchScore ?? 0,
      stage: raw?.stage ?? 'applied',
      appliedDate: new Date().toISOString().split('T')[0],
      appliedAt: new Date().toISOString(),
      skills: raw?.skills ?? [],
      notes: raw?.notes ?? [],
      salary: '',
      availability: ''
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