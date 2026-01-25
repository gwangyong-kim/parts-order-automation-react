"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  TOOLTIP_STYLE,
  formatNumber,
} from "./chartUtils";

interface StatusItem {
  status: string;
  count: number;
  totalAmount?: number;
}

interface OrderStatusChartProps {
  data: StatusItem[];
}

export default function OrderStatusChart({ data }: OrderStatusChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        발주 상태 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: ORDER_STATUS_LABELS[item.status] || item.status,
    fill: ORDER_STATUS_COLORS[item.status] || "#94a3b8",
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
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            width={80}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatNumber(Number(value) || 0), "건수"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
