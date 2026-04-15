// components/Analytics.ui.tsx

import { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { Users, Clock, Target, Filter, CalendarDays } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type TimeRange = 'week' | '1month' | '3months' | '6months' | '1year';
type ChartDimension = 'department' | 'position';
type UpcomingJoiner = {
  candidateId: string;
  name: string;
  position: string;
  joinDate: Date;
  daysUntil: number;
} | null;

interface AnalyticsUIProps {
  // Controls
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  chartDimension: ChartDimension;
  onToggleChartDimension: () => void;

  // Metrics
  keyMetrics: {
    totalApplications: number;
    avgTimeToHire: number;
    successRate: string;
  };
  upcomingJoiner: UpcomingJoiner;

  // Chart data
  conversionFunnelData: any[];
  timeToHireData: any[];
  applicationsByDimensionData: any[];
}

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

export function AnalyticsUI({
  timeRange,
  onTimeRangeChange,
  chartDimension,
  onToggleChartDimension,
  keyMetrics,
  upcomingJoiner,
  conversionFunnelData,
  timeToHireData,
  applicationsByDimensionData,
}: AnalyticsUIProps) {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Insights into your recruitment performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select
            value={timeRange}
            onValueChange={(value: string) => onTimeRangeChange(value as TimeRange)}
          >
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
          <Button variant="outline" size="sm" onClick={onToggleChartDimension}>
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
          className={upcomingJoiner
            ? 'cursor-pointer transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
            : undefined}
          aria-label={upcomingJoiner ? `View ${upcomingJoiner.name}'s profile` : undefined}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time to Join</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingJoiner ? (
              <>
                <div className="text-2xl font-bold text-primary">
                  Start in {upcomingJoiner.daysUntil} days
                </div>
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
          <CardTitle>
            Average Time to Hire by {chartDimension === 'department' ? 'Department' : 'Position'}
          </CardTitle>
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
          <CardTitle>
            Applications by {chartDimension === 'department' ? 'Department' : 'Position'}
          </CardTitle>
          <CardDescription>
            Distribution across {chartDimension === 'department' ? 'departments' : 'positions'}
          </CardDescription>
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