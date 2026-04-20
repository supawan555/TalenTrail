import { DashboardUI } from '../components/new-compo/Dashboard';
import { useDashboard } from '../hooks/useDashboard';

export function Dashboard() {
  const {
    user,
    applicationsByMonth,
    jobsCount,
    currentMonthCandidateCount,
    hiredThisMonthCount,
    avgTimeToHire,
    dropOffRate,
    currentStageData,
    currentStageColor,
    currentBottleneckDays,
    bottleneckReason,
    stageSampleLabel,
    canNavigateToBottleneck,
    handleBottleneckClick,
    handleBottleneckKeyDown,
    setIsHovered,
    recentCandidates,
  } = useDashboard();

  return (
    <DashboardUI
      userEmail={user?.email}
      userRole={user?.role}
      currentMonthCount={currentMonthCandidateCount}
      candidateTrendValue={null}
      candidateTrendLabel="No trend data"
      hiredThisMonthCount={hiredThisMonthCount}
      avgTimeToHire={avgTimeToHire}
      dropOffRate={dropOffRate}
      jobsCount={jobsCount}
      currentStageData={currentStageData}
      currentStageColor={currentStageColor}
      currentBottleneckDays={currentBottleneckDays}
      bottleneckReason={bottleneckReason}
      stageSampleLabel={stageSampleLabel}
      canNavigateToBottleneck={canNavigateToBottleneck}
      onBottleneckMouseEnter={() => setIsHovered(true)}
      onBottleneckMouseLeave={() => setIsHovered(false)}
      onBottleneckClick={handleBottleneckClick}
      onBottleneckKeyDown={handleBottleneckKeyDown}
      applicationsByMonth={applicationsByMonth}
      recentCandidates={recentCandidates}
    />
  );
}
