// hooks/usePipeline.ts

import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { pipelineStages, Candidate } from '../lib/mock-data';
import { calculateAverageStageDuration } from '../utils/pipelineAnalytics';

export const usePipeline = (propCandidates?: Candidate[]) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [positionFilter, setPositionFilter] = useState('all');
    const [allCandidates, setAllCandidates] = useState<Candidate[]>(propCandidates || []);
    const [expandedStage, setExpandedStage] = useState<string | null>(null);

    const toIsoString = (value?: string | null | Date): string | undefined => {
        if (!value) return undefined;
        try {
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) return undefined;
            return date.toISOString();
        } catch {
            return undefined;
        }
    };

    const normalizeStageHistory = (history: any): Candidate['stageHistory'] => {
        if (!Array.isArray(history)) {
            return [];
        }
        return history
            .map((entry) => {
                const stage = entry?.stage ?? entry?.state;
                const enteredAt = toIsoString(entry?.entered_at ?? entry?.enteredAt);
                const exited = toIsoString(entry?.exited_at ?? entry?.exitedAt);
                if (!stage || !enteredAt) {
                    return null;
                }
                return {
                    stage,
                    enteredAt,
                    exitedAt: exited ?? null
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    };

    // ===== fetch =====
    useEffect(() => {
        if (Array.isArray(propCandidates)) {
            setAllCandidates(propCandidates);
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const res = await api.get('/candidates/');
                const data = res.data;

                if (cancelled) return;

                const normalized: Candidate[] = (data || []).map((c: any) => {
                    const appliedIso =
                        toIsoString(c.applied_at ?? c.created_at) ?? new Date().toISOString();

                    return {
                        id: c.id ?? c._id ?? String(Date.now()),
                        name: c.name ?? 'Unknown',
                        email: c.email ?? 'candidate@example.com',
                        phone: c.phone ?? '+1 234 567 8900',
                        avatar: c.avatar ?? '',
                        position: c.position ?? (c.role ?? 'Unknown'),
                        department: c.department ?? 'Engineering',
                        experience: c.experience ?? 'mid',
                        location: c.location ?? 'Remote',
                        matchScore: typeof c.matchScore === 'number' ? c.matchScore : 0,
                        stage: c.stage ?? c.current_state ?? 'applied',
                        appliedDate: appliedIso,
                        appliedAt: appliedIso,
                        screeningAt: toIsoString(c.screening_at ?? c.screeningAt),
                        interviewAt: toIsoString(c.interview_at ?? c.interviewAt),
                        finalAt: toIsoString(c.final_at ?? c.finalAt),
                        hiredAt: toIsoString(c.hired_at ?? c.hiredAt),
                        rejectedAt: toIsoString(c.rejected_at ?? c.rejectedAt),
                        droppedAt: toIsoString(c.dropped_at ?? c.dropoff_at ?? c.droppedAt),
                        archivedDate: toIsoString(c.archived_date ?? c.archivedDate),
                        skills: Array.isArray(c.skills) ? c.skills : [],
                        salary: c.salary ?? '',
                        availability: c.availability ?? '',
                        resumeUrl: c.resume_url ?? c.resumeUrl ?? '',
                        resumeAnalysis: c.resumeAnalysis ?? null,
                        notes: Array.isArray(c.notes) ? c.notes : [],
                        stageHistory: normalizeStageHistory(c.stageHistory ?? c.state_history)
                    } as Candidate;
                });

                setAllCandidates(normalized);
            } catch {
                setAllCandidates([]);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [propCandidates]);

    // ===== computed =====
    const activeCandidates = useMemo(() => {
        return allCandidates.filter(c =>
            c.stage !== 'rejected' &&
            c.stage !== 'drop-off' &&
            c.stage !== 'archived'
        );
    }, [allCandidates]);

    const positionOptions = useMemo(() => {
        const set = new Set<string>();
        activeCandidates.forEach(c => c.position && set.add(c.position));
        return Array.from(set);
    }, [activeCandidates]);

    const filteredCandidates = useMemo(() => {
        return activeCandidates.filter(c => {
            const matchesSearch =
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.position.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesDept =
                departmentFilter === 'all' || c.department === departmentFilter;

            const matchesPos =
                positionFilter === 'all' || c.position === positionFilter;

            return matchesSearch && matchesDept && matchesPos;
        });
    }, [activeCandidates, searchQuery, departmentFilter, positionFilter]);

    const filteredStages = useMemo(() => {
        return pipelineStages.map(stage => ({
            ...stage,
            candidates: filteredCandidates.filter(c => c.stage === stage.id)
        }));
    }, [filteredCandidates]);

    const stageDurationData = useMemo(() => {
        return calculateAverageStageDuration(filteredCandidates);
    }, [filteredCandidates]);

    return {
        searchQuery,
        setSearchQuery,
        departmentFilter,
        setDepartmentFilter,
        positionFilter,
        setPositionFilter,
        expandedStage,
        setExpandedStage,

        positionOptions,
        filteredCandidates,
        filteredStages,
        stageDurationData,
    };
};