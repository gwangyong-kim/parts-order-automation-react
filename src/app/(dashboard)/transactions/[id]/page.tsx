"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  ArrowLeftRight,
  Calendar,
  User,
  Package,
  FileText,
  Hash,
  Layers,
  ClipboardList,
  Edit2,
  Trash2,
} from "lucide-react";
import TransactionForm from "@/components/forms/TransactionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface Transaction {
  id: number;
  transactionCode: string;
  transactionType: string;
  partId: number;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
  updatedAt?: string;
  part: {
    id: number;
    partCode: string;
    partName: string;
    unit?: string;
  };
}

interface TransactionInput {
  partId: number;
  transactionType: string;
  quantity: number;
  notes: string | null;
}

async function fetchTransaction(id: string): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch transaction");
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

const typeDescriptions: Record<string, string> = {
  INBOUND: "재고가 입고되어 수량이 증가했습니다.",
  OUTBOUND: "재고가 출고되어 수량이 감소했습니다.",
  ADJUSTMENT: "재고 조정으로 수량이 변경되었습니다.",
  TRANSFER: "창고 간 이동이 처리되었습니다.",
};

const typeIcons: Record<string, React.ElementType> = {
  INBOUND: ArrowDownRight,
  OUTBOUND: ArrowUpRight,
  ADJUSTMENT: RotateCcw,
  TRANSFER: ArrowLeftRight,
};

const typeBgColors: Record<string, string> = {
  INBOUND: "bg-[var(--success)]/10",
  OUTBOUND: "bg-[var(--danger)]/10",
  ADJUSTMENT: "bg-[var(--warning)]/10",
  TRANSFER: "bg-[var(--info)]/10",
};

