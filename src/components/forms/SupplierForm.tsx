"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { supplierSchema, type SupplierFormData } from "@/schemas/supplier.schema";
import type { Supplier } from "@/types/entities";

interface SupplierFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierFormData) => void;
  initialData?: Supplier | null;
  isLoading?: boolean;
}

const defaultValues: SupplierFormData = {
  code: "",
  name: "",
  contactPerson: null,
  phone: null,
  email: null,
  address: null,
  leadTimeDays: 7,
  paymentTerms: null,
  notes: null,
};

export default function SupplierForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: SupplierFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues,
  });

  // 초기 데이터 또는 기본값으로 폼 리셋
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          code: initialData.code,
          name: initialData.name,
          contactPerson: initialData.contactPerson,
          phone: initialData.phone,
          email: initialData.email,
          address: initialData.address,
          leadTimeDays: initialData.leadTimeDays,
          paymentTerms: initialData.paymentTerms,
          notes: initialData.notes,
        });
      } else {
        reset(defaultValues);
      }
    }
  }, [initialData, isOpen, reset]);

  const onFormSubmit = (data: SupplierFormData) => {
    onSubmit(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "공급업체 수정" : "공급업체 등록"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="업체코드"
            {...register("code")}
            error={errors.code?.message}
            required
            placeholder="예: SUP-001"
          />
          <Input
            label="업체명"
            {...register("name")}
            error={errors.name?.message}
            required
            placeholder="예: ABC 전자"
          />
          <Input
            label="담당자"
            {...register("contactPerson")}
            error={errors.contactPerson?.message}
            placeholder="담당자 이름"
          />
          <Input
            label="연락처"
            {...register("phone")}
            error={errors.phone?.message}
            placeholder="예: 02-1234-5678"
          />
          <Input
            label="이메일"
            type="email"
            {...register("email")}
            error={errors.email?.message}
            placeholder="예: contact@supplier.com"
          />
          <Input
            label="리드타임 (일)"
            type="number"
            {...register("leadTimeDays", { valueAsNumber: true })}
            error={errors.leadTimeDays?.message}
            min={0}
            helperText="발주부터 입고까지 기본 소요일"
          />
          <div className="md:col-span-2">
            <Input
              label="결제조건"
              {...register("paymentTerms")}
              error={errors.paymentTerms?.message}
              placeholder="예: 30일 후 결제"
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="주소"
              {...register("address")}
              error={errors.address?.message}
              placeholder="사업장 주소"
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="비고"
              {...register("notes")}
              error={errors.notes?.message}
              placeholder="추가 메모"
              rows={2}
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
