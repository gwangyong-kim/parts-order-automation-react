"use client";

import { useState, useEffect } from "react";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { Plus, Trash2 } from "lucide-react";

interface Part {
  id: number;
  partCode: string;
  partName: string | null;
  unit: string;
}

interface BomItemInput {
  partId: number;
  quantityPerUnit: number;
  lossRate: number;
  notes: string;
}

interface Product {
  id?: number;
  productCode: string;
  productName: string | null;
  description: string | null;
  bomItems?: {
    id?: number;
    partId: number;
    quantityPerUnit: number;
    lossRate: number;
    notes: string | null;
    part?: Part;
  }[];
}

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    productCode: string;
    productName: string | null;
    description: string | null;
    bomItems: BomItemInput[];
  }) => void;
  initialData?: Product | null;
  isLoading?: boolean;
}

export default function ProductForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: ProductFormProps) {
  const [formData, setFormData] = useState({
    productCode: "",
    productName: "",
    description: "",
  });
  const [bomItems, setBomItems] = useState<BomItemInput[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingParts, setIsLoadingParts] = useState(false);

  // 파츠 목록 조회
  useEffect(() => {
    if (isOpen) {
      setIsLoadingParts(true);
      fetch("/api/parts")
        .then((res) => res.json())
        .then((data) => {
          setParts(
            data.map((p: { id: number; partCode: string; partName: string | null; unit: string }) => ({
              id: p.id,
              partCode: p.partCode,
              partName: p.partName,
              unit: p.unit,
            }))
          );
        })
        .catch(console.error)
        .finally(() => setIsLoadingParts(false));
    }
  }, [isOpen]);

  // 초기 데이터 설정
  useEffect(() => {
    if (initialData) {
      setFormData({
        productCode: initialData.productCode,
        productName: initialData.productName || "",
        description: initialData.description || "",
      });
      setBomItems(
        initialData.bomItems?.map((item) => ({
          partId: item.partId,
          quantityPerUnit: item.quantityPerUnit,
          lossRate: item.lossRate,
          notes: item.notes || "",
        })) || []
      );
    } else {
      setFormData({
        productCode: "",
        productName: "",
        description: "",
      });
      setBomItems([]);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.productCode?.trim()) {
      newErrors.productCode = "제품코드를 입력해주세요.";
    }

    // BOM 항목 검증
    bomItems.forEach((item, index) => {
      if (!item.partId) {
        newErrors[`bom_${index}_partId`] = "파츠를 선택해주세요.";
      }
      if (item.quantityPerUnit <= 0) {
        newErrors[`bom_${index}_qty`] = "수량은 0보다 커야 합니다.";
      }
    });

    // 중복 파츠 체크
    const partIds = bomItems.map((item) => item.partId).filter(Boolean);
    const uniquePartIds = new Set(partIds);
    if (partIds.length !== uniquePartIds.size) {
      newErrors.bom_duplicate = "중복된 파츠가 있습니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        productCode: formData.productCode,
        productName: formData.productName || null,
        description: formData.description || null,
        bomItems: bomItems.filter((item) => item.partId),
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addBomItem = () => {
    setBomItems((prev) => [
      ...prev,
      { partId: 0, quantityPerUnit: 1, lossRate: 0, notes: "" },
    ]);
  };

  const removeBomItem = (index: number) => {
    setBomItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBomItem = (
    index: number,
    field: keyof BomItemInput,
    value: number | string
  ) => {
    setBomItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const getPartDisplay = (part: Part) => {
    return part.partName
      ? `${part.partCode} - ${part.partName}`
      : part.partCode;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "제품 수정" : "제품 등록"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="제품코드"
              name="productCode"
              value={formData.productCode}
              onChange={handleChange}
              error={errors.productCode}
              required
              placeholder="예: PRD-001"
            />
            <Input
              label="제품명"
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              placeholder="예: 스마트 센서 모듈"
            />
          </div>
          <Textarea
            label="설명"
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            placeholder="제품에 대한 설명을 입력하세요."
            rows={2}
          />

          {/* BOM 섹션 */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                BOM (자재명세서)
              </h3>
              <button
                type="button"
                onClick={addBomItem}
                className="btn-secondary text-sm py-1 px-2 flex items-center gap-1"
                disabled={isLoadingParts}
              >
                <Plus className="w-4 h-4" />
                파츠 추가
              </button>
            </div>

            {errors.bom_duplicate && (
              <p className="text-sm text-red-500 mb-2">{errors.bom_duplicate}</p>
            )}

            {bomItems.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-4 bg-[var(--bg-secondary)] rounded-lg">
                등록된 파츠가 없습니다. 파츠 추가 버튼을 클릭하여 BOM을 구성하세요.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {/* 헤더 */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-[var(--text-secondary)] px-2">
                  <div className="col-span-5">파츠</div>
                  <div className="col-span-2">수량</div>
                  <div className="col-span-2">손실률(%)</div>
                  <div className="col-span-2">비고</div>
                  <div className="col-span-1"></div>
                </div>

                {bomItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-center bg-[var(--bg-secondary)] p-2 rounded-lg"
                  >
                    <div className="col-span-5">
                      <select
                        value={item.partId || ""}
                        onChange={(e) =>
                          updateBomItem(index, "partId", parseInt(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      >
                        <option value="">파츠 선택</option>
                        {parts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {getPartDisplay(part)}
                          </option>
                        ))}
                      </select>
                      {errors[`bom_${index}_partId`] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors[`bom_${index}_partId`]}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.quantityPerUnit}
                        onChange={(e) =>
                          updateBomItem(
                            index,
                            "quantityPerUnit",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      />
                      {errors[`bom_${index}_qty`] && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors[`bom_${index}_qty`]}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.lossRate * 100}
                        onChange={(e) =>
                          updateBomItem(
                            index,
                            "lossRate",
                            (parseFloat(e.target.value) || 0) / 100
                          )
                        }
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) =>
                          updateBomItem(index, "notes", e.target.value)
                        }
                        placeholder="비고"
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeBomItem(index)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                저장 중...
              </span>
            ) : initialData ? (
              "수정"
            ) : (
              "등록"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
