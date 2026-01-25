"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE, formatNumber, formatDateLabel } from "./chartUtils";

interface DailyTrendItem {
  date: string;
  inbound: number;
  outbound: number;
}

interface InventoryMovementChartProps {
  data: DailyTrendItem[];
}

export default function InventoryMovementChart({ data }: InventoryMovementChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        입출고 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      dateLabel: formatDateLabel(item.date),
    }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.danger} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.danger} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            tickFormatter={formatNumber}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [
              formatNumber(Number(value) || 0),
              name === "inbound" ? "입고" : "출고",
            ]}
            labelFormatter={(label) => `날짜: ${label}`}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: "var(--text-secondary)" }}>
                {value === "inbound" ? "입고" : "출고"}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="inbound"
            stroke={CHART_COLORS.success}
            strokeWidth={2}
            fill="url(#colorInbound)"
          />
          <Area
            type="monotone"
            dataKey="outbound"
            stroke={CHART_COLORS.danger}
            strokeWidth={2}
            fill="url(#colorOutbound)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
