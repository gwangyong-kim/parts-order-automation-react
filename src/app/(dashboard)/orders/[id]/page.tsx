"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Calendar,
  Building,
  FolderOpen,
  Package,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Truck,
  User,
  DollarSign,
  PackageCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import OrderForm from "@/components/forms/OrderForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface OrderItem {
  id: number;
  partId: number;
  orderQty: number;
  receivedQty: number;
  unitPrice: number | null;
  totalPrice: number | null;
  status: string;
  notes: string | null;
  part: {
    id: number;
    partCode: string;
    partName: string;
    unit: string;
  };
}

interface Order {
  id: number;
  orderCode: string;
  supplierId: number;
  project: string | null;
  orderDate: string;
  expectedDate: string | null;
  actualDate: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: number;
    code: string;
    name: string;
  };
  items: OrderItem[];
}

interface FormOrder {
  id?: number;
  orderNumber: string;
  supplierId: number;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
}

async function fetchOrder(id: string): Promise<Order> {
  const res = await fetch(`/api/orders/${id}`);
  if (!res.ok) throw new Error("Failed to fetch order");
  return res.json();
}

async function updateOrder(id: number, data: Partial<FormOrder>): Promise<Order> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update order");
  return res.json();
}

async function deleteOrder(id: number): Promise<void> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete order");
}

interface ReceiveItem {
  orderItemId: number;
  receivedQty: number;
}

async function receiveItems(orderId: number, items: ReceiveItem[]): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/orders/${orderId}/receive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to receive items");
  }
  return res.json();
}

const statusColors: Record<string, string> = {
  DRAFT: "badge-secondary",
  SUBMITTED: "badge-warning",
  APPROVED: "badge-info",
  ORDERED: "badge-primary",
  RECEIVED: "badge-success",
  CANCELLED: "badge-danger",
};

const statusLabels: Record<string, string> = {
  DRAFT: "작성중",
  SUBMITTED: "제출됨",
  APPROVED: "승인됨",
  ORDERED: "발주됨",
  RECEIVED: "입고완료",
  CANCELLED: "취소됨",
};

const statusIcons: Record<string, React.ElementType> = {
  DRAFT: FileText,
  SUBMITTED: Clock,
  APPROVED: CheckCircle,
  ORDERED: Truck,
  RECEIVED: PackageCheck,
  CANCELLED: XCircle,
};

const itemStatusLabels: Record<string, string> = {
  PENDING: "대기",
  PARTIAL: "부분입고",
  COMPLETED: "완료",
};

const itemStatusColors: Record<string, string> = {
  PENDING: "badge-secondary",
  PARTIAL: "badge-warning",
  COMPLETED: "badge-success",
};

