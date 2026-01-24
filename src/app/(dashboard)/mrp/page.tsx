"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  Play,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface MrpResult {
  id: number;
  part: {
    id: number;
    partNumber: string;
    partName: string;
    unit: string;
    leadTime: number;
  };
  salesOrderId: number | null;
  totalRequirement: number;
  currentStock: number;
  incomingQty: number;
  safetyStock: number;
  netRequirement: number;
  recommendedOrderQty: number;
  recommendedOrderDate: string | null;
  urgency: string;
  calculatedAt: string;
}

async function fetchMrpResults(): Promise<MrpResult[]> {
  const res = await fetch("/api/mrp");
  if (!res.ok) throw new Error("Failed to fetch MRP results");
  return res.json();
}

async function runMrpCalculation(): Promise<void> {
  const res = await fetch("/api/mrp/calculate", { method: "POST" });
  if (!res.ok) throw new Error("Failed to run MRP calculation");
}

const urgencyColors: Record<string, string> = {
  CRITICAL: "badge-danger",
  HIGH: "badge-warning",
  MEDIUM: "badge-info",
  LOW: "badge-secondary",
};

const urgencyLabels: Record<string, string> = {
  CRITICAL: "긴급",
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

export default function MrpPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);

  const { data: results, isLoading, error } = useQuery({
    queryKey: ["mrp-results"],
    queryFn: fetchMrpResults,
  });

  const calculateMutation = useMutation({
    mutationFn: runMrpCalculation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      toast.success("MRP 계산이 완료되었습니다.");
    },
    onError: () => {
      toast.error("MRP 계산에 실패했습니다.");
    },
  });

  const filteredResults = results?.filter((result) => {
    if (showRecommendedOnly) {
      return result.recommendedOrderQty > 0;
    }
    return true;
  });

  const criticalCount = results?.filter((r) => r.urgency === "CRITICAL").length || 0;
  const highCount = results?.filter((r) => r.urgency === "HIGH").length || 0;
  const recommendedCount = results?.filter((r) => r.recommendedOrderQty > 0).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="로딩 중" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">MRP 분석</h1>
          <p className="text-[var(--text-secondary)]">
            자재 소요량 계획(Material Requirements Planning)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {calculateMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            MRP 계산 실행
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            결과 다운로드
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--danger)]/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">긴급</p>
              <p className="text-xl font-bold text-[var(--danger)]">{criticalCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--warning)]/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">높음</p>
              <p className="text-xl font-bold text-[var(--warning)]">{highCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">발주 필요</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{recommendedCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">분석 완료</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{results?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowRecommendedOnly(!showRecommendedOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showRecommendedOnly
                ? "bg-[var(--primary)] text-white"
                : "btn-secondary"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            발주 필요 품목만
          </button>
          {results && results.length > 0 && (
            <p className="text-sm text-[var(--text-muted)]">
              마지막 계산: {new Date(results[0].calculatedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      </div>

      {/* MRP Results Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">긴급도</th>
                <th className="table-header">부품</th>
                <th className="table-header text-right">총 소요량</th>
                <th className="table-header text-right">현재고</th>
                <th className="table-header text-right">입고예정</th>
                <th className="table-header text-right">안전재고</th>
                <th className="table-header text-right">순소요량</th>
                <th className="table-header text-right">권장 발주량</th>
                <th className="table-header">권장 발주일</th>
              </tr>
            </thead>
            <tbody>
              {!filteredResults || filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-8">
                    <Calculator className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {error ? "MRP 결과를 불러오는데 실패했습니다." : "MRP 계산 결과가 없습니다. 계산을 실행해주세요."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr
                    key={result.id}
                    className={`border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors ${
                      result.urgency === "CRITICAL" ? "bg-[var(--danger)]/5" : ""
                    }`}
                  >
                    <td className="table-cell">
                      <span className={`badge ${urgencyColors[result.urgency]}`}>
                        {urgencyLabels[result.urgency]}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium">{result.part.partNumber}</p>
                        <p className="text-sm text-[var(--text-muted)]">{result.part.partName}</p>
                      </div>
                    </td>
                    <td className="table-cell text-right">{result.totalRequirement.toLocaleString()}</td>
                    <td className="table-cell text-right">{result.currentStock.toLocaleString()}</td>
                    <td className="table-cell text-right">{result.incomingQty.toLocaleString()}</td>
                    <td className="table-cell text-right text-[var(--text-secondary)]">
                      {result.safetyStock.toLocaleString()}
                    </td>
                    <td className="table-cell text-right">
                      <span
                        className={`font-medium ${
                          result.netRequirement > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
                        }`}
                      >
                        {result.netRequirement.toLocaleString()}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      {result.recommendedOrderQty > 0 ? (
                        <span className="font-bold text-[var(--primary)]">
                          {result.recommendedOrderQty.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {result.recommendedOrderDate
                        ? new Date(result.recommendedOrderDate).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
