import { useState, useEffect, useMemo, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Briefcase, AlertTriangle, TrendingUp, Clock, Target, TrendingDown } from 'lucide-react';
import api from '../lib/api';

const STAGE_COLORS = {
  applied: { bg: '#E3F2FD', text: '#2196F3', name: 'Applied' },
  screening: { bg: '#FFF9C4', text: '#FBC02D', name: 'Screening' },
  interview: { bg: '#F3E5F5', text: '#7E57C2', name: 'Interview' },
  final: { bg: '#FFE0B2', text: '#FB8C00', name: 'Final Round' },
  hired: { bg: '#E8F5E9', text: '#43A047', name: 'Hired' }
};

type StageKey = keyof typeof STAGE_COLORS;
type StageDelay = {
  stage: StageKey;
  averageDays: number;
  sampleSize: number;
  longestCandidateId?: string;
  longestCandidateName?: string;
  longestDurationDays: number;
};

const BOTTLENECK_STAGES: StageKey[] = ['applied', 'screening', 'interview', 'final'];

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
  if (stage.includes('applied') || stage === 'applied') return 'applied';
  if (stage === 'screening') return 'screening';
  if (stage === 'final') return 'final';
  if (stage === 'interview') return 'interview';
  if (stage === 'hired') return 'hired';
  return null;
};

const getCandidateCreatedDate = (candidate: any) =>
  parseDateValue(
    candidate?.created_at ??
    candidate?.createdAt ??
    candidate?.applied_at ??
    candidate?.appliedAt ??
    candidate?.appliedDate
  );

const getCandidateHiredDate = (candidate: any) =>
  parseDateValue(
    candidate?.hired_at ??
    candidate?.hiredAt ??
    candidate?.hiredDate ??
    candidate?.hireDate
  );

const getStageEnteredDate = (candidate: any) =>
  parseDateValue(
    candidate?.stage_entered_at ??
    candidate?.stageEnteredAt ??
    candidate?.updated_at ??
    candidate?.updatedAt ??
    candidate?.created_at ??
    candidate?.createdAt
  );

const formatDaysLabel = (value?: number | null) => `${Math.max(0, Math.round(value ?? 0))} days`;


type DashboardMetrics = {
  bottleneck: { state: string | null; avg_days: number };
  hired_this_month: number;
  avg_time_to_hire: number;
  drop_off_rate: number;
};

