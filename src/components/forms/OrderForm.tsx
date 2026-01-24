"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

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
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("Failed to fetch suppliers");
  return res.json();
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
  const [formData, setFormData] = useState<Partial<Order>>({
    orderNumber: "",
    supplierId: 0,
    orderDate: new Date().toISOString().split("T")[0],
    expectedDate: "",
    status: "DRAFT",
    totalAmount: 0,
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
    enabled: isOpen,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        orderNumber: initialData.orderNumber,
        supplierId: initialData.supplierId,
        orderDate: new Date(initialData.orderDate).toISOString().split("T")[0],
        expectedDate: initialData.expectedDate
          ? new Date(initialData.expectedDate).toISOString().split("T")[0]
          : "",
        status: initialData.status,
        totalAmount: initialData.totalAmount,
        notes: initialData.notes || "",
      });
    } else {
      setFormData({
        orderNumber: "",
        supplierId: 0,
        orderDate: new Date().toISOString().split("T")[0],
        expectedDate: "",
        status: "DRAFT",
        totalAmount: 0,
        notes: "",
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.orderNumber?.trim()) {
      newErrors.orderNumber = "발주번호를 입력해주세요.";
    }
    if (!formData.supplierId || formData.supplierId === 0) {
      newErrors.supplierId = "공급업체를 선택해주세요.";
    }
    if (!formData.orderDate) {
      newErrors.orderDate = "발주일을 선택해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "totalAmount"
          ? parseFloat(value) || 0
          : name === "supplierId"
          ? parseInt(value) || 0
          : value,
    }));
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
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="발주번호"
            name="orderNumber"
            value={formData.orderNumber}
            onChange={handleChange}
            error={errors.orderNumber}
            required
            placeholder="예: PO-2024-001"
          />
          <Select
            label="공급업체"
            name="supplierId"
            value={formData.supplierId?.toString()}
            onChange={handleChange}
            options={supplierOptions}
            placeholder="공급업체 선택"
            error={errors.supplierId}
            required
          />
          <Input
            label="발주일"
            name="orderDate"
            type="date"
            value={formData.orderDate}
            onChange={handleChange}
            error={errors.orderDate}
            required
          />
          <Input
            label="입고예정일"
            name="expectedDate"
            type="date"
            value={formData.expectedDate || ""}
            onChange={handleChange}
          />
          <Select
            label="상태"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={statusOptions}
          />
          <Input
            label="총 금액"
            name="totalAmount"
            type="number"
            value={formData.totalAmount?.toString()}
            onChange={handleChange}
            placeholder="0"
          />
          <div className="md:col-span-2">
            <Textarea
              label="비고"
              name="notes"
              value={formData.notes || ""}
              onChange={handleChange}
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
