// hooks/useAnalytics.ts

import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';

type TimeRange = 'week' | '1month' | '3months' | '6months' | '1year';
type ChartDimension = 'department' | 'position';
type UpcomingJoiner = {
    candidateId: string;
    name: string;
    position: string;
    joinDate: Date;
    daysUntil: number;
} | null;

const toValidDate = (value: unknown): Date | null => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const useAnalytics = () => {
    const [timeRange, setTimeRange] = useState<TimeRange>('6months');
    const [chartDimension, setChartDimension] = useState<ChartDimension>('department');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ===== fetch =====
    useEffect(() => {
        const loadCandidates = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await api.get('/candidates/');
                setCandidates(Array.isArray(res?.data) ? res.data : []);
            } catch {
                setError('Failed to load analytics data');
                setCandidates([]);
            } finally {
                setIsLoading(false);
            }
        };
        loadCandidates();
    }, []);

    // ===== toggle =====
    const toggleChartDimension = () => {
        setChartDimension(prev => prev === 'department' ? 'position' : 'department');
    };

    // ===== filtered =====
    const filteredCandidates = useMemo(() => {
        const now = new Date();
        const cutoffDate = new Date();

        switch (timeRange) {
            case 'week': cutoffDate.setDate(now.getDate() - 7); break;
            case '1month': cutoffDate.setMonth(now.getMonth() - 1); break;
            case '3months': cutoffDate.setMonth(now.getMonth() - 3); break;
            case '6months': cutoffDate.setMonth(now.getMonth() - 6); break;
            case '1year': cutoffDate.setFullYear(now.getFullYear() - 1); break;
        }

        return candidates.filter(c => {
            const appliedDate = new Date(c?.applied_at || c?.created_at || new Date());
            return appliedDate >= cutoffDate;
        });
    }, [candidates, timeRange]);

    // ===== key metrics =====
    const keyMetrics = useMemo(() => {
        const totalApplications = filteredCandidates.length;

        const hiredCandidates = filteredCandidates.filter(c => {
            const stage = (c?.stage || c?.current_state || '').toLowerCase();
            const status = (c?.status || '').toLowerCase();
            return stage === 'hired' || (stage === 'archived' && status === 'hired');
        });

        let avgTimeToHire = 0;
        if (hiredCandidates.length > 0) {
            const totalDays = hiredCandidates.reduce((sum, c) => {
                const applied = new Date(c?.applied_at || c?.created_at || new Date());
                const hired = new Date(c?.hired_at || new Date());
                return sum + Math.max(0, Math.floor((hired.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24)));
            }, 0);
            avgTimeToHire = Math.round(totalDays / hiredCandidates.length);
        }

        const successRate = totalApplications > 0
            ? ((hiredCandidates.length / totalApplications) * 100).toFixed(1)
            : '0.0';

        return { totalApplications, avgTimeToHire, successRate };
    }, [filteredCandidates]);

    // ===== upcoming =====
    const upcomingJoiner = useMemo<UpcomingJoiner>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return candidates
            .map(c => {
                const stage = (c?.stage || c?.current_state || '').toLowerCase();
                const status = (c?.status || '').toLowerCase();
                const isHired = stage === 'hired' || (stage === 'archived' && status === 'hired');
                if (!isHired) return null;

                const start = toValidDate(
                    c?.availableStartDate ??
                    c?.available_start_date ??
                    c?.startDate ??
                    c?.start_date
                );
                if (!start) return null;

                const days = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                // Keep only upcoming or today; past dates should not be shown as upcoming.
                if (days < 0) return null;

                return {
                    candidateId: String(c.id ?? c._id ?? ''),
                    name: String(c.name ?? 'Unknown'),
                    position: String(c.position ?? 'Unknown'),
                    joinDate: start,
                    daysUntil: days,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .sort((a, b) => a.daysUntil - b.daysUntil)[0] || null;
    }, [candidates]);

    // ===== UI =====
    // Calculate conversion funnel including archived hired candidates
    const conversionFunnelData = useMemo(() => {
        if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
            console.log('[Analytics] No filtered candidates for funnel');
            return [
                { stage: 'Applied', count: 0, percentage: 100, fill: '#3b82f6' },
                { stage: 'Screening', count: 0, percentage: 0, fill: '#eab308' },
                { stage: 'Interview', count: 0, percentage: 0, fill: '#8b5cf6' },
                { stage: 'Final Round', count: 0, percentage: 0, fill: '#f59e0b' },
                { stage: 'Hired', count: 0, percentage: 0, fill: '#10b981' }
            ];
        }

        const stages = ['applied', 'screening', 'interview', 'final', 'hired'];
        const counts = stages.map(stage => {
            const count = filteredCandidates.filter(c => {
                const candidateStage = (c?.stage || c?.current_state || '').toLowerCase();
                return candidateStage === stage;
            }).length;
            return { stage, count };
        });

        // For 'hired', include both active hired and archived hired candidates
        const hiredCount = filteredCandidates.filter(c => {
            const candidateStage = (c?.stage || c?.current_state || '').toLowerCase();
            const candidateStatus = (c?.status || '').toLowerCase();
            return candidateStage === 'hired' || (candidateStage === 'archived' && candidateStatus === 'hired');
        }).length;

        counts[4].count = hiredCount;

        const totalApplied = filteredCandidates.length;
        const funnelData = [
            { stage: 'Applied', count: totalApplied, percentage: 100, fill: '#3b82f6' },
            { stage: 'Screening', count: counts[1].count, percentage: totalApplied > 0 ? (counts[1].count / totalApplied) * 100 : 0, fill: '#eab308' },
            { stage: 'Interview', count: counts[2].count, percentage: totalApplied > 0 ? (counts[2].count / totalApplied) * 100 : 0, fill: '#8b5cf6' },
            { stage: 'Final Round', count: counts[3].count, percentage: totalApplied > 0 ? (counts[3].count / totalApplied) * 100 : 0, fill: '#f59e0b' },
            { stage: 'Hired', count: hiredCount, percentage: totalApplied > 0 ? (hiredCount / totalApplied) * 100 : 0, fill: '#10b981' }
        ];

        console.log('[Analytics] Conversion funnel data:', funnelData);
        return funnelData;
    }, [filteredCandidates]);

    // Calculate time to hire by dimension
    const timeToHireData = useMemo(() => {
        if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
            console.log('[Analytics] No filtered candidates for time to hire');
            return [];
        }

        const hiredCandidates = filteredCandidates.filter(c => {
            const candidateStage = (c?.stage || c?.current_state || '').toLowerCase();
            const candidateStatus = (c?.status || '').toLowerCase();
            return candidateStage === 'hired' || (candidateStage === 'archived' && candidateStatus === 'hired');
        });

        console.log('[Analytics] Hired candidates for time to hire:', hiredCandidates.length);

        const grouped: Record<string, { totalDays: number; count: number }> = {};

        hiredCandidates.forEach(c => {
            const dimension = chartDimension === 'department' ? (c?.department || 'Unknown') : (c?.position || 'Unknown');
            const appliedDate = new Date(c?.applied_at || c?.appliedDate || c?.created_at || new Date());
            const hiredDate = new Date(c?.hired_at || c?.hiredDate || new Date());
            const days = Math.max(0, Math.floor((hiredDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)));

            if (!grouped[dimension]) {
                grouped[dimension] = { totalDays: 0, count: 0 };
            }
            grouped[dimension].totalDays += days;
            grouped[dimension].count += 1;
        });

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
        const data = Object.entries(grouped)
            .filter(([_, stats]) => stats.count > 0)
            .map(([dimension, stats], index) => ({
                [chartDimension]: dimension,
                avgDays: Math.round(stats.totalDays / stats.count),
                fill: colors[index % colors.length]
            }))
            .filter(item => item.avgDays > 0);

        console.log('[Analytics] Time to hire data:', data);
        return data;
    }, [filteredCandidates, chartDimension]);

    // Calculate applications by dimension
    const applicationsByDimensionData = useMemo(() => {
        if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
            console.log('[Analytics] No filtered candidates for applications by dimension');
            return [];
        }

        const grouped: Record<string, number> = {};
        filteredCandidates.forEach(c => {
            const dimension = chartDimension === 'department' ? (c?.department || 'Unknown') : (c?.position || 'Unknown');
            grouped[dimension] = (grouped[dimension] || 0) + 1;
        });

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
        const data = Object.entries(grouped)
            .filter(([_, count]) => count > 0)
            .map(([dimension, count], index) => ({
                [chartDimension]: dimension,
                applications: count,
                fill: colors[index % colors.length]
            }));

        console.log('[Analytics] Applications by dimension data:', data);
        return data;
    }, [filteredCandidates, chartDimension]);

    return {
        timeRange,
        setTimeRange,
        chartDimension,
        toggleChartDimension,

        isLoading,
        error,

        keyMetrics,
        upcomingJoiner,

        // IMPORTANT (UI ใช้)
        filteredCandidates,
        conversionFunnelData,
        timeToHireData,
        applicationsByDimensionData,
    };
};