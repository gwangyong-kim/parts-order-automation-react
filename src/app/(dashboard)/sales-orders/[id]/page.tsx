"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Calendar,
  User,
  Building,
  FolderOpen,
  Package,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Truck,
  Layers,
  AlertTriangle,
  ClipboardCheck,
  Play,
  ShoppingCart,
  Check,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import SalesOrderForm from "@/components/forms/SalesOrderForm";
import type { PickingTask } from "@/types/warehouse";

interface SalesOrderItem {
  id: number;
  productId: number;
  orderQty: number;
  producedQty: number;
  notes: string | null;
  product: {
    id: number;
    productCode: string;
    productName: string;
    unit: string;
  };
}

interface MaterialRequirement {
  partId: number;
  partCode: string;
  partName: string;
  unit: string;
  totalRequirement: number;
  currentStock: number;
  reservedQty: number;
  incomingQty: number;
  availableStock: number;
  shortageQty: number;
  safetyStock: number;
  supplierId: number | null;
  supplierName: string | null;
  supplierCode: string | null;
  leadTimeDays: number;
  unitPrice: number;
  minOrderQty: number;
  recommendedOrderQty: number;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  estimatedCost: number;
  alreadyOrdered: boolean;
  existingOrderCode: string | null;
  existingOrderQty: number;
}

interface SalesOrder {
  id: number;
  orderCode: string;
  division: string | null;
  manager: string | null;
  project: string | null;
  orderDate: string;
  dueDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: SalesOrderItem[];
  materialRequirements?: MaterialRequirement[];
}

async function fetchSalesOrder(id: string): Promise<SalesOrder> {
  const res = await fetch(`/api/sales-orders/${id}`);
  if (!res.ok) throw new Error("Failed to fetch sales order");
  return res.json();
}

async function fetchPickingTaskForOrder(salesOrderId: string): Promise<PickingTask | null> {
  const res = await fetch(`/api/picking-tasks?salesOrderId=${salesOrderId}`);
  if (!res.ok) return null;
  const tasks: PickingTask[] = await res.json();
  return tasks.find(t => t.salesOrderId === parseInt(salesOrderId)) || null;
}

async function createPickingTask(salesOrderId: number): Promise<PickingTask> {
  const res = await fetch(`/api/picking-tasks/from-sales-order/${salesOrderId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create picking task");
  }
  return res.json();
}

interface FormSalesOrder {
  id?: number;
  orderNumber: string;
  division: string;
  manager: string;
  project: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  notes: string | null;
  items?: {
    id?: number;
    productId: number;
    productCode?: string;
    productName?: string;
    orderQty: number;
    notes: string | null;
  }[];
}

async function updateSalesOrder(id: number, data: Partial<FormSalesOrder>): Promise<SalesOrder> {
  const res = await fetch(`/api/sales-orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update sales order");
  return res.json();
}

const statusColors: Record<string, string> = {
  PENDING: "badge-warning",
  CONFIRMED: "badge-info",
  IN_PRODUCTION: "badge-primary",
  COMPLETED: "badge-success",
  CANCELLED: "badge-danger",
};

const statusLabels: Record<string, string> = {
  PENDING: "대기",
  CONFIRMED: "확정",
  IN_PRODUCTION: "생산중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const statusIcons: Record<string, React.ElementType> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle,
  IN_PRODUCTION: Truck,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
};

// 중복 발주 에러 타입
interface DuplicateOrderError {
  error: string;
  duplicates: {
    partId: number;
    partCode: string;
    partName: string;
    existingOrderCode: string;
  }[];
}

// 발주 생성 API 호출
async function createOrderFromMrp(data: {
  items: { partId: number; orderQty: number }[];
  salesOrderId: number;
  skipDraft: boolean;
  orderDate: string;
  notes: string;
}) {
  const res = await fetch("/api/orders/from-mrp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    if (res.status === 409 && error.duplicates) {
      // 중복 발주 에러
      const duplicateError = error as DuplicateOrderError;
      const duplicateParts = duplicateError.duplicates
        .map((d) => `${d.partCode} (${d.existingOrderCode})`)
        .join(", ");
      throw new Error(`중복 발주: ${duplicateParts}`);
    }
    throw new Error(error.error || "발주 생성 실패");
  }
  return res.json();
}

