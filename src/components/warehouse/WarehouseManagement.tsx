"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Layout,
  Plus,
  Trash2,
  Map,
  Building2,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Pencil,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ExcelUpload from "@/components/ui/ExcelUpload";
import UsageGuide, {
  WAREHOUSE_GUIDE_SECTIONS,
  WAREHOUSE_GUIDE_TIPS,
  WAREHOUSE_GUIDE_WARNINGS,
} from "@/components/ui/UsageGuide";
import { useToast } from "@/components/ui/Toast";
import type { Warehouse } from "@/types/warehouse";

const WAREHOUSE_UPLOAD_FIELDS = [
  { name: "창고코드", description: "창고 고유 코드", required: true, example: "WH01", type: "text" },
  { name: "창고명", description: "창고 이름", required: true, example: "본사 창고", type: "text" },
  { name: "설명", description: "창고 설명", required: false, example: "주요 파츠 보관", type: "text" },
  { name: "주소", description: "창고 주소", required: false, example: "서울시 강남구", type: "text" },
  { name: "너비", description: "맵 너비 (기본: 100)", required: false, example: "100", type: "number" },
  { name: "높이", description: "맵 높이 (기본: 100)", required: false, example: "100", type: "number" },
  { name: "Zone코드", description: "Zone 고유 코드 (선택)", required: false, example: "A", type: "text" },
  { name: "Zone명", description: "Zone 이름 (선택)", required: false, example: "A 구역", type: "text" },
  { name: "Zone색상", description: "Zone 색상 (선택)", required: false, example: "#3B82F6", type: "text" },
  { name: "Zone X", description: "Zone X 위치", required: false, example: "0", type: "number" },
  { name: "Zone Y", description: "Zone Y 위치", required: false, example: "0", type: "number" },
  { name: "Zone 너비", description: "Zone 너비", required: false, example: "20", type: "number" },
  { name: "Zone 높이", description: "Zone 높이", required: false, example: "20", type: "number" },
  { name: "Rack번호", description: "Rack 번호 (선택)", required: false, example: "01", type: "text" },
  { name: "Rack X", description: "Rack X 위치", required: false, example: "0", type: "number" },
  { name: "Rack Y", description: "Rack Y 위치", required: false, example: "0", type: "number" },
  { name: "선반수", description: "선반 개수 (기본: 4)", required: false, example: "4", type: "number" },
];

type SortField = "code" | "name" | "zoneCount" | "rackCount" | "isActive";
type SortDirection = "asc" | "desc";

async function fetchWarehouses(): Promise<Warehouse[]> {
  const res = await fetch("/api/warehouse");
  if (!res.ok) throw new Error("Failed to fetch warehouses");
  return res.json();
}

async function createWarehouse(data: Partial<Warehouse>): Promise<Warehouse> {
  const res = await fetch("/api/warehouse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create warehouse");
  return res.json();
}

