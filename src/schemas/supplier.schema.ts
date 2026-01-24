/**
 * Supplier Schema
 *
 * 공급업체 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 공급업체 생성 스키마
export const supplierSchema = z.object({
  code: z
    .string()
    .min(1, "업체코드를 입력해주세요.")
    .max(20, "업체코드는 20자 이내로 입력해주세요."),
  name: z
    .string()
    .min(1, "업체명을 입력해주세요.")
    .max(100, "업체명은 100자 이내로 입력해주세요."),
  contactPerson: z.string().max(50).nullable().optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^[\d\-+() ]*$/, "올바른 전화번호 형식이 아닙니다.")
    .nullable()
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("올바른 이메일 형식이 아닙니다.")
    .nullable()
    .optional()
    .or(z.literal("")),
  address: z.string().max(200).nullable().optional(),
  leadTimeDays: z
    .number()
    .int("리드타임은 정수여야 합니다.")
    .min(0, "리드타임은 0 이상이어야 합니다."),
  paymentTerms: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// 공급업체 수정 스키마
export const supplierUpdateSchema = supplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// 타입 추론
export type SupplierFormData = z.infer<typeof supplierSchema>;
export type SupplierUpdateData = z.infer<typeof supplierUpdateSchema>;
