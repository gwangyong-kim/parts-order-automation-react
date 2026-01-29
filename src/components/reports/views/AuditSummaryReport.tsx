"use client";

import { useState } from "react";
import { ClipboardCheck, CheckCircle, Clock, Target } from "lucide-react";
import ReportStats, { StatCard } from "../ReportStats";
import ReportTabs, { TabType } from "../ReportTabs";
import ReportHeader from "../ReportHeader";
import DataTable from "../DataTable";
import AuditSummaryChart from "@/components/charts/reports/AuditSummaryChart";

interface AuditSummaryData {
  summary: {
    totalAudits: number;
    completedAudits: number;
    inProgressAudits: number;
    plannedAudits: number;
    totalItemsAudited: number;
    totalDiscrepancies: number;
    accuracyRate: number;
  };
  recentAudits: Array<{
    auditCode: string;
    auditDate: string;
    status: string;
    totalItems: number;
    matchedItems: number;
    discrepancyItems: number;
    performedBy: string;
  }>;
  recentDiscrepancies: Array<{
    partNumber: string;
    partName: string;
    systemQty: number;
    actualQty: number;
    difference: number;
    status: string;
    createdAt: string;
  }>;
}

interface AuditSummaryReportProps {
  data: AuditSummaryData | null;
  isLoading: boolean;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
}

export default function AuditSummaryReport({
  data,
  isLoading,
  onExportCSV,
  onExportJSON,
}: AuditSummaryReportProps) {
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
      label: "총 실사",
      value: data.summary.totalAudits,
      color: "primary",
      icon: ClipboardCheck,
    },
    {
      label: "완료",
      value: data.summary.completedAudits,
      color: "success",
      icon: CheckCircle,
    },
    {
      label: "진행중",
      value: data.summary.inProgressAudits,
      color: "warning",
      icon: Clock,
    },
    {
      label: "정확도",
      value: `${data.summary.accuracyRate.toFixed(1)}%`,
      color: data.summary.accuracyRate >= 95 ? "success" : data.summary.accuracyRate >= 85 ? "warning" : "danger",
      icon: Target,
    },
  ];

  const statusMap: Record<string, { label: string; color: string }> = {
    PLANNED: { label: "예정", color: "bg-gray-500/20 text-gray-400" },
    IN_PROGRESS: { label: "진행중", color: "bg-amber-500/20 text-amber-400" },
    COMPLETED: { label: "완료", color: "bg-emerald-500/20 text-emerald-400" },
  };

  const discrepancyStatusMap: Record<string, { label: string; color: string }> = {
    OPEN: { label: "미해결", color: "bg-red-500/20 text-red-400" },
    INVESTIGATING: { label: "조사중", color: "bg-amber-500/20 text-amber-400" },
    RESOLVED: { label: "해결", color: "bg-emerald-500/20 text-emerald-400" },
  };

  const auditColumns = [
    { key: "auditCode", header: "실사코드", sortable: true },
    {
      key: "auditDate",
      header: "실사일",
      sortable: true,
      render: (item: AuditSummaryData["recentAudits"][0]) =>
        new Date(item.auditDate).toLocaleDateString("ko-KR"),
    },
    {
      key: "status",
      header: "상태",
      sortable: true,
      render: (item: AuditSummaryData["recentAudits"][0]) => {
        const status = statusMap[item.status] || { label: item.status, color: "bg-gray-500/20 text-gray-400" };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        );
      },
    },
    {
      key: "totalItems",
      header: "총 품목",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "matchedItems",
      header: "일치",
      sortable: true,
      align: "right" as const,
      render: (item: AuditSummaryData["recentAudits"][0]) => (
        <span className="text-emerald-400">{item.matchedItems}</span>
      ),
    },
    {
      key: "discrepancyItems",
      header: "불일치",
      sortable: true,
      align: "right" as const,
      render: (item: AuditSummaryData["recentAudits"][0]) => (
        <span className={item.discrepancyItems > 0 ? "text-red-400" : "text-emerald-400"}>
          {item.discrepancyItems}
        </span>
      ),
    },
    { key: "performedBy", header: "담당자", sortable: true },
  ];

  const discrepancyColumns = [
    { key: "partNumber", header: "파츠코드", sortable: true },
    { key: "partName", header: "파츠명", sortable: true },
    {
      key: "systemQty",
      header: "시스템 수량",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "actualQty",
      header: "실제 수량",
      sortable: true,
      align: "right" as const,
    },
    {
      key: "difference",
      header: "차이",
      sortable: true,
      align: "right" as const,
      render: (item: AuditSummaryData["recentDiscrepancies"][0]) => {
        const diff = item.difference;
        return (
          <span className={diff > 0 ? "text-emerald-400" : "text-red-400"}>
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "상태",
      sortable: true,
      render: (item: AuditSummaryData["recentDiscrepancies"][0]) => {
        const status = discrepancyStatusMap[item.status] || { label: item.status, color: "bg-gray-500/20 text-gray-400" };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="실사 결과 리포트"
        description="재고 실사 현황 및 불일치 분석"
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
              재고 정확도
            </h3>
            <AuditSummaryChart accuracyRate={data.summary.accuracyRate} />
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
              실사 요약
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)]">
                <span className="text-[var(--text-secondary)]">총 점검 품목</span>
                <span className="text-[var(--text-primary)] font-bold">
                  {data.summary.totalItemsAudited.toLocaleString()}개
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                <span className="text-[var(--text-secondary)]">일치 품목</span>
                <span className="text-emerald-400 font-bold">
                  {(data.summary.totalItemsAudited - data.summary.totalDiscrepancies).toLocaleString()}개
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                <span className="text-[var(--text-secondary)]">불일치 품목</span>
                <span className="text-red-400 font-bold">
                  {data.summary.totalDiscrepancies.toLocaleString()}개
                </span>
              </div>
              <div className="pt-4 border-t border-[var(--glass-border)]">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[var(--text-muted)]">정확도</span>
                  <span className={`font-bold ${
                    data.summary.accuracyRate >= 95
                      ? "text-emerald-400"
                      : data.summary.accuracyRate >= 85
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}>
                    {data.summary.accuracyRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      data.summary.accuracyRate >= 95
                        ? "bg-emerald-500"
                        : data.summary.accuracyRate >= 85
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${data.summary.accuracyRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            최근 실사 목록
          </h3>
          <DataTable
            data={data.recentAudits}
            columns={auditColumns}
            pageSize={10}
            emptyMessage="실사 내역이 없습니다."
          />
        </div>
      )}

      {activeTab === "detail" && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            최근 불일치 내역
          </h3>
          <DataTable
            data={data.recentDiscrepancies}
            columns={discrepancyColumns}
            pageSize={15}
            emptyMessage="불일치 내역이 없습니다."
          />
        </div>
      )}
    </div>
  );
}
