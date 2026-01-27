"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calculator,
  Play,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
  CheckSquare,
  Square,
  X,
  Building2,
  Package,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface MrpResult {
  id: number;
  partId: number;
  part: {
    id: number;
    partCode: string;
    partNumber?: string;
    partName: string;
    unit: string;
    leadTime: number;
    unitPrice?: number;
    supplierId?: number;
    supplier?: {
      id: number;
      name: string;
    };
  };
  salesOrderId: number | null;
  totalRequirement: number;
  grossRequirement?: number;
  currentStock: number;
  incomingQty: number;
  safetyStock: number;
  netRequirement: number;
  recommendedOrderQty: number;
  suggestedOrderQty?: number;
  recommendedOrderDate: string | null;
  suggestedOrderDate?: string | null;
  urgency: string;
  status?: string;
  calculatedAt: string;
  calculationDate?: string;
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

async function createOrdersFromMrp(items: { partId: number; orderQty: number }[], options: { orderDate?: string; expectedDate?: string; notes?: string } = {}): Promise<{ success: boolean; data: { totalOrders: number; totalAmount: number } }> {
  const res = await fetch("/api/orders/from-mrp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, ...options }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create orders");
  }
  return res.json();
}

export default function MrpPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(true); // 기본값: 발주 필요 품목만
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const { data: results, isLoading, error } = useQuery({
    queryKey: ["mrp-results"],
    queryFn: fetchMrpResults,
  });

  const calculateMutation = useMutation({
    mutationFn: runMrpCalculation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      setSelectedIds(new Set());
      toast.success("MRP 계산이 완료되었습니다.");
    },
    onError: () => {
      toast.error("MRP 계산에 실패했습니다.");
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (useAll: boolean = false) => {
      const targetResults = useAll
        ? (results?.filter((r) => r.recommendedOrderQty > 0) || [])
        : (results?.filter((r) => selectedIds.has(r.id)) || []);
      const items = targetResults.map((r) => ({
        partId: r.partId || r.part?.id || 0,
        orderQty: r.recommendedOrderQty,
      }));
      return createOrdersFromMrp(items, { orderDate, expectedDate: expectedDate || undefined, notes: orderNotes || undefined });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedIds(new Set());
      setShowOrderModal(false);
      setOrderNotes("");
      toast.success(`발주서 ${data.data.totalOrders}건 생성 완료 (₩${Math.round(data.data.totalAmount).toLocaleString()})`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "발주서 생성에 실패했습니다.");
    },
  });

  // 전체 발주 (선택 없이 바로 발주)
  const handleQuickOrderAll = () => {
    if (recommendedCount === 0) {
      toast.error("발주할 품목이 없습니다.");
      return;
    }
    if (confirm(`발주 필요 품목 ${recommendedCount}개를 모두 발주하시겠습니까?`)) {
      createOrderMutation.mutate(true);
    }
  };

  const filteredResults = results?.filter((result) => {
    if (showRecommendedOnly) {
      return result.recommendedOrderQty > 0;
    }
    return true;
  });

  // 선택 가능한 품목 (발주 필요한 품목만)
  const selectableResults = filteredResults?.filter((r) => r.recommendedOrderQty > 0) || [];

  // 선택된 품목 정보
  const selectedResults = results?.filter((r) => selectedIds.has(r.id)) || [];

  // 선택 요약
  const selectionSummary = useMemo(() => {
    const totalAmount = selectedResults.reduce(
      (sum, r) => sum + r.recommendedOrderQty * (r.part?.unitPrice || 0),
      0
    );
    return {
      count: selectedResults.length,
      totalAmount,
    };
  }, [selectedResults]);

  // 공급업체별 그룹핑 (모달용)
  const groupedBySupplier = useMemo(() => {
    const groups: Record<string, { supplier: string; items: typeof selectedResults }> = {};
    for (const result of selectedResults) {
      const supplierName = result.part?.supplier?.name || "미지정";
      if (!groups[supplierName]) {
        groups[supplierName] = { supplier: supplierName, items: [] };
      }
      groups[supplierName].items.push(result);
    }
    return Object.values(groups);
  }, [selectedResults]);

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedIds.size === selectableResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableResults.map((r) => r.id)));
    }
  };

  // 개별 선택/해제
  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const allSelected = selectableResults.length > 0 && selectedIds.size === selectableResults.length;

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
            MRP 계산
          </button>
          <button
            onClick={handleQuickOrderAll}
            disabled={createOrderMutation.isPending || recommendedCount === 0}
            className="btn-success flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createOrderMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            전체 발주 ({recommendedCount})
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowOrderModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              선택 발주 ({selectedIds.size})
            </button>
          )}
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

      {/* Filters & Selection */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRecommendedOnly(true)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showRecommendedOnly
                  ? "bg-[var(--primary)] text-white"
                  : "btn-secondary"
              }`}
            >
              발주 필요 ({recommendedCount})
            </button>
            <button
              onClick={() => setShowRecommendedOnly(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                !showRecommendedOnly
                  ? "bg-[var(--primary)] text-white"
                  : "btn-secondary"
              }`}
            >
              전체 ({results?.length || 0})
            </button>
          </div>
          <div className="h-6 w-px bg-[var(--glass-border)]" />
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg btn-secondary text-sm"
          >
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? "선택 해제" : "전체 선택"}
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--success)]/10 text-[var(--success)] text-sm">
              <CheckSquare className="w-4 h-4" />
              <span className="font-medium">{selectionSummary.count}개 선택</span>
              <span className="text-[var(--text-muted)]">|</span>
              <span>₩{Math.round(selectionSummary.totalAmount).toLocaleString()}</span>
            </div>
          )}
          {results && results.length > 0 && (
            <p className="text-sm text-[var(--text-muted)] ml-auto">
              계산: {new Date(results[0].calculatedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      </div>

      {/* MRP Results Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-bordered">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header w-12"></th>
                <th className="table-header">긴급도</th>
                <th className="table-header">파츠</th>
                <th className="table-header">공급업체</th>
                <th className="table-header text-right">총 소요량</th>
                <th className="table-header text-right">현재고</th>
                <th className="table-header text-right">입고예정</th>
                <th className="table-header text-right">안전재고</th>
                <th className="table-header text-right">순소요량</th>
                <th className="table-header text-right">권장 발주량</th>
                <th className="table-header text-right">단가</th>
                <th className="table-header">권장 발주일</th>
              </tr>
            </thead>
            <tbody>
              {!filteredResults || filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={12} className="table-cell text-center py-8">
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
                    } ${selectedIds.has(result.id) ? "bg-[var(--primary)]/5" : ""}`}
                  >
                    <td className="table-cell">
                      {result.recommendedOrderQty > 0 && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(result.id)}
                          onChange={() => toggleSelect(result.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${urgencyColors[result.urgency]}`}>
                        {urgencyLabels[result.urgency]}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div>
                        <Link
                          href="/parts"
                          className="font-medium text-[var(--primary)] hover:underline"
                        >
                          {result.part?.partNumber ?? result.part?.partCode ?? "-"}
                        </Link>
                        <p className="text-sm text-[var(--text-muted)]">{result.part?.partName ?? "-"}</p>
                      </div>
                    </td>
                    <td className="table-cell text-sm">
                      {result.part?.supplier?.name ?? <span className="text-[var(--text-muted)]">미지정</span>}
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
                    <td className="table-cell text-right text-sm">
                      {result.part?.unitPrice ? `₩${result.part.unitPrice.toLocaleString()}` : "-"}
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

      {/* Order Creation Modal - Simplified */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowOrderModal(false)}>
          <div className="glass-card w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                선택 품목 발주
              </h2>
              <button onClick={() => setShowOrderModal(false)} className="p-1.5 hover:bg-[var(--glass-bg)] rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Quick Summary */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--primary)]/10">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">품목</p>
                    <p className="font-bold text-[var(--primary)]">{selectionSummary.count}개</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">공급업체</p>
                    <p className="font-bold text-[var(--primary)]">{groupedBySupplier.length}곳</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">예상 금액</p>
                  <p className="font-bold text-lg text-[var(--primary)]">₩{Math.round(selectionSummary.totalAmount).toLocaleString()}</p>
                </div>
              </div>

              {/* Supplier List - Compact */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {groupedBySupplier.map((group, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)] text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="font-medium">{group.supplier}</span>
                    </div>
                    <span className="text-[var(--text-muted)]">
                      {group.items.length}개 · ₩{Math.round(group.items.reduce((sum, r) => sum + r.recommendedOrderQty * (r.part?.unitPrice || 0), 0)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Optional: Notes */}
              <div>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm"
                  placeholder="비고 (선택사항)"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--glass-border)]">
              <button
                onClick={() => setShowOrderModal(false)}
                className="btn-secondary"
                disabled={createOrderMutation.isPending}
              >
                취소
              </button>
              <button
                onClick={() => createOrderMutation.mutate(false)}
                disabled={createOrderMutation.isPending || selectedIds.size === 0}
                className="btn-success flex items-center gap-2"
              >
                {createOrderMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4" />
                )}
                발주 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
