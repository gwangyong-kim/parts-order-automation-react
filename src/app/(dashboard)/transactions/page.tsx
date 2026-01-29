"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
  Edit2,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import TransactionForm from "@/components/forms/TransactionForm";
import ExcelUpload from "@/components/ui/ExcelUpload";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";

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
  partId: number;
  part: {
    id: number;
    partCode?: string;
    partNumber?: string;
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
  const res = await fetch("/api/transactions?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const result = await res.json();
  return result.data;
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

async function updateTransaction(id: number, data: Partial<TransactionInput>): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to update transaction");
  }
  return res.json();
}

async function deleteTransaction(id: number): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to delete transaction");
  }
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

const columnHelper = createColumnHelper<Transaction>();

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const filterRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

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
      tx.part.partCode || tx.part.partNumber,
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
      setSelectedTransaction(null);
    },
    onError: () => {
      toast.error("입출고 처리에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TransactionInput> }) =>
      updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("입출고 내역이 수정되었습니다.");
      setShowFormModal(false);
      setSelectedTransaction(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "입출고 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("입출고 내역이 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedTransaction(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "입출고 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedTransaction(null);
    setShowFormModal(true);
  };

  const handleEdit = (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTransaction(tx);
    setShowFormModal(true);
  };

  const handleDelete = (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTransaction(tx);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: Partial<TransactionInput>) => {
    if (selectedTransaction) {
      updateMutation.mutate({ id: selectedTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedTransaction) {
      deleteMutation.mutate(selectedTransaction.id);
    }
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

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    return transactions.filter((tx) => {
      const partCode = tx.part.partCode || tx.part.partNumber || "";
      const matchesSearch =
        tx.transactionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  }, [transactions, searchTerm, typeFilter, dateFilter]);

  // TanStack Table 컬럼 정의
  const columns = useMemo(
    () => [
      // 거래코드
      columnHelper.accessor("transactionCode", {
        header: "거래코드",
        size: 130,
        minSize: 100,
        maxSize: 180,
        cell: ({ row }) => (
          <Link
            href={`/transactions/${row.original.id}`}
            className="font-medium font-mono text-xs text-[var(--primary)] hover:underline truncate block"
            onClick={(e) => e.stopPropagation()}
            title={row.original.transactionCode}
          >
            {row.original.transactionCode}
          </Link>
        ),
      }),
      // 유형
      columnHelper.accessor("transactionType", {
        header: "유형",
        size: 80,
        minSize: 70,
        maxSize: 100,
        cell: ({ row }) => {
          const Icon = typeIcons[row.original.transactionType] || ArrowLeftRight;
          return (
            <span
              className={`badge ${typeColors[row.original.transactionType] || "badge-secondary"} inline-flex items-center gap-1`}
            >
              <Icon className="w-3 h-3" />
              {typeLabels[row.original.transactionType] || row.original.transactionType}
            </span>
          );
        },
      }),
      // 파츠
      columnHelper.accessor((row) => row.part.partCode || row.part.partNumber || "", {
        id: "part",
        header: "파츠",
        size: 200,
        minSize: 150,
        maxSize: 300,
        cell: ({ row }) => {
          const partCode = row.original.part.partCode || row.original.part.partNumber || "";
          return (
            <div className="min-w-0">
              <Link
                href={`/parts/${row.original.part.id}`}
                className="font-medium text-[var(--primary)] hover:underline truncate block"
                onClick={(e) => e.stopPropagation()}
                title={partCode}
              >
                {partCode}
              </Link>
              <p className="text-sm text-[var(--text-muted)] truncate" title={row.original.part.partName}>
                {row.original.part.partName}
              </p>
            </div>
          );
        },
      }),
      // 수량
      columnHelper.accessor("quantity", {
        header: "수량",
        size: 90,
        minSize: 70,
        maxSize: 120,
        cell: ({ row }) => (
          <span
            className={`tabular-nums text-right block font-bold ${
              row.original.transactionType === "INBOUND"
                ? "text-[var(--success)]"
                : row.original.transactionType === "OUTBOUND"
                ? "text-[var(--danger)]"
                : "text-[var(--text-primary)]"
            }`}
          >
            {row.original.transactionType === "INBOUND" ? "+" : row.original.transactionType === "OUTBOUND" ? "-" : ""}
            {row.original.quantity.toLocaleString()}
          </span>
        ),
      }),
      // 이전재고
      columnHelper.accessor("beforeQty", {
        header: "이전",
        size: 80,
        minSize: 60,
        maxSize: 100,
        cell: (info) => (
          <span className="tabular-nums text-right block text-[var(--text-secondary)]">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 이후재고
      columnHelper.accessor("afterQty", {
        header: "이후",
        size: 80,
        minSize: 60,
        maxSize: 100,
        cell: (info) => (
          <span className="tabular-nums text-right block font-medium">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 참조
      columnHelper.accessor("referenceType", {
        header: "참조",
        size: 70,
        minSize: 50,
        maxSize: 100,
        cell: (info) => (
          <span className="text-center block text-[var(--text-secondary)]">
            {info.getValue() || "-"}
          </span>
        ),
      }),
      // 처리자
      columnHelper.accessor((row) => row.createdBy?.name || "-", {
        id: "createdBy",
        header: "처리자",
        size: 80,
        minSize: 60,
        maxSize: 120,
        cell: (info) => (
          <span className="text-center block">{info.getValue()}</span>
        ),
      }),
      // 비고
      columnHelper.accessor("notes", {
        header: "비고",
        size: 150,
        minSize: 100,
        maxSize: 250,
        cell: (info) => (
          <span className="text-sm text-[var(--text-secondary)] truncate block" title={info.getValue() || ""}>
            {info.getValue() || "-"}
          </span>
        ),
      }),
      // 일시
      columnHelper.accessor("createdAt", {
        header: "일시",
        size: 160,
        minSize: 130,
        maxSize: 200,
        cell: (info) => (
          <span className="text-right block text-[var(--text-secondary)] text-sm whitespace-nowrap">
            {new Date(info.getValue()).toLocaleString("ko-KR")}
          </span>
        ),
      }),
      // 작업
      columnHelper.display({
        id: "actions",
        header: "작업",
        size: 80,
        minSize: 70,
        maxSize: 100,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            {can("inventory", "edit") && (
              <button
                onClick={(e) => handleEdit(row.original, e)}
                className="table-action-btn edit"
                title="수정"
                aria-label={`${row.original.transactionCode} 수정`}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {can("inventory", "delete") && (
              <button
                onClick={(e) => handleDelete(row.original, e)}
                className="table-action-btn delete"
                title="삭제"
                aria-label={`${row.original.transactionCode} 삭제`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ),
      }),
    ],
    [can]
  );

  const table = useReactTable({
    data: filteredTransactions,
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
        {can("inventory", "create") && (
          <button onClick={handleCreate} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            수동 입출고
          </button>
        )}
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

            {can("inventory", "export") && (
              <button onClick={handleExport} className="btn-secondary">
                <Download className="w-4 h-4" />
                내보내기
              </button>
            )}
            {can("inventory", "import") && (
              <button onClick={() => setShowUploadModal(true)} className="btn-secondary">
                <Upload className="w-4 h-4" />
                가져오기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table - TanStack Table */}
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
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm || typeFilter ? "검색 결과가 없습니다." : "입출고 내역이 없습니다."}
                    </p>
                    {!searchTerm && !typeFilter && can("inventory", "create") && (
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
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--glass-bg)] transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/transactions/${row.original.id}`}
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
        {filteredTransactions.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50 text-xs text-[var(--text-muted)]">
            헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬
          </div>
        )}
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedTransaction(null);
        }}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        initialData={selectedTransaction}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedTransaction(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="입출고 내역 삭제"
        message={`"${selectedTransaction?.transactionCode}" 내역을 삭제하시겠습니까?\n\n삭제 시 재고가 해당 트랜잭션 이전 상태로 롤백됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
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
