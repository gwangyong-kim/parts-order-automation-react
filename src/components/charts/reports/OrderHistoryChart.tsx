"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatCurrency, formatMonthLabel } from "./chartUtils";

interface MonthlyTrendItem {
  month: string;
  count: number;
  amount: number;
}

interface OrderHistoryChartProps {
  data: MonthlyTrendItem[];
}

export default function OrderHistoryChart({ data }: OrderHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        발주 이력 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    monthLabel: formatMonthLabel(item.month),
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            dataKey="monthLabel"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => {
              const numValue = Number(value) || 0;
              return [
                name === "amount" ? formatCurrency(numValue) : `${numValue}건`,
                name === "amount" ? "금액" : "건수",
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill="url(#colorAmount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
