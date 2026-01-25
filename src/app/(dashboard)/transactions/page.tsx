"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeftRight,
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import TransactionForm from "@/components/forms/TransactionForm";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";

const transactionUploadFields = [
  { name: "파츠코드", description: "파츠 코드", required: false, type: "text", example: "P2501-0001" },
  { name: "파츠명", description: "파츠명 (코드 없을 시 사용)", required: false, type: "text", example: "볼트 M8" },
  { name: "유형", description: "입고/출고/조정 (INBOUND, OUTBOUND, ADJUSTMENT)", required: true, type: "text", example: "입고" },
  { name: "수량", description: "거래 수량", required: true, type: "number", example: "100" },
  { name: "참조유형", description: "참조 문서 유형 (SO, PO 등)", required: false, type: "text", example: "PO" },
  { name: "참조번호", description: "참조 문서 번호", required: false, type: "text", example: "PO2501-0001" },
  { name: "담당자", description: "처리 담당자", required: false, type: "text", example: "홍길동" },
  { name: "비고", description: "기타 메모", required: false, type: "text", example: "긴급 입고" },
];

interface Transaction {
  id: number;
  transactionCode: string;
  transactionType: string;
  part: {
    id: number;
    partNumber: string;
    partName: string;
  };
  quantity: number;
  beforeQty: number;
  afterQty: number;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
  } | null;
}

interface TransactionInput {
  partId: number;
  transactionType: string;
  quantity: number;
  notes: string | null;
}

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

async function createTransaction(data: Partial<TransactionInput>): Promise<Transaction> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create transaction");
  return res.json();
}

const typeColors: Record<string, string> = {
  INBOUND: "badge-success",
  OUTBOUND: "badge-danger",
  ADJUSTMENT: "badge-warning",
  TRANSFER: "badge-info",
};

const typeLabels: Record<string, string> = {
  INBOUND: "입고",
  OUTBOUND: "출고",
  ADJUSTMENT: "조정",
  TRANSFER: "이동",
};

