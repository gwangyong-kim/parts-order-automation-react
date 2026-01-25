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
import { CHART_COLORS, TOOLTIP_STYLE, formatNumber } from "./chartUtils";

interface TopProduct {
  productName: string;
  count: number;
  quantity: number;
}

interface SalesAnalysisChartProps {
  data: TopProduct[];
}

export default function SalesAnalysisChart({ data }: SalesAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        수주 분석 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data.slice(0, 10).map((item) => ({
    name: item.productName.length > 15
      ? item.productName.substring(0, 15) + "..."
      : item.productName,
    fullName: item.productName,
    quantity: item.quantity,
    count: item.count,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            type="number"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            tickFormatter={formatNumber}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            width={120}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatNumber(Number(value) || 0), "수량"]}
            labelFormatter={(_, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullName;
              }
              return "";
            }}
          />
          <Bar
            dataKey="quantity"
            fill={CHART_COLORS.info}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
