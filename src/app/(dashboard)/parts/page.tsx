"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
} from "lucide-react";
import PartForm from "@/components/forms/PartForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import { useToast } from "@/components/ui/Toast";
import type { Part } from "@/types/entities";

const partUploadFields = [
  { name: "부품코드", description: "고유 부품 코드 (비워두면 자동생성)", required: false, type: "text", example: "P2501-0001" },
  { name: "부품명", description: "부품 이름", required: true, type: "text", example: "볼트 M8" },
  { name: "규격", description: "부품 규격/사양", required: false, type: "text", example: "SUS304" },
  { name: "단위", description: "수량 단위", required: false, type: "text", example: "EA" },
  { name: "단가", description: "단가 (원)", required: false, type: "number", example: "1000" },
  { name: "안전재고", description: "최소 유지 재고량", required: false, type: "number", example: "100" },
  { name: "최소발주량", description: "최소 발주 수량", required: false, type: "number", example: "50" },
  { name: "리드타임", description: "조달 소요일 (일)", required: false, type: "number", example: "7" },
  { name: "카테고리", description: "부품 분류명", required: false, type: "text", example: "체결부품" },
  { name: "공급업체", description: "공급업체명", required: false, type: "text", example: "ABC산업" },
];

async function fetchParts(): Promise<Part[]> {
  const res = await fetch("/api/parts");
  if (!res.ok) throw new Error("Failed to fetch parts");
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

export default function PartsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: parts, isLoading, error } = useQuery({
    queryKey: ["parts"],
    queryFn: fetchParts,
  });

  const createMutation = useMutation({
    mutationFn: createPart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("부품이 등록되었습니다.");
      setShowFormModal(false);
    },
    onError: () => {
      toast.error("부품 등록에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Part> }) =>
      updatePart(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("부품이 수정되었습니다.");
      setShowFormModal(false);
      setSelectedPart(null);
    },
    onError: () => {
      toast.error("부품 수정에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      toast.success("부품이 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedPart(null);
    },
    onError: () => {
      toast.error("부품 삭제에 실패했습니다.");
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

  const handleFormSubmit = (data: Partial<Part>) => {
    if (selectedPart) {
      updateMutation.mutate({ id: selectedPart.id, data });
    } else {
      createMutation.mutate(data);
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

  const filteredParts = parts?.filter(
    (part) =>
      part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.partName.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">파츠 관리</h1>
          <p className="text-[var(--text-secondary)]">
            등록된 부품 {parts?.length || 0}개
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary btn-lg">
          <Plus className="w-5 h-5" />
          부품 등록
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="부품번호 또는 부품명으로 검색..."
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

      {/* Parts Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="table-header">부품번호</th>
                <th className="table-header">부품명</th>
                <th className="table-header">규격</th>
                <th className="table-header">단위</th>
                <th className="table-header text-right">단가</th>
                <th className="table-header text-right">안전재고</th>
                <th className="table-header">카테고리</th>
                <th className="table-header">공급업체</th>
                <th className="table-header">상태</th>
                <th className="table-header text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts?.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-cell text-center py-8">
                    <Package className="w-12 h-12 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[var(--text-muted)]">
                      {searchTerm ? "검색 결과가 없습니다." : "등록된 부품이 없습니다."}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreate}
                        className="mt-4 text-[var(--primary)] hover:underline"
                      >
                        첫 번째 부품 등록하기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredParts?.map((part) => (
                  <tr
                    key={part.id}
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <td className="table-cell font-medium font-mono">
                      {part.partNumber}
                    </td>
                    <td className="table-cell">{part.partName}</td>
                    <td className="table-cell text-[var(--text-secondary)] max-w-xs truncate">
                      {part.description || "-"}
                    </td>
                    <td className="table-cell">{part.unit}</td>
                    <td className="table-cell text-right tabular-nums">
                      ₩{part.unitPrice.toLocaleString()}
                    </td>
                    <td className="table-cell text-right tabular-nums">{part.safetyStock}</td>
                    <td className="table-cell">
                      {part.category ? (
                        <span className="badge badge-info">{part.category.name}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell">{part.supplier?.name || "-"}</td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          part.isActive ? "badge-success" : "badge-secondary"
                        }`}
                      >
                        {part.isActive ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(part)}
                          className="table-action-btn edit"
                          title="수정"
                          aria-label={`${part.partName} 수정`}
                        >
                          <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(part)}
                          className="table-action-btn delete"
                          title="삭제"
                          aria-label={`${part.partName} 삭제`}
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

        {/* Pagination */}
        {filteredParts && filteredParts.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--glass-border)]">
            <p className="text-sm text-[var(--text-secondary)]">
              총 {filteredParts.length}개 부품
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled>
                이전
              </button>
              <button className="btn-secondary" disabled>
                다음
              </button>
            </div>
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
        title="부품 삭제"
        message={`"${selectedPart?.partName}" 부품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Excel Upload Modal */}
      <ExcelUpload
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleBulkUpload}
        title="부품 대량 등록"
        templateName="부품"
        fields={partUploadFields}
        isLoading={isUploading}
      />
    </div>
  );
}