export default function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedParts, setSelectedParts] = useState<Set<number>>(new Set());

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sales-order", id],
    queryFn: () => fetchSalesOrder(id),
    refetchOnMount: "always",      // 페이지 진입 시 항상 최신 데이터 fetch
    refetchOnWindowFocus: true,    // 창 포커스 시 refetch
    staleTime: 0,                  // 항상 stale 상태로 취급
  });

  const { data: pickingTask } = useQuery({
    queryKey: ["picking-task-for-order", id],
    queryFn: () => fetchPickingTaskForOrder(id),
    enabled: !!order,
  });

  const createPickingMutation = useMutation({
    mutationFn: () => createPickingTask(parseInt(id)),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["picking-task-for-order", id] });
      queryClient.invalidateQueries({ queryKey: ["picking-tasks"] });
      toast.success(`피킹 작업 ${task.taskCode}이(가) 생성되었습니다.`);
      router.push(`/picking/${task.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "피킹 작업 생성에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FormSalesOrder>) => updateSalesOrder(parseInt(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order", id] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("수주가 수정되었습니다.");
      setShowEditModal(false);
    },
    onError: () => {
      toast.error("수주 수정에 실패했습니다.");
    },
  });

  // 빠른 발주 생성 mutation
  const quickOrderMutation = useMutation({
    mutationFn: (parts: MaterialRequirement[]) =>
      createOrderFromMrp({
        items: parts.map((p) => ({
          partId: p.partId,
          orderQty: p.recommendedOrderQty,
        })),
        salesOrderId: parseInt(id),
        skipDraft: true,
        orderDate: new Date().toISOString(),
        notes: `SO ${order?.orderCode}에서 자동 생성`,
      }),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["sales-order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      // 발주 후 MRP 재계산 실행
      try {
        await fetch("/api/mrp/calculate", { method: "POST" });
        queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      } catch {
        // MRP 재계산 실패해도 발주는 성공한 것으로 처리
        console.error("MRP 재계산 실패");
      }

      const orderCount = result.data?.purchaseOrders?.length || 0;
      toast.success(
        `발주 ${orderCount.toLocaleString()}건이 생성되었습니다. (총 ${(result.data?.totalItems || 0).toLocaleString()}개 품목)`
      );
      setSelectedParts(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message || "발주 생성에 실패했습니다.");
    },
  });

  const handleEditSubmit = (data: Partial<FormSalesOrder>) => {
    updateMutation.mutate(data);
  };

  // Convert order to form format
  const orderForForm = order ? {
    id: order.id,
    orderNumber: order.orderCode,
    division: order.division || "",
    manager: order.manager || "",
    project: order.project || "",
    orderDate: order.orderDate,
    deliveryDate: order.dueDate || "",
    status: order.status,
    notes: order.notes,
    items: order.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productCode: item.product.productCode,
      productName: item.product.productName,
      orderQty: item.orderQty,
      notes: item.notes,
    })),
  } : null;

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
        <p className="text-[var(--danger)]">수주를 찾을 수 없습니다.</p>
        <Link href="/sales-orders" className="mt-4 text-[var(--primary)] hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const totalOrderQty = order.items.reduce((sum, item) => sum + item.orderQty, 0);
  const totalProducedQty = order.items.reduce((sum, item) => sum + item.producedQty, 0);
  const progressPercent = totalOrderQty > 0 ? Math.round((totalProducedQty / totalOrderQty) * 100) : 0;

  const StatusIcon = statusIcons[order.status] || AlertCircle;

  const getDaysUntilDue = () => {
    if (!order.dueDate) return null;
    const now = new Date();
    const due = new Date(order.dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();

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
                {order.orderCode}
              </h1>
              <span className={`badge ${statusColors[order.status] || "badge-secondary"} flex items-center gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {statusLabels[order.status] || order.status}
              </span>
            </div>
            <p className="text-[var(--text-secondary)]">
              {order.project || "프로젝트 미지정"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Picking Button */}
          {order.items.length > 0 && order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
            pickingTask ? (
              <Link
                href={`/picking/${pickingTask.id}`}
                className={`btn ${pickingTask.status === "COMPLETED" ? "btn-secondary" : "btn-primary"}`}
              >
                <ClipboardCheck className="w-4 h-4" />
                {pickingTask.status === "PENDING" ? "피킹 시작" :
                 pickingTask.status === "IN_PROGRESS" ? "피킹 진행중" :
                 pickingTask.status === "COMPLETED" ? "피킹 완료" : "피킹 보기"}
              </Link>
            ) : (
              <button
                onClick={() => createPickingMutation.mutate()}
                disabled={createPickingMutation.isPending}
                className="btn btn-primary"
              >
                {createPickingMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                피킹 생성
              </button>
            )
          )}
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-secondary"
          >
            <Edit2 className="w-4 h-4" />
            편집
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Items */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">제품 항목</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {order.items.length}
                <span className="text-sm font-normal ml-1">개</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--primary)]/10">
              <Package className="w-6 h-6 text-[var(--primary)]" />
            </div>
          </div>
        </div>

        {/* Total Order Qty */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">총 수주량</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {totalOrderQty.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--info)]/10">
              <FileText className="w-6 h-6 text-[var(--info)]" />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">생산 진행률</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {progressPercent}
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
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Due Date */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">납기일</p>
              {order.dueDate ? (
                <>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {new Date(order.dueDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </p>
                  {daysUntilDue !== null && (
                    <p className={`text-xs ${daysUntilDue < 0 ? "text-[var(--danger)]" : daysUntilDue <= 7 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`}>
                      {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}일 지남` : daysUntilDue === 0 ? "오늘" : `${daysUntilDue}일 남음`}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold text-[var(--text-muted)]">-</p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${daysUntilDue !== null && daysUntilDue < 0 ? "bg-[var(--danger)]/10" : daysUntilDue !== null && daysUntilDue <= 7 ? "bg-[var(--warning)]/10" : "bg-[var(--primary)]/10"}`}>
              <Calendar className={`w-6 h-6 ${daysUntilDue !== null && daysUntilDue < 0 ? "text-[var(--danger)]" : daysUntilDue !== null && daysUntilDue <= 7 ? "text-[var(--warning)]" : "text-[var(--primary)]"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Order Info & Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            수주 정보
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">사업부</p>
                <p className="text-[var(--text-primary)]">{order.division || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">담당자</p>
                <p className="text-[var(--text-primary)]">{order.manager || "-"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">프로젝트</p>
                <p className="text-[var(--text-primary)]">{order.project || "-"}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
                <div>
                  <p className="text-sm text-[var(--text-muted)]">수주일</p>
                  <p className="text-[var(--text-primary)]">
                    {new Date(order.orderDate).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-[var(--text-muted)] mt-0.5" />
              <div>
                <p className="text-sm text-[var(--text-muted)]">납기일</p>
                <p className="text-[var(--text-primary)]">
                  {order.dueDate ? new Date(order.dueDate).toLocaleDateString("ko-KR") : "-"}
                </p>
              </div>
            </div>

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
              수주 제품
            </h2>
            <span className="text-sm text-[var(--text-muted)]">
              {order.items.length}개 항목
            </span>
          </div>

          {order.items.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>등록된 제품이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-bordered">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      제품코드
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      제품명
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      수주량
                    </th>
                    <th className="text-left px-1 py-2 text-sm font-medium text-[var(--text-muted)]">
                      단위
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      생산량
                    </th>
                    <th className="text-center px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      진행률
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      비고
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => {
                    const itemProgress = item.orderQty > 0 ? Math.round((item.producedQty / item.orderQty) * 100) : 0;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50"
                      >
                        <td className="px-3 py-3">
                          <Link
                            href={`/products/${item.product.id}`}
                            className="font-mono text-sm text-[var(--primary)] hover:underline"
                          >
                            {item.product.productCode}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[var(--text-primary)]">
                          {item.product.productName}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {item.orderQty.toLocaleString()}
                        </td>
                        <td className="px-1 py-3 text-left text-xs text-[var(--text-muted)]">
                          {item.product.unit}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <span className={item.producedQty >= item.orderQty ? "text-[var(--success)]" : "text-[var(--text-primary)]"}>
                            {item.producedQty.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${itemProgress >= 100 ? "bg-[var(--success)]" : "bg-[var(--primary)]"}`}
                                style={{ width: `${Math.min(itemProgress, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--text-muted)] w-10 text-right">
                              {itemProgress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                          {item.notes || "-"}
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
                    <td></td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--primary)]">
                      {totalProducedQty.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-center font-medium">
                      {progressPercent}%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Material Requirements */}
      {order.materialRequirements && order.materialRequirements.length > 0 && (() => {
        // 발주가 필요한 파츠: 부족량 > 0이고 아직 발주되지 않은 파츠
        const shortageParts = order.materialRequirements.filter(m => m.shortageQty > 0 && !m.alreadyOrdered);
        // 이미 발주된 파츠
        const alreadyOrderedParts = order.materialRequirements.filter(m => m.alreadyOrdered);
        const hasShortage = shortageParts.length > 0;
        const selectedShortageParts = shortageParts.filter(m => selectedParts.has(m.partId));
        const allShortageSelected = hasShortage && selectedShortageParts.length === shortageParts.length;

        const togglePartSelection = (partId: number) => {
          setSelectedParts(prev => {
            const next = new Set(prev);
            if (next.has(partId)) {
              next.delete(partId);
            } else {
              next.add(partId);
            }
            return next;
          });
        };

        const toggleAllShortage = () => {
          if (allShortageSelected) {
            setSelectedParts(new Set());
          } else {
            setSelectedParts(new Set(shortageParts.map(p => p.partId)));
          }
        };

        const handleQuickOrder = (parts: MaterialRequirement[]) => {
          if (parts.length === 0) return;
          if (!parts.every(p => p.supplierId)) {
            toast.error("공급업체가 지정되지 않은 파츠가 있습니다.");
            return;
          }
          quickOrderMutation.mutate(parts);
        };

        const urgencyColors = {
          CRITICAL: { bg: "bg-[var(--danger)]/10", text: "text-[var(--danger)]", badge: "badge-danger" },
          HIGH: { bg: "bg-[var(--warning)]/10", text: "text-[var(--warning)]", badge: "badge-warning" },
          MEDIUM: { bg: "bg-[var(--info)]/10", text: "text-[var(--info)]", badge: "badge-info" },
          LOW: { bg: "bg-[var(--glass-bg)]", text: "text-[var(--text-muted)]", badge: "badge-secondary" },
        };

        const urgencyLabels = {
          CRITICAL: "긴급",
          HIGH: "높음",
          MEDIUM: "보통",
          LOW: "낮음",
        };

        return (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  자재 소요량
                </h2>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {alreadyOrderedParts.length > 0 && (
                  <span className="flex items-center gap-1 text-[var(--success)]">
                    <CheckCircle className="w-4 h-4" />
                    발주완료 {alreadyOrderedParts.length}건
                  </span>
                )}
                {hasShortage && (
                  <span className="flex items-center gap-1 text-[var(--danger)]">
                    <AlertTriangle className="w-4 h-4" />
                    발주필요 {shortageParts.length}건
                  </span>
                )}
                <span className="text-[var(--text-muted)]">
                  {order.materialRequirements.length}개 파츠
                </span>
              </div>
            </div>

            {/* Shortage Alert Card */}
            {hasShortage && (
              <div className="mb-6 p-4 rounded-xl border-2 border-[var(--warning)] bg-[var(--warning)]/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      부족 파츠 {shortageParts.length}건 발견 - 발주가 필요합니다
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleAllShortage}
                      className="text-sm text-[var(--primary)] hover:underline"
                    >
                      {allShortageSelected ? "전체 해제" : "전체 선택"}
                    </button>
                  </div>
                </div>

                {/* Shortage Parts List */}
                <div className="space-y-2 mb-4">
                  {shortageParts.map((mat) => {
                    const isSelected = selectedParts.has(mat.partId);
                    const colors = urgencyColors[mat.urgency];

                    return (
                      <div
                        key={mat.partId}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-[var(--glass-border)] hover:border-[var(--primary)]/50"
                        }`}
                        onClick={() => togglePartSelection(mat.partId)}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-[var(--primary)] border-[var(--primary)]"
                              : "border-[var(--glass-border)]"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Part Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/parts/${mat.partId}`}
                              className="font-mono text-sm text-[var(--primary)] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {mat.partCode}
                            </Link>
                            <span className="text-[var(--text-primary)] truncate">
                              {mat.partName}
                            </span>
                          </div>
                          {mat.supplierName && (
                            <span className="text-xs text-[var(--text-muted)]">
                              {mat.supplierName}
                            </span>
                          )}
                        </div>

                        {/* Shortage Qty */}
                        <div className="text-right">
                          <div className="text-sm font-bold text-[var(--danger)]">
                            부족: {mat.shortageQty.toLocaleString()}{mat.unit}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            권장 발주: {mat.recommendedOrderQty.toLocaleString()}{mat.unit}
                          </div>
                        </div>

                        {/* Urgency Badge */}
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {urgencyLabels[mat.urgency]}
                        </div>

                        {/* Estimated Cost */}
                        {mat.estimatedCost > 0 && (
                          <div className="text-right text-xs text-[var(--text-muted)] w-20">
                            {mat.estimatedCost.toLocaleString()}원
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
                  <div className="text-sm text-[var(--text-muted)]">
                    {selectedShortageParts.length > 0 && (
                      <>
                        선택됨: {selectedShortageParts.length}건 /
                        예상 금액: {selectedShortageParts.reduce((sum, p) => sum + p.estimatedCost, 0).toLocaleString()}원
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuickOrder(selectedShortageParts)}
                      disabled={selectedShortageParts.length === 0 || quickOrderMutation.isPending}
                      className="btn btn-secondary"
                    >
                      {quickOrderMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      선택 발주 ({selectedShortageParts.length}건)
                    </button>
                    <button
                      onClick={() => handleQuickOrder(shortageParts)}
                      disabled={quickOrderMutation.isPending}
                      className="btn btn-primary"
                    >
                      {quickOrderMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      전체 발주 ({shortageParts.length}건)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Full Material Requirements Table */}
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
                      소요량
                    </th>
                    <th className="text-left px-1 py-2 text-sm font-medium text-[var(--text-muted)]">
                      단위
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      현재고
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      예약
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      입고예정
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      가용재고
                    </th>
                    <th className="text-right px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      부족량
                    </th>
                    <th className="text-left px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      공급업체
                    </th>
                    <th className="text-center px-3 py-2 text-sm font-medium text-[var(--text-muted)]">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.materialRequirements.map((mat) => {
                    const isShortage = mat.shortageQty > 0;
                    const isSafetyWarning = !isShortage && mat.availableStock - mat.totalRequirement < mat.safetyStock;
                    const colors = urgencyColors[mat.urgency];

                    return (
                      <tr
                        key={mat.partId}
                        className={`border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50 ${isShortage ? "bg-[var(--danger)]/5" : ""}`}
                      >
                        <td className="px-3 py-3">
                          <Link
                            href={`/parts/${mat.partId}`}
                            className="font-mono text-sm text-[var(--primary)] hover:underline"
                          >
                            {mat.partCode}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[var(--text-primary)]">
                          {mat.partName}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium">
                          {mat.totalRequirement.toLocaleString()}
                        </td>
                        <td className="px-1 py-3 text-left text-xs text-[var(--text-muted)]">
                          {mat.unit}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {mat.currentStock.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                          {mat.reservedQty > 0 ? `-${mat.reservedQty.toLocaleString()}` : "-"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--info)]">
                          {mat.incomingQty > 0 ? `+${mat.incomingQty.toLocaleString()}` : "-"}
                        </td>
                        <td className={`px-3 py-3 text-right tabular-nums font-medium ${mat.availableStock < 0 ? "text-[var(--danger)]" : ""}`}>
                          {mat.availableStock.toLocaleString()}
                        </td>
                        <td className={`px-3 py-3 text-right tabular-nums font-bold ${isShortage ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                          {isShortage ? `-${mat.shortageQty.toLocaleString()}` : "0"}
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                          {mat.supplierName || "-"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {mat.alreadyOrdered ? (
                            <span className="badge badge-info flex items-center gap-1 w-fit mx-auto" title={`발주번호: ${mat.existingOrderCode}`}>
                              <ShoppingCart className="w-3 h-3" />
                              발주완료
                            </span>
                          ) : isShortage ? (
                            <span className={`badge ${colors.badge} flex items-center gap-1 w-fit mx-auto`}>
                              <AlertTriangle className="w-3 h-3" />
                              {urgencyLabels[mat.urgency]}
                            </span>
                          ) : isSafetyWarning ? (
                            <span className="badge badge-warning flex items-center gap-1 w-fit mx-auto">
                              <AlertCircle className="w-3 h-3" />
                              주의
                            </span>
                          ) : (
                            <span className="badge badge-success flex items-center gap-1 w-fit mx-auto">
                              <CheckCircle className="w-3 h-3" />
                              충분
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--glass-bg)]">
                    <td colSpan={2} className="px-3 py-3 font-medium">
                      합계 ({order.materialRequirements.length}개 파츠)
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {order.materialRequirements.reduce((sum, m) => sum + m.totalRequirement, 0).toLocaleString()}
                    </td>
                    <td></td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {order.materialRequirements.reduce((sum, m) => sum + m.currentStock, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {order.materialRequirements.reduce((sum, m) => sum + m.reservedQty, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-[var(--info)]">
                      {order.materialRequirements.reduce((sum, m) => sum + m.incomingQty, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {order.materialRequirements.reduce((sum, m) => sum + m.availableStock, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--danger)]">
                      {order.materialRequirements.reduce((sum, m) => sum + m.shortageQty, 0).toLocaleString()}
                    </td>
                    <td></td>
                    <td className="px-3 py-3 text-center">
                      {hasShortage ? (
                        <span className="text-sm text-[var(--danger)] font-medium">
                          {shortageParts.length}건 부족
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--success)] font-medium">
                          모두 충분
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      <SalesOrderForm
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditSubmit}
        initialData={orderForForm}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}
