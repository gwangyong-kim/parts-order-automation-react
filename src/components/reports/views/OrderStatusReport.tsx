"use client";

import { useState } from "react";
import { ShoppingCart, Clock, Truck, CheckCircle } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import OrderStatusChart from "@/components/charts/reports/OrderStatusChart";

interface OrderStatusData {
  summary: {
    totalOrders: number;
    draftCount: number;
    pendingCount: number;
    completedCount: number;
    cancelledCount: number;
    totalAmount: number;
  };
  byStatus: Array<{
    status: string;
    count: number;
    totalAmount: number;
  }>;
  supplierStats: Array<{
    supplier: string;
    totalOrders: number;
    totalAmount: number;
    pendingOrders: number;
  }>;
}

interface OrderStatusReportProps {
  data: OrderStatusData | null;
  isLoading: boolean;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
}

export default function OrderStatusReport({
  data,
  isLoading,
  onExportCSV,
  onExportJSON,
}: OrderStatusReportProps) {
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
      label: "총 발주",
      value: data.summary.totalOrders,
      color: "primary",
      icon: ShoppingCart,
    },
    {
      label: "초안/대기",
      value: data.summary.draftCount + data.summary.pendingCount,
      color: "warning",
      icon: Clock,
    },
    {
      label: "진행중",
      value: data.summary.totalOrders - data.summary.draftCount - data.summary.pendingCount - data.summary.completedCount - data.summary.cancelledCount,
      color: "info",
      icon: Truck,
    },
    {
      label: "완료",
      value: data.summary.completedCount,
      color: "success",
      icon: CheckCircle,
    },
  ];

  const statusMap: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "초안", color: "bg-gray-500/20 text-gray-400" },
    PENDING: { label: "대기", color: "bg-amber-500/20 text-amber-400" },
    APPROVED: { label: "승인", color: "bg-blue-500/20 text-blue-400" },
    ORDERED: { label: "발주완료", color: "bg-cyan-500/20 text-cyan-400" },
    PARTIAL: { label: "부분입고", color: "bg-purple-500/20 text-purple-400" },
    RECEIVED: { label: "입고완료", color: "bg-emerald-500/20 text-emerald-400" },
    CANCELLED: { label: "취소", color: "bg-red-500/20 text-red-400" },
  };

  const statusColumns = [
    {
      key: "status",
      header: "상태",
      sortable: true,
      render: (item: OrderStatusData["byStatus"][0]) => {
        const status = statusMap[item.status] || { label: item.status, color: "bg-gray-500/20 text-gray-400" };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      key: "count",
      header: "건수",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "totalAmount",
      header: "금액",
      sortable: true,
      align: "right" as const,
      render: (item: OrderStatusData["byStatus"][0]) =>
        `₩${item.totalAmount?.toLocaleString() || 0}`,
    },
  ];

  const supplierColumns = [
    { key: "supplier", header: "공급업체", sortable: true },
    {
      key: "totalOrders",
      header: "총 발주",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "pendingOrders",
      header: "진행중",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "totalAmount",
      header: "총 금액",
      sortable: true,
      align: "right" as const,
      render: (item: OrderStatusData["supplierStats"][0]) =>
        `₩${item.totalAmount.toLocaleString()}`,
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="발주 현황 리포트"
        description="현재 발주 상태 및 공급업체별 현황"
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
              상태별 발주 현황
            </h3>
            <OrderStatusChart data={data.byStatus} />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              공급업체별 발주 (Top 5)
            </h3>
            <div className="space-y-3">
              {data.supplierStats.slice(0, 5).map((supplier, index) => (
                <div
                  key={supplier.supplier}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-[var(--text-primary)]">
                      {supplier.supplier}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--text-primary)] font-medium">
                      {supplier.totalOrders}건
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      ₩{supplier.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            상태별 발주 현황
          </h3>
          <DataTable
            data={data.byStatus}
            columns={statusColumns}
            pageSize={15}
            emptyMessage="발주 내역이 없습니다."
          />
        </div>
      )}

      {activeTab === "detail" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            공급업체별 상세
          </h3>
          <DataTable
            data={data.supplierStats}
            columns={supplierColumns}
            pageSize={15}
            emptyMessage="공급업체 데이터가 없습니다."
          />
        </div>
      )}
    </div>
  );
}