async function deleteWarehouse(id: number): Promise<void> {
  const res = await fetch(`/api/warehouse/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete warehouse");
}

async function bulkDeleteWarehouses(ids: number[]): Promise<{ count: number }> {
  const res = await fetch("/api/warehouse/bulk-delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to delete warehouses");
  return res.json();
}

async function updateWarehouse(id: number, data: Partial<Warehouse>): Promise<Warehouse> {
  const res = await fetch(`/api/warehouse/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update warehouse");
  return res.json();
}

export default function WarehouseManagement() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    address: "",
    width: 100,
    height: 100,
    isActive: true,
  });

  const { data: warehouses, isLoading, error } = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  const createMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("창고가 등록되었습니다.");
      setShowForm(false);
      resetForm();
    },
    onError: () => {
      toast.error("창고 등록에 실패했습니다.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("창고가 삭제되었습니다.");
      setShowDeleteDialog(false);
      setSelectedWarehouse(null);
    },
    onError: () => {
      toast.error("창고 삭제에 실패했습니다.");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteWarehouses,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(`${data.count}개의 창고가 삭제되었습니다.`);
      setShowBulkDeleteDialog(false);
      setSelectedIds([]);
    },
    onError: () => {
      toast.error("창고 삭제에 실패했습니다.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Warehouse> }) =>
      updateWarehouse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("창고가 수정되었습니다.");
      setShowForm(false);
      setIsEditMode(false);
      setSelectedWarehouse(null);
      resetForm();
    },
    onError: () => {
      toast.error("창고 수정에 실패했습니다.");
    },
  });

  const filteredAndSortedWarehouses = useMemo(() => {
    if (!warehouses) return [];

    let filtered = warehouses.filter((wh) => {
      const term = searchTerm.toLowerCase();
      return (
        wh.code.toLowerCase().includes(term) ||
        wh.name.toLowerCase().includes(term) ||
        (wh.description?.toLowerCase().includes(term) ?? false) ||
        (wh.address?.toLowerCase().includes(term) ?? false)
      );
    });

    filtered.sort((a, b) => {
      let aVal: string | number | boolean;
      let bVal: string | number | boolean;

      const aZoneCount = a.zones?.length || 0;
      const bZoneCount = b.zones?.length || 0;
      const aRackCount = a.zones?.reduce((sum, z) => sum + (z.racks?.length || 0), 0) || 0;
      const bRackCount = b.zones?.reduce((sum, z) => sum + (z.racks?.length || 0), 0) || 0;

      switch (sortField) {
        case "code":
          aVal = a.code;
          bVal = b.code;
          break;
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "zoneCount":
          aVal = aZoneCount;
          bVal = bZoneCount;
          break;
        case "rackCount":
          aVal = aRackCount;
          bVal = bRackCount;
          break;
        case "isActive":
          aVal = a.isActive ? 1 : 0;
          bVal = b.isActive ? 1 : 0;
          break;
        default:
          aVal = a.code;
          bVal = b.code;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal, "ko")
          : bVal.localeCompare(aVal, "ko");
      }

      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [warehouses, searchTerm, sortField, sortDirection]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      address: "",
      width: 100,
      height: 100,
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && selectedWarehouse) {
      updateMutation.mutate({ id: selectedWarehouse.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setIsEditMode(true);
    setSelectedWarehouse(warehouse);
    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      description: warehouse.description || "",
      address: warehouse.address || "",
      width: warehouse.width,
      height: warehouse.height,
      isActive: warehouse.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowDeleteDialog(true);
  };

  const handleBulkUpload = async (data: Record<string, unknown>[]) => {
    setIsUploading(true);
    try {
      const res = await fetch("/api/warehouse/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();

      if (result.success > 0) {
        toast.success(`${result.success}건 업로드 완료`);
        queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      }
      if (result.failed > 0) {
        toast.error(`${result.failed}건 실패`);
      }
      setShowBulkUpload(false);
    } catch {
      toast.error("업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAndSortedWarehouses.map((wh) => wh.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-[var(--text-muted)]" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 text-[var(--primary)]" />
    ) : (
      <ChevronDown className="w-4 h-4 text-[var(--primary)]" />
    );
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[var(--text-secondary)]">
            창고 레이아웃 설정 및 Zone/Rack 관리
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UsageGuide
            title="창고 관리 사용 가이드"
            description="창고, Zone, Rack 등록 및 관리 방법을 안내합니다."
            sections={WAREHOUSE_GUIDE_SECTIONS}
            tips={WAREHOUSE_GUIDE_TIPS}
            warnings={WAREHOUSE_GUIDE_WARNINGS}
          />
          <button
            onClick={() => setShowBulkUpload(true)}
            className="btn btn-secondary"
          >
            <Upload className="w-5 h-5" />
            대량 등록
          </button>
          <button
            onClick={() => {
              setIsEditMode(false);
              setSelectedWarehouse(null);
              resetForm();
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            창고 등록
          </button>
        </div>
      </div>

      {/* Search and Bulk Actions */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="창고코드, 창고명, 설명, 주소로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon w-full"
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--text-secondary)]">
                {selectedIds.length}개 선택됨
              </span>
              <button
                onClick={() => setShowBulkDeleteDialog(true)}
                className="btn btn-danger"
              >
                <Trash2 className="w-4 h-4" />
                선택 삭제
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Warehouse Table */}
      {!warehouses || warehouses.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)] mb-4">등록된 창고가 없습니다.</p>
          <button
            onClick={() => {
              setIsEditMode(false);
              setSelectedWarehouse(null);
              resetForm();
              setShowForm(true);
            }}
            className="text-[var(--primary)] hover:underline"
          >
            첫 번째 창고 등록하기
          </button>
        </div>
      ) : filteredAndSortedWarehouses.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Search className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        filteredAndSortedWarehouses.length > 0 &&
                        selectedIds.length === filteredAndSortedWarehouses.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--gray-300)]"
                    />
                  </th>
                  <th>
                    <button
                      onClick={() => handleSort("code")}
                      className="flex items-center gap-1 hover:text-[var(--primary)]"
                    >
                      창고코드
                      <SortIcon field="code" />
                    </button>
                  </th>
                  <th>
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 hover:text-[var(--primary)]"
                    >
                      창고명
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th>설명</th>
                  <th>주소</th>
                  <th className="text-center">
                    <button
                      onClick={() => handleSort("zoneCount")}
                      className="flex items-center gap-1 hover:text-[var(--primary)] mx-auto"
                    >
                      Zones
                      <SortIcon field="zoneCount" />
                    </button>
                  </th>
                  <th className="text-center">
                    <button
                      onClick={() => handleSort("rackCount")}
                      className="flex items-center gap-1 hover:text-[var(--primary)] mx-auto"
                    >
                      Racks
                      <SortIcon field="rackCount" />
                    </button>
                  </th>
                  <th className="text-center">
                    <button
                      onClick={() => handleSort("isActive")}
                      className="flex items-center gap-1 hover:text-[var(--primary)] mx-auto"
                    >
                      상태
                      <SortIcon field="isActive" />
                    </button>
                  </th>
                  <th className="text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedWarehouses.map((warehouse) => {
                  const zoneCount = warehouse.zones?.length || 0;
                  const rackCount =
                    warehouse.zones?.reduce(
                      (sum, zone) => sum + (zone.racks?.length || 0),
                      0
                    ) || 0;
                  const isSelected = selectedIds.includes(warehouse.id);

                  return (
                    <tr
                      key={warehouse.id}
                      className={isSelected ? "bg-[var(--primary)]/5" : ""}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectOne(warehouse.id, e.target.checked)
                          }
                          className="w-4 h-4 rounded border-[var(--gray-300)]"
                        />
                      </td>
                      <td>
                        <span className="font-mono text-sm font-medium text-[var(--primary)]">
                          {warehouse.code}
                        </span>
                      </td>
                      <td>
                        <span className="font-medium">{warehouse.name}</span>
                      </td>
                      <td>
                        <span className="text-[var(--text-secondary)] text-sm">
                          {warehouse.description || "-"}
                        </span>
                      </td>
                      <td>
                        <span className="text-[var(--text-secondary)] text-sm">
                          {warehouse.address || "-"}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-info">{zoneCount}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-secondary">{rackCount}</span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${
                            warehouse.isActive ? "badge-success" : "badge-secondary"
                          }`}
                        >
                          {warehouse.isActive ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(warehouse)}
                            className="table-action-btn"
                            title="수정"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/warehouse/${warehouse.id}`}
                            className="table-action-btn"
                            title="레이아웃 편집"
                          >
                            <Map className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(warehouse)}
                            className="table-action-btn delete"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-3 border-t border-[var(--glass-border)] bg-[var(--gray-50)]">
            <p className="text-sm text-[var(--text-secondary)]">
              총 {filteredAndSortedWarehouses.length}개 창고
              {searchTerm && ` (검색 결과)`}
            </p>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
              {isEditMode ? "창고 수정" : "새 창고 등록"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  창고 코드 *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  className="input w-full"
                  placeholder="WH01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  창고명 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="본사 창고"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  설명
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input w-full"
                  placeholder="주요 파츠 보관 창고"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  주소
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input w-full"
                  placeholder="서울시 강남구..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    맵 너비
                  </label>
                  <input
                    type="number"
                    value={formData.width}
                    onChange={(e) =>
                      setFormData({ ...formData, width: parseInt(e.target.value) || 100 })
                    }
                    className="input w-full"
                    min={50}
                    max={2000}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    맵 높이
                  </label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) =>
                      setFormData({ ...formData, height: parseInt(e.target.value) || 100 })
                    }
                    className="input w-full"
                    min={50}
                    max={2000}
                  />
                </div>
              </div>

              {isEditMode && (
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--gray-200)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    {formData.isActive ? "활성" : "비활성"}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setIsEditMode(false);
                    setSelectedWarehouse(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditMode
                    ? updateMutation.isPending
                      ? "수정 중..."
                      : "수정"
                    : createMutation.isPending
                    ? "등록 중..."
                    : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedWarehouse(null);
        }}
        onConfirm={() => selectedWarehouse && deleteMutation.mutate(selectedWarehouse.id)}
        title="창고 삭제"
        message={`"${selectedWarehouse?.name}" 창고를 삭제하시겠습니까? 관련된 모든 Zone과 Rack도 함께 삭제됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        title="창고 대량 삭제"
        message={`선택한 ${selectedIds.length}개의 창고를 삭제하시겠습니까? 관련된 모든 Zone, Rack, Shelf도 함께 삭제됩니다.`}
        confirmText="삭제"
        variant="danger"
        isLoading={bulkDeleteMutation.isPending}
      />

      {/* Bulk Upload Modal */}
      <ExcelUpload
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onUpload={handleBulkUpload}
        title="창고 대량 등록"
        templateName="창고"
        fields={WAREHOUSE_UPLOAD_FIELDS}
        isLoading={isUploading}
      />
    </div>
  );
}
