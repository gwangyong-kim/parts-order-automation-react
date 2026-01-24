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

interface MonthlyData {
  month: string;
  inbound: number;
  outbound: number;
}

interface MonthlyTransactionChartProps {
  data: MonthlyData[];
}

export default function MonthlyTransactionChart({ data }: MonthlyTransactionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
        <XAxis
          dataKey="month"
          stroke="var(--text-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px",
            backdropFilter: "blur(20px)",
          }}
          labelStyle={{ color: "var(--text-primary)" }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="inbound"
          name="입고"
          stroke="var(--success)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorInbound)"
        />
        <Area
          type="monotone"
          dataKey="outbound"
          name="출고"
          stroke="var(--danger)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorOutbound)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
