"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Box,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  Layers,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import ProductForm from "@/components/forms/ProductForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/usePermission";
import MultiSheetUpload from "@/components/ui/MultiSheetUpload";

interface BomItem {
  id: number;
  partId: number;
  quantityPerUnit: number;
  lossRate: number;
  notes: string | null;
  part?: {
    id: number;
    partCode: string;
    partName: string | null;
    unit: string;
  };
}

interface Product {
  id: number;
  productCode: string;
  productName: string | null;
  description: string | null;
  category: string | null;
  isActive: boolean;
  bomItems: BomItem[];
}

interface BomItemInput {
  partId: number;
  quantityPerUnit: number;
  lossRate: number;
  notes: string;
}

interface ProductFormData {
  productCode: string;
  productName: string | null;
  description: string | null;
  bomItems: BomItemInput[];
}

const productUploadSheets = [
  {
    name: "products",
    label: "제품",
    description: "제품 기본 정보를 등록합니다. 제품코드는 필수입니다.",
    required: true,
    fields: [
      { name: "제품코드", description: "고유 제품 코드", required: true, type: "text", example: "PRD-001" },
      { name: "제품명", description: "제품 이름", required: false, type: "text", example: "스마트 컨트롤러" },
      { name: "설명", description: "제품 설명", required: false, type: "text", example: "산업용 IoT 컨트롤러" },
      { name: "카테고리", description: "제품 분류", required: false, type: "text", example: "완제품" },
      { name: "단위", description: "수량 단위", required: false, type: "text", example: "SET" },
    ],
  },
  {
    name: "bom",
    label: "BOM",
    description: "제품별 자재명세(BOM)를 등록합니다. 제품코드와 파츠코드로 연결됩니다.",
    required: false,
    fields: [
      { name: "제품코드", description: "BOM을 등록할 제품 코드", required: true, type: "text", example: "PRD-001" },
      { name: "파츠코드", description: "파츠(부품) 코드", required: true, type: "text", example: "PART-001" },
      { name: "수량", description: "제품 1개당 필요한 파츠 수량", required: true, type: "number", example: "2" },
      { name: "로스율", description: "손실 배수 (1.05 = 5% 손실, 1.1 = 10% 손실)", required: false, type: "number", example: "1.05" },
      { name: "비고", description: "추가 메모", required: false, type: "text", example: "필수 부품" },
    ],
  },
];

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch products");
  const result = await res.json();
  return result.data;
}

async function createProduct(data: Partial<Product>): Promise<Product> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create product");
  return res.json();
}

async function updateProduct(id: number, data: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update product");
  return res.json();
}

async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete product");
}

const columnHelper = createColumnHelper<Product>();

