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
import { CHART_COLORS, TOOLTIP_STYLE, formatPercent } from "./chartUtils";

interface SupplierStat {
  supplierId: number;
  supplierName: string;
  totalOrders: number;
  completedOrders: number;
  onTimeDeliveryRate: number;
  totalAmount: number;
}

interface SupplierPerformanceChartProps {
  data: SupplierStat[];
}

function getDeliveryRateColor(rate: number): string {
  if (rate >= 90) return CHART_COLORS.success;
  if (rate >= 70) return CHART_COLORS.warning;
  return CHART_COLORS.danger;
}

export default function SupplierPerformanceChart({ data }: SupplierPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        공급업체 성과 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data
    .filter((item) => item.completedOrders > 0)
    .sort((a, b) => b.onTimeDeliveryRate - a.onTimeDeliveryRate)
    .slice(0, 10)
    .map((item) => ({
      name: item.supplierName.length > 12
        ? item.supplierName.substring(0, 12) + "..."
        : item.supplierName,
      fullName: item.supplierName,
      rate: item.onTimeDeliveryRate,
      totalOrders: item.totalOrders,
      completedOrders: item.completedOrders,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        완료된 발주가 있는 공급업체가 없습니다.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--glass-border)" }}
            width={100}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatPercent(Number(value) || 0), "납기 준수율"]}
            labelFormatter={(_, payload) => {
              if (payload && payload[0]) {
                const data = payload[0].payload;
                return `${data.fullName} (완료: ${data.completedOrders}건)`;
              }
              return "";
            }}
          />
          <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getDeliveryRateColor(entry.rate)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
