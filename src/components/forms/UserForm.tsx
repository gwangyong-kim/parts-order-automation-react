"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

// 폼 스키마 - 생성/수정 통합
const userFormSchema = z.object({
  username: z
    .string()
    .min(3, "아이디는 3자 이상이어야 합니다.")
    .max(20, "아이디는 20자 이내로 입력해주세요.")
    .regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문, 숫자, 밑줄만 사용할 수 있습니다."),
  name: z
    .string()
    .min(1, "이름을 입력해주세요.")
    .max(50, "이름은 50자 이내로 입력해주세요."),
  email: z.string().email("올바른 이메일 형식이 아닙니다.").or(z.literal("")).optional(),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

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
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(
      userFormSchema.refine(
        (data) => {
          // 신규 생성시에만 비밀번호 필수
          if (!initialData && (!data.password || data.password.length < 6)) {
            return false;
          }
          // 수정시 비밀번호 입력한 경우 6자 이상
          if (initialData && data.password && data.password.length < 6) {
            return false;
          }
          return true;
        },
        {
          message: initialData
            ? "비밀번호는 6자 이상이어야 합니다."
            : "비밀번호를 6자 이상 입력해주세요.",
          path: ["password"],
        }
      )
    ),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      password: "",
      role: "VIEWER",
      department: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          username: initialData.username || "",
          name: initialData.name || "",
          email: initialData.email || "",
          password: "",
          role: (initialData.role as UserFormData["role"]) || "VIEWER",
          department: initialData.department || "",
          isActive: initialData.isActive ?? true,
        });
      } else {
        reset({
          username: "",
          name: "",
          email: "",
          password: "",
          role: "VIEWER",
          department: "",
          isActive: true,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onFormSubmit = (data: UserFormData) => {
    const submitData: Partial<User> = { ...data };
    // 수정 시 비밀번호가 비어있으면 제외
    if (initialData && !submitData.password) {
      delete submitData.password;
    }
    onSubmit(submitData);
  };

  const isActiveValue = watch("isActive");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "사용자 수정" : "사용자 추가"}
      size="md"
    >
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4">
          <Input
            label="아이디"
            {...register("username")}
            error={errors.username?.message}
            required
            disabled={!!initialData}
            placeholder="로그인에 사용할 아이디"
          />
          <Input
            label="이름"
            {...register("name")}
            error={errors.name?.message}
            required
            placeholder="사용자 이름"
          />
          <Input
            label="이메일"
            type="email"
            {...register("email")}
            error={errors.email?.message}
            placeholder="이메일 주소 (선택)"
          />
          <Input
            label={initialData ? "비밀번호 (변경시에만 입력)" : "비밀번호"}
            type="password"
            {...register("password")}
            error={errors.password?.message}
            required={!initialData}
            placeholder={initialData ? "변경하지 않으려면 비워두세요" : "비밀번호 입력"}
          />
          <Select
            label="역할"
            {...register("role")}
            options={roleOptions}
            required
          />
          <Input
            label="부서"
            {...register("department")}
            placeholder="소속 부서 (선택)"
          />
          {initialData && (
            <Select
              label="상태"
              value={isActiveValue?.toString()}
              onChange={(e) => setValue("isActive", e.target.value === "true")}
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
                <Spinner size="sm" />
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
