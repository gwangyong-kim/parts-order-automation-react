"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { Search, Package, Check } from "lucide-react";

interface Part {
  id: number;
  partCode: string;
  partNumber?: string;
  partName: string;
  inventory?: {
    currentQty: number;
  } | null;
  storageLocation: string | null;
}

interface AuditRecord {
  id?: number;
  auditCode?: string;
  auditDate: string;
  auditType: string;
  auditScope: "ALL" | "PARTIAL";
  status: string;
  notes: string | null;
  partIds?: number[];
}

interface AuditFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AuditRecord>) => void;
  initialData?: AuditRecord | null;
  isLoading?: boolean;
}

const statusOptions = [
  { value: "PLANNED", label: "예정" },
  { value: "IN_PROGRESS", label: "진행중" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

const auditTypeOptions = [
  { value: "MONTHLY", label: "월간 실사", description: "매월 정기적으로 실시하는 실사" },
  { value: "QUARTERLY", label: "분기 실사", description: "분기별로 실시하는 정기 실사" },
  { value: "YEARLY", label: "연간 실사", description: "연 1회 실시하는 전수 조사" },
  { value: "SPOT", label: "비정기 실사", description: "필요시 수시로 실시하는 실사" },
];

async function fetchParts(): Promise<Part[]> {
  const res = await fetch("/api/parts?limit=1000");
  if (!res.ok) throw new Error("Failed to fetch parts");
  const data = await res.json();
  return data.parts || data;
}

export default function AuditForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: AuditFormProps) {
  const [formData, setFormData] = useState<Partial<AuditRecord>>({
    auditDate: new Date().toISOString().split("T")[0],
    auditType: "MONTHLY",
    auditScope: "ALL",
    status: "PLANNED",
    notes: "",
    partIds: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPartIds, setSelectedPartIds] = useState<Set<number>>(new Set());

  // Fetch parts for selection
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["parts-for-audit"],
    queryFn: fetchParts,
    enabled: isOpen && formData.auditScope === "PARTIAL",
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          auditDate: initialData.auditDate
            ? new Date(initialData.auditDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          auditType: initialData.auditType || "MONTHLY",
          auditScope: initialData.auditScope || "ALL",
          status: initialData.status || "PLANNED",
          notes: initialData.notes || "",
          partIds: initialData.partIds || [],
        });
        setSelectedPartIds(new Set(initialData.partIds || []));
      } else {
        setFormData({
          auditDate: new Date().toISOString().split("T")[0],
          auditType: "MONTHLY",
          auditScope: "ALL",
          status: "PLANNED",
          notes: "",
          partIds: [],
        });
        setSelectedPartIds(new Set());
      }
      setErrors({});
      setSearchTerm("");
    }
  }, [isOpen, initialData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.auditDate) {
      newErrors.auditDate = "실사일을 선택해주세요.";
    }

    if (!formData.auditType) {
      newErrors.auditType = "실사 유형을 선택해주세요.";
    }

    if (formData.auditScope === "PARTIAL" && selectedPartIds.size === 0) {
      newErrors.partIds = "실사할 품목을 선택해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        ...formData,
        partIds: formData.auditScope === "PARTIAL" ? Array.from(selectedPartIds) : undefined,
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const togglePartSelection = (partId: number) => {
    setSelectedPartIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(partId)) {
        newSet.delete(partId);
      } else {
        newSet.add(partId);
      }
      return newSet;
    });
  };

  const selectAllParts = () => {
    const filtered = parts.filter(
      (part) =>
        (part.partNumber || part.partCode).toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.partName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSelectedPartIds(new Set(filtered.map((p) => p.id)));
  };

  const clearSelection = () => {
    setSelectedPartIds(new Set());
  };

  const filteredParts = parts.filter(
    (part) =>
      (part.partNumber || part.partCode).toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.partName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "실사 수정" : "실사 생성"}
      size={formData.auditScope === "PARTIAL" && !initialData ? "xl" : "md"}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="실사일"
            name="auditDate"
            type="date"
            value={formData.auditDate}
            onChange={handleChange}
            error={errors.auditDate}
            required
          />

          {/* 실사 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              실사 유형 <span className="text-[var(--danger)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {auditTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.auditType === option.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--glass-border)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="auditType"
                    value={option.value}
                    checked={formData.auditType === option.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="font-medium text-[var(--text-primary)]">
                    {option.label}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] mt-1">
                    {option.description}
                  </span>
                  {formData.auditType === option.value && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--primary)] rounded-full flex items-center justify-center">
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </label>
              ))}
            </div>
            {errors.auditType && (
              <p className="mt-1 text-sm text-[var(--danger)]">{errors.auditType}</p>
            )}
          </div>

          {/* 실사 범위 선택 - 생성 시에만 표시 */}
          {!initialData && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                실사 범위 <span className="text-[var(--danger)]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.auditScope === "ALL"
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--glass-border)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="auditScope"
                    value="ALL"
                    checked={formData.auditScope === "ALL"}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="font-medium text-[var(--text-primary)]">전체 품목</span>
                  <span className="text-xs text-[var(--text-muted)] mt-1">
                    모든 재고 품목을 실사합니다
                  </span>
                  {formData.auditScope === "ALL" && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--primary)] rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </label>
                <label
                  className={`relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.auditScope === "PARTIAL"
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--glass-border)] hover:border-[var(--primary)]/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="auditScope"
                    value="PARTIAL"
                    checked={formData.auditScope === "PARTIAL"}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="font-medium text-[var(--text-primary)]">일부 품목</span>
                  <span className="text-xs text-[var(--text-muted)] mt-1">
                    선택한 품목만 실사합니다
                  </span>
                  {formData.auditScope === "PARTIAL" && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--primary)] rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* 품목 선택 - 일부 품목 선택 시에만 표시 */}
          {!initialData && formData.auditScope === "PARTIAL" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-[var(--text-primary)]">
                  실사 대상 품목 <span className="text-[var(--danger)]">*</span>
                  <span className="ml-2 text-[var(--text-muted)] font-normal">
                    ({selectedPartIds.size}개 선택됨)
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllParts}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-[var(--text-muted)] hover:underline"
                  >
                    선택 해제
                  </button>
                </div>
              </div>

              {/* 검색 */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="품번 또는 품명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input input-with-icon w-full"
                />
              </div>

              {/* 품목 목록 */}
              <div className="border border-[var(--glass-border)] rounded-lg max-h-60 overflow-y-auto">
                {partsLoading ? (
                  <div className="p-4 text-center text-[var(--text-muted)]">
                    품목을 불러오는 중...
                  </div>
                ) : filteredParts.length === 0 ? (
                  <div className="p-4 text-center text-[var(--text-muted)]">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {searchTerm ? "검색 결과가 없습니다" : "등록된 품목이 없습니다"}
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--glass-border)]">
                    {filteredParts.map((part) => (
                      <label
                        key={part.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--glass-bg)] transition-colors ${
                          selectedPartIds.has(part.id) ? "bg-[var(--primary)]/5" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPartIds.has(part.id)}
                          onChange={() => togglePartSelection(part.id)}
                          className="w-4 h-4 rounded border-[var(--glass-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-[var(--text-secondary)]">
                              {part.partNumber || part.partCode}
                            </span>
                            <span className="font-medium text-[var(--text-primary)] truncate">
                              {part.partName}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            재고: {part.inventory?.currentQty || 0}개
                            {part.storageLocation && ` · 위치: ${part.storageLocation}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {errors.partIds && (
                <p className="mt-1 text-sm text-[var(--danger)]">{errors.partIds}</p>
              )}
            </div>
          )}

          {initialData && (
            <Select
              label="상태"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={statusOptions}
              required
            />
          )}
          <Textarea
            label="비고"
            name="notes"
            value={formData.notes || ""}
            onChange={handleChange}
            placeholder="실사 관련 메모를 입력하세요."
            rows={3}
          />
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                처리 중...
              </span>
            ) : initialData ? (
              "수정"
            ) : (
              "생성"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
