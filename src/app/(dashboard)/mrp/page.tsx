"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnResizeMode,
} from "@tanstack/react-table";
import {
  Calculator,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
  CheckSquare,
  Square,
  X,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";

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
  salesOrder?: {
    id: number;
    orderCode: string;
    project?: string | null;
  } | null;
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

async function createOrdersFromMrp(
  items: { partId: number; orderQty: number; salesOrderId?: number | null }[],
  options: { orderDate?: string; expectedDate?: string; notes?: string } = {}
): Promise<{ success: boolean; data: { totalOrders: number; totalAmount: number } }> {
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

const columnHelper = createColumnHelper<MrpResult>();

export default function MrpPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermission();
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const { data: results, isLoading, error } = useQuery({
    queryKey: ["mrp-results"],
    queryFn: fetchMrpResults,
    refetchOnMount: "always",      // 페이지 진입 시 항상 최신 데이터 fetch
    refetchOnWindowFocus: true,    // 창 포커스 시 refetch
    staleTime: 0,                  // 항상 stale 상태로 취급
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
      // 이미 발주된 항목(ORDERED)은 제외
      const targetResults = useAll
        ? results?.filter((r) => r.recommendedOrderQty > 0 && r.status !== "ORDERED") || []
        : results?.filter((r) => selectedIds.has(r.id) && r.status !== "ORDERED") || [];
      const items = targetResults.map((r) => ({
        partId: r.partId || r.part?.id || 0,
        orderQty: r.recommendedOrderQty,
        salesOrderId: r.salesOrderId,
      }));
      return createOrdersFromMrp(items, {
        orderDate,
        expectedDate: expectedDate || undefined,
        notes: orderNotes || undefined,
      });
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      // 발주 후 MRP 재계산 실행
      try {
        await fetch("/api/mrp/calculate", { method: "POST" });
      } catch {
        console.error("MRP 재계산 실패");
      }
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });

      setSelectedIds(new Set());
      setShowOrderModal(false);
      setOrderNotes("");
      toast.success(
        `발주서 ${data.data.totalOrders}건 생성 완료 (₩${Math.round(data.data.totalAmount).toLocaleString()})`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "발주서 생성에 실패했습니다.");
    },
  });

  const filteredResults = useMemo(() => {
    if (!results) return [];
    return showRecommendedOnly ? results.filter((r) => r.recommendedOrderQty > 0) : results;
  }, [results, showRecommendedOnly]);

  // 선택 가능한 결과: 발주 필요하고 아직 발주되지 않은 항목
  const selectableResults = useMemo(
    () => filteredResults.filter((r) => r.recommendedOrderQty > 0 && r.status !== "ORDERED"),
    [filteredResults]
  );

  const selectedResults = useMemo(
    () => results?.filter((r) => selectedIds.has(r.id)) || [],
    [results, selectedIds]
  );

  const selectionSummary = useMemo(() => {
    const totalAmount = selectedResults.reduce(
      (sum, r) => sum + r.recommendedOrderQty * (r.part?.unitPrice || 0),
      0
    );
    return { count: selectedResults.length, totalAmount };
  }, [selectedResults]);

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

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableResults.map((r) => r.id)));
    }
  };

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
  const criticalCount = results?.filter((r) => r.urgency === "CRITICAL" && r.status !== "ORDERED").length || 0;
  const highCount = results?.filter((r) => r.urgency === "HIGH" && r.status !== "ORDERED").length || 0;
  const recommendedCount = results?.filter((r) => r.recommendedOrderQty > 0 && r.status !== "ORDERED").length || 0;
  const orderedCount = results?.filter((r) => r.status === "ORDERED").length || 0;

  const handleQuickOrderAll = () => {
    if (recommendedCount === 0) {
      toast.error("발주할 품목이 없습니다.");
      return;
    }
    if (confirm(`발주 필요 품목 ${recommendedCount}개를 모두 발주하시겠습니까? (이미 발주된 ${orderedCount}개는 제외됩니다)`)) {
      createOrderMutation.mutate(true);
    }
  };

  // Tanstack Table 컬럼 정의
  const columns = useMemo(
    () => [
      // 체크박스 컬럼
      columnHelper.display({
        id: "select",
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        header: () => null,
        cell: ({ row }) => {
          const isOrdered = row.original.status === "ORDERED";
          const canSelect = can("orders", "create") && row.original.recommendedOrderQty > 0 && !isOrdered;

          if (!can("orders", "create") || row.original.recommendedOrderQty <= 0) return null;

          if (isOrdered) {
            return (
              <span className="text-[var(--success)]" title="이미 발주됨">
                <CheckCircle className="w-4 h-4" />
              </span>
            );
          }

          return (
            <input
              type="checkbox"
              checked={selectedIds.has(row.original.id)}
              onChange={() => toggleSelect(row.original.id)}
              disabled={!canSelect}
              className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          );
        },
      }),
      // 긴급도
      columnHelper.accessor("urgency", {
        header: "긴급도",
        size: 80,
        minSize: 70,
        maxSize: 100,
        cell: (info) => (
          <span className={`badge ${urgencyColors[info.getValue()]}`}>
            {urgencyLabels[info.getValue()]}
          </span>
        ),
      }),
      // 파츠
      columnHelper.accessor((row) => row.part?.partNumber ?? row.part?.partCode ?? "-", {
        id: "part",
        header: "파츠",
        size: 200,
        minSize: 150,
        maxSize: 300,
        cell: ({ row }) => (
          <Link
            href={`/parts/${row.original.part?.id}`}
            className="font-medium text-[var(--primary)] hover:underline truncate block"
            title={`${row.original.part?.partNumber ?? row.original.part?.partCode ?? "-"} - ${row.original.part?.partName ?? ""}`}
          >
            {row.original.part?.partNumber ?? row.original.part?.partCode ?? "-"}
            {row.original.part?.partName && (
              <span className="text-[var(--text-muted)] font-normal ml-1">
                ({row.original.part.partName})
              </span>
            )}
          </Link>
        ),
      }),
      // 공급업체
      columnHelper.accessor((row) => row.part?.supplier?.name ?? "미지정", {
        id: "supplier",
        header: "공급업체",
        size: 110,
        minSize: 90,
        maxSize: 160,
        cell: (info) =>
          info.getValue() !== "미지정" ? (
            <span className="truncate block">{info.getValue()}</span>
          ) : (
            <span className="text-[var(--text-muted)]">미지정</span>
          ),
      }),
      // 프로젝트
      columnHelper.accessor((row) => row.salesOrder?.project ?? null, {
        id: "project",
        header: "프로젝트",
        size: 120,
        minSize: 80,
        maxSize: 180,
        cell: (info) =>
          info.getValue() ? (
            <span className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-medium truncate block">
              {info.getValue()}
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">-</span>
          ),
      }),
      // 총 소요량
      columnHelper.accessor("totalRequirement", {
        header: "총 소요량",
        size: 100,
        minSize: 90,
        maxSize: 120,
        cell: (info) => (
          <span className="tabular-nums text-right block">{info.getValue().toLocaleString()}</span>
        ),
      }),
      // 현재고
      columnHelper.accessor("currentStock", {
        header: "현재고",
        size: 85,
        minSize: 75,
        maxSize: 100,
        cell: (info) => (
          <span className="tabular-nums text-right block">{info.getValue().toLocaleString()}</span>
        ),
      }),
      // 입고예정
      columnHelper.accessor("incomingQty", {
        header: "입고예정",
        size: 95,
        minSize: 85,
        maxSize: 110,
        cell: (info) => (
          <span className="tabular-nums text-right block">{info.getValue().toLocaleString()}</span>
        ),
      }),
      // 안전재고
      columnHelper.accessor("safetyStock", {
        header: "안전재고",
        size: 95,
        minSize: 85,
        maxSize: 110,
        cell: (info) => (
          <span className="tabular-nums text-right block text-[var(--text-secondary)]">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 순소요량
      columnHelper.accessor("netRequirement", {
        header: "순소요량",
        size: 95,
        minSize: 85,
        maxSize: 110,
        cell: (info) => {
          const value = info.getValue();
          return (
            <span
              className={`tabular-nums text-right block font-medium ${
                value > 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
              }`}
            >
              {value.toLocaleString()}
            </span>
          );
        },
      }),
      // 권장 발주량
      columnHelper.accessor("recommendedOrderQty", {
        header: "권장 발주량",
        size: 115,
        minSize: 105,
        maxSize: 140,
        cell: (info) => {
          const value = info.getValue();
          return value > 0 ? (
            <span className="tabular-nums text-right block font-bold text-[var(--primary)]">
              {value.toLocaleString()}
            </span>
          ) : (
            <span className="text-[var(--text-muted)] text-right block">-</span>
          );
        },
      }),
      // 단가
      columnHelper.accessor((row) => row.part?.unitPrice ?? 0, {
        id: "unitPrice",
        header: "단가",
        size: 95,
        minSize: 80,
        maxSize: 120,
        cell: (info) => (
          <span className="tabular-nums text-right block text-sm">
            {info.getValue() > 0 ? `₩${info.getValue().toLocaleString()}` : "-"}
          </span>
        ),
      }),
      // 권장 발주일
      columnHelper.accessor("recommendedOrderDate", {
        header: "권장 발주일",
        size: 115,
        minSize: 105,
        maxSize: 140,
        cell: (info) => (
          <span className="whitespace-nowrap">
            {info.getValue() ? new Date(info.getValue()!).toLocaleDateString("ko-KR") : "-"}
          </span>
        ),
      }),
    ],
    [selectedIds, can]
  );

  const table = useReactTable({
    data: filteredResults,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="로딩 중"
        />
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
          {can("mrp", "create") && (
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
          )}
          {can("orders", "create") && (
            <button
              onClick={handleQuickOrderAll}
              disabled={createOrderMutation.isPending || recommendedCount === 0}
              className="btn-warning flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createOrderMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              전체 발주 ({recommendedCount})
            </button>
          )}
          {can("orders", "create") && selectedIds.size > 0 && (
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="w-10 h-10 bg-[var(--info)]/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">발주 완료</p>
              <p className="text-xl font-bold text-[var(--info)]">{orderedCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[var(--success)]" />
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
                showRecommendedOnly ? "bg-[var(--primary)] text-white" : "btn-secondary"
              }`}
            >
              발주 필요 ({recommendedCount})
            </button>
            <button
              onClick={() => setShowRecommendedOnly(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                !showRecommendedOnly ? "bg-[var(--primary)] text-white" : "btn-secondary"
              }`}
            >
              전체 ({results?.length || 0})
            </button>
          </div>
          <div className="h-6 w-px bg-[var(--glass-border)]" />
          {can("orders", "create") && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg btn-secondary text-sm"
            >
              {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allSelected ? "선택 해제" : "전체 선택"}
            </button>
          )}
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

      {/* MRP Results Table - Tanstack Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tanstack-table" style={{ minWidth: table.getCenterTotalSize() }}>
            <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="relative px-3 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap border-r border-[var(--glass-border)] last:border-r-0"
                      style={{ width: header.getSize() }}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          header.column.getCanSort() ? "cursor-pointer select-none hover:text-[var(--text-primary)]" : ""
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-[var(--text-muted)]">
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                      {/* 컬럼 리사이즈 핸들 */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-[var(--primary)] ${
                            header.column.getIsResizing() ? "bg-[var(--primary)]" : "bg-transparent"
                          }`}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <Calculator className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {error
                        ? "MRP 결과를 불러오는데 실패했습니다."
                        : "MRP 계산 결과가 없습니다. 계산을 실행해주세요."}
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-[var(--glass-bg)] transition-colors ${
                      row.original.urgency === "CRITICAL" ? "bg-[var(--danger)]/5" : ""
                    } ${selectedIds.has(row.original.id) ? "bg-[var(--primary)]/5" : ""}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-3 text-sm border-r border-[var(--glass-border)] last:border-r-0"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* 테이블 하단 안내 */}
        {filteredResults.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50 text-xs text-[var(--text-muted)]">
            헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬
          </div>
        )}
      </div>

      {/* Order Creation Modal */}
      {showOrderModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowOrderModal(false)}
        >
          <div
            className="glass-card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                선택 품목 발주
              </h2>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1.5 hover:bg-[var(--glass-bg)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
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
                  <p className="font-bold text-lg text-[var(--primary)]">
                    ₩{Math.round(selectionSummary.totalAmount).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {groupedBySupplier.map((group, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)] text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="font-medium">{group.supplier}</span>
                    </div>
                    <span className="text-[var(--text-muted)]">
                      {group.items.length}개 · ₩
                      {Math.round(
                        group.items.reduce(
                          (sum, r) => sum + r.recommendedOrderQty * (r.part?.unitPrice || 0),
                          0
                        )
                      ).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

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
