"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import PartForm from "@/components/forms/PartForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";
import type { Part, Category } from "@/types/entities";
import type { PartFormData } from "@/schemas/part.schema";

const partUploadFields = [
  { name: "파츠코드", description: "고유 파츠 코드", required: true, type: "text", example: "P2501-0001" },
  { name: "파츠명", description: "파츠 이름", required: false, type: "text", example: "볼트 M8" },
  { name: "규격", description: "파츠 규격/사양", required: false, type: "text", example: "SUS304" },
  { name: "저장위치", description: "사내 규정 위치코드", required: false, type: "text", example: "A-01-02" },
  { name: "단위", description: "수량 단위", required: false, type: "text", example: "EA" },
  { name: "단가", description: "단가 (원)", required: false, type: "number", example: "1000" },
  { name: "안전재고", description: "최소 유지 재고량", required: false, type: "number", example: "100" },
  { name: "최소발주량", description: "최소 발주 수량", required: false, type: "number", example: "50" },
  { name: "리드타임", description: "조달 소요일 (일)", required: false, type: "number", example: "7" },
  { name: "카테고리", description: "파츠 분류명", required: false, type: "text", example: "체결파츠" },
  { name: "공급업체", description: "공급업체명", required: false, type: "text", example: "ABC산업" },
];