const typeTextColors: Record<string, string> = {
  INBOUND: "text-[var(--success)]",
  OUTBOUND: "text-[var(--danger)]",
  ADJUSTMENT: "text-[var(--warning)]",
  TRANSFER: "text-[var(--info)]",
};

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: transaction,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => fetchTransaction(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TransactionInput>) =>
      updateTransaction(parseInt(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("입출고 내역이 수정되었습니다.");
      setShowEditModal(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "입출고 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTransaction(parseInt(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("입출고 내역이 삭제되었습니다.");
      router.push("/transactions");
    },
    onError: (error: Error) => {
      toast.error(error.message || "입출고 삭제에 실패했습니다.");
    },
  });

  const handleFormSubmit = (data: Partial<TransactionInput>) => {
    updateMutation.mutate(data);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
  };

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

  if (error || !transaction) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">거래 내역을 찾을 수 없습니다.</p>
        <Link href="/transactions" className="mt-4 text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const Icon = typeIcons[transaction.transactionType] || ArrowLeftRight;
  const quantityChange = transaction.afterQty - transaction.beforeQty;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-[var(--glass-bg)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)] font-mono">
                {transaction.transactionCode}
              </h1>
              <span className={`badge ${typeColors[transaction.transactionType] || "badge-secondary"} flex items-center gap-1`}>
                <Icon className="w-3 h-3" />
                {typeLabels[transaction.transactionType] || transaction.transactionType}
              </span>
            </div>
            <p className="text-[var(--text-secondary)]">
              {typeDescriptions[transaction.transactionType] || "거래가 처리되었습니다."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-secondary"
          >
            <Edit2 className="w-4 h-4" />
            수정
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="btn btn-danger"
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
          <Link
            href="/transactions"
            className="btn btn-secondary"
          >
            목록으로
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Transaction Type */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">거래 유형</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {typeLabels[transaction.transactionType] || transaction.transactionType}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeBgColors[transaction.transactionType] || "bg-[var(--gray-100)]"}`}>
              <Icon className={`w-6 h-6 ${typeTextColors[transaction.transactionType] || "text-[var(--text-muted)]"}`} />
            </div>
          </div>
        </div>

        {/* Quantity */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">처리 수량</p>
              <p className={`text-2xl font-bold ${typeTextColors[transaction.transactionType] || "text-[var(--text-primary)]"}`}>
                {transaction.transactionType === "INBOUND" ? "+" : transaction.transactionType === "OUTBOUND" ? "-" : ""}
                {transaction.quantity.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--primary)]/10">
              <Package className="w-6 h-6 text-[var(--primary)]" />
            </div>
          </div>
        </div>

        {/* Before -> After */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">재고 변화</p>
              <div className="flex items-center gap-2">
                <span className="text-lg text-[var(--text-secondary)]">
                  {transaction.beforeQty.toLocaleString()}
                </span>
                <ArrowLeftRight className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xl font-bold text-[var(--text-primary)]">
                  {transaction.afterQty.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--info)]/10">
              <Layers className="w-6 h-6 text-[var(--info)]" />
            </div>
          </div>
        </div>

        {/* Net Change */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">순 변화량</p>
              <p className={`text-2xl font-bold ${quantityChange > 0 ? "text-[var(--success)]" : quantityChange < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"}`}>
                {quantityChange > 0 ? "+" : ""}{quantityChange.toLocaleString()}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${quantityChange > 0 ? "bg-[var(--success)]/10" : quantityChange < 0 ? "bg-[var(--danger)]/10" : "bg-[var(--gray-100)]"}`}>
              {quantityChange > 0 ? (
                <ArrowDownRight className="w-6 h-6 text-[var(--success)]" />
              ) : quantityChange < 0 ? (
                <ArrowUpRight className="w-6 h-6 text-[var(--danger)]" />
              ) : (
                <RotateCcw className="w-6 h-6 text-[var(--text-muted)]" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Info */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            거래 정보
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">거래코드</p>
                <p className="text-[var(--text-primary)] font-mono">{transaction.transactionCode}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 ${typeTextColors[transaction.transactionType] || "text-[var(--text-muted)]"}`} />
              <div>
                <p className="text-sm text-[var(--text-muted)]">거래 유형</p>
                <p className="text-[var(--text-primary)]">
                  {typeLabels[transaction.transactionType] || transaction.transactionType}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">처리자</p>
                <p className="text-[var(--text-primary)]">{transaction.performedBy || "-"}</p>
              </div>
            </div>

            {transaction.referenceType && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <p className="text-sm text-[var(--text-muted)]">참조 문서</p>
                  <p className="text-[var(--text-primary)]">
                    {transaction.referenceType}
                    {transaction.referenceId && ` #${transaction.referenceId}`}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <p className="text-sm text-[var(--text-muted)]">처리 일시</p>
                  <p className="text-[var(--text-primary)]">
                    {new Date(transaction.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Part Info */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            파츠 정보
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">파츠 코드</p>
                <Link
                  href={`/parts/${transaction.part.id}`}
                  className="text-[var(--primary)] hover:underline font-mono"
                >
                  {transaction.part.partCode}
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">파츠명</p>
                <p className="text-[var(--text-primary)]">{transaction.part.partName}</p>
              </div>
            </div>

            {transaction.part.unit && (
              <div className="flex items-start gap-3">
                <Layers className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <p className="text-sm text-[var(--text-muted)]">단위</p>
                  <p className="text-[var(--text-primary)]">{transaction.part.unit}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <Link
                href={`/parts/${transaction.part.id}`}
                className="btn btn-secondary w-full justify-center"
              >
                <Package className="w-4 h-4" />
                파츠 상세 보기
              </Link>
            </div>
          </div>
        </div>

        {/* Quantity Details & Notes */}
        <div className="space-y-6">
          {/* Quantity Change Visual */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              재고 변화 상세
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[var(--glass-border)]">
                <span className="text-[var(--text-secondary)]">변경 전 재고</span>
                <span className="text-lg font-medium text-[var(--text-primary)] tabular-nums">
                  {transaction.beforeQty.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[var(--glass-border)]">
                <span className="text-[var(--text-secondary)]">
                  {transaction.transactionType === "INBOUND" ? "입고 수량" :
                   transaction.transactionType === "OUTBOUND" ? "출고 수량" : "조정 수량"}
                </span>
                <span className={`text-lg font-bold tabular-nums ${typeTextColors[transaction.transactionType] || "text-[var(--text-primary)]"}`}>
                  {transaction.transactionType === "INBOUND" ? "+" : transaction.transactionType === "OUTBOUND" ? "-" : ""}
                  {transaction.quantity.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[var(--text-secondary)] font-medium">변경 후 재고</span>
                <span className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
                  {transaction.afterQty.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              비고
            </h2>
            {transaction.notes ? (
              <p className="text-[var(--text-secondary)] whitespace-pre-wrap">
                {transaction.notes}
              </p>
            ) : (
              <p className="text-[var(--text-muted)] italic">
                등록된 비고가 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <TransactionForm
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleFormSubmit}
        isLoading={updateMutation.isPending}
        initialData={transaction}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        title="입출고 내역 삭제"
        message={`"${transaction.transactionCode}" 내역을 삭제하시겠습니까?\n\n삭제 시 재고가 해당 트랜잭션 이전 상태로 롤백됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
