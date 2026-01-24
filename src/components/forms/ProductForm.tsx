"use client";

import { useState, useEffect } from "react";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

interface Product {
  id?: number;
  productCode: string;
  productName: string;
  description: string | null;
}

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Product>) => void;
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
  const [formData, setFormData] = useState<Partial<Product>>({
    productCode: "",
    productName: "",
    description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        productCode: initialData.productCode,
        productName: initialData.productName,
        description: initialData.description || "",
      });
    } else {
      setFormData({
        productCode: "",
        productName: "",
        description: "",
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.productCode?.trim()) {
      newErrors.productCode = "제품코드를 입력해주세요.";
    }
    if (!formData.productName?.trim()) {
      newErrors.productName = "제품명을 입력해주세요.";
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "제품 수정" : "제품 등록"}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
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
            error={errors.productName}
            required
            placeholder="예: 스마트 센서 모듈"
          />
          <Textarea
            label="설명"
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            placeholder="제품에 대한 설명을 입력하세요."
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
