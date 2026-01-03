import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Briefcase, AlertTriangle, TrendingUp, Clock, Target, TrendingDown, Pause, Play } from 'lucide-react';
import api from '../lib/api';

const STAGE_COLORS = {
  applied: { bg: '#E3F2FD', text: '#2196F3', name: 'Applied' },
  screening: { bg: '#FFF9C4', text: '#FBC02D', name: 'Screening' },
  interview: { bg: '#F3E5F5', text: '#7E57C2', name: 'Interview' },
  final: { bg: '#FFE0B2', text: '#FB8C00', name: 'Final Round' },
  hired: { bg: '#E8F5E9', text: '#43A047', name: 'Hired' }
};

const STAGES = ['applied', 'screening', 'interview', 'final', 'hired'] as const;

type DashboardMetrics = {
  bottleneck: { state: string | null; avg_days: number };
  hired_this_month: number;
  avg_time_to_hire: number;
  drop_off_rate: number;
};

export function Dashboard() {
  const { user } = useAuth(); // <--- 2. ดึงข้อมูล User มาใช้

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [applicationsByMonth, setApplicationsByMonth] = useState<Array<{ month: string; applications: number; hires: number }>>([]);
  const [jobsCount, setJobsCount] = useState<number>(0);

  const activeCandidates = candidates.filter((c) => {
    const stage = c.current_state || c.stage || 'applied';
    return stage !== 'rejected' && stage !== 'dropped' && stage !== 'drop-off' && stage !== 'hired';
  });
  const recentCandidates = candidates.slice(0, 5);
  
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate through stages
  useEffect(() => {
    if (isPaused || isHovered) return;

    const interval = setInterval(() => {
      setCurrentStageIndex((prev: number) => (prev + 1) % STAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isPaused, isHovered]);

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

  // Get current stage data
  const currentStage = metrics?.bottleneck?.state || 'applied';
  const currentStageColor = STAGE_COLORS[currentStage as keyof typeof STAGE_COLORS] || STAGE_COLORS['applied'];
  const currentBottleneck = metrics?.bottleneck?.avg_days || 0;
  const bottleneckReason = currentBottleneck > 0 ? 'Potential Delay' : 'On Track';

  const MetricCard = ({ title, value, description, icon: Icon, trend }: {
    title: string;
    value: string | number;
    description: string;
    icon: any;
    trend?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="flex items-center pt-1">
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            <span className="text-xs text-green-600">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const BottleneckCard = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Bottleneck</CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold" style={{ color: '#EF4444' }}>
              {currentBottleneck.toFixed(1)} days
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
          value={candidates.length}
          description="Active in pipeline"
          icon={Users}
          trend="+12% from last month"
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
          value={metrics?.hired_this_month ?? 0}
          description="New team members"
          icon={Target}
          trend="+25% from last month"
        />
        <MetricCard
          title="Avg. Time to Hire"
          value={`${(metrics?.avg_time_to_hire ?? 0).toFixed(1)} days`}
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
              const initials = String(name).split(' ').map((n: string) => n[0]).join('');
              const matchScore = typeof candidate.matchScore === 'number' ? candidate.matchScore : (candidate.resumeAnalysis?.match?.score ?? 0);
              return (
              <div key={candidate.id} className="flex items-center justify-between p-4 border border-border/40 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                    <span className="text-white font-medium">{initials}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{name}</h4>
                    <p className="text-sm text-muted-foreground">{candidate.position}</p>
                  </div>
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
                      stage === 'hired' ? 'bg-green-100 text-green-800' :
                      stage === 'interview' ? 'bg-purple-100 text-purple-800' :
                      stage === 'final' ? 'bg-orange-100 text-orange-800' :
                      stage === 'screening' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {stage}
                  </Badge>
                </div>
              </div>
            );})}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}