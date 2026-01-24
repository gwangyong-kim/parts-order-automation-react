/**
 * Order Schema
 *
 * 발주(구매주문) 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 발주 품목 스키마
export const orderItemSchema = z.object({
  partId: z
    .number({ message: "부품을 선택해주세요." })
    .int()
    .positive("부품을 선택해주세요."),
  orderQty: z
    .number({ message: "수량을 입력해주세요." })
    .int("수량은 정수여야 합니다.")
    .positive("수량은 1 이상이어야 합니다."),
  unitPrice: z.number().min(0).nullable().optional(),
  expectedDate: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// 발주 생성 스키마
export const orderSchema = z.object({
  supplierId: z
    .number({ message: "공급업체를 선택해주세요." })
    .int()
    .positive("공급업체를 선택해주세요."),
  project: z.string().max(100).nullable().optional(),
  orderDate: z.string().min(1, "발주일을 선택해주세요."),
  expectedDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(orderItemSchema)
    .min(1, "최소 1개 이상의 품목을 추가해주세요."),
});

// 발주 수정 스키마
export const orderUpdateSchema = z.object({
  project: z.string().max(100).nullable().optional(),
  expectedDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(orderItemSchema).optional(),
});

// 발주 상태 변경 스키마
export const orderStatusSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"], {
    message: "상태를 선택해주세요.",
  }),
  approvedBy: z.string().nullable().optional(),
});

// 입고 처리 스키마
export const orderReceiveSchema = z.object({
  itemId: z.number().int().positive(),
  receivedQty: z
    .number({ message: "입고수량을 입력해주세요." })
    .int("입고수량은 정수여야 합니다.")
    .min(0, "입고수량은 0 이상이어야 합니다."),
  notes: z.string().max(500).nullable().optional(),
});

// 타입 추론
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderUpdateData = z.infer<typeof orderUpdateSchema>;
export type OrderStatusData = z.infer<typeof orderStatusSchema>;
export type OrderReceiveData = z.infer<typeof orderReceiveSchema>;
