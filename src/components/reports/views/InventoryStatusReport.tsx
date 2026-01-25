"use client";

import { useState } from "react";
import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import InventoryStatusChart from "@/components/charts/reports/InventoryStatusChart";

interface InventoryStatusData {
  summary: {
    totalParts: number;
    lowStockCount: number;
    overStockCount: number;
    totalInventoryValue: number;
  };
  lowStockItems: Array<{
    partNumber: string;
    partName: string;
    currentQty: number;
    safetyStock: number;
    category?: string;
  }>;
  categoryStats: Array<{
    category: string;
    partCount: number;
    totalQty: number;
    totalValue: number;
  }>;
}

interface InventoryStatusReportProps {
  data: InventoryStatusData | null;
  isLoading: boolean;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export default function InventoryStatusReport({
  data,
  isLoading,
  onExportCSV,
  onExportJSON,
}: InventoryStatusReportProps) {
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
      label: "총 파츠",
      value: data.summary.totalParts,
      color: "primary",
      icon: Package,
    },
    {
      label: "재고 부족",
      value: data.summary.lowStockCount,
      subValue: "안전재고 미달",
      color: "danger",
      icon: AlertTriangle,
    },
    {
      label: "과재고",
      value: data.summary.overStockCount,
      subValue: "안전재고 3배 초과",
      color: "warning",
      icon: TrendingUp,
    },
    {
      label: "총 재고가치",
      value: `₩${((data.summary.totalInventoryValue || 0) / 10000).toFixed(0)}만`,
      color: "info",
      icon: DollarSign,
    },
  ];

  const lowStockColumns = [
    { key: "partNumber", header: "파츠코드", sortable: true },
    { key: "partName", header: "파츠명", sortable: true },
    { key: "category", header: "카테고리", sortable: true },
    {
      key: "currentQty",
      header: "현재고",
      sortable: true,
      align: "right" as const,
      render: (item: InventoryStatusData["lowStockItems"][0]) => (
        <span className="text-red-400 font-medium">
          {item.currentQty.toLocaleString()}
        </span>
      ),
    },
    {
      key: "safetyStock",
      header: "안전재고",
      sortable: true,
      align: "right" as const,
      render: (item: InventoryStatusData["lowStockItems"][0]) =>
        item.safetyStock.toLocaleString(),
    },
    {
      key: "shortage",
      header: "부족량",
      align: "right" as const,
      render: (item: InventoryStatusData["lowStockItems"][0]) => {
        const shortage = item.safetyStock - item.currentQty;
        return shortage > 0 ? (
          <span className="text-red-400 font-medium">-{shortage}</span>
        ) : (
          <span className="text-emerald-400">0</span>
        );
      },
    },
  ];

  const categoryColumns = [
    { key: "category", header: "카테고리", sortable: true },
    {
      key: "partCount",
      header: "품목수",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "totalQty",
      header: "총 수량",
      sortable: true,
      align: "right" as const,
      render: (item: InventoryStatusData["categoryStats"][0]) =>
        item.totalQty.toLocaleString(),
    },
    {
      key: "totalValue",
      header: "재고가치",
      sortable: true,
      align: "right" as const,
      render: (item: InventoryStatusData["categoryStats"][0]) =>
        `₩${item.totalValue.toLocaleString()}`,
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="재고 현황 리포트"
        description="현재 재고 상태 및 저재고 품목 현황"
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
              카테고리별 재고 분포
            </h3>
            <InventoryStatusChart data={data.categoryStats} />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              재고 상태 요약
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                <span className="text-[var(--text-secondary)]">정상 재고</span>
                <span className="text-emerald-400 font-bold">
                  {data.summary.totalParts -
                    data.summary.lowStockCount -
                    data.summary.overStockCount}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                <span className="text-[var(--text-secondary)]">재고 부족</span>
                <span className="text-red-400 font-bold">
                  {data.summary.lowStockCount}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                <span className="text-[var(--text-secondary)]">과재고</span>
                <span className="text-amber-400 font-bold">
                  {data.summary.overStockCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              저재고 품목 ({data.lowStockItems.length}개)
            </h3>
            <DataTable
              data={data.lowStockItems}
              columns={lowStockColumns}
              pageSize={10}
              emptyMessage="저재고 품목이 없습니다."
            />
          </div>
        </div>
      )}

      {activeTab === "detail" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              카테고리별 상세
            </h3>
            <DataTable
              data={data.categoryStats}
              columns={categoryColumns}
              pageSize={10}
              emptyMessage="카테고리 데이터가 없습니다."
            />
          </div>
        </div>
      )}
    </div>
  );
}
