import { AnalyticsUI } from '../components/new-compo/Analytics';
import { useAnalytics } from '../hooks/useAnalytics';

export const Analytics = () => {
  const {
    timeRange,
    setTimeRange,
    chartDimension,
    toggleChartDimension,
    isLoading,
    error,
    keyMetrics,
    upcomingJoiner,
    conversionFunnelData,
    timeToHireData,
    applicationsByDimensionData,
  } = useAnalytics();

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
    <AnalyticsUI
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange as any}
      chartDimension={chartDimension}
      onToggleChartDimension={toggleChartDimension}
      keyMetrics={keyMetrics}
      upcomingJoiner={upcomingJoiner}
      conversionFunnelData={conversionFunnelData}
      timeToHireData={timeToHireData}
      applicationsByDimensionData={applicationsByDimensionData}
    />
  );
};
