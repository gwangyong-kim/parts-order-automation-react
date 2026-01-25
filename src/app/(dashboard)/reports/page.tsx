"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Package,
  ShoppingCart,
  Warehouse,
  DollarSign,
  Calendar,
  PieChart,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: string;
}

const reports: ReportCard[] = [
  {
    id: "inventory-status",
    title: "재고 현황 리포트",
    description: "현재 재고량, 저재고 품목, 과재고 품목 분석",
    icon: Warehouse,
    color: "primary",
    category: "재고",
  },
  {
    id: "inventory-movement",
    title: "입출고 분석 리포트",
    description: "기간별 입고/출고 추이 및 품목별 이동 내역",
    icon: TrendingUp,
    color: "success",
    category: "재고",
  },
  {
    id: "order-status",
    title: "발주 현황 리포트",
    description: "발주 상태별 현황 및 공급업체별 발주 분석",
    icon: ShoppingCart,
    color: "info",
    category: "발주",
  },
  {
    id: "order-history",
    title: "발주 이력 리포트",
    description: "기간별 발주 이력 및 금액 분석",
    icon: FileText,
    color: "warning",
    category: "발주",
  },
  {
    id: "sales-analysis",
    title: "수주 분석 리포트",
    description: "고객별, 제품별 수주 현황 및 추이",
    icon: BarChart3,
    color: "primary",
    category: "수주",
  },
  {
    id: "cost-analysis",
    title: "비용 분석 리포트",
    description: "파츠별 구매 비용 및 재고 자산 가치 분석",
    icon: DollarSign,
    color: "success",
    category: "재무",
  },
  {
    id: "supplier-performance",
    title: "공급업체 성과 리포트",
    description: "공급업체별 납기 준수율, 품질 분석",
    icon: Package,
    color: "info",
    category: "공급업체",
  },
  {
    id: "audit-summary",
    title: "실사 결과 리포트",
    description: "실사 불일치 현황 및 조정 이력",
    icon: PieChart,
    color: "warning",
    category: "실사",
  },
];

const colorClasses: Record<string, string> = {
  primary: "bg-[var(--primary)]/10 text-[var(--primary)]",
  success: "bg-[var(--success)]/10 text-[var(--success)]",
  warning: "bg-[var(--warning)]/10 text-[var(--warning)]",
  info: "bg-[var(--info)]/10 text-[var(--info)]",
};

interface ReportData {
  reportType: string;
  generatedAt: string;
  summary: Record<string, number | string>;
  [key: string]: unknown;
}

async function fetchReport(reportId: string): Promise<ReportData> {
  const res = await fetch(`/api/reports?type=${reportId}`);
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
}

function convertToCSV(data: ReportData): string {
  const lines: string[] = [];

  // Header
  lines.push(`Report: ${data.reportType}`);
  lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString("ko-KR")}`);
  lines.push("");

  // Summary
  lines.push("=== Summary ===");
  Object.entries(data.summary).forEach(([key, value]) => {
    lines.push(`${key},${value}`);
  });
  lines.push("");

  // Other data arrays
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0) {
      lines.push(`=== ${key} ===`);
      // Headers
      const headers = Object.keys(value[0]);
      lines.push(headers.join(","));
      // Rows
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
  const [previewData, setPreviewData] = useState<ReportData | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const categories = [...new Set(reports.map((r) => r.category))];

  const fetchMutation = useMutation({
    mutationFn: fetchReport,
    onError: () => {
      toast.error("리포트 생성에 실패했습니다.");
    },
  });

  const handlePreview = async (report: ReportCard) => {
    try {
      const data = await fetchMutation.mutateAsync(report.id);
      setPreviewData(data);
      setPreviewTitle(report.title);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDownloadCSV = async (reportId: string, title: string) => {
    try {
      const data = await fetchMutation.mutateAsync(reportId);
      const csv = convertToCSV(data);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("리포트가 다운로드되었습니다.");
    } catch {
      // Error handled by mutation
    }
  };

  const handleDownloadJSON = async (reportId: string, title: string) => {
    try {
      const data = await fetchMutation.mutateAsync(reportId);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("리포트가 다운로드되었습니다.");
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">리포트</h1>
          <p className="text-[var(--text-secondary)]">
            다양한 분석 리포트를 생성하고 다운로드합니다.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">사용 가능</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{reports.length}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">재고 리포트</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {reports.filter((r) => r.category === "재고").length}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--info)]/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">발주 리포트</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {reports.filter((r) => r.category === "발주").length}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">카테고리</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{categories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports by Category */}
      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {category} 리포트
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports
              .filter((r) => r.category === category)
              .map((report) => (
                <div
                  key={report.id}
                  className="glass-card p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[report.color]}`}
                    >
                      <report.icon className="w-6 h-6" />
                    </div>
                    <span className="badge badge-secondary">{report.category}</span>
                  </div>

                  <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                    {report.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    {report.description}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(report)}
                      disabled={fetchMutation.isPending}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      {fetchMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                      미리보기
                    </button>
                    <button
                      onClick={() => handleDownloadCSV(report.id, report.title)}
                      disabled={fetchMutation.isPending}
                      className="btn-primary flex items-center justify-center gap-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                      title="CSV 다운로드"
                      aria-label="CSV 다운로드"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewData(null)}
          />
          <div className="relative glass-card w-full max-w-4xl max-h-[80vh] overflow-hidden m-4">
            <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {previewTitle}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  생성일: {new Date(previewData.generatedAt).toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadCSV(previewData.reportType, previewTitle)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={() => handleDownloadJSON(previewData.reportType, previewTitle)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => setPreviewData(null)}
                  className="p-2 hover:bg-[var(--gray-100)] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(80vh-80px)]">
              {/* Summary */}
              <div className="mb-6">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">요약</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(previewData.summary).map(([key, value]) => (
                    <div key={key} className="bg-[var(--glass-bg)] p-3 rounded-lg">
                      <p className="text-sm text-[var(--text-muted)] capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-lg font-bold text-[var(--text-primary)]">
                        {typeof value === "number"
                          ? value.toLocaleString("ko-KR", {
                              maximumFractionDigits: 2,
                            })
                          : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Tables */}
              {Object.entries(previewData).map(([key, value]) => {
                if (
                  key === "reportType" ||
                  key === "generatedAt" ||
                  key === "summary" ||
                  key === "period" ||
                  !Array.isArray(value) ||
                  value.length === 0
                ) {
                  return null;
                }

                return (
                  <div key={key} className="mb-6">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-3 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--glass-border)]">
                            {Object.keys(value[0]).map((header) => (
                              <th
                                key={header}
                                className="table-header text-left capitalize"
                              >
                                {header.replace(/([A-Z])/g, " $1").trim()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {value.slice(0, 10).map((row: Record<string, unknown>, i: number) => (
                            <tr
                              key={i}
                              className="border-b border-[var(--glass-border)]"
                            >
                              {Object.values(row).map((cell, j) => (
                                <td key={j} className="table-cell">
                                  {typeof cell === "number"
                                    ? cell.toLocaleString("ko-KR", {
                                        maximumFractionDigits: 2,
                                      })
                                    : cell instanceof Date
                                    ? new Date(cell).toLocaleDateString("ko-KR")
                                    : String(cell ?? "-")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {value.length > 10 && (
                        <p className="text-sm text-[var(--text-muted)] mt-2 text-center">
                          ... 및 {value.length - 10}개 더 (전체 데이터는 다운로드하세요)
                        </p>
                      )}
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
