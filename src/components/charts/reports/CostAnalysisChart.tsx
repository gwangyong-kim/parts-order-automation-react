"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatCurrency } from "./chartUtils";

interface CategoryValue {
  category: string;
  partCount: number;
  inventoryValue: number;
}

interface CostAnalysisChartProps {
  data: CategoryValue[];
}

export default function CostAnalysisChart({ data }: CostAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        비용 분석 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .map((item) => ({
      name: item.category || "미분류",
      value: item.inventoryValue,
      partCount: item.partCount,
    }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatCurrency(Number(value) || 0), "재고 가치"]}
            labelFormatter={(label) => `카테고리: ${label}`}
          />
          <Bar
            dataKey="value"
            fill={CHART_COLORS.success}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