export default function ProductsContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermission();
  const filterRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  // 필터 드롭다운 외부 클릭 감지
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
    if (editId && products) {
      const productToEdit = products.find((p) => p.id === parseInt(editId));
      if (productToEdit) {
        setSelectedProduct(productToEdit);
        setShowFormModal(true);
        router.replace("/master-data", { scroll: false });
      }
    }
  }, [searchParams, products, router]);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      toast.success("제품이 등록되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("제품 등록에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) =>
      updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      toast.success("제품이 수정되었습니다.");
      setShowFormModal(false);
      setSelectedProduct(null);
    },
    onError: () => {
      toast.error("제품 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });
      toast.success("제품이 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedProduct(null);
    },
    onError: () => {
      toast.error("제품 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedProduct(null);
    setShowFormModal(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowFormModal(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: ProductFormData) => {
    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, data: data as Partial<Product> });
    } else {
      createMutation.mutate(data as Partial<Product>);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedProduct) {
      deleteMutation.mutate(selectedProduct.id);
    }
  };

  const handleBulkUpload = async (data: Record<string, Record<string, unknown>[]>) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: data.products,
          bom: data.bom,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        const errorDetails = result.errors?.length > 0
          ? result.errors.slice(0, 5).join("\n") + (result.errors.length > 5 ? `\n... 외 ${result.errors.length - 5}건` : "")
          : result.error || "업로드 실패";
        throw new Error(errorDetails);
      }

      if (result.success === 0 && result.failed > 0) {
        const errorDetails = result.errors?.length > 0
          ? result.errors.slice(0, 5).join("\n") + (result.errors.length > 5 ? `\n... 외 ${result.errors.length - 5}건` : "")
          : "모든 항목 업로드 실패";
        throw new Error(errorDetails);
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["mrp-results"] });

      if (result.errors?.length > 0) {
        const errorSummary = result.errors.slice(0, 3).join(", ");
        toast.warning(`${result.message}\n일부 오류: ${errorSummary}`);
      } else {
        toast.success(result.message);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((product) => {
      const code = String(product.productCode || "").toLowerCase();
      const name = String(product.productName || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchesSearch = code.includes(search) || name.includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.isActive) ||
        (statusFilter === "inactive" && !product.isActive);
      const cat = String(product.category || "").toLowerCase();
      const matchesCategory = !categoryFilter || cat.includes(categoryFilter.toLowerCase());
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, searchTerm, statusFilter, categoryFilter]);

  const handleExport = () => {
    if (!filteredProducts || filteredProducts.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    try {
      const headers = "제품코드,제품명,설명,카테고리,BOM항목수,상태";
      const rows = filteredProducts.map(p => {
        const code = String(p.productCode || "").replace(/"/g, '""');
        const name = String(p.productName || "").replace(/"/g, '""');
        const desc = String(p.description || "").replace(/"/g, '""');
        const cat = String(p.category || "").replace(/"/g, '""');
        const bom = Array.isArray(p.bomItems) ? p.bomItems.length : 0;
        const status = p.isActive ? "활성" : "비활성";
        return `"${code}","${name}","${desc}","${cat}","${bom}","${status}"`;
      });
      const csv = "\uFEFF" + headers + "\n" + rows.join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `제품목록_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("파일이 다운로드되었습니다.");
    } catch (e) {
      console.error("Export error:", e);
      toast.error("내보내기 중 오류가 발생했습니다.");
    }
  };

  const categories = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
  }, [products]);

  const hasActiveFilters = statusFilter !== "all" || categoryFilter !== "";
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (categoryFilter ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("");
  };

  // TanStack Table 컬럼 정의
  const columns = useMemo(
    () => [
      columnHelper.accessor("productCode", {
        header: "제품코드",
        size: 140,
        minSize: 100,
        maxSize: 200,
        cell: (info) => (
          <Link
            href={`/products/${info.row.original.id}`}
            className="font-mono text-sm text-[var(--primary)] hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("productName", {
        header: "제품명",
        size: 200,
        minSize: 150,
        maxSize: 350,
        cell: (info) => (
          <span className="truncate block" title={info.getValue() || ""}>
            {info.getValue() || "-"}
          </span>
        ),
      }),
      columnHelper.accessor("category", {
        header: "카테고리",
        size: 120,
        minSize: 80,
        maxSize: 180,
        cell: (info) => (
          <span className="text-sm text-[var(--text-secondary)]">
            {info.getValue() || "-"}
          </span>
        ),
      }),
      columnHelper.accessor((row) => Array.isArray(row.bomItems) ? row.bomItems.length : 0, {
        id: "bomCount",
        header: "BOM",
        size: 80,
        minSize: 60,
        maxSize: 100,
        cell: (info) => (
          <div className="flex items-center justify-center gap-1">
            <Layers className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm tabular-nums">{info.getValue().toLocaleString()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("isActive", {
        header: "상태",
        size: 80,
        minSize: 70,
        maxSize: 100,
        cell: (info) => (
          <div className="flex justify-center">
            <span className={`badge ${info.getValue() ? "badge-success" : "badge-secondary"}`}>
              {info.getValue() ? "활성" : "비활성"}
            </span>
          </div>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "관리",
        size: 100,
        minSize: 80,
        maxSize: 120,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            {can("master-data", "edit") && (
              <button
                onClick={() => handleEdit(row.original)}
                className="table-action-btn edit"
                title="수정"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {can("master-data", "delete") && (
              <button
                onClick={() => handleDelete(row.original)}
                className="table-action-btn delete"
                title="삭제"
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

  const table = useReactTable({
    data: filteredProducts || [],
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
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
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
    <div className="space-y-4">
      {/* Header with count and action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          등록된 제품 {products?.length || 0}개
        </p>
        {can("master-data", "create") && (
          <button onClick={handleCreate} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            제품 등록
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="제품코드 또는 제품명으로 검색..."
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
                    {activeFilterCount}
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
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--gray-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                    >
                      <option value="">전체</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="px-4 py-2">
                    <label className="text-xs font-medium text-[var(--gray-600)] mb-1.5 block">
                      상태
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
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
              <button onClick={() => setShowUploadModal(true)} className="btn-secondary">
                <Upload className="w-4 h-4" />
                가져오기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table - TanStack Table */}
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
              {(filteredProducts?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center">
                    <Box className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm || activeFilterCount > 0 ? "검색 결과가 없습니다." : "등록된 제품이 없습니다."}
                    </p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--glass-bg)]/50 transition-colors"
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
        {(filteredProducts?.length || 0) > 0 && (
          <div className="px-4 py-2 border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50 text-xs text-[var(--text-muted)]">
            헤더 경계를 드래그하여 컬럼 너비 조절 | 헤더 클릭으로 정렬
          </div>
        )}
      </div>

      <ProductForm
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setSelectedProduct(null); }}
        onSubmit={handleFormSubmit}
        initialData={selectedProduct}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {showUploadModal && (
        <MultiSheetUpload
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleBulkUpload}
          title="제품 및 BOM 대량 등록"
          sheets={productUploadSheets}
          templateName="제품_BOM_업로드"
          isLoading={isUploading}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setSelectedProduct(null); }}
        onConfirm={handleDeleteConfirm}
        title="제품 삭제"
        message={`"${selectedProduct?.productName || selectedProduct?.productCode}" 제품을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
