"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Edit2,
  Save,
  X,
  Package,
  Hash,
  MapPin,
  FileText,
  Check,
  Loader2,
  RefreshCw,
  ArrowRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";

interface Part {
  id: number;
  partCode: string;
  partName: string;
  storageLocation: string | null;
}

interface AuditItem {
  id: number;
  auditId: number;
  partId: number;
  systemQty: number;
  countedQty: number | null;
  discrepancy: number | null;
  notes: string | null;
  countedAt: string | null;
  part: Part;
}

interface AuditRecord {
  id: number;
  auditCode: string;
  auditDate: string;
  auditType: string;
  status: string;
  totalItems: number;
  matchedItems: number;
  discrepancyItems: number;
  notes: string | null;
  performedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  items: AuditItem[];
}

const auditTypeLabels: Record<string, string> = {
  MONTHLY: "월간 실사",
  QUARTERLY: "분기 실사",
  YEARLY: "연간 실사",
  SPOT: "비정기 실사",
};

const auditTypeColors: Record<string, string> = {
  MONTHLY: "badge-primary",
  QUARTERLY: "badge-info",
  YEARLY: "badge-warning",
  SPOT: "badge-secondary",
};

const statusLabels: Record<string, string> = {
  PLANNED: "예정",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const statusColors: Record<string, string> = {
  PLANNED: "badge-secondary",
  IN_PROGRESS: "badge-warning",
  COMPLETED: "badge-success",
  CANCELLED: "badge-danger",
};

async function fetchAudit(id: string): Promise<AuditRecord> {
  const res = await fetch(`/api/audit/${id}`);
  if (!res.ok) throw new Error("Failed to fetch audit");
  return res.json();
}

async function updateAuditItem(
  itemId: number,
  data: { countedQty: number; notes?: string }
): Promise<AuditItem> {
  const res = await fetch(`/api/audit/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update audit item");
  return res.json();
}

async function completeAudit(
  id: number,
  adjustInventory: boolean,
  auditCode: string
): Promise<AuditRecord> {
  const res = await fetch(`/api/audit/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "COMPLETED",
      adjustInventory,
      auditCode,
    }),
  });
  if (!res.ok) throw new Error("Failed to complete audit");
  return res.json();
}

