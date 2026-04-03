import { useDashboard } from '../hooks/useDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export function Dashboard() {
    const {
        user,
        jobsCount,
        recentCandidates,
        currentMonthCandidateCount,
    } = useDashboard();

    return (
        <div className="p-6 space-y-6">

            {/* Header */}
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

            {/* METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Total Candidates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {currentMonthCandidateCount}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Active Jobs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {jobsCount}
                    </CardContent>
                </Card>
            </div>

            {/* RECENT */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Candidates</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentCandidates.map((c) => (
                        <div key={c.id}>{c.name}</div>
                    ))}
                </CardContent>
            </Card>

        </div>
    );
}