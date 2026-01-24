"use client";

import { useQuery } from "@tanstack/react-query";
import MonthlyTransactionChart from "./MonthlyTransactionChart";
import CategoryDistributionChart from "./CategoryDistributionChart";
import OrderStatusChart from "./OrderStatusChart";

interface ChartData {
  monthlyTransactions: { month: string; inbound: number; outbound: number }[];
  categoryDistribution: { name: string; value: number }[];
  orderStatus: { status: string; count: number; color: string }[];
}

async function fetchChartData(): Promise<ChartData> {
  const res = await fetch("/api/dashboard/charts");
  if (!res.ok) throw new Error("Failed to fetch chart data");
  return res.json();
}

export default function DashboardCharts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: fetchChartData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
        <div className="glass-card p-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Monthly Transaction Chart */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          월별 입출고 추이
        </h2>
        <MonthlyTransactionChart data={data.monthlyTransactions} />
      </div>

      {/* Two Charts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            카테고리별 부품 현황
          </h2>
          {data.categoryDistribution.length > 0 ? (
            <CategoryDistributionChart data={data.categoryDistribution} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)]">
              데이터가 없습니다.
            </div>
          )}
        </div>

        {/* Order Status */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            발주 상태별 현황
          </h2>
          {data.orderStatus.some((s) => s.count > 0) ? (
            <OrderStatusChart data={data.orderStatus} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)]">
              발주 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