export default function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    countedQty: string;
    notes: string;
  }>({ countedQty: "", notes: "" });
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [adjustInventory, setAdjustInventory] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);
  const [completedAuditData, setCompletedAuditData] = useState<AuditRecord | null>(null);

  const {
    data: audit,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["audit", id],
    queryFn: () => fetchAudit(id),
    enabled: !!id,
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: number;
      data: { countedQty: number; notes?: string };
    }) => updateAuditItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit", id] });
      toast.success("수량이 저장되었습니다.");
      setEditingItemId(null);
    },
    onError: () => {
      toast.error("수량 저장에 실패했습니다.");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      completeAudit(parseInt(id), adjustInventory, audit?.auditCode || ""),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["audit", id] });
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setShowCompleteDialog(false);
      setCompletedAuditData(data);
      setShowResultModal(true);
    },
    onError: () => {
      toast.error("실사 완료에 실패했습니다.");
    },
  });

  const handleEditItem = (item: AuditItem) => {
    setEditingItemId(item.id);
    setEditValues({
      countedQty: item.countedQty?.toString() || "",
      notes: item.notes || "",
    });
  };

  const handleSaveItem = (itemId: number) => {
    const countedQty = parseInt(editValues.countedQty);
    if (isNaN(countedQty) || countedQty < 0) {
      toast.error("올바른 수량을 입력해주세요.");
      return;
    }
    updateItemMutation.mutate({
      itemId,
      data: { countedQty, notes: editValues.notes || undefined },
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditValues({ countedQty: "", notes: "" });
  };

  const getDiscrepancyStatus = (item: AuditItem) => {
    if (item.countedQty === null) return "pending";
    if (item.countedQty === item.systemQty) return "matched";
    return "discrepancy";
  };

  const countedItems = audit?.items.filter((item) => item.countedQty !== null).length || 0;
  const matchedItems = audit?.items.filter(
    (item) => item.countedQty !== null && item.countedQty === item.systemQty
  ).length || 0;
  const discrepancyItems = audit?.items.filter(
    (item) => item.countedQty !== null && item.countedQty !== item.systemQty
  ).length || 0;

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

  if (error || !audit) {
    return (
      <div className="glass-card p-6 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[var(--danger)]" />
        <p className="text-[var(--danger)]">실사 정보를 불러오는데 실패했습니다.</p>
        <Link href="/audit" className="btn-primary mt-4 inline-block">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/audit"
            className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {audit.auditCode}
              </h1>
              <span className={`badge ${auditTypeColors[audit.auditType] || "badge-secondary"}`}>
                {auditTypeLabels[audit.auditType] || audit.auditType}
              </span>
              <span className={`badge ${statusColors[audit.status]}`}>
                {statusLabels[audit.status]}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] mt-1">
              실사 상세 정보 및 품목별 수량 확인
            </p>
          </div>
        </div>
        {audit.status === "IN_PROGRESS" && (
          <button
            onClick={() => setShowCompleteDialog(true)}
            className="btn btn-primary btn-lg"
            disabled={countedItems === 0}
          >
            <CheckCircle className="w-5 h-5" />
            실사 완료
          </button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">실사일</p>
              <p className="font-semibold text-[var(--text-primary)]">
                {new Date(audit.auditDate).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--info)]/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">총 품목</p>
              <p className="font-semibold text-[var(--text-primary)]">
                {audit.items.length}개
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success)]/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">일치</p>
              <p className="font-semibold text-[var(--success)]">{matchedItems}개</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--danger)]/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">불일치</p>
              <p className="font-semibold text-[var(--danger)]">{discrepancyItems}개</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      {audit.status === "IN_PROGRESS" && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">진행률</span>
            <span className="text-sm text-[var(--text-secondary)]">
              {countedItems} / {audit.items.length} 완료
            </span>
          </div>
          <div className="w-full bg-[var(--glass-border)] rounded-full h-2">
            <div
              className="bg-[var(--primary)] h-2 rounded-full transition-all duration-300"
              style={{
                width: `${audit.items.length > 0 ? (countedItems / audit.items.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Audit Info */}
      {audit.notes && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">비고</p>
              <p className="text-[var(--text-secondary)] mt-1">{audit.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-[var(--glass-border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">실사 품목</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            각 품목의 실제 수량을 입력하세요. 시스템 수량과 비교하여 불일치 여부가 표시됩니다.
          </p>
        </div>

        {audit.items.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">실사 대상 품목이 없습니다.</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              부품 관리에서 실사 대상 품목을 추가해주세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-bordered">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="table-header">상태</th>
                  <th className="table-header">품번</th>
                  <th className="table-header">품명</th>
                  <th className="table-header">위치</th>
                  <th className="table-header text-right">시스템 수량</th>
                  <th className="table-header text-right">실사 수량</th>
                  <th className="table-header text-right">차이</th>
                  <th className="table-header">비고</th>
                  {audit.status === "IN_PROGRESS" && (
                    <th className="table-header text-center">작업</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {audit.items.map((item) => {
                  const status = getDiscrepancyStatus(item);
                  const isEditing = editingItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors ${
                        status === "discrepancy" ? "bg-[var(--danger)]/5" : ""
                      }`}
                    >
                      <td className="table-cell">
                        {status === "pending" && (
                          <span className="flex items-center gap-1 text-[var(--text-muted)]">
                            <Clock className="w-4 h-4" />
                            대기
                          </span>
                        )}
                        {status === "matched" && (
                          <span className="flex items-center gap-1 text-[var(--success)]">
                            <Check className="w-4 h-4" />
                            일치
                          </span>
                        )}
                        {status === "discrepancy" && (
                          <span className="flex items-center gap-1 text-[var(--danger)]">
                            <AlertTriangle className="w-4 h-4" />
                            불일치
                          </span>
                        )}
                      </td>
                      <td className="table-cell font-mono text-sm">{item.part.partCode}</td>
                      <td className="table-cell font-medium">{item.part.partName}</td>
                      <td className="table-cell text-[var(--text-secondary)]">
                        {item.part.storageLocation || "-"}
                      </td>
                      <td className="table-cell text-right tabular-nums">{item.systemQty}</td>
                      <td className="table-cell text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editValues.countedQty}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, countedQty: e.target.value }))
                            }
                            className="input w-24 text-right"
                            autoFocus
                          />
                        ) : (
                          <span className="tabular-nums">
                            {item.countedQty !== null ? item.countedQty : "-"}
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        {item.countedQty !== null ? (
                          <span
                            className={`tabular-nums font-medium ${
                              item.discrepancy === 0
                                ? "text-[var(--success)]"
                                : "text-[var(--danger)]"
                            }`}
                          >
                            {item.discrepancy !== null && item.discrepancy > 0 ? "+" : ""}
                            {item.discrepancy}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="table-cell">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.notes}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, notes: e.target.value }))
                            }
                            placeholder="비고 입력"
                            className="input w-full"
                          />
                        ) : (
                          <span className="text-[var(--text-secondary)] text-sm">
                            {item.notes || "-"}
                          </span>
                        )}
                      </td>
                      {audit.status === "IN_PROGRESS" && (
                        <td className="table-cell text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveItem(item.id)}
                                className="table-action-btn edit"
                                title="저장"
                                disabled={updateItemMutation.isPending}
                              >
                                {updateItemMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 text-[var(--success)]" />
                                )}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="table-action-btn delete"
                                title="취소"
                              >
                                <X className="w-4 h-4 text-[var(--danger)]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditItem(item)}
                              className="table-action-btn edit"
                              title="수량 입력"
                            >
                              <Edit2 className="w-4 h-4 text-[var(--primary)]" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete Dialog */}
      <Modal
        isOpen={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        title="실사 완료 확인"
        size="md"
      >
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-[var(--glass-bg)]">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{countedItems}</p>
              <p className="text-sm text-[var(--text-muted)]">완료 품목</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--success)]/10">
              <p className="text-2xl font-bold text-[var(--success)]">{matchedItems}</p>
              <p className="text-sm text-[var(--text-muted)]">일치</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--danger)]/10">
              <p className="text-2xl font-bold text-[var(--danger)]">{discrepancyItems}</p>
              <p className="text-sm text-[var(--text-muted)]">불일치</p>
            </div>
          </div>

          {/* Inventory Adjustment Option */}
          {discrepancyItems > 0 && (
            <div className="p-4 rounded-lg border border-[var(--glass-border)]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adjustInventory}
                  onChange={(e) => setAdjustInventory(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[var(--glass-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    불일치 항목 재고 자동 조정
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    실사 수량으로 시스템 재고를 자동 조정합니다.
                    {discrepancyItems}개 품목의 재고가 변경됩니다.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--warning)]/10">
            <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-secondary)]">
              실사 완료 후에는 수량을 수정할 수 없습니다.
              모든 항목을 확인한 후 완료해 주세요.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCompleteDialog(false)}
              className="btn-secondary"
              disabled={completeMutation.isPending}
            >
              취소
            </button>
            <button
              onClick={() => completeMutation.mutate()}
              className="btn-primary"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  실사 완료
                </span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Result Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => {
          setShowResultModal(false);
          setCompletedAuditData(null);
        }}
        title="실사 완료"
        size="lg"
      >
        <div className="space-y-6">
          {/* Success Header */}
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-[var(--success)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-[var(--success)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">
              실사가 완료되었습니다
            </h3>
            <p className="text-[var(--text-secondary)] mt-1">
              {completedAuditData?.auditCode || audit?.auditCode}
            </p>
          </div>

          {/* Result Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-[var(--glass-bg)]">
              <Package className="w-6 h-6 mx-auto mb-2 text-[var(--primary)]" />
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {audit?.items.length || 0}
              </p>
              <p className="text-xs text-[var(--text-muted)]">총 품목</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--info)]/10">
              <BarChart3 className="w-6 h-6 mx-auto mb-2 text-[var(--info)]" />
              <p className="text-2xl font-bold text-[var(--info)]">{countedItems}</p>
              <p className="text-xs text-[var(--text-muted)]">실사 완료</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--success)]/10">
              <Check className="w-6 h-6 mx-auto mb-2 text-[var(--success)]" />
              <p className="text-2xl font-bold text-[var(--success)]">{matchedItems}</p>
              <p className="text-xs text-[var(--text-muted)]">일치</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--danger)]/10">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-[var(--danger)]" />
              <p className="text-2xl font-bold text-[var(--danger)]">{discrepancyItems}</p>
              <p className="text-xs text-[var(--text-muted)]">불일치</p>
            </div>
          </div>

          {/* Discrepancy Details */}
          {discrepancyItems > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                불일치 항목 상세
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--glass-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--glass-bg)] sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">품번</th>
                      <th className="text-left p-2 font-medium">품명</th>
                      <th className="text-right p-2 font-medium">시스템</th>
                      <th className="text-right p-2 font-medium">실사</th>
                      <th className="text-right p-2 font-medium">차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit?.items
                      .filter(
                        (item) =>
                          item.countedQty !== null && item.countedQty !== item.systemQty
                      )
                      .map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-[var(--glass-border)]"
                        >
                          <td className="p-2 font-mono text-xs">{item.part.partCode}</td>
                          <td className="p-2">{item.part.partName}</td>
                          <td className="p-2 text-right tabular-nums">{item.systemQty}</td>
                          <td className="p-2 text-right tabular-nums">{item.countedQty}</td>
                          <td className="p-2 text-right tabular-nums">
                            <span
                              className={`flex items-center justify-end gap-1 ${
                                (item.discrepancy || 0) > 0
                                  ? "text-[var(--success)]"
                                  : "text-[var(--danger)]"
                              }`}
                            >
                              {(item.discrepancy || 0) > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {item.discrepancy !== null && item.discrepancy > 0 ? "+" : ""}
                              {item.discrepancy}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {adjustInventory && (
                <div className="flex items-center gap-2 text-sm text-[var(--success)]">
                  <RefreshCw className="w-4 h-4" />
                  재고가 실사 수량으로 자동 조정되었습니다.
                </div>
              )}
            </div>
          )}

          {/* Next Actions */}
          <div className="pt-4 border-t border-[var(--glass-border)]">
            <p className="text-sm text-[var(--text-muted)] mb-4">다음 단계</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/audit"
                className="btn-secondary flex items-center gap-2"
                onClick={() => setShowResultModal(false)}
              >
                <ClipboardCheck className="w-4 h-4" />
                실사 목록
              </Link>
              <Link
                href="/inventory"
                className="btn-secondary flex items-center gap-2"
                onClick={() => setShowResultModal(false)}
              >
                <Package className="w-4 h-4" />
                재고 현황
              </Link>
              <Link
                href="/reports"
                className="btn-primary flex items-center gap-2"
                onClick={() => setShowResultModal(false)}
              >
                <BarChart3 className="w-4 h-4" />
                리포트 보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