async function fetchParts(): Promise<Part[]> {
  const res = await fetch("/api/parts?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch parts");
  const result = await res.json();
  return result.data;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

async function createPart(data: Partial<Part>): Promise<Part> {
  const res = await fetch("/api/parts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create part");
  return res.json();
}

async function updatePart(id: number, data: Partial<Part>): Promise<Part> {
  const res = await fetch(`/api/parts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update part");
  return res.json();
}

async function deletePart(id: number): Promise<void> {
  const res = await fetch(`/api/parts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete part");
}

const columnHelper = createColumnHelper<Part>();

export default function PartsListContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = usePermission();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const filterRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const { data: parts, isLoading, error } = useQuery({
    queryKey: ["parts"],
    queryFn: fetchParts,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
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

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && parts) {
      const partToEdit = parts.find((p) => p.id === parseInt(editId));
      if (partToEdit) {
        setSelectedPart(partToEdit);
        setShowFormModal(true);
        router.replace("/master-data?tab=parts", { scroll: false });
      }
    }
  }, [searchParams, parts, router]);

  const handleExport = () => {
    if (!filteredParts || filteredParts.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["파츠번호", "파츠명", "규격", "저장위치", "단위", "단가", "안전재고", "카테고리", "공급업체", "상태"];
    const rows = filteredParts.map((part) => [
      part.partNumber,
      part.partName,
      part.description || "",
      part.storageLocation || "",
      part.unit,
      part.unitPrice,
      part.safetyStock,
      part.category?.name || "",
      part.supplier?.name || "",
      part.isActive ? "활성" : "비활성",
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
    link.download = `parts_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  const clearFilters = () => {
    setFilterCategory(null);
    setFilterStatus("all");
    setShowFilterDropdown(false);
  };

  const hasActiveFilters = filterCategory !== null || filterStatus !== "all";

  const createMutation = useMutation({
    mutationFn: createPart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("파츠가 등록되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("파츠 등록에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Part> }) =>
      updatePart(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("파츠가 수정되었습니다.");
      setShowFormModal(false);
      setSelectedPart(null);
    },
    onError: () => {
      toast.error("파츠 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("파츠가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedPart(null);
    },
    onError: () => {
      toast.error("파츠 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedPart(null);
    setShowFormModal(true);
  };

  const handleEdit = (part: Part) => {
    setSelectedPart(part);
    setShowFormModal(true);
  };

  const handleDelete = (part: Part) => {
    setSelectedPart(part);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: PartFormData) => {
    if (selectedPart) {
      updateMutation.mutate({ id: selectedPart.id, data: data as Partial<Part> });
    } else {
      createMutation.mutate(data as Partial<Part>);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedPart) {
      deleteMutation.mutate(selectedPart.id);
    }
  };

  const handleBulkUpload = async (data: Record<string, unknown>[]) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/parts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "업로드 실패");
      }

      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success(result.message);
      setShowUploadModal(false);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const filteredParts = useMemo(() => {
    return parts?.filter((part) => {
      const matchesSearch =
        part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.partName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === null || part.categoryId === filterCategory;

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && part.isActive) ||
        (filterStatus === "inactive" && !part.isActive);

      return matchesSearch && matchesCategory && matchesStatus;
    }) || [];
  }, [parts, searchTerm, filterCategory, filterStatus]);

  // Tanstack Table 컬럼 정의
  const columns = useMemo(
    () => [
      columnHelper.accessor("partNumber", {
        header: "파츠번호",
        size: 130,
        minSize: 100,
        maxSize: 180,
        cell: (info) => (
          <Link
            href={`/parts/${info.row.original.id}`}
            className="text-[var(--primary)] hover:underline truncate block font-medium font-mono"
            title={info.getValue()}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("partName", {
        header: "파츠명",
        size: 180,
        minSize: 120,
        maxSize: 280,
        cell: (info) => (
          <span className="truncate block" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("description", {
        header: "규격",
        size: 150,
        minSize: 100,
        maxSize: 220,
        cell: (info) => (
          <span className="truncate block text-[var(--text-secondary)]" title={info.getValue() || ""}>
            {info.getValue() || "-"}
          </span>
        ),
      }),
      columnHelper.accessor("storageLocation", {
        header: "저장위치",
        size: 100,
        minSize: 80,
        maxSize: 140,
        cell: (info) => (
          <span className="font-mono text-sm">
            {info.getValue() || "-"}
          </span>
        ),
      }),
      columnHelper.accessor("unit", {
        header: "단위",
        size: 70,
        minSize: 60,
        maxSize: 100,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("unitPrice", {
        header: "단가",
        size: 110,
        minSize: 90,
        maxSize: 140,
        cell: (info) => (
          <span className="text-right tabular-nums block">
            {"\u20A9"}{info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("safetyStock", {
        header: "안전재고",
        size: 90,
        minSize: 80,
        maxSize: 120,
        cell: (info) => (
          <span className="text-right tabular-nums block">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.category?.name ?? "", {
        id: "category",
        header: "카테고리",
        size: 110,
        minSize: 90,
        maxSize: 160,
        cell: ({ row }) =>
          row.original.category ? (
            <span className="badge badge-info">{row.original.category.name}</span>
          ) : (
            "-"
          ),
      }),
      columnHelper.accessor((row) => row.supplier?.name ?? "", {
        id: "supplier",
        header: "공급업체",
        size: 140,
        minSize: 100,
        maxSize: 200,
        cell: ({ row }) => (
          <span className="truncate block" title={row.original.supplier?.name || ""}>
            {row.original.supplier?.name || "-"}
          </span>
        ),
      }),
      columnHelper.accessor("isActive", {
        header: "상태",
        size: 80,
        minSize: 70,
        maxSize: 100,
        cell: (info) => (
          <span className={`badge ${info.getValue() ? "badge-success" : "badge-secondary"}`}>
            {info.getValue() ? "활성" : "비활성"}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "작업",
        size: 90,
        minSize: 80,
        maxSize: 100,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2">
            {can("master-data", "edit") && (
              <button
                onClick={() => handleEdit(row.original)}
                className="table-action-btn edit"
                title="수정"
                aria-label={`${row.original.partName} 수정`}
              >
                <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            )}
            {can("master-data", "delete") && (
              <button
                onClick={() => handleDelete(row.original)}
                className="table-action-btn delete"
                title="삭제"
                aria-label={`${row.original.partName} 삭제`}
              >
                <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            )}
          </div>
        ),
      }),
    ],
    [can]
  );

  const table = useReactTable({
    data: filteredParts,
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
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[var(--text-secondary)]">
            등록된 파츠 {parts?.length || 0}개
          </p>
        </div>
        {can("master-data", "create") && (
          <button onClick={handleCreate} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            파츠 등록
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="파츠번호 또는 파츠명으로 검색..."
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
                필터
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary-500)] text-white rounded-full">
                    {(filterCategory !== null ? 1 : 0) + (filterStatus !== "all" ? 1 : 0)}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? "rotate-180" : ""}`} />
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-[var(--gray-200)] shadow-lg py-3 z-50 animate-scale-in">
                  <div className="px-4 pb-2 mb-2 border-b border-[var(--gray-100)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--gray-900)]">필터</span>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="text-xs text-[var(--primary-500)] hover:underline"
                      >
                        초기화
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">
                      카테고리
                    </label>
                    <select
                      value={filterCategory ?? ""}
                      onChange={(e) => setFilterCategory(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="">전체</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">
                      상태
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="all">전체</option>
                      <option value="active">활성</option>
                      <option value="inactive">비활성</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {can("master-data", "export") && (
              <button onClick={handleExport} className="btn-secondary">
                <Download className="w-4 h-4" />
                내보내기
              </button>
            )}

            {can("master-data", "import") && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-secondary"
              >
                <Upload className="w-4 h-4" />
                가져오기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Parts Table - Tanstack Table */}
      <div className="glass-card overflow-hidden table-container">
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
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <Package className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 파츠가 없습니다."}
                    </p>
                    {!searchTerm && can("master-data", "create") && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 파츠 등록하기
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
        {filteredParts.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50">
            <p className="text-sm text-[var(--text-secondary)]">
              총 {filteredParts.length}개 파츠
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬
            </p>
          </div>
        )}
      </div>

      {/* Part Form Modal */}
      <PartForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedPart(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={selectedPart}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedPart(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="파츠 삭제"
        message={`"${selectedPart?.partName}" 파츠를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Excel Upload Modal */}
      <ExcelUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="파츠 대량 등록"
        templateName="파츠"
        fields={partUploadFields}
        isLoading={isUploading}
      />
    </div>
  );
}
