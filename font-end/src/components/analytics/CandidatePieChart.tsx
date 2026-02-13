import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { Candidate } from '../../lib/mock-data';

const STAGE_COLORS: Record<string, string> = {
  applied: '#60A5FA',
  screening: '#FCD34D',
  interview: '#C084FC',
  final: '#FB923C',
  hired: '#34D399',
  default: '#A5B4FC'
};
const STAGE_ORDER = ['applied', 'screening', 'interview', 'final', 'hired'] as const;
const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  final: 'Final Round',
  hired: 'Hired'
};

interface CandidatePieChartProps {
  data: Candidate[];
  height?: number;
}

export function CandidatePieChart({ data, height = 300 }: CandidatePieChartProps) {
  const chartData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }
    const counts = new Map<string, number>();
    data.forEach((candidate) => {
      const key = (candidate.stage ?? 'applied').toLowerCase();
      if (key === 'drop-off' || key === 'dropoff' || key === 'dropped') {
        return;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const ordered = STAGE_ORDER.filter(stage => counts.has(stage));
    const otherStages = Array.from(counts.keys()).filter(stage => !STAGE_ORDER.includes(stage as typeof STAGE_ORDER[number]));
    if (otherStages.length) {
      ordered.push(...otherStages);
    }
    return ordered.map((stage) => {
      const value = counts.get(stage) ?? 0;
      const label = STAGE_LABELS[stage] ?? stage;
      return {
        stage,
        name: label,
        value
      };
    });
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            innerRadius={40}
            label={({ name, value }) => `${name} ${value}`}
          >
            {chartData.map((entry) => {
              const colorKey = (entry.stage ?? '').toLowerCase();
              const fill = STAGE_COLORS[colorKey] ?? STAGE_COLORS.default;
              return <Cell key={entry.stage ?? entry.name} fill={fill} />;
            })}
          </Pie>
          <Tooltip
            formatter={(value: number, _name, payload) => {
              return [`${value} candidates`, 'Candidates'];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
