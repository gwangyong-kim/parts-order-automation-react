"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface CategoryData {
  name: string;
  value: number;
}

interface CategoryDistributionChartProps {
  data: CategoryData[];
}

const COLORS = [
  "#6366f1", // primary/indigo
  "#22c55e", // success/green
  "#f59e0b", // warning/amber
  "#ef4444", // danger/red
  "#3b82f6", // info/blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
];

export default function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px",
            backdropFilter: "blur(20px)",
          }}
          formatter={(value) => [`${value ?? 0}개`, "파츠 수"]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => (
            <span style={{ color: "var(--text-secondary)" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