export default function OrderDetailPage({
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
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, number>>({});

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FormOrder>) => updateOrder(parseInt(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("발주가 수정되었습니다.");
      setShowEditModal(false);
    },
    onError: () => {
      toast.error("발주 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(parseInt(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("발주가 삭제되었습니다.");
      router.push("/orders");
    },
    onError: () => {
      toast.error("발주 삭제에 실패했습니다.");
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (items: ReceiveItem[]) => receiveItems(parseInt(id), items),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(result.message);
      setShowReceiveModal(false);
      setReceiveQuantities({});
    },
    onError: (error: Error) => {
      toast.error(error.message || "입고 처리에 실패했습니다.");
    },
  });

  const handleEditSubmit = (data: Partial<FormOrder>) => {
    updateMutation.mutate(data);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
  };

  const handleReceiveSubmit = () => {
    const items: ReceiveItem[] = Object.entries(receiveQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        orderItemId: parseInt(itemId),
        receivedQty: qty,
      }));

    if (items.length === 0) {
      toast.error("입고할 수량을 입력해주세요.");
      return;
    }

    receiveMutation.mutate(items);
  };

  const openReceiveModal = () => {
    // 초기화: 남은 수량만큼 기본값 설정
    const initialQty: Record<number, number> = {};
    order?.items.forEach((item) => {
      const remaining = item.orderQty - item.receivedQty;
      if (remaining > 0) {
        initialQty[item.id] = 0;
      }
    });
    setReceiveQuantities(initialQty);
    setShowReceiveModal(true);
  };

  // Convert order to form format
  const orderForForm: FormOrder | null = order
    ? {
        id: order.id,
        orderNumber: order.orderCode,
        supplierId: order.supplierId,
        orderDate: order.orderDate,
        expectedDate: order.expectedDate,
        status: order.status,
        totalAmount: order.totalAmount,
        notes: order.notes,
      }
    : null;

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

  if (error || !order) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[var(--danger)]">발주를 찾을 수 없습니다.</p>
        <Link href="/orders" className="mt-4 text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  // 통계 계산
  const totalItems = order.items.length;
  const totalOrderQty = order.items.reduce((sum, item) => sum + item.orderQty, 0);
  const totalReceivedQty = order.items.reduce((sum, item) => sum + item.receivedQty, 0);
  const receivePercent = totalOrderQty > 0 ? Math.round((totalReceivedQty / totalOrderQty) * 100) : 0;

  const StatusIcon = statusIcons[order.status] || AlertCircle;

  const getDaysUntilExpected = () => {
    if (!order.expectedDate) return null;
    const now = new Date();
    const expected = new Date(order.expectedDate);
    const diffTime = expected.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpected = getDaysUntilExpected();

  // 입고 가능 여부 체크 (발주됨 상태이고 입고가 완료되지 않은 경우)
  const canReceive = order.status === "ORDERED" && receivePercent < 100;
  const hasRemainingItems = order.items.some((item) => item.orderQty > item.receivedQty);

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
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                발주번호: {order.orderCode}
              </h1>
              <span
                className={`badge ${statusColors[order.status] || "badge-secondary"} flex items-center gap-1`}
              >
                <StatusIcon className="w-3 h-3" />
                {statusLabels[order.status] || order.status}
              </span>
            </div>
            <p className="text-[var(--text-secondary)]">
              공급업체: {order.supplier.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canReceive && hasRemainingItems && (
            <button onClick={openReceiveModal} className="btn btn-primary">
              <PackageCheck className="w-4 h-4" />
              입고 처리
            </button>
          )}
          <button onClick={() => setShowEditModal(true)} className="btn btn-secondary">
            <Edit2 className="w-4 h-4" />
            편집
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="btn btn-secondary text-[var(--danger)]"
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Items */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">품목 수</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {totalItems}
                <span className="text-sm font-normal ml-1">개</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--primary)]/10">
              <Package className="w-6 h-6 text-[var(--primary)]" />
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">발주금액</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {order.totalAmount >= 100000000
                  ? `₩${(order.totalAmount / 100000000).toFixed(1)}억`
                  : order.totalAmount >= 10000
                  ? `₩${(order.totalAmount / 10000).toFixed(0)}만`
                  : `₩${order.totalAmount.toLocaleString()}`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--info)]/10">
              <DollarSign className="w-6 h-6 text-[var(--info)]" />
            </div>
          </div>
        </div>

        {/* Receive Progress */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">입고율</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {receivePercent}
                <span className="text-sm font-normal ml-1">%</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--success)]/10">
              <CheckCircle className="w-6 h-6 text-[var(--success)]" />
            </div>
          </div>
          <div className="mt-2 h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--success)] transition-all"
              style={{ width: `${receivePercent}%` }}
            />
          </div>
        </div>

        {/* Expected Date */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">입고예정일</p>
              {order.expectedDate ? (
                <>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {new Date(order.expectedDate).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {daysUntilExpected !== null && (
                    <p
                      className={`text-xs ${
                        daysUntilExpected < 0
                          ? "text-[var(--danger)]"
                          : daysUntilExpected <= 7
                          ? "text-[var(--warning)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {daysUntilExpected < 0
                        ? `${Math.abs(daysUntilExpected)}일 지남`
                        : daysUntilExpected === 0
                        ? "오늘"
                        : `${daysUntilExpected}일 남음`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold text-[var(--text-muted)]">-</p>
              )}
            </div>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                daysUntilExpected !== null && daysUntilExpected < 0
                  ? "bg-[var(--danger)]/10"
                  : daysUntilExpected !== null && daysUntilExpected <= 7
                  ? "bg-[var(--warning)]/10"
                  : "bg-[var(--primary)]/10"
              }`}
            >
              <Calendar
                className={`w-6 h-6 ${
                  daysUntilExpected !== null && daysUntilExpected < 0
                    ? "text-[var(--danger)]"
                    : daysUntilExpected !== null && daysUntilExpected <= 7
                    ? "text-[var(--warning)]"
                    : "text-[var(--primary)]"
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Order Info & Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            발주 정보
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">공급업체</p>
                <Link
                  href="/suppliers"
                  className="text-[var(--primary)] hover:underline"
                >
                  {order.supplier.name}
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">발주일</p>
                <p className="text-[var(--text-primary)]">
                  {new Date(order.orderDate).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">입고예정일</p>
                <p className="text-[var(--text-primary)]">
                  {order.expectedDate
                    ? new Date(order.expectedDate).toLocaleDateString("ko-KR")
                    : "-"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">프로젝트</p>
                <p className="text-[var(--text-primary)]">
                  {order.project || "-"}
                </p>
              </div>
            </div>

            {order.approvedBy && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <p className="text-sm text-[var(--text-muted)]">승인자</p>
                  <p className="text-[var(--text-primary)]">{order.approvedBy}</p>
                  {order.approvedAt && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(order.approvedAt).toLocaleDateString("ko-KR")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {order.notes && (
              <div className="pt-4 border-t border-[var(--glass-border)]">
                <p className="text-sm text-[var(--text-muted)]">비고</p>
                <p className="text-[var(--text-secondary)] mt-1">{order.notes}</p>
              </div>
            )}

            <div className="pt-4 border-t border-[var(--glass-border)] text-xs text-[var(--text-muted)]">
              <p>등록일: {new Date(order.createdAt).toLocaleString("ko-KR")}</p>
              <p>수정일: {new Date(order.updatedAt).toLocaleString("ko-KR")}</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              발주 품목
            </h2>
            <span className="text-sm text-[var(--text-muted)]">
              {order.items.length}개 항목
            </span>
          </div>

          {order.items.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>등록된 품목이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-bordered">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      파츠코드
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      파츠명
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      발주량
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      입고량
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      단가
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      금액
                    </th>
                    <th className="text-center px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const itemProgress =
                      item.orderQty > 0
                        ? Math.round((item.receivedQty / item.orderQty) * 100)
                        : 0;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50"
                      >
                        <td className="px-3 py-3">
                          <Link
                            href={`/parts/${item.part.id}`}
                            className="font-mono text-sm text-[var(--primary)] hover:underline"
                          >
                            {item.part.partCode}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[var(--text-primary)]">
                          {item.part.partName}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {item.orderQty.toLocaleString()}
                          <span className="text-xs text-[var(--text-muted)] ml-1">
                            {item.part.unit}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`tabular-nums ${
                                item.receivedQty >= item.orderQty
                                  ? "text-[var(--success)]"
                                  : "text-[var(--text-primary)]"
                              }`}
                            >
                              {item.receivedQty.toLocaleString()}
                            </span>
                            <div className="w-16 h-1.5 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  itemProgress >= 100
                                    ? "bg-[var(--success)]"
                                    : itemProgress > 0
                                    ? "bg-[var(--warning)]"
                                    : "bg-[var(--glass-bg)]"
                                }`}
                                style={{ width: `${Math.min(itemProgress, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                          {item.unitPrice
                            ? `₩${item.unitPrice.toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium">
                          {item.totalPrice
                            ? `₩${item.totalPrice.toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`badge ${
                              itemStatusColors[item.status] || "badge-secondary"
                            }`}
                          >
                            {itemStatusLabels[item.status] || item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--glass-bg)]">
                    <td colSpan={2} className="px-3 py-3 font-medium">
                      합계
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {totalOrderQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--primary)]">
                      {totalReceivedQty.toLocaleString()}
                    </td>
                    <td></td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      ₩{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-center font-medium">
                      {receivePercent}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <OrderForm
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditSubmit}
        initialData={orderForForm}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        title="발주 삭제"
        message={`"${order.orderCode}" 발주를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowReceiveModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[var(--glass-border)]">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                입고 처리
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {order.orderCode} - 입고 수량을 입력하세요
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <table className="w-full table-bordered">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      파츠명
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      발주량
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      기입고
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      잔량
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      입고 수량
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items
                    .filter((item) => item.orderQty > item.receivedQty)
                    .map((item) => {
                      const remaining = item.orderQty - item.receivedQty;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[var(--glass-border)]"
                        >
                          <td className="px-3 py-3">
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">
                                {item.part.partName}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {item.part.partCode}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {item.orderQty.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {item.receivedQty.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-[var(--warning)]">
                            {remaining.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min="0"
                                max={remaining}
                                value={receiveQuantities[item.id] || 0}
                                onChange={(e) => {
                                  const value = Math.min(
                                    Math.max(0, parseInt(e.target.value) || 0),
                                    remaining
                                  );
                                  setReceiveQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: value,
                                  }));
                                }}
                                className="w-24 px-3 py-1.5 text-right border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setReceiveQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: remaining,
                                  }))
                                }
                                className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
                              >
                                전체
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {order.items.filter((item) => item.orderQty > item.receivedQty)
                .length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-[var(--success)]" />
                  <p>모든 품목이 입고 완료되었습니다.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--glass-border)] flex justify-end gap-3">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="btn btn-secondary"
                disabled={receiveMutation.isPending}
              >
                취소
              </button>
              <button
                onClick={handleReceiveSubmit}
                className="btn btn-primary"
                disabled={
                  receiveMutation.isPending ||
                  Object.values(receiveQuantities).every((qty) => qty === 0)
                }
              >
                {receiveMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    처리 중...
                  </span>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4" />
                    입고 확인
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
