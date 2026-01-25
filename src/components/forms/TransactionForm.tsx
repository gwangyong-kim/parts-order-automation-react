"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

interface Transaction {
  partId: number;
  transactionType: string;
  quantity: number;
  notes: string | null;
}

interface Part {
  id: number;
  partNumber: string;
  partName: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Transaction>) => void;
  isLoading?: boolean;
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
}: TransactionFormProps) {
  const [formData, setFormData] = useState<Partial<Transaction>>({
    partId: 0,
    transactionType: "INBOUND",
    quantity: 0,
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: parts } = useQuery({
    queryKey: ["parts"],
    queryFn: fetchParts,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        partId: 0,
        transactionType: "INBOUND",
        quantity: 0,
        notes: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.partId || formData.partId === 0) {
      newErrors.partId = "파츠를 선택해주세요.";
    }
    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = "수량은 0보다 커야 합니다.";
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
        name === "quantity" || name === "partId"
          ? parseInt(value) || 0
          : value,
    }));
  };

  const partOptions =
    parts?.map((p) => ({
      value: p.id,
      label: `${p.partNumber} - ${p.partName}`,
    })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="수동 입출고"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Select
            label="파츠"
            name="partId"
            value={formData.partId?.toString()}
            onChange={handleChange}
            options={partOptions}
            placeholder="파츠 선택"
            error={errors.partId}
            required
          />
          <Select
            label="유형"
            name="transactionType"
            value={formData.transactionType}
            onChange={handleChange}
            options={typeOptions}
            required
          />
          <Input
            label="수량"
            name="quantity"
            type="number"
            value={formData.quantity?.toString()}
            onChange={handleChange}
            error={errors.quantity}
            required
            min={1}
            placeholder="수량 입력"
          />
          <Textarea
            label="비고"
            name="notes"
            value={formData.notes || ""}
            onChange={handleChange}
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
                처리 중...
              </span>
            ) : (
              "등록"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
