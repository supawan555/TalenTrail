import { useAuth } from '../context/AuthContext';
import { useState, useMemo, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell
} from 'recharts';
import { Users, Clock, Target, Filter, CalendarDays } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import api from '../lib/api';

// Custom tick component for multi-line labels
const CustomTick = (props: any) => {
  const { x, y, payload } = props;
  const words = payload.value.split(' ');
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={12} dy={24} textAnchor="middle" fill="#666" fontSize={14}>
        {words.map((word: string, index: number) => (
          <tspan x={0} dy={index === 0 ? 0 : 16} key={index}>
            {word}
          </tspan>
        ))}
      </text>
    </g>
  );
};

type TimeRange = 'week' | '1month' | '3months' | '6months' | '1year';
type ChartDimension = 'department' | 'position';
type UpcomingJoiner = {
  candidateId: string;
  name: string;
  position: string;
  joinDate: Date;
  daysUntil: number;
};

export function Analytics() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('6months');
  const [chartDimension, setChartDimension] = useState<ChartDimension>('department');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load candidates from backend API
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.get('/candidates/');
        console.log('📊 [Analytics] API Response:', res);
        console.log('📊 [Analytics] Candidates data:', res?.data);
        console.log('📊 [Analytics] Total candidates:', res?.data?.length || 0);
        
        const candidatesData = Array.isArray(res?.data) ? res.data : [];
        console.log('📊 [Analytics] Processed candidates array:', candidatesData);
        setCandidates(candidatesData);
      } catch (err) {
        console.error('❌ [Analytics] Failed to load candidates:', err);
        setError('Failed to load analytics data');
        setCandidates([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCandidates();
  }, []);

  // Toggle chart dimension
  const toggleChartDimension = () => {
    setChartDimension(prev => prev === 'department' ? 'position' : 'department');
  };

  // Filter candidates by time range
  const filteredCandidates = useMemo(() => {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.log('📊 [Analytics] No candidates to filter');
      return [];
    }

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '1month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3months':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const filtered = candidates.filter(c => {
      const appliedDate = new Date(c?.applied_at || c?.appliedDate || c?.created_at || new Date());
      return appliedDate >= cutoffDate;
    });

    console.log('📊 [Analytics] Filtered candidates:', filtered.length, 'out of', candidates.length);
    return filtered;
  }, [candidates, timeRange]);

  // Calculate conversion funnel including archived hired candidates
  const conversionFunnelData = useMemo(() => {
    if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
      console.log('📊 [Analytics] No filtered candidates for funnel');
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

    console.log('📊 [Analytics] Conversion funnel data:', funnelData);
    return funnelData;
  }, [filteredCandidates]);

  // Calculate time to hire by dimension
  const timeToHireData = useMemo(() => {
    if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
      console.log('📊 [Analytics] No filtered candidates for time to hire');
      return [];
    }

    const hiredCandidates = filteredCandidates.filter(c => {
      const candidateStage = (c?.stage || c?.current_state || '').toLowerCase();
      const candidateStatus = (c?.status || '').toLowerCase();
      return candidateStage === 'hired' || (candidateStage === 'archived' && candidateStatus === 'hired');
    });

    console.log('📊 [Analytics] Hired candidates for time to hire:', hiredCandidates.length);

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

    console.log('📊 [Analytics] Time to hire data:', data);
    return data;
  }, [filteredCandidates, chartDimension]);

  // Calculate applications by dimension
  const applicationsByDimensionData = useMemo(() => {
    if (!Array.isArray(filteredCandidates) || filteredCandidates.length === 0) {
      console.log('📊 [Analytics] No filtered candidates for applications by dimension');
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

    console.log('📊 [Analytics] Applications by dimension data:', data);
    return data;
  }, [filteredCandidates, chartDimension]);

  // Calculate key metrics
  const keyMetrics = useMemo(() => {
    const totalApplications = filteredCandidates.length;
    
    const hiredCandidates = filteredCandidates.filter(c => {
      const candidateStage = (c?.stage || c?.current_state || '').toLowerCase();
      const candidateStatus = (c?.status || '').toLowerCase();
      return candidateStage === 'hired' || (candidateStage === 'archived' && candidateStatus === 'hired');
    });

    let avgTimeToHire = 0;
    if (hiredCandidates.length > 0) {
      const totalDays = hiredCandidates.reduce((sum, c) => {
        const appliedDate = new Date(c?.applied_at || c?.appliedDate || c?.created_at || new Date());
        const hiredDate = new Date(c?.hired_at || c?.hiredDate || new Date());
        const days = Math.max(0, Math.floor((hiredDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)));
        return sum + days;
      }, 0);
      avgTimeToHire = Math.round(totalDays / hiredCandidates.length);
    }

    const successRate = totalApplications > 0 ? ((hiredCandidates.length / totalApplications) * 100).toFixed(1) : '0.0';

    console.log('📊 [Analytics] Key metrics:', { totalApplications, avgTimeToHire, successRate, hiredCount: hiredCandidates.length });
    
    return { totalApplications, avgTimeToHire, successRate };
  }, [filteredCandidates]);

  // Role-based UI Guard (Management only)
  if (loading) return null;

  if (!user || !['management','ADMIN'].includes(user.role)) {
    return null; 
  }
  const upcomingJoiner = useMemo<UpcomingJoiner | null>(() => {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayInMs = 1000 * 60 * 60 * 24;

    const entries = candidates
      .map((candidate): UpcomingJoiner | null => {
        const candidateId = candidate?.id ?? candidate?._id ?? null;
        if (!candidateId) return null;
        const stage = (candidate?.stage || candidate?.current_state || '').toLowerCase();
        const status = (candidate?.status || '').toLowerCase();
        const isHired = stage === 'hired' || (stage === 'archived' && status === 'hired');
        if (!isHired) return null;

        const rawStartDate =
          candidate?.availableStartDate ??
          candidate?.available_start_date ??
          candidate?.startDate ??
          candidate?.start_date;
        if (!rawStartDate) return null;

        const startDate = new Date(rawStartDate);
        if (Number.isNaN(startDate.getTime())) return null;
        startDate.setHours(0, 0, 0, 0);
        if (startDate < today) return null;

        const daysUntil = Math.max(0, Math.ceil((startDate.getTime() - today.getTime()) / dayInMs));
        return {
          candidateId,
          name: candidate?.name ?? 'Candidate',
          position: candidate?.position ?? candidate?.role ?? 'Role pending',
          joinDate: startDate,
          daysUntil,
        };
      })
      .filter((entry): entry is UpcomingJoiner => Boolean(entry))
      .sort((a, b) => a.joinDate.getTime() - b.joinDate.getTime());

    return entries[0] ?? null;
  }, [candidates]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">Loading analytics data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Insights into your recruitment performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={(value: string) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={toggleChartDimension}>
            <Filter className="w-4 h-4 mr-2" />
            {chartDimension === 'department' ? 'By Department' : 'By Position'}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keyMetrics.totalApplications}</div>
            <p className="text-xs text-muted-foreground">In selected time range</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time to Hire</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keyMetrics.avgTimeToHire} days</div>
            <p className="text-xs text-muted-foreground">Average hiring duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keyMetrics.successRate}%</div>
            <p className="text-xs text-muted-foreground">Hired / Total applications</p>
          </CardContent>
        </Card>
        <Card
          onClick={upcomingJoiner ? () => navigate(`/candidate/${upcomingJoiner.candidateId}`) : undefined}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (!upcomingJoiner) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate(`/candidate/${upcomingJoiner.candidateId}`);
            }
          }}
          role={upcomingJoiner ? 'button' : undefined}
          tabIndex={upcomingJoiner ? 0 : -1}
          className={upcomingJoiner ? 'cursor-pointer transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : undefined}
          aria-label={upcomingJoiner ? `View ${upcomingJoiner.name}'s profile` : undefined}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Time to Join</CardTitle>
            </div>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingJoiner ? (
              <>
                <div className="text-2xl font-bold text-primary">Start in {upcomingJoiner.daysUntil} days</div>
                <p className="mt-3 text-sm font-semibold">{upcomingJoiner.name}</p>
                <p className="text-sm text-muted-foreground">{upcomingJoiner.position}</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-primary">--</div>
                <p className="mt-3 text-sm text-muted-foreground">No upcoming start dates</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Track candidates through the recruitment pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={conversionFunnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {conversionFunnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Time to Hire */}
      <Card>
        <CardHeader>
          <CardTitle>Average Time to Hire by {chartDimension === 'department' ? 'Department' : 'Position'}</CardTitle>
          <CardDescription>Days from application to hire</CardDescription>
        </CardHeader>
        <CardContent>
          {timeToHireData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={timeToHireData} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={chartDimension} 
                  tick={<CustomTick />}
                  interval={0}
                  height={60}
                  minTickGap={10}
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgDays" radius={[4, 4, 0, 0]}>
                  {timeToHireData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              No hired candidates in selected time range
            </div>
          )}
        </CardContent>
      </Card>

      {/* Applications by Dimension */}
      <Card>
        <CardHeader>
          <CardTitle>Applications by {chartDimension === 'department' ? 'Department' : 'Position'}</CardTitle>
          <CardDescription>Distribution across {chartDimension === 'department' ? 'departments' : 'positions'}</CardDescription>
        </CardHeader>
        <CardContent>
          {applicationsByDimensionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={applicationsByDimensionData} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={chartDimension} 
                  tick={<CustomTick />}
                  interval={0}
                  height={60}
                  minTickGap={10}
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="applications" radius={[4, 4, 0, 0]}>
                  {applicationsByDimensionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              No applications in selected time range
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}