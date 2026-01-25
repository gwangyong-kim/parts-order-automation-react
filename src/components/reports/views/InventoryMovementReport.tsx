"use client";

import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Activity } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import InventoryMovementChart from "@/components/charts/reports/InventoryMovementChart";

interface InventoryMovementData {
  summary: {
    totalInbound: number;
    totalOutbound: number;
    netChange: number;
    transactionCount: number;
  };
  dailyTrend: Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  recentTransactions: Array<{
    transactionCode: string;
    type: string;
    partNumber: string;
    partName: string;
    quantity: number;
    date: string;
  }>;
}

interface InventoryMovementReportProps {
  data: InventoryMovementData | null;
  isLoading: boolean;
  filterValue: number;
  onFilterChange: (value: number) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

const filterOptions = [
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
  { value: 90, label: "최근 90일" },
];

export default function InventoryMovementReport({
  data,
  isLoading,
  filterValue,
  onFilterChange,
  onExportCSV,
  onExportJSON,
}: InventoryMovementReportProps) {
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
      label: "총 입고",
      value: data.summary.totalInbound.toLocaleString(),
      color: "success",
      icon: ArrowDownCircle,
    },
    {
      label: "총 출고",
      value: data.summary.totalOutbound.toLocaleString(),
      color: "danger",
      icon: ArrowUpCircle,
    },
    {
      label: "순변동",
      value:
        (data.summary.netChange >= 0 ? "+" : "") +
        data.summary.netChange.toLocaleString(),
      color: data.summary.netChange >= 0 ? "success" : "danger",
      icon: TrendingUp,
    },
    {
      label: "거래 건수",
      value: data.summary.transactionCount,
      color: "info",
      icon: Activity,
    },
  ];

  const transactionColumns = [
    { key: "transactionCode", header: "거래코드", sortable: true },
    {
      key: "type",
      header: "유형",
      sortable: true,
      render: (item: InventoryMovementData["recentTransactions"][0]) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          INBOUND: { label: "입고", color: "bg-emerald-500/20 text-emerald-400" },
          OUTBOUND: { label: "출고", color: "bg-red-500/20 text-red-400" },
          ADJUSTMENT: { label: "조정", color: "bg-amber-500/20 text-amber-400" },
        };
        const type = typeMap[item.type] || { label: item.type, color: "bg-gray-500/20 text-gray-400" };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.color}`}>
            {type.label}
          </span>
        );
      },
    },
    { key: "partNumber", header: "파츠코드", sortable: true },
    { key: "partName", header: "파츠명", sortable: true },
    {
      key: "quantity",
      header: "수량",
      sortable: true,
      align: "right" as const,
      render: (item: InventoryMovementData["recentTransactions"][0]) => {
        const isInbound = item.type === "INBOUND";
        return (
          <span className={isInbound ? "text-emerald-400" : "text-red-400"}>
            {isInbound ? "+" : "-"}
            {Math.abs(item.quantity).toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "date",
      header: "일시",
      sortable: true,
      render: (item: InventoryMovementData["recentTransactions"][0]) =>
        new Date(item.date).toLocaleDateString("ko-KR"),
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="입출고 분석 리포트"
        description="기간별 입출고 추이 및 거래 내역"
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
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
            일별 입출고 추이
          </h3>
          <InventoryMovementChart data={data.dailyTrend} />
        </div>
      )}

      {activeTab === "table" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            최근 거래 내역
          </h3>
          <DataTable
            data={data.recentTransactions}
            columns={transactionColumns}
            pageSize={15}
            emptyMessage="거래 내역이 없습니다."
          />
        </div>
      )}
    </div>
  );
}
