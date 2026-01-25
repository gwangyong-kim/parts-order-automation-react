"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import { CHART_COLORS, formatPercent } from "./chartUtils";

interface AuditSummaryChartProps {
  accuracyRate: number;
}

function getAccuracyColor(rate: number): string {
  if (rate >= 95) return CHART_COLORS.success;
  if (rate >= 85) return CHART_COLORS.warning;
  return CHART_COLORS.danger;
}

export default function AuditSummaryChart({ accuracyRate }: AuditSummaryChartProps) {
  const rate = Math.min(100, Math.max(0, accuracyRate));
  const color = getAccuracyColor(rate);

  const data = [
    {
      name: "정확도",
      value: rate,
      fill: color,
    },
  ];

  return (
    <div className="w-full">
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            barSize={20}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: "var(--glass-border)" }}
              dataKey="value"
              cornerRadius={10}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold"
            style={{ color }}
          >
            {formatPercent(rate)}
          </span>
          <span className="text-sm text-[var(--text-muted)] mt-1">
            {rate >= 95 ? "우수" : rate >= 85 ? "양호" : "개선 필요"}
          </span>
        </div>
      </div>
    </div>
  );
}
