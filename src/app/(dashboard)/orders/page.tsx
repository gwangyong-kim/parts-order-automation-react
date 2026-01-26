"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  ChevronDown,
} from "lucide-react";
import OrderForm from "@/components/forms/OrderForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";

const orderUploadFields = [
  { name: "발주번호", description: "고유 발주 코드 (비워두면 자동생성: PO2501-0001)", required: false, type: "text", example: "PO2501-0001" },
  { name: "공급업체", description: "공급업체명", required: true, type: "text", example: "ABC산업" },
  { name: "프로젝트", description: "프로젝트명", required: false, type: "text", example: "A 프로젝트" },
  { name: "발주일", description: "발주 일자", required: false, type: "date", example: "2025-01-24" },
  { name: "납기예정일", description: "납품 예정일", required: false, type: "date", example: "2025-02-28" },
  { name: "파츠코드", description: "파츠 코드", required: false, type: "text", example: "P2501-0001" },
  { name: "파츠명", description: "파츠명 (코드 없을 시 사용)", required: false, type: "text", example: "볼트 M8" },
  { name: "수량", description: "발주 수량", required: false, type: "number", example: "100" },
  { name: "단가", description: "단가 (비워두면 파츠 기본단가)", required: false, type: "number", example: "1000" },
  { name: "비고", description: "기타 메모", required: false, type: "text", example: "긴급 발주" },
];

interface Order {
  id: number;
  orderNumber: string;
  supplierId: number;
  supplier: { id: number; name: string } | null;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  items: { id: number }[];
}

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch orders");
  const result = await res.json();
  return result.data;
}

async function createOrder(data: Partial<Order>): Promise<Order> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create order");
  return res.json();
}

async function updateOrder(id: number, data: Partial<Order>): Promise<Order> {
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

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const filterRef = useRef<HTMLDivElement>(null);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  // 필터 드롭다운 외부 클릭시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 내보내기 기능
  const handleExport = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["발주번호", "공급업체", "발주일", "입고예정일", "품목수", "금액", "상태"];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      order.supplier?.name || "",
      new Date(order.orderDate).toLocaleDateString("ko-KR"),
      order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("ko-KR") : "",
      order.items.length,
      order.totalAmount,
      statusLabels[order.status] || order.status,
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
    link.download = `orders_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  // 필터 초기화
  const clearFilters = () => {
    setFilterStatus("all");
    setShowFilterDropdown(false);
  };

  const hasActiveFilters = filterStatus !== "all";

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("발주가 생성되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("발주 생성에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Order> }) =>
      updateOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("발주가 수정되었습니다.");
      setShowFormModal(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error("발주 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("발주가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error("발주 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedOrder(null);
    setShowFormModal(true);
  };

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setShowFormModal(true);
  };

  const handleDelete = (order: Order) => {
    setSelectedOrder(order);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: Partial<Order>) => {
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
      const res = await fetch("/api/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(result.message);
      setShowUploadModal(false);

      if (result.errors?.length > 0) {
        result.errors.slice(0, 5).forEach((err: string) => toast.error(err));
      }
    } catch (error) {
      toast.error((error as Error).message || "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || order.status === filterStatus;
    return matchesSearch && matchesStatus;
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">발주 관리</h1>
          <p className="text-[var(--text-secondary)]">
            파츠 발주를 생성하고 관리합니다.
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          발주 생성
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">제출됨</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {orders?.filter((o) => o.status === "SUBMITTED").length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">승인됨</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {orders?.filter((o) => o.status === "APPROVED").length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">발주됨</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {orders?.filter((o) => o.status === "ORDERED").length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">입고완료</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {orders?.filter((o) => o.status === "RECEIVED").length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="발주번호 또는 공급업체로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            {/* 필터 드롭다운 */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`btn-secondary ${hasActiveFilters ? "ring-2 ring-[var(--primary-500)] ring-offset-1" : ""}`}
              >
                <Filter className="w-4 h-4" />
                필터
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary-500)] text-white rounded-full">1</span>
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
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">상태</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="all">전체</option>
                      <option value="DRAFT">작성중</option>
                      <option value="SUBMITTED">제출됨</option>
                      <option value="APPROVED">승인됨</option>
                      <option value="ORDERED">발주됨</option>
                      <option value="RECEIVED">입고완료</option>
                      <option value="CANCELLED">취소됨</option>
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
              대량 업로드
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
                <th className="table-header">발주번호</th>
                <th className="table-header">공급업체</th>
                <th className="table-header">발주일</th>
                <th className="table-header">입고예정일</th>
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
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 발주가 없습니다."}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 발주 생성하기
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
                    <td className="table-cell font-medium">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {order.supplier ? (
                        <Link
                          href="/suppliers"
                          className="text-[var(--primary)] hover:underline"
                        >
                          {order.supplier.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell">
                      {new Date(order.orderDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="table-cell">
                      {order.expectedDate
                        ? new Date(order.expectedDate).toLocaleDateString("ko-KR")
                        : "-"}
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
                        <Link
                          href={`/orders/${order.id}`}
                          className="table-action-btn edit"
                          title="상세보기"
                          aria-label={`${order.orderNumber} 상세보기`}
                        >
                          <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
                        </Link>
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

      {/* Order Form Modal */}
      <OrderForm
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
        title="발주 삭제"
        message={`"${selectedOrder?.orderNumber}" 발주를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Excel Upload Modal */}
      <ExcelUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="발주 대량 업로드"
        fields={orderUploadFields}
        templateName="발주_업로드_양식"
        isLoading={isUploading}
      />
    </div>
  );
}
