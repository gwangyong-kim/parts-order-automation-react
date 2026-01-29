"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, FileText, Building2 } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import OrderHistoryChart from "@/components/charts/reports/OrderHistoryChart";

interface OrderHistoryData {
  summary: {
    totalAmount: number;
    averageAmount: number;
    orderCount: number;
    supplierCount: number;
  };
  monthlyTrend: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  recentOrders: Array<{
    orderNumber: string;
    supplier: string;
    orderDate: string;
    expectedDate: string;
    status: string;
    itemCount: number;
    totalAmount: number;
  }>;
}

interface OrderHistoryReportProps {
  data: OrderHistoryData | null;
  isLoading: boolean;
  filterValue: number;
  onFilterChange: (value: number) => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
}

const filterOptions = [
  { value: 90, label: "최근 3개월" },
  { value: 180, label: "최근 6개월" },
  { value: 365, label: "최근 1년" },
];

export default function OrderHistoryReport({
  data,
  isLoading,
  filterValue,
  onFilterChange,
  onExportCSV,
  onExportJSON,
}: OrderHistoryReportProps) {
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

  const totalAmount = data.summary.totalAmount || 0;
  const averageAmount = data.summary.averageAmount || 0;

  const stats: StatCard[] = [
    {
      label: "총 발주액",
      value: `₩${(totalAmount / 10000).toFixed(0)}만`,
      color: "primary",
      icon: DollarSign,
    },
    {
      label: "평균 발주액",
      value: `₩${(averageAmount / 10000).toFixed(0)}만`,
      color: "info",
      icon: TrendingUp,
    },
    {
      label: "발주 건수",
      value: data.summary.orderCount,
      color: "success",
      icon: FileText,
    },
    {
      label: "공급업체 수",
      value: data.summary.supplierCount,
      color: "warning",
      icon: Building2,
    },
  ];

  const monthlyColumns = [
    { key: "month", header: "월", sortable: true },
    {
      key: "count",
      header: "발주 건수",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "amount",
      header: "발주 금액",
      sortable: true,
      align: "right" as const,
      render: (item: OrderHistoryData["monthlyTrend"][0]) =>
        `₩${item.amount.toLocaleString()}`,
    },
  ];

  const orderColumns = [
    { key: "orderNumber", header: "발주번호", sortable: true },
    { key: "supplier", header: "공급업체", sortable: true },
    {
      key: "orderDate",
      header: "발주일",
      sortable: true,
      render: (item: OrderHistoryData["recentOrders"][0]) =>
        new Date(item.orderDate).toLocaleDateString("ko-KR"),
    },
    {
      key: "itemCount",
      header: "품목수",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "totalAmount",
      header: "금액",
      sortable: true,
      align: "right" as const,
      render: (item: OrderHistoryData["recentOrders"][0]) =>
        `₩${item.totalAmount?.toLocaleString() || 0}`,
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="발주 이력 리포트"
        description="기간별 발주 추이 및 이력 분석"
        filterOptions={filterOptions}
        filterValue={filterValue}
        onFilterChange={onFilterChange}
        onExportCSV={onExportCSV}
        onExportJSON={onExportJSON}
      />

      <ReportStats stats={stats} />

      <div className="flex justify-between items-center">
        <ReportTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "chart" && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
            월별 발주 금액 추이
          </h3>
          <OrderHistoryChart data={data.monthlyTrend} />
        </div>
      )}

      {activeTab === "table" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            월별 요약
          </h3>
          <DataTable
            data={data.monthlyTrend}
            columns={monthlyColumns}
            pageSize={12}
            emptyMessage="데이터가 없습니다."
          />
        </div>
      )}

      {activeTab === "detail" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            발주 상세 이력
          </h3>
          <DataTable
            data={data.recentOrders}
            columns={orderColumns}
            pageSize={15}
            emptyMessage="발주 내역이 없습니다."
          />
        </div>
      )}
    </div>
  );
}
