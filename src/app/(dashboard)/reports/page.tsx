"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Warehouse,
  TrendingUp,
  ShoppingCart,
  FileText,
  BarChart3,
  DollarSign,
  Package,
  PieChart,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  InventoryStatusReport,
  InventoryMovementReport,
  OrderStatusReport,
  OrderHistoryReport,
  SalesAnalysisReport,
  CostAnalysisReport,
  SupplierPerformanceReport,
  AuditSummaryReport,
} from "@/components/reports/views";

// 리포트 정의
const reportDefinitions = [
  {
    id: "inventory-status",
    title: "재고 현황",
    icon: Warehouse,
    color: "primary",
  },
  {
    id: "inventory-movement",
    title: "입출고 분석",
    icon: TrendingUp,
    color: "success",
  },
  {
    id: "order-status",
    title: "발주 현황",
    icon: ShoppingCart,
    color: "info",
  },
  {
    id: "order-history",
    title: "발주 이력",
    icon: FileText,
    color: "warning",
  },
  {
    id: "sales-analysis",
    title: "수주 분석",
    icon: BarChart3,
    color: "primary",
  },
  {
    id: "cost-analysis",
    title: "비용 분석",
    icon: DollarSign,
    color: "success",
  },
  {
    id: "supplier-performance",
    title: "공급업체 성과",
    icon: Package,
    color: "info",
  },
  {
    id: "audit-summary",
    title: "실사 결과",
    icon: PieChart,
    color: "warning",
  },
];

const colorClasses: Record<string, { active: string; inactive: string }> = {
  primary: {
    active: "bg-[var(--primary)] text-white",
    inactive: "text-[var(--primary)] hover:bg-[var(--primary)]/10",
  },
  success: {
    active: "bg-emerald-500 text-white",
    inactive: "text-emerald-500 hover:bg-emerald-500/10",
  },
  warning: {
    active: "bg-amber-500 text-white",
    inactive: "text-amber-500 hover:bg-amber-500/10",
  },
  info: {
    active: "bg-cyan-500 text-white",
    inactive: "text-cyan-500 hover:bg-cyan-500/10",
  },
};

type ReportId = (typeof reportDefinitions)[number]["id"];

interface ReportFilters {
  days: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = any;

function convertToCSV(data: ReportData): string {
  const lines: string[] = [];

  lines.push(`Report: ${data.reportType}`);
  lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString("ko-KR")}`);
  lines.push("");

  lines.push("=== Summary ===");
  Object.entries(data.summary || {}).forEach(([key, value]) => {
    lines.push(`${key},${value}`);
  });
  lines.push("");

  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      lines.push(`=== ${key} ===`);
      const headers = Object.keys(value[0]);
      lines.push(headers.join(","));
      value.forEach((row: Record<string, unknown>) => {
        lines.push(headers.map((h) => String(row[h] ?? "")).join(","));
      });
      lines.push("");
    }
  });

  return lines.join("\n");
}

export default function ReportsPage() {
  const toast = useToast();
  const [selectedReport, setSelectedReport] = useState<ReportId>("inventory-status");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({ days: 30 });

  const fetchReportData = useCallback(async (reportId: ReportId, filterDays?: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ type: reportId });
      if (filterDays) {
        params.set("days", String(filterDays));
      }
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      setReportData(data);
    } catch {
      toast.error("리포트 데이터를 불러오는데 실패했습니다.");
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReportData(selectedReport, filters.days);
  }, [selectedReport, filters.days, fetchReportData]);

  const handleReportChange = (reportId: ReportId) => {
    setSelectedReport(reportId);
    setReportData(null);
  };

  const handleFilterChange = (days: number) => {
    setFilters({ ...filters, days });
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    const csv = convertToCSV(reportData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV 파일이 다운로드되었습니다.");
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    const json = JSON.stringify(reportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON 파일이 다운로드되었습니다.");
  };

  const renderReportContent = () => {
    const commonProps = {
      data: reportData,
      isLoading,
      onExportCSV: handleExportCSV,
      onExportJSON: handleExportJSON,
    };

    switch (selectedReport) {
      case "inventory-status":
        return <InventoryStatusReport {...commonProps} />;
      case "inventory-movement":
        return (
          <InventoryMovementReport
            {...commonProps}
            filterValue={filters.days}
            onFilterChange={handleFilterChange}
          />
        );
      case "order-status":
        return <OrderStatusReport {...commonProps} />;
      case "order-history":
        return (
          <OrderHistoryReport
            {...commonProps}
            filterValue={filters.days}
            onFilterChange={handleFilterChange}
          />
        );
      case "sales-analysis":
        return <SalesAnalysisReport {...commonProps} />;
      case "cost-analysis":
        return <CostAnalysisReport {...commonProps} />;
      case "supplier-performance":
        return (
          <SupplierPerformanceReport
            {...commonProps}
            filterValue={filters.days}
            onFilterChange={handleFilterChange}
          />
        );
      case "audit-summary":
        return <AuditSummaryReport {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">리포트</h1>
          <p className="text-[var(--text-secondary)]">
            비즈니스 데이터를 분석하고 인사이트를 확인합니다.
          </p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="glass-card p-2">
        <div className="flex flex-wrap gap-2">
          {reportDefinitions.map((report) => {
            const Icon = report.icon;
            const isActive = selectedReport === report.id;
            const colors = colorClasses[report.color];

            return (
              <button
                key={report.id}
                onClick={() => handleReportChange(report.id as ReportId)}
                disabled={isLoading}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 disabled:opacity-50
                  ${isActive ? colors.active : colors.inactive}
                `}
              >
                {isLoading && selectedReport === report.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {report.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Content */}
      <div className="min-h-[500px]">
        {renderReportContent()}
      </div>
    </div>
  );
}
