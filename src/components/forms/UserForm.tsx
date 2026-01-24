"use client";

import { useState, useEffect } from "react";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface User {
  id?: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  isActive?: boolean;
  password?: string;
}

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<User>) => void;
  initialData?: User | null;
  isLoading?: boolean;
}

const roleOptions = [
  { value: "ADMIN", label: "관리자" },
  { value: "MANAGER", label: "매니저" },
  { value: "OPERATOR", label: "운영자" },
  { value: "VIEWER", label: "조회자" },
];

const statusOptions = [
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

export default function UserForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: UserFormProps) {
  const [formData, setFormData] = useState<Partial<User>>({
    username: "",
    name: "",
    email: "",
    role: "VIEWER",
    department: "",
    password: "",
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          username: initialData.username || "",
          name: initialData.name || "",
          email: initialData.email || "",
          role: initialData.role || "VIEWER",
          department: initialData.department || "",
          password: "", // Don't populate password
          isActive: initialData.isActive ?? true,
        });
      } else {
        setFormData({
          username: "",
          name: "",
          email: "",
          role: "VIEWER",
          department: "",
          password: "",
          isActive: true,
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username?.trim()) {
      newErrors.username = "아이디를 입력해주세요.";
    }
    if (!formData.name?.trim()) {
      newErrors.name = "이름을 입력해주세요.";
    }
    if (!initialData && !formData.password) {
      newErrors.password = "비밀번호를 입력해주세요.";
    }
    if (formData.password && formData.password.length < 6) {
      newErrors.password = "비밀번호는 6자 이상이어야 합니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const submitData = { ...formData };
      // Don't send empty password when editing
      if (initialData && !submitData.password) {
        delete submitData.password;
      }
      onSubmit(submitData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "isActive" ? value === "true" : value,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "사용자 수정" : "사용자 추가"}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="아이디"
            name="username"
            value={formData.username}
            onChange={handleChange}
            error={errors.username}
            required
            disabled={!!initialData} // Username cannot be changed
            placeholder="로그인에 사용할 아이디"
          />
          <Input
            label="이름"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            required
            placeholder="사용자 이름"
          />
          <Input
            label="이메일"
            name="email"
            type="email"
            value={formData.email || ""}
            onChange={handleChange}
            placeholder="이메일 주소 (선택)"
          />
          <Input
            label={initialData ? "비밀번호 (변경시에만 입력)" : "비밀번호"}
            name="password"
            type="password"
            value={formData.password || ""}
            onChange={handleChange}
            error={errors.password}
            required={!initialData}
            placeholder={initialData ? "변경하지 않으려면 비워두세요" : "비밀번호 입력"}
          />
          <Select
            label="역할"
            name="role"
            value={formData.role}
            onChange={handleChange}
            options={roleOptions}
            required
          />
          <Input
            label="부서"
            name="department"
            value={formData.department || ""}
            onChange={handleChange}
            placeholder="소속 부서 (선택)"
          />
          {initialData && (
            <Select
              label="상태"
              name="isActive"
              value={formData.isActive?.toString()}
              onChange={handleChange}
              options={statusOptions}
            />
          )}
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
              "추가"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
