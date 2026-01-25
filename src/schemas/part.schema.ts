/**
 * Part Schema
 *
 * 파츠 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 파츠 생성/수정 스키마
export const partSchema = z.object({
  partNumber: z
    .string()
    .min(1, "파츠번호를 입력해주세요.")
    .max(50, "파츠번호는 50자 이내로 입력해주세요."),
  partName: z
    .string()
    .max(100, "파츠명은 100자 이내로 입력해주세요.")
    .nullable()
    .optional(),
  description: z.string().max(500).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  unit: z.string().min(1, "단위를 선택해주세요."),
  unitPrice: z.number().min(0, "단가는 0 이상이어야 합니다."),
  safetyStock: z.number().int().min(0, "안전재고는 0 이상이어야 합니다."),
  minOrderQty: z.number().int().min(1, "최소발주량은 1 이상이어야 합니다."),
  leadTime: z.number().int().min(0, "리드타임은 0 이상이어야 합니다."),
});

// 파츠 수정 스키마 (모든 필드 optional)
export const partUpdateSchema = partSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// API 요청용 스키마 (DB 필드명 매핑)
export const partApiSchema = z.object({
  partCode: z.string().min(1, "파츠코드를 입력해주세요."),
  partName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  unit: z.string().min(1, "단위를 선택해주세요."),
  unitPrice: z.number().min(0, "단가는 0 이상이어야 합니다."),
  safetyStock: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  minOrderQty: z.number().int().min(1).default(1),
  leadTimeDays: z.number().int().min(0).default(7),
  storageLocation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

// 타입 추론
export type PartFormData = z.infer<typeof partSchema>;
export type PartUpdateData = z.infer<typeof partUpdateSchema>;
export type PartApiData = z.infer<typeof partApiSchema>;
