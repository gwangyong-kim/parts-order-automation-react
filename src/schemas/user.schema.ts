/**
 * User Schema
 *
 * 사용자 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 사용자 역할
export const userRoleSchema = z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"], {
  message: "역할을 선택해주세요.",
});

// 사용자 생성 스키마
export const userSchema = z.object({
  username: z
    .string()
    .min(3, "사용자명은 3자 이상이어야 합니다.")
    .max(20, "사용자명은 20자 이내로 입력해주세요.")
    .regex(/^[a-zA-Z0-9_]+$/, "사용자명은 영문, 숫자, 밑줄만 사용할 수 있습니다."),
  email: z
    .string()
    .email("올바른 이메일 형식이 아닙니다.")
    .nullable()
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(100, "비밀번호는 100자 이내로 입력해주세요."),
  name: z
    .string()
    .min(1, "이름을 입력해주세요.")
    .max(50, "이름은 50자 이내로 입력해주세요."),
  role: userRoleSchema,
  department: z.string().max(50).nullable().optional(),
});

// 사용자 수정 스키마 (비밀번호 제외)
export const userUpdateSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").nullable().optional().or(z.literal("")),
  name: z.string().min(1, "이름을 입력해주세요.").max(50).optional(),
  role: userRoleSchema.optional(),
  department: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
});

// 비밀번호 변경 스키마
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요.").optional(),
    newPassword: z
      .string()
      .min(8, "새 비밀번호는 8자 이상이어야 합니다.")
      .max(100, "비밀번호는 100자 이내로 입력해주세요."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

// 로그인 스키마
export const loginSchema = z.object({
  username: z.string().min(1, "사용자명을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

// 타입 추론
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type UserUpdateData = z.infer<typeof userUpdateSchema>;
export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
export type LoginData = z.infer<typeof loginSchema>;
