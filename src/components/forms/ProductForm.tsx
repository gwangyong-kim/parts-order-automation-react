"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { Plus, Trash2 } from "lucide-react";
import { productSchema, type ProductFormData } from "@/schemas/product.schema";

interface Part {
  id: number;
  partCode: string;
  partName: string | null;
  unit: string;
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
    bomItems: { partId: number; quantityPerUnit: number; lossRate: number; notes: string }[];
  }) => void;
  initialData?: Product | null;
  isLoading?: boolean;
}

async function fetchParts(): Promise<Part[]> {
  const res = await fetch("/api/parts");
  if (!res.ok) throw new Error("Failed to fetch parts");
  return res.json();
}

export default function ProductForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: ProductFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productCode: "",
      productName: "",
      description: "",
      unit: "EA",
      bomItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bomItems",
  });

  const { data: parts = [], isLoading: isLoadingParts } = useQuery({
    queryKey: ["parts-for-bom"],
    queryFn: fetchParts,
    enabled: isOpen,
  });

  // 초기 데이터 설정
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          productCode: initialData.productCode,
          productName: initialData.productName || "",
          description: initialData.description || "",
          unit: "EA",
          bomItems: initialData.bomItems?.map((item) => ({
            partId: item.partId,
            quantityPerUnit: item.quantityPerUnit,
            lossRate: item.lossRate,
            notes: item.notes || "",
          })) || [],
        });
      } else {
        reset({
          productCode: "",
          productName: "",
          description: "",
          unit: "EA",
          bomItems: [],
        });
      }
    }
  }, [initialData, isOpen, reset]);

  const validateDuplicateParts = (data: ProductFormData): boolean => {
    if (!data.bomItems || data.bomItems.length === 0) return true;
    const partIds = data.bomItems.map((item) => item.partId).filter(Boolean);
    const uniquePartIds = new Set(partIds);
    if (partIds.length !== uniquePartIds.size) {
      setError("bomItems", { type: "manual", message: "중복된 파츠가 있습니다." });
      return false;
    }
    clearErrors("bomItems");
    return true;
  };

  const onFormSubmit = (data: ProductFormData) => {
    if (!validateDuplicateParts(data)) return;

    onSubmit({
      productCode: data.productCode,
      productName: data.productName || null,
      description: data.description || null,
      bomItems: (data.bomItems || [])
        .filter((item) => item.partId)
        .map((item) => ({
          partId: item.partId,
          quantityPerUnit: item.quantityPerUnit,
          lossRate: item.lossRate,
          notes: item.notes || "",
        })),
    });
  };

  const addBomItem = () => {
    append({ partId: 0, quantityPerUnit: 1, lossRate: 0, notes: "" });
  };

  const getPartDisplay = (part: Part) => {
    return part.partName ? `${part.partCode} - ${part.partName}` : part.partCode;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "제품 수정" : "제품 등록"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="제품코드"
              {...register("productCode")}
              error={errors.productCode?.message}
              required
              placeholder="예: PRD-001"
            />
            <Input
              label="제품명"
              {...register("productName")}
              error={errors.productName?.message}
              placeholder="예: 스마트 센서 모듈"
            />
          </div>
          <Textarea
            label="설명"
            {...register("description")}
            error={errors.description?.message}
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

            {errors.bomItems?.message && (
              <p className="text-sm text-red-500 mb-2">{errors.bomItems.message}</p>
            )}

            {fields.length === 0 ? (
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

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-12 gap-2 items-center bg-[var(--bg-secondary)] p-2 rounded-lg"
                  >
                    <div className="col-span-5">
                      <Controller
                        name={`bomItems.${index}.partId`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <select
                            value={controllerField.value || ""}
                            onChange={(e) => controllerField.onChange(parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                          >
                            <option value="">파츠 선택</option>
                            {parts.map((part) => (
                              <option key={part.id} value={part.id}>
                                {getPartDisplay(part)}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                      {errors.bomItems?.[index]?.partId && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.bomItems[index]?.partId?.message}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Controller
                        name={`bomItems.${index}.quantityPerUnit`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <input
                            type="number"
                            value={controllerField.value}
                            onChange={(e) => controllerField.onChange(parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                          />
                        )}
                      />
                      {errors.bomItems?.[index]?.quantityPerUnit && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.bomItems[index]?.quantityPerUnit?.message}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Controller
                        name={`bomItems.${index}.lossRate`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <input
                            type="number"
                            value={(controllerField.value ?? 0) * 100}
                            onChange={(e) => controllerField.onChange((parseFloat(e.target.value) || 0) / 100)}
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                          />
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        {...register(`bomItems.${index}.notes`)}
                        placeholder="비고"
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => remove(index)}
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
