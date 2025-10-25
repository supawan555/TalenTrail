import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Briefcase, AlertTriangle, TrendingUp, Clock, Target, TrendingDown, Pause, Play } from 'lucide-react';
import { dashboardMetrics, analyticsData, mockCandidates } from '../lib/mock-data';

const STAGE_COLORS = {
  applied: { bg: '#E3F2FD', text: '#2196F3', name: 'Applied' },
  screening: { bg: '#FFF9C4', text: '#FBC02D', name: 'Screening' },
  interview: { bg: '#F3E5F5', text: '#7E57C2', name: 'Interview' },
  final: { bg: '#FFE0B2', text: '#FB8C00', name: 'Final Round' },
  hired: { bg: '#E8F5E9', text: '#43A047', name: 'Hired' }
};

const STAGES = ['applied', 'screening', 'interview', 'final', 'hired'] as const;

export function Dashboard() {
  // Filter out archived candidates
  const activeCandidates = mockCandidates.filter(c => c.stage !== 'rejected' && c.stage !== 'drop-off');
  const recentCandidates = activeCandidates.slice(0, 5);
  
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

  // Calculate bottleneck for a specific stage
  const calculateBottleneck = (stage: typeof STAGES[number]) => {
    const today = new Date();
    const stageCandidates = activeCandidates.filter(c => c.stage === stage);
    const delayThresholdDays = 7;
    
    let totalDelayedDays = 0;
    stageCandidates.forEach(candidate => {
      const appliedDate = new Date(candidate.appliedDate);
      const daysInProcess = Math.floor((today.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Estimate days in current stage based on stage position
      const stageIndex = STAGES.indexOf(stage);
      const estimatedDaysBeforeStage = stageIndex * 5; // ~5 days per previous stage
      const estimatedDaysInStage = Math.max(0, daysInProcess - estimatedDaysBeforeStage);
      
      if (estimatedDaysInStage > delayThresholdDays) {
        totalDelayedDays += (estimatedDaysInStage - delayThresholdDays);
      }
    });
    
    return totalDelayedDays;
  };

  // Calculate drop-off rate for Interview stage
  const candidatesInInterview = activeCandidates.filter(c => c.stage === 'interview').length;
  const candidatesPassedInterview = activeCandidates.filter(c => 
    c.stage === 'final' || c.stage === 'hired'
  ).length;
  const totalReachedInterview = candidatesInInterview + candidatesPassedInterview;
  const dropoffRate = totalReachedInterview > 0 
    ? (candidatesInInterview / totalReachedInterview) * 100 
    : 0;

  // Get current stage data
  const currentStage = STAGES[currentStageIndex];
  const currentBottleneck = calculateBottleneck(currentStage);
  const currentStageColor = STAGE_COLORS[currentStage];
  const bottleneckReason = currentBottleneck > 0 ? 'Awaiting Feedback' : 'On Track';

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
        {/* Carousel container */}
        <div
          className="w-full overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className="flex"
            style={{
              width: `${STAGES.length * 100}%`,
              transform: `translateX(-${currentStageIndex * (100 / STAGES.length)}%)`,
              transition: 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {STAGES.map((stage) => {
              const stageBottleneck = calculateBottleneck(stage);
              const stageColor = STAGE_COLORS[stage];
              const stageReason = stageBottleneck > 0 ? 'Awaiting Feedback' : 'On Track';

              return (
                <div key={stage} className="p-0" style={{ minWidth: `${100 / STAGES.length}%` }}>
                  <div className="p-0">
                    <div className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                      {stageBottleneck} days
                    </div>
                    <p className="text-xs text-muted-foreground">{stageReason}</p>
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: stageColor.bg,
                          color: stageColor.text,
                          borderColor: stageColor.text
                        }}
                      >
                        {stageColor.name}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1">
            {STAGES.map((stage, index) => (
              <button
                key={stage}
                onClick={() => setCurrentStageIndex(index)}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: index === currentStageIndex
                    ? STAGE_COLORS[STAGES[index]].text
                    : '#D1D5DB',
                  opacity: index === currentStageIndex ? 1 : 0.5
                }}
                aria-label={`Go to ${STAGE_COLORS[stage].name}`}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-6 w-6 p-0"
          >
            {isPaused ? (
              <Play className="h-3 w-3" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Candidates"
          value={dashboardMetrics.totalCandidates}
          description="Active in pipeline"
          icon={Users}
          trend="+12% from last month"
        />
        <MetricCard
          title="Active Positions"
          value={dashboardMetrics.activePositions}
          description="Open roles"
          icon={Briefcase}
        />
        <BottleneckCard />
        <MetricCard
          title="Hired This Month"
          value={dashboardMetrics.hiredThisMonth}
          description="New team members"
          icon={Target}
          trend="+25% from last month"
        />
        <MetricCard
          title="Avg. Time to Hire"
          value={`${dashboardMetrics.averageTimeToHire} days`}
          description="From application to offer"
          icon={Clock}
        />
        <MetricCard
          title="Drop-off Rate"
          value={`${dropoffRate.toFixed(1)}%`}
          description="Interview stage drop-off"
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
              <BarChart data={analyticsData.applicationsByMonth}>
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
            {recentCandidates.map((candidate) => (
              <div key={candidate.id} className="flex items-center justify-between p-4 border border-border/40 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {candidate.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium">{candidate.name}</h4>
                    <p className="text-sm text-muted-foreground">{candidate.position}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">Match Score</span>
                      <Badge variant="secondary">{candidate.matchScore}%</Badge>
                    </div>
                    <Progress value={candidate.matchScore} className="w-20 h-2 mt-1" />
                  </div>
                  <Badge 
                    variant={candidate.stage === 'hired' ? 'default' : 'secondary'}
                    className={`capitalize ${
                      candidate.stage === 'hired' ? 'bg-green-100 text-green-800' :
                      candidate.stage === 'interview' ? 'bg-purple-100 text-purple-800' :
                      candidate.stage === 'final' ? 'bg-orange-100 text-orange-800' :
                      candidate.stage === 'screening' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {candidate.stage}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}