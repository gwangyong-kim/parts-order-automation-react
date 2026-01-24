/**
 * Transaction Schema
 *
 * 입출고 거래 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 거래 유형
export const transactionTypeSchema = z.enum(["INBOUND", "OUTBOUND", "ADJUSTMENT", "TRANSFER"], {
  message: "거래 유형을 선택해주세요.",
});

// 거래 생성 스키마
export const transactionSchema = z.object({
  partId: z
    .number({ message: "부품을 선택해주세요." })
    .int()
    .positive("부품을 선택해주세요."),
  transactionType: transactionTypeSchema,
  quantity: z
    .number({ message: "수량을 입력해주세요." })
    .int("수량은 정수여야 합니다.")
    .positive("수량은 1 이상이어야 합니다."),
  reason: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  referenceType: z.string().max(50).nullable().optional(),
  referenceId: z.string().max(50).nullable().optional(),
});

// 재고 조정 스키마 (조정 전용)
export const adjustmentSchema = z.object({
  partId: z.number().int().positive("부품을 선택해주세요."),
  adjustedQty: z.number().int("수량은 정수여야 합니다."),
  reason: z.string().min(1, "조정 사유를 입력해주세요.").max(200),
  notes: z.string().max(1000).nullable().optional(),
});

// 타입 추론
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionFormData = z.infer<typeof transactionSchema>;
export type AdjustmentFormData = z.infer<typeof adjustmentSchema>;
