"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";

// Zod 스키마 정의 - partId는 생성 시에만 필수
const transactionFormSchema = z.object({
  partId: z.number(),
  transactionType: z.enum(["INBOUND", "OUTBOUND", "ADJUSTMENT"]),
  quantity: z.number().min(1, "수량은 0보다 커야 합니다."),
  notes: z.string().nullable().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

// 생성 모드용 스키마 (partId 필수)
const createTransactionSchema = transactionFormSchema.refine(
  (data) => data.partId > 0,
  { message: "파츠를 선택해주세요.", path: ["partId"] }
);

interface TransactionData {
  id: number;
  transactionCode: string;
  partId?: number;
  transactionType: string;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  notes: string | null;
  part?: {
    id: number;
    partCode?: string;
    partName: string;
  };
}

interface Part {
  id: number;
  partCode?: string;
  partNumber?: string;
  partName: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<TransactionFormData>) => void;
  isLoading?: boolean;
  initialData?: TransactionData | null;
}

async function fetchParts(): Promise<Part[]> {
  const res = await fetch("/api/parts");
  if (!res.ok) throw new Error("Failed to fetch parts");
  return res.json();
}

const typeOptions = [
  { value: "INBOUND", label: "입고" },
  { value: "OUTBOUND", label: "출고" },
  { value: "ADJUSTMENT", label: "조정" },
];

export default function TransactionForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialData = null,
}: TransactionFormProps) {
  const isEditMode = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(isEditMode ? transactionFormSchema : createTransactionSchema),
    defaultValues: {
      partId: 0,
      transactionType: "INBOUND",
      quantity: 0,
      notes: "",
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["parts"],
    queryFn: fetchParts,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          partId: initialData.partId || initialData.part?.id || 0,
          transactionType: initialData.transactionType as TransactionFormData["transactionType"],
          quantity: initialData.quantity,
          notes: initialData.notes || "",
        });
      } else {
        reset({
          partId: 0,
          transactionType: "INBOUND",
          quantity: 0,
          notes: "",
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onFormSubmit = (data: TransactionFormData) => {
    onSubmit(data);
  };

  const transactionType = watch("transactionType");

  const partOptions =
    parts?.map((p) => ({
      value: p.id,
      label: `${p.partCode || p.partNumber} - ${p.partName}`,
    })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "입출고 수정" : "수동 입출고"}
      size="md"
    >
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4">
          {isEditMode ? (
            <div className="p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <p className="text-sm text-[var(--text-muted)]">파츠</p>
              <p className="font-medium text-[var(--text-primary)]">
                {initialData?.part?.partCode} - {initialData?.part?.partName}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                트랜잭션: {initialData?.transactionCode}
              </p>
            </div>
          ) : (
            <Select
              label="파츠"
              value={watch("partId")?.toString()}
              onChange={(e) => setValue("partId", parseInt(e.target.value) || 0)}
              options={partOptions}
              placeholder="파츠 선택"
              error={errors.partId?.message}
              required
            />
          )}
          <Select
            label="유형"
            {...register("transactionType")}
            options={typeOptions}
            required
          />
          <Input
            label={transactionType === "ADJUSTMENT" ? "조정 후 재고" : "수량"}
            type="number"
            {...register("quantity", { valueAsNumber: true })}
            error={errors.quantity?.message}
            required
            min={transactionType === "ADJUSTMENT" ? 0 : 1}
            placeholder={transactionType === "ADJUSTMENT" ? "조정 후 재고 입력" : "수량 입력"}
          />
          {isEditMode && initialData && (
            <div className="p-3 rounded-lg bg-[var(--info)]/10 text-sm text-[var(--text-secondary)]">
              <p>현재 기록: {initialData.beforeQty.toLocaleString()} → {initialData.afterQty.toLocaleString()}</p>
              <p className="text-xs mt-1 text-[var(--text-muted)]">
                수정 시 재고가 자동으로 재계산됩니다.
              </p>
            </div>
          )}
          <Textarea
            label="비고"
            {...register("notes")}
            placeholder="입출고 사유를 입력하세요."
            rows={2}
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
            ) : isEditMode ? (
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
