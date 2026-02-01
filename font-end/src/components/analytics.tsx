import { useAuth } from '../context/AuthContext';
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
import { analyticsData } from '../lib/mock-data';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function Analytics() {
  const { user, loading } = useAuth();

  // Role-based UI Guard (Management only)
  if (loading) return null;

  if (!user || !['management','ADMIN'].includes(user.role)) {
    return null; 
  }
  const mockUpcomingJoiner = {
    name: 'Alex Morgan',
    position: 'Product Marketing Manager',
    joinDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
  };
  const joinDate = new Date(mockUpcomingJoiner.joinDate);
  const daysUntilJoin = Math.max(
    0,
    Math.ceil((joinDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const conversionFunnelData = [
    { stage: 'Applied', count: 245, percentage: 100, fill: '#3b82f6' }, // Blue
    { stage: 'Screening', count: 147, percentage: 60, fill: '#eab308' }, // Yellow
    { stage: 'Interview', count: 89, percentage: 36, fill: '#8b5cf6' }, // Purple
    { stage: 'Final Round', count: 34, percentage: 14, fill: '#f59e0b' }, // Orange
    { stage: 'Hired', count: 21, percentage: 8.5, fill: '#10b981' } // Green
  ];

  const timeToHireData = [
    { department: 'Engineering', avgDays: 22, fill: '#3b82f6' },
    { department: 'Design', avgDays: 18, fill: '#10b981' },
    { department: 'Product', avgDays: 25, fill: '#f59e0b' },
    { department: 'Marketing', avgDays: 15, fill: '#8b5cf6' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Insights into your recruitment performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select defaultValue="6months">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
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
            <div className="text-2xl font-bold">301</div>
            <p className="text-xs text-muted-foreground">+15% from last period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time to Hire</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20 days</div>
            <p className="text-xs text-muted-foreground">-2 days from last period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5%</div>
            <p className="text-xs text-muted-foreground">+1.2% from last period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium">Time to Join</CardTitle>
            </div>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{daysUntilJoin} days</div>
            <p className="mt-3 text-sm font-semibold">{mockUpcomingJoiner.name}</p>
            <p className="text-sm text-muted-foreground">{mockUpcomingJoiner.position}</p>
          </CardContent>
        </Card>
      </div>


      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Candidate progression through pipeline stages</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={conversionFunnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count">
                {conversionFunnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Time to Hire by Department */}
      <Card>
        <CardHeader>
          <CardTitle>Time to Hire by Department</CardTitle>
          <CardDescription>Average days from application to offer</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={timeToHireData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgDays" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Applications by Department */}
      <Card>
        <CardHeader>
          <CardTitle>Applications by Department</CardTitle>
          <CardDescription>Distribution of current applications across departments</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart 
              data={analyticsData.positionTypes}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="position" 
                tick={{ fontSize: 14 }}
                tickLine={{ stroke: '#9ca3af' }}
              />
              <YAxis 
                tick={{ fontSize: 14 }}
                tickLine={{ stroke: '#9ca3af' }}
                label={{ value: 'Number of Applications', angle: -90, position: 'insideLeft', style: { fontSize: 14 } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                formatter={(value: number, name: string) => [value, 'Applications']}
              />
              <Bar 
                dataKey="count" 
                radius={[8, 8, 0, 0]}
                label={{ 
                  position: 'top', 
                  fontSize: 14,
                  fontWeight: 600,
                  fill: '#374151'
                }}
              >
                {analyticsData.positionTypes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {analyticsData.positionTypes.map((item, index) => {
              const total = analyticsData.positionTypes.reduce((sum, i) => sum + i.count, 0);
              const percentage = ((item.count / total) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                  <div 
                    className="w-4 h-4 rounded" 
                    style={{ backgroundColor: item.fill }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.position}</p>
                    <p className="text-xs text-muted-foreground">{item.count} ({percentage}%)</p>
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