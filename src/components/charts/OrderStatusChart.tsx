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

interface OrderStatusData {
  status: string;
  count: number;
  color: string;
}

interface OrderStatusChartProps {
  data: OrderStatusData[];
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "작성중",
  SUBMITTED: "제출됨",
  APPROVED: "승인됨",
  ORDERED: "발주됨",
  RECEIVED: "입고완료",
  CANCELLED: "취소됨",
};

export default function OrderStatusChart({ data }: OrderStatusChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    name: STATUS_LABELS[item.status] || item.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formattedData} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" horizontal={false} />
        <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
        <YAxis
          type="category"
          dataKey="name"
          stroke="var(--text-muted)"
          fontSize={12}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px",
            backdropFilter: "blur(20px)",
          }}
          formatter={(value) => [`${value ?? 0}건`, "발주 수"]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
