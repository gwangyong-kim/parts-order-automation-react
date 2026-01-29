"use client";

import { useState } from "react";
import { ShoppingBag, Clock, CheckCircle, Package } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import SalesAnalysisChart from "@/components/charts/reports/SalesAnalysisChart";

interface SalesAnalysisData {
  summary: {
    totalOrders: number;
    pendingCount: number;
    inProgressCount: number;
    completedCount: number;
  };
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  topProducts: Array<{
    productName: string;
    count: number;
    quantity: number;
  }>;
}

interface SalesAnalysisReportProps {
  data: SalesAnalysisData | null;
  isLoading: boolean;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
}

export default function SalesAnalysisReport({
  data,
  isLoading,
  onExportCSV,
  onExportJSON,
}: SalesAnalysisReportProps) {
  const [activeTab, setActiveTab] = useState<TabType>("chart");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const stats: StatCard[] = [
    {
      label: "총 수주",
      value: data.summary.totalOrders,
      color: "primary",
      icon: ShoppingBag,
    },
    {
      label: "대기중",
      value: data.summary.pendingCount,
      color: "warning",
      icon: Clock,
    },
    {
      label: "진행중",
      value: data.summary.inProgressCount,
      color: "info",
      icon: Package,
    },
    {
      label: "완료",
      value: data.summary.completedCount,
      color: "success",
      icon: CheckCircle,
    },
  ];

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: "대기", color: "bg-gray-500/20 text-gray-400" },
    CONFIRMED: { label: "확인", color: "bg-blue-500/20 text-blue-400" },
    IN_PRODUCTION: { label: "생산중", color: "bg-amber-500/20 text-amber-400" },
    COMPLETED: { label: "완료", color: "bg-emerald-500/20 text-emerald-400" },
    CANCELLED: { label: "취소", color: "bg-red-500/20 text-red-400" },
  };

  const productColumns = [
    { key: "productName", header: "제품명", sortable: true },
    {
      key: "quantity",
      header: "총 주문수량",
      sortable: true,
      align: "right" as const,
      render: (item: SalesAnalysisData["topProducts"][0]) =>
        item.quantity.toLocaleString(),
    },
    {
      key: "count",
      header: "주문 건수",
      sortable: true,
      align: "right" as const,
    },
  ];


  return (
    <div className="space-y-6">
      <ReportHeader
        title="수주 분석 리포트"
        description="수주 현황 및 제품별 주문 분석"
        onExportCSV={onExportCSV}
        onExportJSON={onExportJSON}
      />

      <ReportStats stats={stats} />

      <div className="flex justify-between items-center">
        <ReportTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "chart" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              제품별 주문량 TOP 10
            </h3>
            <SalesAnalysisChart data={data.topProducts} />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              상태별 수주 현황
            </h3>
            <div className="space-y-3">
              {data.byStatus.map((item) => {
                const status = statusMap[item.status] || { label: item.status, color: "" };
                return (
                  <div
                    key={item.status}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]"
                  >
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-[var(--text-primary)] font-bold">
                      {item.count}건
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            제품별 주문 현황
          </h3>
          <DataTable
            data={data.topProducts}
            columns={productColumns}
            pageSize={15}
            emptyMessage="제품 주문 데이터가 없습니다."
          />
        </div>
      )}

      {activeTab === "detail" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              전체 제품 주문 현황
            </h3>
            <DataTable
              data={data.topProducts}
              columns={productColumns}
              pageSize={10}
              emptyMessage="제품 주문 데이터가 없습니다."
            />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              상태별 상세
            </h3>
            <div className="space-y-3">
              {data.byStatus.map((item) => {
                const status = statusMap[item.status] || { label: item.status, color: "bg-gray-500/20 text-gray-400" };
                const percentage = data.summary.totalOrders > 0
                  ? ((item.count / data.summary.totalOrders) * 100).toFixed(1)
                  : 0;
                return (
                  <div
                    key={item.status}
                    className="p-3 rounded-lg bg-[var(--glass-bg)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-[var(--text-primary)] font-bold">
                        {item.count}건 ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[var(--glass-border)] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-[var(--primary)]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
