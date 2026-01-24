"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface Category {
  id: number;
  code: string;
  name: string;
  description: string | null;
  parentId: number | null;
  _count?: { parts: number };
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

async function createCategory(data: Partial<Category>): Promise<Category> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create category");
  }
  return res.json();
}

async function updateCategory(id: number, data: Partial<Category>): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update category");
  }
  return res.json();
}

async function deleteCategory(id: number): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete category");
  }
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("카테고리가 생성되었습니다.");
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Category> }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("카테고리가 수정되었습니다.");
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("카테고리가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedCategory(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    setSelectedCategory(null);
    setFormData({ code: "", name: "", description: "" });
    setShowFormModal(true);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      description: category.description || "",
    });
    setShowFormModal(true);
  };

  const handleDelete = (category: Category) => {
    setSelectedCategory(category);
    setShowDeleteDialog(true);
  };

  const handleCloseForm = () => {
    setShowFormModal(false);
    setSelectedCategory(null);
    setFormData({ code: "", name: "", description: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategory) {
      updateMutation.mutate({ id: selectedCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedCategory) {
      deleteMutation.mutate(selectedCategory.id);
    }
  };

  const filteredCategories = categories?.filter(
    (category) =>
      category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">카테고리 관리</h1>
          <p className="text-[var(--text-secondary)]">
            부품 분류를 위한 카테고리를 관리합니다.
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          카테고리 추가
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <FolderTree className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">전체 카테고리</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {categories?.length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">사용 중</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {categories?.filter((c) => (c._count?.parts || 0) > 0).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gray-100)] rounded-lg flex items-center justify-center">
              <FolderTree className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">미사용</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {categories?.filter((c) => (c._count?.parts || 0) === 0).length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="코드 또는 이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-full"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Categories Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">코드</th>
                <th className="table-header">이름</th>
                <th className="table-header">설명</th>
                <th className="table-header text-center">부품 수</th>
                <th className="table-header text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center py-8">
                    <FolderTree className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 카테고리가 없습니다."}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 카테고리 추가하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCategories?.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td className="table-cell">
                      <span className="font-mono text-sm bg-[var(--gray-100)] px-2 py-1 rounded">
                        {category.code}
                      </span>
                    </td>
                    <td className="table-cell font-medium">{category.name}</td>
                    <td className="table-cell text-[var(--text-secondary)]">
                      {category.description || "-"}
                    </td>
                    <td className="table-cell text-center tabular-nums">
                      <span className={`badge ${(category._count?.parts || 0) > 0 ? "badge-primary" : "badge-secondary"}`}>
                        {category._count?.parts || 0}개
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(category)}
                          className="table-action-btn edit"
                          title="수정"
                          aria-label={`${category.name} 수정`}
                        >
                          <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className="table-action-btn delete"
                          title="삭제"
                          aria-label={`${category.name} 삭제`}
                          disabled={(category._count?.parts || 0) > 0}
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

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseForm}
          />
          <div className="relative glass-card w-full max-w-md mx-4 p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              {selectedCategory ? "카테고리 수정" : "카테고리 추가"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  코드 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="input w-full"
                  placeholder="예: ELEC, MECH"
                  required
                  maxLength={10}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  영문 대문자로 입력 (최대 10자)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  이름 <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="예: 전자부품"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  placeholder="카테고리 설명 (선택)"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="btn-secondary flex-1"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedCategory(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="카테고리 삭제"
        message={`"${selectedCategory?.name}" 카테고리를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
