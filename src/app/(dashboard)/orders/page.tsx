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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import OrderForm from "@/components/forms/OrderForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";

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
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const filterRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

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
      updateOrder(id, data),
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
    mutationFn: deleteOrder,
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

  const table = useReactTable({
    data: filteredOrders,
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

      {/* Orders Table - Tanstack Table */}
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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 발주가 없습니다."}
                    </p>
                    {!searchTerm && can("orders", "create") && (
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
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--glass-bg)] transition-colors"
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
        {filteredOrders.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50 text-xs text-[var(--text-muted)]">
            헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬
          </div>
        )}
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
        title="발주 대량 등록"
        fields={orderUploadFields}
        templateName="발주"
        isLoading={isUploading}
      />
    </div>
  );
}
