"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  Eye,
  Calendar,
} from "lucide-react";
import SalesOrderForm from "@/components/forms/SalesOrderForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";

const salesOrderUploadFields = [
  { name: "수주번호", description: "고유 수주 코드 (비워두면 자동생성: SO2501-0001)", required: false, type: "text", example: "SO2501-0001" },
  { name: "사업부", description: "담당 사업부", required: false, type: "text", example: "영업1팀" },
  { name: "담당자", description: "영업 담당자", required: false, type: "text", example: "홍길동" },
  { name: "프로젝트", description: "프로젝트명", required: false, type: "text", example: "A 프로젝트" },
  { name: "수주일", description: "수주 접수일", required: true, type: "date", example: "2025-01-24" },
  { name: "납기일", description: "납품 예정일", required: false, type: "date", example: "2025-02-28" },
  { name: "제품코드", description: "제품 코드", required: false, type: "text", example: "PRD-001" },
  { name: "제품명", description: "제품명 (코드 없을 시 사용)", required: false, type: "text", example: "조립품 A" },
  { name: "수량", description: "주문 수량", required: false, type: "number", example: "100" },
  { name: "비고", description: "기타 메모", required: false, type: "text", example: "긴급 납품" },
];

interface SalesOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  items: { id: number }[];
}

async function fetchSalesOrders(): Promise<SalesOrder[]> {
  const res = await fetch("/api/sales-orders");
  if (!res.ok) throw new Error("Failed to fetch sales orders");
  return res.json();
}

async function createSalesOrder(data: Partial<SalesOrder>): Promise<SalesOrder> {
  const res = await fetch("/api/sales-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create sales order");
  return res.json();
}

async function updateSalesOrder(id: number, data: Partial<SalesOrder>): Promise<SalesOrder> {
  const res = await fetch(`/api/sales-orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update sales order");
  return res.json();
}

async function deleteSalesOrder(id: number): Promise<void> {
  const res = await fetch(`/api/sales-orders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete sales order");
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

export default function SalesOrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["sales-orders"],
    queryFn: fetchSalesOrders,
  });

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("수주가 등록되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("수주 등록에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SalesOrder> }) =>
      updateSalesOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("수주가 수정되었습니다.");
      setShowFormModal(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error("수주 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSalesOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("수주가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error("수주 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedOrder(null);
    setShowFormModal(true);
  };

  const handleEdit = (order: SalesOrder) => {
    setSelectedOrder(order);
    setShowFormModal(true);
  };

  const handleDelete = (order: SalesOrder) => {
    setSelectedOrder(order);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: Partial<SalesOrder>) => {
    if (selectedOrder) {
      updateMutation.mutate({ id: selectedOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedOrder) {
      deleteMutation.mutate(selectedOrder.id);
    }
  };

  const handleBulkUpload = async (data: Record<string, unknown>[]) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/sales-orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "업로드 실패");
      }

      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success(result.message);
      if (result.generatedCodes?.length > 0) {
        toast.info(`생성된 수주번호: ${result.generatedCodes.slice(0, 3).join(", ")}${result.generatedCodes.length > 3 ? " 외" : ""}`);
      }
      setShowUploadModal(false);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const filteredOrders = orders?.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">수주 관리</h1>
          <p className="text-[var(--text-secondary)]">
            고객 주문(수주)을 등록하고 관리합니다.
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          수주 등록
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-[var(--text-muted)]">전체 수주</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {orders?.length || 0}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-[var(--text-muted)]">대기중</p>
          <p className="text-2xl font-bold text-[var(--warning)]">
            {orders?.filter((o) => o.status === "PENDING").length || 0}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-[var(--text-muted)]">생산중</p>
          <p className="text-2xl font-bold text-[var(--info)]">
            {orders?.filter((o) => o.status === "IN_PRODUCTION").length || 0}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-[var(--text-muted)]">완료</p>
          <p className="text-2xl font-bold text-[var(--success)]">
            {orders?.filter((o) => o.status === "COMPLETED").length || 0}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="수주번호 또는 고객명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2">
              <Filter className="w-4 h-4" />
              필터
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              내보내기
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              가져오기
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">수주번호</th>
                <th className="table-header">고객명</th>
                <th className="table-header">주문일</th>
                <th className="table-header">납기일</th>
                <th className="table-header">품목수</th>
                <th className="table-header text-right">금액</th>
                <th className="table-header">상태</th>
                <th className="table-header text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 수주가 없습니다."}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 수주 등록하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders?.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td className="table-cell font-medium">{order.orderNumber}</td>
                    <td className="table-cell">{order.customerName}</td>
                    <td className="table-cell">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.orderDate).toLocaleDateString("ko-KR")}
                      </span>
                    </td>
                    <td className="table-cell">
                      {new Date(order.deliveryDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="table-cell">{order.items.length}개</td>
                    <td className="table-cell text-right font-medium tabular-nums">
                      ₩{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${statusColors[order.status] || "badge-secondary"}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="table-action-btn edit"
                          title="상세보기"
                          aria-label={`${order.orderNumber} 상세보기`}
                        >
                          <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          className="table-action-btn edit"
                          title="수정"
                          aria-label={`${order.orderNumber} 수정`}
                        >
                          <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(order)}
                          className="table-action-btn delete"
                          title="삭제"
                          aria-label={`${order.orderNumber} 삭제`}
                        >
                          <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Order Form Modal */}
      <SalesOrderForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedOrder(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={selectedOrder}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedOrder(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="수주 삭제"
        message={`"${selectedOrder?.orderNumber}" 수주를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Excel Upload Modal */}
      <ExcelUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="수주 대량 등록"
        templateName="수주"
        fields={salesOrderUploadFields}
        isLoading={isUploading}
      />
    </div>
  );
}
