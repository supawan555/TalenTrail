// hooks/usePipeline.ts

import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { Candidate } from '../lib/mock-data';
import { calculateAverageStageDuration } from '../utils/pipelineAnalytics';

const ACTIVE_PIPELINE_STAGES = [
    { id: 'applied', name: 'Applied', color: 'bg-blue-50 border-blue-200' },
    { id: 'screening', name: 'Screening', color: 'bg-yellow-50 border-yellow-200' },
    { id: 'interview', name: 'Interview', color: 'bg-purple-50 border-purple-200' },
    { id: 'final', name: 'Final Round', color: 'bg-orange-50 border-orange-200' },
    { id: 'hired', name: 'Hired', color: 'bg-green-50 border-green-200' }
] as const;

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
                const exited = toIsoString(entry?.exited_at ?? entry?.exitedAt);
                if (!enteredAt) {
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

                    const parsedMatchScore = typeof c.matchScore === 'number'
                        ? c.matchScore
                        : Number.parseFloat(c.matchScore ?? '0');

                    return {
                        id: c.id ?? c._id ?? String(Date.now()),
                        name: c.name ?? 'Unknown',
                        email: c.email ?? '',
                        phone: c.phone ?? '',
                        avatar: c.avatar ?? '',
                        position: c.position ?? (c.role ?? 'Unknown'),
                        department: normalizeDepartment(c.department),
                        experience: c.experience ?? 'mid',
                        location: c.location ?? 'Remote',
                        matchScore: Number.isFinite(parsedMatchScore) ? parsedMatchScore : 0,
                        stage: normalizeStage(c.stage ?? c.current_state),
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

    const departmentOptions = useMemo(() => {
        const set = new Set<string>();
        activeCandidates.forEach(c => c.department && set.add(c.department));
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
        return ACTIVE_PIPELINE_STAGES.map(stage => ({
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
        departmentOptions,
        filteredCandidates,
        filteredStages,
        stageDurationData,
    };
};