export function Dashboard() {
  const { user, loading } = useAuth();// <--- 2. ดึงข้อมูล User มาใช้
  const navigate = useNavigate();


  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [applicationsByMonth, setApplicationsByMonth] = useState<Array<{ month: string; applications: number; hires: number }>>([]);
  const [jobsCount, setJobsCount] = useState<number>(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const monthlyCandidateStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastYear = lastMonthDate.getFullYear();

    let currentMonthCount = 0;
    let lastMonthCount = 0;
    let hiredThisMonthCount = 0;

    candidates.forEach((candidate) => {
      const createdDate = getCandidateCreatedDate(candidate);
      if (createdDate) {
        if (isSameMonth(createdDate, currentYear, currentMonth)) {
          currentMonthCount += 1;
        } else if (isSameMonth(createdDate, lastYear, lastMonth)) {
          lastMonthCount += 1;
        }
      }

      const stage = normalizeStage(candidate?.current_state ?? candidate?.stage ?? candidate?.status);
      if (stage === 'hired') {
        const hiredDate = getCandidateHiredDate(candidate);
        if (hiredDate && isSameMonth(hiredDate, currentYear, currentMonth)) {
          hiredThisMonthCount += 1;
        }
      }
    });

    let candidateTrendValue: number | null = null;
    let candidateTrendLabel: string | undefined;

    if (lastMonthCount > 0) {
      candidateTrendValue = ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100;
    } else if (currentMonthCount > 0) {
      candidateTrendLabel = 'No data from last month';
    } else {
      candidateTrendLabel = 'Awaiting new candidates';
    }

    return {
      currentMonthCandidateCount: currentMonthCount,
      candidateTrendValue,
      candidateTrendLabel,
      hiredThisMonthCount,
    };
  }, [candidates]);

  const {
    currentMonthCandidateCount,
    candidateTrendValue,
    candidateTrendLabel,
    hiredThisMonthCount,
  } = monthlyCandidateStats;

  const stageDelays = useMemo<StageDelay[]>(() => {
    const stageStats = BOTTLENECK_STAGES.reduce((acc, stage) => {
      acc[stage] = {
        durations: [] as number[],
        longestDuration: -1,
        longestCandidateId: undefined as string | undefined,
        longestCandidateName: undefined as string | undefined,
      };
      return acc;
    }, {} as Record<StageKey, {
      durations: number[];
      longestDuration: number;
      longestCandidateId?: string;
      longestCandidateName?: string;
    }>);

    const now = new Date();

    candidates.forEach((candidate) => {
      const stageKey = normalizeStage(candidate?.current_state ?? candidate?.stage ?? candidate?.status);
      if (!stageKey || !stageStats[stageKey]) return;

      const enteredAt = getStageEnteredDate(candidate) ?? getCandidateCreatedDate(candidate);
      if (!enteredAt) return;

      const duration = diffInDays(now, enteredAt);
      const stats = stageStats[stageKey];
      stats.durations.push(duration);

      if (duration > stats.longestDuration) {
        stats.longestDuration = duration;
        stats.longestCandidateId = candidate?.id ?? candidate?._id ?? undefined;
        stats.longestCandidateName = candidate?.name ?? 'Candidate';
      }
    });

    return BOTTLENECK_STAGES.map((stage) => {
      const stats = stageStats[stage];
      const samples = stats?.durations ?? [];
      const averageDays = samples.length
        ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)
        : 0;

      return {
        stage,
        averageDays,
        sampleSize: samples.length,
        longestCandidateId: stats?.longestCandidateId,
        longestCandidateName: stats?.longestCandidateName,
        longestDurationDays: Math.max(0, stats?.longestDuration ?? 0),
      };
    });
  }, [candidates]);

  const defaultStage: StageDelay = {
    stage: BOTTLENECK_STAGES[0],
    averageDays: 0,
    sampleSize: 0,
    longestCandidateId: undefined,
    longestCandidateName: undefined,
    longestDurationDays: 0,
  };

  useEffect(() => {
    if (isHovered || stageDelays.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => (stageDelays.length ? (prev + 1) % stageDelays.length : 0));
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovered, stageDelays.length]);

  useEffect(() => {
    if (currentStageIndex >= stageDelays.length) {
      setCurrentStageIndex(0);
    }
  }, [currentStageIndex, stageDelays.length]);

  const currentStageData = stageDelays[currentStageIndex] ?? stageDelays[0] ?? defaultStage;
  const currentStageKey = currentStageData?.stage ?? defaultStage.stage;
  const currentStageColor = STAGE_COLORS[currentStageKey];
  const currentBottleneckDays = currentStageData?.longestDurationDays ?? 0;
  const bottleneckReason = currentBottleneckDays > 0 ? 'Potential Delay' : 'On Track';
  const stageSampleLabel = currentStageData?.sampleSize
    ? `Based on ${currentStageData.sampleSize} candidate${currentStageData.sampleSize === 1 ? '' : 's'}`
    : 'Awaiting candidates in this stage';
  const canNavigateToBottleneck = Boolean(currentStageData?.longestCandidateId);

  const handleBottleneckIconClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!currentStageData?.longestCandidateId) return;
    navigate(`/candidate/${currentStageData.longestCandidateId}`);
  };

  const activeCandidates = candidates.filter((c) => {
    const stage = c.current_state || c.stage || 'applied';
    return stage !== 'rejected' && stage !== 'dropped' && stage !== 'drop-off' && stage !== 'hired';
  });
  const recentCandidates = candidates.slice(0, 5);

  // Fetch data from backend
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
          setCandidates(Array.isArray(candidatesRes.data) ? candidatesRes.data : []);
          setJobsCount(Array.isArray(jobsRes.data) ? jobsRes.data.length : 0);
          setApplicationsByMonth(Array.isArray(analyticsRes.data?.applicationsByMonth) ? analyticsRes.data.applicationsByMonth : []);
        }
      } catch (e) {
        console.error('Failed fetching dashboard data', e);
      }
    };
    fetchAll();
    return () => { ignore = true; };
  }, []);

  const MetricCard = ({ title, value, description, icon: Icon, trendValue, trendLabel }: {
    title: string;
    value: string | number;
    description: string;
    icon: any;
    trendValue?: number | null;
    trendLabel?: string;
  }) => {
    const hasTrendValue = typeof trendValue === 'number' && !Number.isNaN(trendValue);
    const trendDirection = hasTrendValue ? (trendValue! > 0 ? 'positive' : trendValue! < 0 ? 'negative' : 'neutral') : null;
    const TrendIconComponent = trendDirection === 'negative' ? TrendingDown : TrendingUp;
    const trendColor = trendDirection === 'negative'
      ? 'text-red-600'
      : trendDirection === 'neutral'
        ? 'text-muted-foreground'
        : 'text-green-600';
    const formattedTrend = hasTrendValue
      ? `${trendValue! > 0 ? '+' : trendValue! < 0 ? '' : ''}${trendValue!.toFixed(1)}% vs last month`
      : null;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {hasTrendValue && formattedTrend && (
            <div className="flex items-center pt-1">
              <TrendIconComponent className={`h-3 w-3 mr-1 ${trendColor}`} />
              <span className={`text-xs ${trendColor}`}>{formattedTrend}</span>
            </div>
          )}
          {!hasTrendValue && trendLabel && (
            <div className="flex items-center pt-1">
              <span className="text-xs text-muted-foreground">{trendLabel}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const BottleneckCard = () => (
    <Card
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Bottleneck</CardTitle>
        <button
          type="button"
          onClick={handleBottleneckIconClick}
          disabled={!canNavigateToBottleneck}
          className={`rounded-full p-1 text-muted-foreground transition-colors ${
            canNavigateToBottleneck ? 'hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : 'opacity-50 cursor-not-allowed'
          }`}
          aria-label={canNavigateToBottleneck
            ? `View ${currentStageData?.longestCandidateName ?? 'candidate'} in ${currentStageColor.name}`
            : 'No bottleneck candidate available'}
        >
          <AlertTriangle className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-destructive">
              {formatDaysLabel(currentBottleneckDays)}
            </div>
            <p className="text-xs text-muted-foreground">{bottleneckReason}</p>
            <div className="mt-2">
              <Badge
                variant="outline"
                style={{
                  backgroundColor: currentStageColor.bg,
                  color: currentStageColor.text,
                  borderColor: currentStageColor.text
                }}
              >
                {currentStageColor.name}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{stageSampleLabel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">

      {/* 3. เพิ่ม Header แสดงชื่อ User และ Role ตรงนี้ครับ */}
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="text-muted-foreground">
          Welcome back, <span className="font-semibold text-primary">{user?.email}</span>
          {user?.role && (
            <Badge variant="outline" className="ml-2 capitalize">
              {user.role}
            </Badge>
          )}
        </div>
      </div>
      {/* ------------------------------------------------ */}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Candidates"
          value={currentMonthCandidateCount}
          description="Created this month"
          icon={Users}
          trendValue={candidateTrendValue}
          trendLabel={candidateTrendLabel}
        />
        <MetricCard
          title="Active Positions"
          value={jobsCount}
          description="Open roles"
          icon={Briefcase}
        />
        <BottleneckCard />
        <MetricCard
          title="Hired This Month"
          value={hiredThisMonthCount}
          description="New team members"
          icon={Target}
        />
        <MetricCard
          title="Avg. Time to Hire"
          value={formatDaysLabel(metrics?.avg_time_to_hire)}
          description="From application to offer"
          icon={Clock}
        />
        <MetricCard
          title="Drop-off Rate"
          value={`${(metrics?.drop_off_rate ?? 0).toFixed(1)}%`}
          description="Current drop-off"
          icon={TrendingDown}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Applications Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Applications & Hires</CardTitle>
            <CardDescription>Monthly trends over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={applicationsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="applications" fill="#3b82f6" name="Applications" />
                <Bar dataKey="hires" fill="#10b981" name="Hires" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Candidates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Candidates</CardTitle>
          <CardDescription>Latest applications and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentCandidates.map((candidate) => {
              const stage = candidate.current_state || candidate.stage || 'applied';
              const name = candidate.name || 'Unknown';
              const matchScore = typeof candidate.matchScore === 'number'
                ? candidate.matchScore
                : (candidate.resumeAnalysis?.match?.score ?? 0);
              return (
                <div key={candidate.id} className="flex items-center justify-between p-4 border border-border/40 rounded-lg">
                  <div>
                    <h4 className="font-medium">{name}</h4>
                    <p className="text-sm text-muted-foreground">{candidate.position}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">Match Score</span>
                        <Badge variant="secondary">{matchScore}%</Badge>
                      </div>
                      <Progress value={matchScore} className="w-20 h-2 mt-1" />
                    </div>
                    <Badge
                      variant={stage === 'hired' ? 'default' : 'secondary'}
                      className={`capitalize ${
                        stage === 'hired' ? 'bg-green-100 text-green-800'
                        : stage === 'interview' ? 'bg-purple-100 text-purple-800'
                        : stage === 'final' ? 'bg-orange-100 text-orange-800'
                        : stage === 'screening' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {stage}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}