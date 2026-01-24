"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  Phone,
  Mail,
} from "lucide-react";
import SupplierForm from "@/components/forms/SupplierForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { Supplier } from "@/types/entities";

async function fetchSuppliers(): Promise<Supplier[]> {
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("Failed to fetch suppliers");
  return res.json();
}

async function createSupplier(data: Partial<Supplier>): Promise<Supplier> {
  const res = await fetch("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create supplier");
  return res.json();
}

async function updateSupplier(id: number, data: Partial<Supplier>): Promise<Supplier> {
  const res = await fetch(`/api/suppliers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update supplier");
  return res.json();
}

async function deleteSupplier(id: number): Promise<void> {
  const res = await fetch(`/api/suppliers/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete supplier");
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading, error } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("공급업체가 등록되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("공급업체 등록에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Supplier> }) =>
      updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("공급업체가 수정되었습니다.");
      setShowFormModal(false);
      setSelectedSupplier(null);
    },
    onError: () => {
      toast.error("공급업체 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("공급업체가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedSupplier(null);
    },
    onError: () => {
      toast.error("공급업체 삭제에 실패했습니다.");
    },
  });

  const handleCreate = () => {
    setSelectedSupplier(null);
    setShowFormModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowFormModal(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteDialog(true);
  };

  const handleFormSubmit = (data: Partial<Supplier>) => {
    if (selectedSupplier) {
      updateMutation.mutate({ id: selectedSupplier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedSupplier) {
      deleteMutation.mutate(selectedSupplier.id);
    }
  };

  const filteredSuppliers = suppliers?.filter(
    (supplier) =>
      supplier.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">공급업체 관리</h1>
          <p className="text-[var(--text-secondary)]">
            등록된 공급업체 {suppliers?.length || 0}개
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          업체 등록
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="업체코드 또는 업체명으로 검색..."
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
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">업체코드</th>
                <th className="table-header">업체명</th>
                <th className="table-header">담당자</th>
                <th className="table-header">연락처</th>
                <th className="table-header">이메일</th>
                <th className="table-header">주소</th>
                <th className="table-header">상태</th>
                <th className="table-header text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8">
                    <Truck className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 공급업체가 없습니다."}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 공급업체 등록하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSuppliers?.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td className="table-cell font-medium font-mono">{supplier.code}</td>
                    <td className="table-cell font-medium">{supplier.name}</td>
                    <td className="table-cell">{supplier.contactPerson || "-"}</td>
                    <td className="table-cell">
                      {supplier.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell">
                      {supplier.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {supplier.email}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell max-w-xs truncate">
                      {supplier.address || "-"}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          supplier.isActive ? "badge-success" : "badge-secondary"
                        }`}
                      >
                        {supplier.isActive ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="table-action-btn edit"
                          title="수정"
                          aria-label={`${supplier.name} 수정`}
                        >
                          <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="table-action-btn delete"
                          title="삭제"
                          aria-label={`${supplier.name} 삭제`}
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

      {/* Supplier Form Modal */}
      <SupplierForm
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedSupplier(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={selectedSupplier}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedSupplier(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="공급업체 삭제"
        message={`"${selectedSupplier?.name}" 업체를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
