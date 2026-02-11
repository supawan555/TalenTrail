import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const STAGE_COLORS: Record<string, string> = {
  applied: '#60A5FA',
  screening: '#FCD34D',
  interview: '#C084FC',
  'final round': '#FB923C',
  hired: '#34D399',
  default: '#A5B4FC'
};

interface StageDurationBarChartProps {
  data: { stage: string; avgDays: number }[];
  height?: number;
}

export function StageDurationBarChart({ data, height = 300 }: StageDurationBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="stage" tickLine={false} axisLine={false} interval={0} tickMargin={10} />
          <YAxis tickLine={false} axisLine={false} label={{ value: 'Avg Days', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value: number) => `${value} days`} />
          <Bar dataKey="avgDays" radius={[6, 6, 0, 0]}>
            {data.map((entry) => {
              const colorKey = entry.stage.toLowerCase();
              const fill = STAGE_COLORS[colorKey] ?? STAGE_COLORS.default;
              return <Cell key={entry.stage} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
