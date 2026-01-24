"use client";

import { useState, useEffect } from "react";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

interface SalesOrder {
  id?: number;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  totalAmount: number;
  notes: string | null;
}

interface SalesOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<SalesOrder>) => void;
  initialData?: SalesOrder | null;
  isLoading?: boolean;
}

const statusOptions = [
  { value: "PENDING", label: "대기" },
  { value: "CONFIRMED", label: "확정" },
  { value: "IN_PRODUCTION", label: "생산중" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

export default function SalesOrderForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: SalesOrderFormProps) {
  const [formData, setFormData] = useState<Partial<SalesOrder>>({
    orderNumber: "",
    customerName: "",
    orderDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    status: "PENDING",
    totalAmount: 0,
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        orderNumber: initialData.orderNumber,
        customerName: initialData.customerName,
        orderDate: new Date(initialData.orderDate).toISOString().split("T")[0],
        deliveryDate: new Date(initialData.deliveryDate).toISOString().split("T")[0],
        status: initialData.status,
        totalAmount: initialData.totalAmount,
        notes: initialData.notes || "",
      });
    } else {
      setFormData({
        orderNumber: "",
        customerName: "",
        orderDate: new Date().toISOString().split("T")[0],
        deliveryDate: "",
        status: "PENDING",
        totalAmount: 0,
        notes: "",
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.orderNumber?.trim()) {
      newErrors.orderNumber = "수주번호를 입력해주세요.";
    }
    if (!formData.customerName?.trim()) {
      newErrors.customerName = "고객명을 입력해주세요.";
    }
    if (!formData.orderDate) {
      newErrors.orderDate = "주문일을 선택해주세요.";
    }
    if (!formData.deliveryDate) {
      newErrors.deliveryDate = "납기일을 선택해주세요.";
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
      [name]: name === "totalAmount" ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "수주 수정" : "수주 등록"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="수주번호"
            name="orderNumber"
            value={formData.orderNumber}
            onChange={handleChange}
            error={errors.orderNumber}
            required
            placeholder="예: SO-2024-001"
          />
          <Input
            label="고객명"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            error={errors.customerName}
            required
            placeholder="고객 회사명"
          />
          <Input
            label="주문일"
            name="orderDate"
            type="date"
            value={formData.orderDate}
            onChange={handleChange}
            error={errors.orderDate}
            required
          />
          <Input
            label="납기일"
            name="deliveryDate"
            type="date"
            value={formData.deliveryDate}
            onChange={handleChange}
            error={errors.deliveryDate}
            required
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
