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

// Zod 스키마 정의
const orderFormSchema = z.object({
  orderNumber: z.string().min(1, "발주번호를 입력해주세요."),
  supplierId: z.number().min(1, "공급업체를 선택해주세요."),
  orderDate: z.string().min(1, "발주일을 선택해주세요."),
  expectedDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "RECEIVED", "CANCELLED"]),
  totalAmount: z.number().min(0),
  notes: z.string().nullable().optional(),
});

type OrderFormData = z.infer<typeof orderFormSchema>;

interface Order {
  id?: number;
  orderNumber: string;
  supplierId: number;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
}

interface Supplier {
  id: number;
  supplierCode: string;
  name: string;
}

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Order>) => void;
  initialData?: Order | null;
  isLoading?: boolean;
}

async function fetchSuppliers(): Promise<Supplier[]> {
  const res = await fetch("/api/suppliers?pageSize=1000");
  if (!res.ok) throw new Error("Failed to fetch suppliers");
  const result = await res.json();
  return result.data || [];
}

const statusOptions = [
  { value: "DRAFT", label: "작성중" },
  { value: "SUBMITTED", label: "제출됨" },
  { value: "APPROVED", label: "승인됨" },
  { value: "ORDERED", label: "발주됨" },
  { value: "RECEIVED", label: "입고완료" },
  { value: "CANCELLED", label: "취소됨" },
];

export default function OrderForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: OrderFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderNumber: "",
      supplierId: 0,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDate: "",
      status: "DRAFT",
      totalAmount: 0,
      notes: "",
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          orderNumber: initialData.orderNumber,
          supplierId: initialData.supplierId,
          orderDate: new Date(initialData.orderDate).toISOString().split("T")[0],
          expectedDate: initialData.expectedDate
            ? new Date(initialData.expectedDate).toISOString().split("T")[0]
            : "",
          status: initialData.status as OrderFormData["status"],
          totalAmount: initialData.totalAmount,
          notes: initialData.notes || "",
        });
      } else {
        reset({
          orderNumber: "",
          supplierId: 0,
          orderDate: new Date().toISOString().split("T")[0],
          expectedDate: "",
          status: "DRAFT",
          totalAmount: 0,
          notes: "",
        });
      }
    }
  }, [initialData, isOpen, reset]);

  const onFormSubmit = (data: OrderFormData) => {
    onSubmit(data);
  };

  const supplierOptions =
    suppliers?.map((s) => ({
      value: s.id,
      label: `${s.supplierCode} - ${s.name}`,
    })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "발주 수정" : "발주 등록"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="발주번호"
            {...register("orderNumber")}
            error={errors.orderNumber?.message}
            required
            placeholder="예: PO-2024-001"
          />
          <Select
            label="공급업체"
            value={watch("supplierId")?.toString()}
            onChange={(e) => setValue("supplierId", parseInt(e.target.value) || 0)}
            options={supplierOptions}
            placeholder="공급업체 선택"
            error={errors.supplierId?.message}
            required
          />
          <Input
            label="발주일"
            type="date"
            {...register("orderDate")}
            error={errors.orderDate?.message}
            required
          />
          <Input
            label="입고예정일"
            type="date"
            {...register("expectedDate")}
          />
          <Select
            label="상태"
            {...register("status")}
            options={statusOptions}
          />
          <Input
            label="총 금액"
            type="number"
            {...register("totalAmount", { valueAsNumber: true })}
            placeholder="0"
          />
          <div className="md:col-span-2">
            <Textarea
              label="비고"
              {...register("notes")}
              placeholder="추가 메모 사항"
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
