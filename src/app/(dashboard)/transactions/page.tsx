"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ArrowLeftRight,
  Search,
  Download,
  Upload,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Edit2,
  Trash2,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import TransactionForm from "@/components/forms/TransactionForm";
import ExcelUpload from "@/components/ui/ExcelUpload";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";
import { exportToCSV, formatDateTimeKR } from "@/lib/export-utils";
import { createApiService } from "@/lib/api-client";

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

const transactionsApi = createApiService<Transaction, TransactionInput>("/api/transactions", { paginated: true });

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
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ["transactions"],
    queryFn: transactionsApi.getAll,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const handleExport = () => {
    try {
      exportToCSV({
        data: filteredTransactions,
        headers: ["거래코드", "유형", "파츠번호", "파츠명", "수량", "이전재고", "이후재고", "참조", "처리자", "일시"],
        rowMapper: (tx) => [
          tx.transactionCode,
          typeLabels[tx.transactionType] || tx.transactionType,
          tx.part.partCode || tx.part.partNumber,
          tx.part.partName,
          tx.quantity,
          tx.beforeQty,
          tx.afterQty,
          tx.referenceType || "",
          tx.createdBy?.name || "",
          formatDateTimeKR(tx.createdAt),
        ],
        filename: "transactions",
      });
      toast.success("파일이 다운로드되었습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const clearFilters = () => {
    setDateFilter("all");
    setTypeFilter(null);
  };

  const createMutation = useMutation({
    mutationFn: transactionsApi.create,
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
      transactionsApi.update(id, data),
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
    mutationFn: transactionsApi.delete,
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
      createMutation.mutate(data as TransactionInput);
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
            <FilterDropdown
              fields={[
                {
                  name: "date",
                  label: "기간",
                  value: dateFilter,
                  onChange: setDateFilter,
                  options: [
                    { value: "all", label: "전체" },
                    { value: "today", label: "오늘" },
                    { value: "week", label: "최근 7일" },
                    { value: "month", label: "최근 30일" },
                  ],
                },
                {
                  name: "type",
                  label: "유형",
                  value: typeFilter || "",
                  onChange: (v) => setTypeFilter(v || null),
                  options: [
                    { value: "", label: "전체" },
                    { value: "INBOUND", label: "입고" },
                    { value: "OUTBOUND", label: "출고" },
                    { value: "ADJUSTMENT", label: "조정" },
                    { value: "TRANSFER", label: "이동" },
                  ],
                },
              ]}
              onClear={clearFilters}
            />

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

      {/* Transactions Table */}
      <DataTable
        data={filteredTransactions}
        columns={columns}
        isLoading={isLoading}
        searchTerm={searchTerm || typeFilter || ""}
        onRowClick={(item) => window.location.href = `/transactions/${item.id}`}
        emptyState={{
          icon: ArrowLeftRight,
          message: "입출고 내역이 없습니다.",
          searchMessage: "검색 결과가 없습니다.",
          actionLabel: can("inventory", "create") ? "첫 번째 입출고 등록하기" : undefined,
          onAction: can("inventory", "create") ? handleCreate : undefined,
        }}
      />

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
