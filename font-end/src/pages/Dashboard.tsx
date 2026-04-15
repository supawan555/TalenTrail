import { DashboardUI } from '../components/new-compo/Dashboard';
import { useDashboard } from '../hooks/useDashboard';

export function Dashboard() {
  const {
    user,
    candidates,
    applicationsByMonth,
    jobsCount,
    currentMonthCandidateCount,
    recentCandidates,
  } = useDashboard();

  const fallbackStageColor = { bg: '#E3F2FD', text: '#2196F3', name: 'Applied' };
  const fallbackStageData = {
    stage: 'applied',
    averageDays: 0,
    longestDays: 0,
    longestCandidateId: undefined,
    longestCandidateName: undefined,
  };

  return (
    <DashboardUI
      userEmail={user?.email}
      userRole={user?.role}
      currentMonthCount={currentMonthCandidateCount}
      candidateTrendValue={null}
      candidateTrendLabel="No trend data"
      hiredThisMonthCount={candidates.filter((c: any) => c.stage === 'hired').length}
      avgTimeToHire={null}
      dropOffRate={0}
      jobsCount={jobsCount}
      currentStageData={fallbackStageData as any}
      currentStageColor={fallbackStageColor as any}
      currentBottleneckDays={0}
      bottleneckReason="No bottleneck data"
      stageSampleLabel="Insufficient data"
      canNavigateToBottleneck={false}
      onBottleneckMouseEnter={() => {}}
      onBottleneckMouseLeave={() => {}}
      onBottleneckClick={() => {}}
      onBottleneckKeyDown={() => {}}
      applicationsByMonth={applicationsByMonth}
      recentCandidates={recentCandidates}
    />
  );
}
