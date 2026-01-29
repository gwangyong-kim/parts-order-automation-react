"use client";

import { useState } from "react";
import { Building2, TrendingUp, Award, AlertTriangle } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import SupplierPerformanceChart from "@/components/charts/reports/SupplierPerformanceChart";

interface SupplierPerformanceData {
  summary: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalOrderValue: number;
  };
  supplierStats: Array<{
    supplierId: number;
    supplierName: string;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    onTimeDeliveryRate: number;
    totalAmount: number;
    averageOrderValue: number;
  }>;
}

interface SupplierPerformanceReportProps {
  data: SupplierPerformanceData | null;
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

function getGrade(onTimeDeliveryRate: number): { grade: string; color: string } {
  if (onTimeDeliveryRate >= 95) return { grade: "A", color: "bg-emerald-500/20 text-emerald-400" };
  if (onTimeDeliveryRate >= 85) return { grade: "B", color: "bg-blue-500/20 text-blue-400" };
  if (onTimeDeliveryRate >= 70) return { grade: "C", color: "bg-amber-500/20 text-amber-400" };
  return { grade: "D", color: "bg-red-500/20 text-red-400" };
}

export default function SupplierPerformanceReport({
  data,
  isLoading,
  filterValue,
  onFilterChange,
  onExportCSV,
  onExportJSON,
}: SupplierPerformanceReportProps) {
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

  const excellentCount = data.supplierStats.filter((s) => s.onTimeDeliveryRate >= 95).length;
  const poorCount = data.supplierStats.filter((s) => s.onTimeDeliveryRate < 70 && s.completedOrders > 0).length;
  const avgOnTimeRate = data.supplierStats.length > 0
    ? data.supplierStats.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / data.supplierStats.length
    : 0;

  const stats: StatCard[] = [
    {
      label: "총 공급업체",
      value: data.summary.totalSuppliers,
      color: "primary",
      icon: Building2,
    },
    {
      label: "활성 공급업체",
      value: data.summary.activeSuppliers,
      color: "info",
      icon: TrendingUp,
    },
    {
      label: "우수 (A등급)",
      value: excellentCount,
      subValue: "95% 이상",
      color: "success",
      icon: Award,
    },
    {
      label: "미흡 (D등급)",
      value: poorCount,
      subValue: "70% 미만",
      color: "danger",
      icon: AlertTriangle,
    },
  ];

  const supplierColumns = [
    {
      key: "grade",
      header: "등급",
      render: (item: SupplierPerformanceData["supplierStats"][0]) => {
        const { grade, color } = getGrade(item.onTimeDeliveryRate);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${color}`}>
            {grade}
          </span>
        );
      },
    },
    { key: "supplierName", header: "공급업체", sortable: true },
    {
      key: "totalOrders",
      header: "총 발주",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "completedOrders",
      header: "완료",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "onTimeDeliveryRate",
      header: "납기준수율",
      sortable: true,
      align: "right" as const,
      render: (item: SupplierPerformanceData["supplierStats"][0]) => {
        const rate = item.onTimeDeliveryRate;
        const color =
          rate >= 95
            ? "text-emerald-400"
            : rate >= 85
              ? "text-blue-400"
              : rate >= 70
                ? "text-amber-400"
                : "text-red-400";
        return <span className={`font-bold ${color}`}>{rate.toFixed(1)}%</span>;
      },
    },
    {
      key: "totalAmount",
      header: "총 발주액",
      sortable: true,
      align: "right" as const,
      render: (item: SupplierPerformanceData["supplierStats"][0]) =>
        `₩${item.totalAmount.toLocaleString()}`,
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="공급업체 성과 리포트"
        description="공급업체별 납기 준수율 및 성과 분석"
        filterOptions={filterOptions}
        filterValue={filterValue}
        onFilterChange={onFilterChange}
        onExportCSV={onExportCSV}
        onExportJSON={onExportJSON}
      />

      <ReportStats stats={stats} />

      <div className="flex justify-between items-center">
        <ReportTabs activeTab={activeTab} onChange={setActiveTab} showDetail={false} />
      </div>

      {activeTab === "chart" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              공급업체별 납기준수율
            </h3>
            <SupplierPerformanceChart data={data.supplierStats} />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              등급별 분포
            </h3>
            <div className="space-y-4">
              {["A", "B", "C", "D"].map((grade) => {
                const count = data.supplierStats.filter((s) => {
                  const g = getGrade(s.onTimeDeliveryRate).grade;
                  return g === grade;
                }).length;
                const total = data.supplierStats.length;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                const colors: Record<string, string> = {
                  A: "bg-emerald-500",
                  B: "bg-blue-500",
                  C: "bg-amber-500",
                  D: "bg-red-500",
                };
                const labels: Record<string, string> = {
                  A: "우수 (95%↑)",
                  B: "양호 (85~95%)",
                  C: "보통 (70~85%)",
                  D: "미흡 (70%↓)",
                };

                return (
                  <div key={grade}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--text-secondary)]">
                        {grade}등급 - {labels[grade]}
                      </span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {count}개 ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[grade]} rounded-full transition-all duration-500`}
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

      {activeTab === "table" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            공급업체 성과 상세
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