const typeIcons: Record<string, React.ElementType> = {
  INBOUND: ArrowDownRight,
  OUTBOUND: ArrowUpRight,
  ADJUSTMENT: RotateCcw,
  TRANSFER: ArrowLeftRight,
};

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const filterRef = useRef<HTMLDivElement>(null);

  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["거래코드", "유형", "파츠번호", "파츠명", "수량", "이전재고", "이후재고", "참조", "처리자", "일시"];
    const rows = filteredTransactions.map((tx) => [
      tx.transactionCode,
      typeLabels[tx.transactionType] || tx.transactionType,
      tx.part.partNumber,
      tx.part.partName,
      tx.quantity,
      tx.beforeQty,
      tx.afterQty,
      tx.referenceType || "",
      tx.createdBy?.name || "",
      new Date(tx.createdAt).toLocaleString("ko-KR"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  const clearFilters = () => {
    setDateFilter("all");
    setTypeFilter(null);
    setShowFilterDropdown(false);
  };

  const hasActiveFilters = dateFilter !== "all" || typeFilter !== null;

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("입출고가 처리되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("입출고 처리에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setShowFormModal(true);
  };

  const handleFormSubmit = (data: Partial<TransactionInput>) => {
    createMutation.mutate(data);
  };

  const handleBulkUpload = async (data: Record<string, unknown>[]) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "업로드 실패");
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(result.message);
      setShowUploadModal(false);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch =
      tx.transactionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.part.partName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter ? tx.transactionType === typeFilter : true;

    // 기간 필터
    const txDate = new Date(tx.createdAt);
    const now = new Date();
    let matchesDate = true;
    if (dateFilter === "today") {
      matchesDate = txDate.toDateString() === now.toDateString();
    } else if (dateFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = txDate >= weekAgo;
    } else if (dateFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = txDate >= monthAgo;
    }

    return matchesSearch && matchesType && matchesDate;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="로딩 중" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">데이터를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">입출고 내역</h1>
          <p className="text-[var(--text-secondary)]">
            파츠 입고, 출고, 조정 내역을 관리합니다.
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          수동 입출고
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(typeLabels).map(([type, label]) => {
          const count = transactions?.filter((tx) => tx.transactionType === type).length || 0;
          const Icon = typeIcons[type];
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`glass-card p-4 text-left transition-all ${
                typeFilter === type ? "ring-2 ring-[var(--primary)]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    type === "INBOUND"
                      ? "bg-[var(--success)]/10"
                      : type === "OUTBOUND"
                      ? "bg-[var(--danger)]/10"
                      : type === "ADJUSTMENT"
                      ? "bg-[var(--warning)]/10"
                      : "bg-[var(--info)]/10"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      type === "INBOUND"
                        ? "text-[var(--success)]"
                        : type === "OUTBOUND"
                        ? "text-[var(--danger)]"
                        : type === "ADJUSTMENT"
                        ? "text-[var(--warning)]"
                        : "text-[var(--info)]"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">{label}</p>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{count}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="거래코드 또는 파츠으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`btn-secondary ${hasActiveFilters ? "ring-2 ring-[var(--primary-500)] ring-offset-1" : ""}`}
              >
                <Filter className="w-4 h-4" />
                기간 필터
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary-500)] text-white rounded-full">
                    {(dateFilter !== "all" ? 1 : 0) + (typeFilter !== null ? 1 : 0)}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? "rotate-180" : ""}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg py-3 z-50 animate-scale-in">
                  <div className="px-4 pb-2 mb-2 border-b border-[var(--gray-100)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--gray-900)]">필터</span>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs text-[var(--primary-500)] hover:underline">
                        초기화
                      </button>
                    )}
                  </div>
                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">기간</label>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="all">전체</option>
                      <option value="today">오늘</option>
                      <option value="week">최근 7일</option>
                      <option value="month">최근 30일</option>
                    </select>
                  </div>
                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">유형</label>
                    <select
                      value={typeFilter || ""}
                      onChange={(e) => setTypeFilter(e.target.value || null)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="">전체</option>
                      <option value="INBOUND">입고</option>
                      <option value="OUTBOUND">출고</option>
                      <option value="ADJUSTMENT">조정</option>
                      <option value="TRANSFER">이동</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" />
              내보내기
            </button>
            <button onClick={() => setShowUploadModal(true)} className="btn-secondary">
              <Upload className="w-4 h-4" />
              가져오기
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">거래코드</th>
                <th className="table-header">유형</th>
                <th className="table-header">파츠</th>
                <th className="table-header text-right">수량</th>
                <th className="table-header text-right">이전</th>
                <th className="table-header text-right">이후</th>
                <th className="table-header">참조</th>
                <th className="table-header">처리자</th>
                <th className="table-header">일시</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-8">
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm || typeFilter ? "검색 결과가 없습니다." : "입출고 내역이 없습니다."}
                    </p>
                    {!searchTerm && !typeFilter && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 입출고 등록하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTransactions?.map((tx) => {
                  const Icon = typeIcons[tx.transactionType] || ArrowLeftRight;
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
                    >
                      <td className="table-cell font-medium">{tx.transactionCode}</td>
                      <td className="table-cell">
                        <span
                          className={`badge ${typeColors[tx.transactionType] || "badge-secondary"} flex items-center gap-1 w-fit`}
                        >
                          <Icon className="w-3 h-3" />
                          {typeLabels[tx.transactionType] || tx.transactionType}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div>
                          <Link
                            href={`/parts/${tx.part.id}`}
                            className="font-medium text-[var(--primary)] hover:underline"
                          >
                            {tx.part.partNumber}
                          </Link>
                          <p className="text-sm text-[var(--text-muted)]">{tx.part.partName}</p>
                        </div>
                      </td>
                      <td className="table-cell text-right">
                        <span
                          className={`font-bold ${
                            tx.transactionType === "INBOUND"
                              ? "text-[var(--success)]"
                              : tx.transactionType === "OUTBOUND"
                              ? "text-[var(--danger)]"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {tx.transactionType === "INBOUND" ? "+" : tx.transactionType === "OUTBOUND" ? "-" : ""}
                          {tx.quantity}
                        </span>
                      </td>
                      <td className="table-cell text-right text-[var(--text-secondary)] tabular-nums">
                        {tx.beforeQty}
                      </td>
                      <td className="table-cell text-right font-medium tabular-nums">{tx.afterQty}</td>
                      <td className="table-cell text-[var(--text-secondary)]">
                        {tx.referenceType || "-"}
                      </td>
                      <td className="table-cell">{tx.createdBy?.name || "-"}</td>
                      <td className="table-cell text-[var(--text-secondary)]">
                        {new Date(tx.createdAt).toLocaleString("ko-KR")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Excel Upload Modal */}
      <ExcelUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="입출고 대량 등록"
        templateName="입출고"
        fields={transactionUploadFields}
        isLoading={isUploading}
      />
    </div>
  );
}
