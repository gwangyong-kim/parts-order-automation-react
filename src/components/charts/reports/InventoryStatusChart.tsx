"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { COLOR_PALETTE, TOOLTIP_STYLE, formatNumber } from "./chartUtils";

interface CategoryStat {
  category: string;
  partCount: number;
  totalQty: number;
  totalValue: number;
}

interface InventoryStatusChartProps {
  data: CategoryStat[];
}

export default function InventoryStatusChart({ data }: InventoryStatusChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">
        카테고리 데이터가 없습니다.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.category || "미분류",
    value: item.totalQty,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
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
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLOR_PALETTE[index % COLOR_PALETTE.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatNumber(Number(value) || 0), "수량"]}
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
    </div>
  );
}
