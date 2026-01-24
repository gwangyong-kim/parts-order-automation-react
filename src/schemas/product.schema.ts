/**
 * Product Schema
 *
 * 제품 및 BOM 관련 Zod 검증 스키마
 */

import { z } from "zod";

// BOM 항목 스키마
export const bomItemSchema = z.object({
  partId: z
    .number({ message: "부품을 선택해주세요." })
    .int()
    .positive("부품을 선택해주세요."),
  quantityPerUnit: z
    .number({ message: "소요량을 입력해주세요." })
    .positive("소요량은 0보다 커야 합니다."),
  lossRate: z
    .number()
    .min(0, "손실률은 0 이상이어야 합니다.")
    .max(1, "손실률은 1 이하여야 합니다.")
    .default(0),
  notes: z.string().max(500).nullable().optional(),
});

// 제품 생성 스키마
export const productSchema = z.object({
  productCode: z
    .string()
    .min(1, "제품코드를 입력해주세요.")
    .max(50, "제품코드는 50자 이내로 입력해주세요."),
  productName: z
    .string()
    .min(1, "제품명을 입력해주세요.")
    .max(100, "제품명은 100자 이내로 입력해주세요."),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  unit: z.string().min(1, "단위를 선택해주세요.").default("EA"),
  notes: z.string().max(1000).nullable().optional(),
  bomItems: z.array(bomItemSchema).optional(),
});

// 제품 수정 스키마
export const productUpdateSchema = productSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// 타입 추론
export type BomItemFormData = z.infer<typeof bomItemSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type ProductUpdateData = z.infer<typeof productUpdateSchema>;
