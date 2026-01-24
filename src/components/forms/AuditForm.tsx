"use client";

import { useState, useEffect } from "react";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

interface AuditRecord {
  id?: number;
  auditCode?: string;
  auditDate: string;
  status: string;
  notes: string | null;
}

interface AuditFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AuditRecord>) => void;
  initialData?: AuditRecord | null;
  isLoading?: boolean;
}

const statusOptions = [
  { value: "PLANNED", label: "예정" },
  { value: "IN_PROGRESS", label: "진행중" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

export default function AuditForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: AuditFormProps) {
  const [formData, setFormData] = useState<Partial<AuditRecord>>({
    auditDate: new Date().toISOString().split("T")[0],
    status: "PLANNED",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          auditDate: initialData.auditDate
            ? new Date(initialData.auditDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          status: initialData.status || "PLANNED",
          notes: initialData.notes || "",
        });
      } else {
        setFormData({
          auditDate: new Date().toISOString().split("T")[0],
          status: "PLANNED",
          notes: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.auditDate) {
      newErrors.auditDate = "실사일을 선택해주세요.";
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
      [name]: value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "실사 수정" : "실사 생성"}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="실사일"
            name="auditDate"
            type="date"
            value={formData.auditDate}
            onChange={handleChange}
            error={errors.auditDate}
            required
          />
          {initialData && (
            <Select
              label="상태"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={statusOptions}
              required
            />
          )}
          <Textarea
            label="비고"
            name="notes"
            value={formData.notes || ""}
            onChange={handleChange}
            placeholder="실사 관련 메모를 입력하세요."
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
                처리 중...
              </span>
            ) : initialData ? (
              "수정"
            ) : (
              "생성"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
