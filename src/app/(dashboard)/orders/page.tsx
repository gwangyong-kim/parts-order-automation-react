"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ShoppingCart,
  Plus,
  Search,
  Download,
  Upload,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
} from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { FilterDropdown } from "@/components/ui/FilterDropdown";
import OrderForm from "@/components/forms/OrderForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";
import { exportToCSV, formatDateKR } from "@/lib/export-utils";
import { createApiService } from "@/lib/api-client";

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
  project: string | null;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  items: { id: number }[];
}

const ordersApi = createApiService<Order>("/api/orders", { paginated: true });

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

const columnHelper = createColumnHelper<Order>();

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: ordersApi.getAll,
  });

  // 내보내기 기능
  const handleExport = () => {
    try {
      exportToCSV({
        data: filteredOrders,
        headers: ["발주번호", "공급업체", "발주일", "입고예정일", "품목수", "금액", "상태"],
        rowMapper: (order) => [
          order.orderNumber,
          order.supplier?.name || "",
          formatDateKR(order.orderDate),
          formatDateKR(order.expectedDate),
          order.items.length,
          order.totalAmount,
          statusLabels[order.status] || order.status,
        ],
        filename: "orders",
      });
      toast.success("파일이 다운로드되었습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  // 필터 초기화
  const clearFilters = () => {
    setFilterStatus("all");
  };

  const createMutation = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      toast.success("발주가 생성되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("발주 생성에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Order> }) =>
      ordersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      toast.success("발주가 수정되었습니다.");
      setShowFormModal(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error("발주 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ordersApi.delete,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order"] });  // 모든 수주 상세 무효화

      // 발주 삭제 후 MRP 재계산 실행
      try {
        await fetch("/api/mrp/calculate", { method: "POST" });
      } catch {
        console.error("MRP 재계산 실패");
      }
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });

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

  const filteredOrders = useMemo(() => {
    return orders?.filter((order) => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "all" || order.status === filterStatus;
      return matchesSearch && matchesStatus;
    }) || [];
  }, [orders, searchTerm, filterStatus]);

  // Tanstack Table 컬럼 정의
  const columns = useMemo(
    () => [
      // 발주번호
      columnHelper.accessor("orderNumber", {
        header: "발주번호",
        size: 140,
        minSize: 100,
        maxSize: 200,
        cell: (info) => (
          <Link
            href={`/orders/${info.row.original.id}`}
            className="text-[var(--primary)] hover:underline truncate block font-medium"
            title={info.getValue()}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      // 공급업체
      columnHelper.accessor((row) => row.supplier?.name ?? "-", {
        id: "supplier",
        header: "공급업체",
        size: 150,
        minSize: 100,
        maxSize: 220,
        cell: ({ row }) =>
          row.original.supplier ? (
            <Link
              href="/suppliers"
              className="text-[var(--primary)] hover:underline truncate block"
              title={row.original.supplier.name}
            >
              {row.original.supplier.name}
            </Link>
          ) : (
            <span className="text-[var(--text-muted)]">-</span>
          ),
      }),
      // 프로젝트
      columnHelper.accessor("project", {
        header: "프로젝트",
        size: 130,
        minSize: 80,
        maxSize: 180,
        cell: (info) =>
          info.getValue() ? (
            <span className="px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-medium truncate block max-w-full">
              {info.getValue()}
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">-</span>
          ),
      }),
      // 발주일
      columnHelper.accessor("orderDate", {
        header: "발주일",
        size: 110,
        minSize: 90,
        maxSize: 130,
        cell: (info) => (
          <span className="whitespace-nowrap">
            {new Date(info.getValue()).toLocaleDateString("ko-KR")}
          </span>
        ),
      }),
      // 입고예정일
      columnHelper.accessor("expectedDate", {
        header: "입고예정일",
        size: 110,
        minSize: 90,
        maxSize: 130,
        cell: (info) => (
          <span className="whitespace-nowrap">
            {info.getValue()
              ? new Date(info.getValue()!).toLocaleDateString("ko-KR")
              : "-"}
          </span>
        ),
      }),
      // 품목수
      columnHelper.accessor((row) => row.items.length, {
        id: "itemCount",
        header: "품목수",
        size: 80,
        minSize: 60,
        maxSize: 100,
        cell: (info) => (
          <span className="tabular-nums">{info.getValue().toLocaleString()}개</span>
        ),
      }),
      // 금액
      columnHelper.accessor("totalAmount", {
        header: "금액",
        size: 130,
        minSize: 100,
        maxSize: 180,
        cell: (info) => (
          <span className="tabular-nums text-right block font-medium">
            ₩{info.getValue().toLocaleString()}
          </span>
        ),
      }),
      // 상태
      columnHelper.accessor("status", {
        header: "상태",
        size: 90,
        minSize: 70,
        maxSize: 120,
        cell: (info) => (
          <span className={`badge ${statusColors[info.getValue()] || "badge-secondary"}`}>
            {statusLabels[info.getValue()] || info.getValue()}
          </span>
        ),
      }),
      // 작업
      columnHelper.display({
        id: "actions",
        header: "작업",
        size: 110,
        minSize: 110,
        maxSize: 110,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Link
              href={`/orders/${row.original.id}`}
              className="table-action-btn edit"
              title="상세보기"
              aria-label={`${row.original.orderNumber} 상세보기`}
            >
              <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
            </Link>
            <button
              onClick={() => handleEdit(row.original)}
              className="table-action-btn edit"
              title="수정"
              aria-label={`${row.original.orderNumber} 수정`}
            >
              <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <button
              onClick={() => handleDelete(row.original)}
              className="table-action-btn delete"
              title="삭제"
              aria-label={`${row.original.orderNumber} 삭제`}
            >
              <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        ),
      }),
    ],
    []
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">발주 관리</h1>
          <p className="text-[var(--text-secondary)]">
            파츠 발주를 생성하고 관리합니다.
          </p>
        </div>
        {can("orders", "create") && (
          <button onClick={handleCreate} className="btn btn-primary btn-lg">
            <Plus className="w-5 h-5" />
            발주 생성
          </button>
        )}
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
            <FilterDropdown
              fields={[
                {
                  name: "status",
                  label: "상태",
                  value: filterStatus,
                  onChange: setFilterStatus,
                  options: [
                    { value: "all", label: "전체" },
                    { value: "DRAFT", label: "작성중" },
                    { value: "SUBMITTED", label: "제출됨" },
                    { value: "APPROVED", label: "승인됨" },
                    { value: "ORDERED", label: "발주됨" },
                    { value: "RECEIVED", label: "입고완료" },
                    { value: "CANCELLED", label: "취소됨" },
                  ],
                },
              ]}
              onClear={clearFilters}
            />

            {can("orders", "export") && (
              <button onClick={handleExport} className="btn-secondary">
                <Download className="w-4 h-4" />
                내보내기
              </button>
            )}
            {can("orders", "import") && (
              <button onClick={() => setShowUploadModal(true)} className="btn-secondary">
                <Upload className="w-4 h-4" />
                가져오기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <DataTable
        data={filteredOrders}
        columns={columns}
        isLoading={isLoading}
        searchTerm={searchTerm}
        emptyState={{
          icon: ShoppingCart,
          message: "등록된 발주가 없습니다.",
          searchMessage: "검색 결과가 없습니다.",
          actionLabel: can("orders", "create") ? "첫 번째 발주 생성하기" : undefined,
          onAction: can("orders", "create") ? handleCreate : undefined,
        }}
      />

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
        title="발주 대량 등록"
        fields={orderUploadFields}
        templateName="발주"
        isLoading={isUploading}
      />
    </div>
  );
}
