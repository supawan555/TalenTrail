// components/Dashboard.ui.tsx

import { KeyboardEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Briefcase, AlertTriangle, Target, Clock, TrendingDown, TrendingUp } from 'lucide-react'

export type StageDelay = {
  stage: string
  averageDays: number
  longestDays: number
  longestCandidateId?: string
  longestCandidateName?: string
}

export const STAGE_COLORS = {
  applied: { bg: '#E3F2FD', text: '#2196F3', name: 'Applied' },
  screening: { bg: '#FFF9C4', text: '#FBC02D', name: 'Screening' },
  interview: { bg: '#F3E5F5', text: '#7E57C2', name: 'Interview' },
  final: { bg: '#FFE0B2', text: '#FB8C00', name: 'Final Round' },
  hired: { bg: '#E8F5E9', text: '#43A047', name: 'Hired' },
} as const

const formatDaysLabel = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${Math.round(value)}d`
}

// ===== SUB-COMPONENTS =====

interface MetricCardProps {
  title: string
  value: string | number
  description: string
  icon: any
  trendValue?: number | null
  trendLabel?: string
}

export function MetricCard({ title, value, description, icon: Icon, trendValue, trendLabel }: MetricCardProps) {
  const hasTrendValue = typeof trendValue === 'number' && !Number.isNaN(trendValue)
  const trendDirection = hasTrendValue
    ? trendValue! > 0 ? 'positive' : trendValue! < 0 ? 'negative' : 'neutral'
    : null
  const TrendIconComponent = trendDirection === 'negative' ? TrendingDown : TrendingUp
  const trendColor =
    trendDirection === 'negative' ? 'text-red-600' :
    trendDirection === 'neutral'  ? 'text-muted-foreground' : 'text-green-600'
  const formattedTrend = hasTrendValue
    ? `${trendValue! > 0 ? '+' : ''}${trendValue!.toFixed(1)}% vs last month`
    : null

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
  )
}

interface BottleneckCardProps {
  currentStageData: StageDelay
  currentStageColor: typeof STAGE_COLORS[keyof typeof STAGE_COLORS]
  currentBottleneckDays: number
  bottleneckReason: string
  stageSampleLabel: string
  canNavigateToBottleneck: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}

export function BottleneckCard({
  currentStageColor,
  currentBottleneckDays,
  bottleneckReason,
  stageSampleLabel,
  canNavigateToBottleneck,
  currentStageData,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onKeyDown,
}: BottleneckCardProps) {
  return (
    <Card
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={canNavigateToBottleneck ? onClick : undefined}
      onKeyDown={onKeyDown}
      role={canNavigateToBottleneck ? 'button' : undefined}
      tabIndex={canNavigateToBottleneck ? 0 : -1}
      className={canNavigateToBottleneck
        ? 'cursor-pointer transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
        : undefined}
      aria-label={canNavigateToBottleneck
        ? `View ${currentStageData?.longestCandidateName ?? 'candidate'} in ${currentStageColor.name}`
        : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Bottleneck</CardTitle>
        <AlertTriangle className={`h-4 w-4 ${canNavigateToBottleneck ? 'text-muted-foreground' : 'opacity-50 text-muted-foreground'}`} />
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
                  borderColor: currentStageColor.text,
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
  )
}

// ===== MAIN UI =====

interface DashboardUIProps {
  // User
  userEmail?: string
  userRole?: string

  // Metrics
  currentMonthCount: number
  candidateTrendValue: number | null
  candidateTrendLabel?: string
  hiredThisMonthCount: number
  avgTimeToHire?: number | null
  dropOffRate?: number
  jobsCount: number

  // Bottleneck
  currentStageData: StageDelay
  currentStageColor: typeof STAGE_COLORS[keyof typeof STAGE_COLORS]
  currentBottleneckDays: number
  bottleneckReason: string
  stageSampleLabel: string
  canNavigateToBottleneck: boolean
  onBottleneckMouseEnter: () => void
  onBottleneckMouseLeave: () => void
  onBottleneckClick: () => void
  onBottleneckKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void

  // Chart
  applicationsByMonth: Array<{ month: string; applications: number; hires: number }>

  // Recent candidates
  recentCandidates: any[]
}

export function DashboardUI({
  userEmail,
  userRole,
  currentMonthCount,
  candidateTrendValue,
  candidateTrendLabel,
  hiredThisMonthCount,
  avgTimeToHire,
  dropOffRate,
  jobsCount,
  currentStageData,
  currentStageColor,
  currentBottleneckDays,
  bottleneckReason,
  stageSampleLabel,
  canNavigateToBottleneck,
  onBottleneckMouseEnter,
  onBottleneckMouseLeave,
  onBottleneckClick,
  onBottleneckKeyDown,
  applicationsByMonth,
  recentCandidates,
}: DashboardUIProps) {
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="text-muted-foreground">
          Welcome back,{' '}
          <span className="font-semibold text-primary">{userEmail}</span>
          {userRole && (
            <Badge variant="outline" className="ml-2 capitalize">{userRole}</Badge>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total Candidates"
          value={currentMonthCount}
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
        <BottleneckCard
          currentStageData={currentStageData}
          currentStageColor={currentStageColor}
          currentBottleneckDays={currentBottleneckDays}
          bottleneckReason={bottleneckReason}
          stageSampleLabel={stageSampleLabel}
          canNavigateToBottleneck={canNavigateToBottleneck}
          onMouseEnter={onBottleneckMouseEnter}
          onMouseLeave={onBottleneckMouseLeave}
          onClick={onBottleneckClick}
          onKeyDown={onBottleneckKeyDown}
        />
        <MetricCard
          title="Hired This Month"
          value={hiredThisMonthCount}
          description="New team members"
          icon={Target}
        />
        <MetricCard
          title="Avg. Time to Hire"
          value={formatDaysLabel(avgTimeToHire)}
          description="From application to offer"
          icon={Clock}
        />
        <MetricCard
          title="Drop-off Rate"
          value={`${(dropOffRate ?? 0).toFixed(1)}%`}
          description="Current drop-off"
          icon={TrendingDown}
        />
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 gap-6">
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
              const stage = candidate.current_state || candidate.stage || 'applied'
              const matchScore = typeof candidate.matchScore === 'number'
                ? candidate.matchScore
                : (candidate.resumeAnalysis?.match?.score ?? 0)
              return (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between p-4 border border-border/40 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">{candidate.name || 'Unknown'}</h4>
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
                        stage === 'hired'     ? 'bg-green-100 text-green-800' :
                        stage === 'interview' ? 'bg-purple-100 text-purple-800' :
                        stage === 'final'     ? 'bg-orange-100 text-orange-800' :
                        stage === 'screening' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {stage}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}