"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { partSchema, type PartFormData } from "@/schemas/part.schema";
import { UNIT_OPTIONS } from "@/constants/options";
import type { Part } from "@/types/entities";

interface PartFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PartFormData) => void;
  initialData?: Part | null;
  isLoading?: boolean;
}

async function fetchCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) return [];
  return res.json();
}

async function fetchSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) return [];
  return res.json();
}

const defaultValues: PartFormData = {
  partNumber: "",
  partName: "",
  description: null,
  unit: "EA",
  unitPrice: 0,
  safetyStock: 0,
  minOrderQty: 1,
  leadTime: 7,
  categoryId: null,
  supplierId: null,
  storageLocation: null,
};

export default function PartForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: PartFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PartFormData>({
    resolver: zodResolver(partSchema),
    defaultValues,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });

  // 초기 데이터 또는 기본값으로 폼 리셋
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          partNumber: initialData.partNumber,
          partName: initialData.partName,
          description: initialData.description || null,
          unit: initialData.unit,
          unitPrice: initialData.unitPrice,
          safetyStock: initialData.safetyStock,
          minOrderQty: initialData.minOrderQty,
          leadTime: initialData.leadTime,
          categoryId: initialData.categoryId,
          supplierId: initialData.supplierId,
          storageLocation: initialData.storageLocation || null,
        });
      } else {
        reset(defaultValues);
      }
    }
  }, [initialData, isOpen, reset]);

  const onFormSubmit = (data: PartFormData) => {
    onSubmit(data);
  };

  // Select 컴포넌트를 위한 값 관찰
  const categoryId = watch("categoryId");
  const supplierId = watch("supplierId");
  const unit = watch("unit");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "파츠 수정" : "파츠 등록"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="파츠번호"
            {...register("partNumber")}
            error={errors.partNumber?.message}
            required
            placeholder="예: PART-001"
          />
          <Input
            label="파츠명"
            {...register("partName")}
            error={errors.partName?.message}
            required
            placeholder="예: 메인 보드"
          />
          <div className="md:col-span-2">
            <Textarea
              label="규격"
              {...register("description")}
              error={errors.description?.message}
              placeholder="파츠 규격 및 상세 정보"
              rows={2}
            />
          </div>
          <Select
            label="단위"
            value={unit}
            onChange={(e) => setValue("unit", e.target.value)}
            options={UNIT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            error={errors.unit?.message}
            required
          />
          <Input
            label="단가 (원)"
            type="number"
            {...register("unitPrice", { valueAsNumber: true })}
            error={errors.unitPrice?.message}
            min={0}
            required
          />
          <Input
            label="안전재고"
            type="number"
            {...register("safetyStock", { valueAsNumber: true })}
            error={errors.safetyStock?.message}
            min={0}
            helperText="재고가 이 수량 이하면 알림"
          />
          <Input
            label="최소발주량"
            type="number"
            {...register("minOrderQty", { valueAsNumber: true })}
            error={errors.minOrderQty?.message}
            min={1}
          />
          <Input
            label="리드타임 (일)"
            type="number"
            {...register("leadTime", { valueAsNumber: true })}
            error={errors.leadTime?.message}
            min={0}
            helperText="발주부터 입고까지 소요일"
          />
          <Select
            label="카테고리"
            value={categoryId ?? ""}
            onChange={(e) =>
              setValue("categoryId", e.target.value ? Number(e.target.value) : null)
            }
            options={categories.map((c: { id: number; name: string }) => ({
              value: c.id,
              label: c.name,
            }))}
            placeholder="카테고리 선택"
          />
          <Select
            label="공급업체"
            value={supplierId ?? ""}
            onChange={(e) =>
              setValue("supplierId", e.target.value ? Number(e.target.value) : null)
            }
            options={suppliers.map((s: { id: number; name: string }) => ({
              value: s.id,
              label: s.name,
            }))}
            placeholder="공급업체 선택"
          />
          <div className="md:col-span-2">
            <Input
              label="저장위치"
              {...register("storageLocation")}
              error={errors.storageLocation?.message}
              placeholder="예: A-01-02, 창고1-선반3"
              helperText="사내 규정 위치코드 (예: 구역-열-단)"
            />
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
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
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
