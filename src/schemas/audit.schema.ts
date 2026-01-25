/**
 * Audit Schema
 *
 * 재고 실사 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 실사 유형
export const auditTypeSchema = z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "SPOT"], {
  message: "실사 유형을 선택해주세요.",
});

// 실사 상태
export const auditStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "APPROVED"], {
  message: "상태를 선택해주세요.",
});

// 실사 생성 스키마
export const auditSchema = z.object({
  auditDate: z.string().min(1, "실사일을 선택해주세요."),
  auditType: auditTypeSchema,
  notes: z.string().max(1000).nullable().optional(),
  partIds: z.array(z.number().int().positive()).optional(), // 특정 파츠만 실사할 경우
});

// 실사 항목 업데이트 스키마
export const auditItemSchema = z.object({
  countedQty: z
    .number({ message: "실사 수량을 입력해주세요." })
    .int("수량은 정수여야 합니다.")
    .min(0, "수량은 0 이상이어야 합니다."),
  notes: z.string().max(500).nullable().optional(),
});

// 실사 완료 스키마
export const auditCompleteSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
});

// 불일치 해결 스키마
export const discrepancyResolveSchema = z.object({
  causeCategory: z.string().min(1, "원인 분류를 선택해주세요.").max(50),
  causeDetail: z.string().max(500).nullable().optional(),
  resolution: z.string().min(1, "해결 방법을 입력해주세요.").max(500),
  notes: z.string().max(1000).nullable().optional(),
});

// 타입 추론
export type AuditType = z.infer<typeof auditTypeSchema>;
export type AuditStatus = z.infer<typeof auditStatusSchema>;
export type AuditFormData = z.infer<typeof auditSchema>;
export type AuditItemFormData = z.infer<typeof auditItemSchema>;
export type AuditCompleteData = z.infer<typeof auditCompleteSchema>;
export type DiscrepancyResolveData = z.infer<typeof discrepancyResolveSchema>;
