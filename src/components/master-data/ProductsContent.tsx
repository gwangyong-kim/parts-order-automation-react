"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import MultiSheetUpload from "@/components/ui/MultiSheetUpload";
import { useToast } from "@/components/ui/Toast";

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

export default function ProductsContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const handleExport = () => {
    if (!products || products.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }

    const headers = ["제품코드", "제품명", "설명", "카테고리", "BOM항목수", "상태"];
    const rows = products.map(product => [
      product.productCode,
      product.productName || "",
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

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.isActive) ||
      (statusFilter === "inactive" && !product.isActive);
    const matchesCategory =
      !categoryFilter || product.category?.toLowerCase().includes(categoryFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = [...new Set(products?.map(p => p.category).filter(Boolean))];

  const activeFilterCount = [
    statusFilter !== "all" ? 1 : 0,
    categoryFilter ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

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
        <button onClick={handleCreate} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          제품 등록
        </button>
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
            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" />
              내보내기
            </button>
            <button onClick={() => setShowUploadModal(true)} className="btn-secondary">
              <Upload className="w-4 h-4" />
              가져오기
            </button>
          </div>
        </div>

        {showFilterPanel && (
          <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[150px]">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">상태</label>
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
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">카테고리</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">전체</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat || ""}>{cat}</option>
                  ))}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={() => { setStatusFilter("all"); setCategoryFilter(""); }}
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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {filteredProducts?.length === 0 ? (
          <div className="p-8 text-center">
            <Box className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)]">
              {searchTerm || activeFilterCount > 0 ? "검색 결과가 없습니다." : "등록된 제품이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-bordered">
              <thead>
                <tr className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
                  <th className="table-header table-col-code">제품코드</th>
                  <th className="table-header table-col-name">제품명</th>
                  <th className="table-header table-col-status">카테고리</th>
                  <th className="table-header text-center table-col-qty">BOM</th>
                  <th className="table-header text-center table-col-status">상태</th>
                  <th className="table-header text-center table-col-action">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts?.map((product) => (
                  <tr key={product.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)]/50">
                    <td className="table-cell table-col-code">
                      <Link href={`/products/${product.id}`} className="font-mono text-sm text-[var(--primary)] hover:underline">
                        {product.productCode}
                      </Link>
                    </td>
                    <td className="table-cell table-col-name">{product.productName || "-"}</td>
                    <td className="table-cell table-col-status text-sm text-[var(--text-secondary)]">{product.category || "-"}</td>
                    <td className="table-cell text-center table-col-qty">
                      <div className="flex items-center justify-center gap-1">
                        <Layers className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-sm tabular-nums">{product.bomItems.length}</span>
                      </div>
                    </td>
                    <td className="table-cell text-center table-col-status">
                      <span className={`badge ${product.isActive ? "badge-success" : "badge-secondary"}`}>
                        {product.isActive ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="table-cell text-center table-col-action">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(product)} className="table-action-btn edit" title="수정">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product)} className="table-action-btn delete" title="삭제">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <MultiSheetUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="제품 및 BOM 대량 등록"
        sheets={productUploadSheets}
        templateName="제품_BOM_업로드"
        isLoading={isUploading}
      />

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
