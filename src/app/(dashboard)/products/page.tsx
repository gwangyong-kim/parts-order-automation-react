"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  X,
} from "lucide-react";
import ProductForm from "@/components/forms/ProductForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";

interface Product {
  id: number;
  productCode: string;
  productName: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  bomItems: { id: number }[];
}

const productUploadFields = [
  { name: "제품코드", description: "고유 제품 코드 (비워두면 자동생성)", required: false, type: "text", example: "PRD-001" },
  { name: "제품명", description: "제품 이름", required: true, type: "text", example: "스마트 컨트롤러" },
  { name: "설명", description: "제품 설명", required: false, type: "text", example: "산업용 IoT 컨트롤러" },
  { name: "카테고리", description: "제품 분류", required: false, type: "text", example: "완제품" },
  { name: "단위", description: "수량 단위", required: false, type: "text", example: "SET" },
];

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
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

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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

  const handleFormSubmit = (data: Partial<Product>) => {
    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedProduct) {
      deleteMutation.mutate(selectedProduct.id);
    }
  };

  const handleBulkUpload = async (data: Record<string, unknown>[]) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "업로드 실패");
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(result.message);
      setShowUploadModal(false);
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = () => {
    if (!products || products.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["제품코드", "제품명", "설명", "카테고리", "BOM항목수", "상태"];
    const rows = products.map(product => [
      product.productCode,
      product.productName,
      product.description || "",
      product.category || "",
      product.bomItems.length.toString(),
      product.isActive ? "활성" : "비활성",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `제품목록_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("파일이 다운로드되었습니다.");
  };

  // 필터링
  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.isActive) ||
      (statusFilter === "inactive" && !product.isActive);
    const matchesCategory =
      !categoryFilter || product.category?.toLowerCase().includes(categoryFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // 카테고리 목록 추출
  const categories = [...new Set(products?.map(p => p.category).filter(Boolean))];

  const activeFilterCount = [
    statusFilter !== "all" ? 1 : 0,
    categoryFilter ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">제품 관리</h1>
          <p className="text-[var(--text-secondary)]">
            제품 및 BOM(자재명세서)을 관리합니다. 등록된 제품 {products?.length || 0}개
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          제품 등록
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="제품코드 또는 제품명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`btn-secondary flex items-center gap-2 ${activeFilterCount > 0 ? "ring-2 ring-[var(--primary)]" : ""}`}
            >
              <Filter className="w-4 h-4" />
              필터
              {activeFilterCount > 0 && (
                <span className="bg-[var(--primary)] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2"
              title="CSV로 내보내기"
            >
              <Download className="w-4 h-4" />
              내보내기
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-secondary flex items-center gap-2"
              title="Excel/CSV 가져오기"
            >
              <Upload className="w-4 h-4" />
              가져오기
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[150px]">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  상태
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  className="input w-full"
                >
                  <option value="all">전체</option>
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
              <div className="min-w-[150px]">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  카테고리
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">전체</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat || ""}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setCategoryFilter("");
                    }}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    필터 초기화
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts?.length === 0 ? (
          <div className="col-span-full glass-card p-8 text-center">
            <Box className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">
              {searchTerm || activeFilterCount > 0 ? "검색 결과가 없습니다." : "등록된 제품이 없습니다."}
            </p>
            {!searchTerm && activeFilterCount === 0 && (
              <button
                onClick={handleCreate}
                className="mt-4 text-[var(--primary)] hover:underline"
              >
                첫 번째 제품 등록하기
              </button>
            )}
          </div>
        ) : (
          filteredProducts?.map((product) => (
            <div key={product.id} className="glass-card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                  <Box className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(product)}
                    className="table-action-btn edit"
                    title="수정"
                    aria-label={`${product.productName} 수정`}
                  >
                    <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="table-action-btn delete"
                    title="삭제"
                    aria-label={`${product.productName} 삭제`}
                  >
                    <Trash2 className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                {product.productName}
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                {product.productCode}
              </p>

              {product.description && (
                <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[var(--glass-border)]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    BOM {product.bomItems.length}개 항목
                  </span>
                </div>
                <span
                  className={`badge ${
                    product.isActive ? "badge-success" : "badge-secondary"
                  }`}
                >
                  {product.isActive ? "활성" : "비활성"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Product Form Modal */}
      <ProductForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedProduct(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={selectedProduct}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Excel Upload Modal */}
      <ExcelUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="제품 대량 등록"
        fields={productUploadFields}
        isLoading={isUploading}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedProduct(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="제품 삭제"
        message={`"${selectedProduct?.productName}" 제품을 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
