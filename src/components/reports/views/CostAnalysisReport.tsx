"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, Layers, Award } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import CostAnalysisChart from "@/components/charts/reports/CostAnalysisChart";

interface CostAnalysisData {
  summary: {
    totalParts: number;
    totalInventoryValue: number;
    averagePartValue: number;
  };
  byCategoryValue: Array<{
    category: string;
    partCount: number;
    inventoryValue: number;
  }>;
  topCostItems: Array<{
    partNumber: string;
    partName: string;
    unitPrice: number;
    currentQty: number;
    totalValue: number;
  }>;
}

interface CostAnalysisReportProps {
  data: CostAnalysisData | null;
  isLoading: boolean;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
}

export default function CostAnalysisReport({
  data,
  isLoading,
  onExportCSV,
  onExportJSON,
}: CostAnalysisReportProps) {
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

  const highestValueItem = data.topCostItems.length > 0 ? data.topCostItems[0] : null;

  const totalInventoryValue = data.summary.totalInventoryValue || 0;
  const averagePartValue = data.summary.averagePartValue || 0;

  const stats: StatCard[] = [
    {
      label: "총 재고가치",
      value: `₩${(totalInventoryValue / 10000).toFixed(0)}만`,
      color: "primary",
      icon: DollarSign,
    },
    {
      label: "평균 품목가치",
      value: `₩${Math.round(averagePartValue).toLocaleString()}`,
      color: "info",
      icon: TrendingUp,
    },
    {
      label: "총 파츠 수",
      value: data.summary.totalParts,
      color: "success",
      icon: Layers,
    },
    {
      label: "최고가 품목",
      value: highestValueItem?.partName || "-",
      color: "warning",
      icon: Award,
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
      key: "inventoryValue",
      header: "재고가치",
      sortable: true,
      align: "right" as const,
      render: (item: CostAnalysisData["byCategoryValue"][0]) =>
        `₩${item.inventoryValue.toLocaleString()}`,
    },
  ];

  const topItemColumns = [
    { key: "partNumber", header: "파츠코드", sortable: true },
    { key: "partName", header: "파츠명", sortable: true },
    {
      key: "unitPrice",
      header: "단가",
      sortable: true,
      align: "right" as const,
      render: (item: CostAnalysisData["topCostItems"][0]) =>
        `₩${item.unitPrice.toLocaleString()}`,
    },
    {
      key: "currentQty",
      header: "현재고",
      sortable: true,
      align: "right" as const,
      render: (item: CostAnalysisData["topCostItems"][0]) =>
        item.currentQty.toLocaleString(),
    },
    {
      key: "totalValue",
      header: "재고가치",
      sortable: true,
      align: "right" as const,
      render: (item: CostAnalysisData["topCostItems"][0]) => (
        <span className="text-emerald-400 font-medium">
          ₩{item.totalValue.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="비용 분석 리포트"
        description="재고 자산 가치 및 카테고리별 비용 분석"
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
              카테고리별 재고 자산
            </h3>
            <CostAnalysisChart data={data.byCategoryValue} />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              고가 품목 TOP 5
            </h3>
            <div className="space-y-3">
              {data.topCostItems.slice(0, 5).map((item, index) => (
                <div
                  key={item.partNumber}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-[var(--text-primary)] font-medium">
                        {item.partName || item.partNumber}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {item.partNumber}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold">
                      ₩{item.totalValue.toLocaleString()}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {item.currentQty}개 × ₩{item.unitPrice.toLocaleString()}
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
            카테고리별 재고 현황
          </h3>
          <DataTable
            data={data.byCategoryValue}
            columns={categoryColumns}
            pageSize={15}
            emptyMessage="카테고리 데이터가 없습니다."
          />
        </div>
      )}

      {activeTab === "detail" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            고가 품목 TOP 10
          </h3>
          <DataTable
            data={data.topCostItems}
            columns={topItemColumns}
            pageSize={15}
            emptyMessage="데이터가 없습니다."
          />
        </div>
      )}
    </div>
  );
}
