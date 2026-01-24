/**
 * Sales Order Schema
 *
 * 수주(판매주문) 관련 Zod 검증 스키마
 */

import { z } from "zod";

// 수주 상태
export const salesOrderStatusSchema = z.enum(["RECEIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], {
  message: "상태를 선택해주세요.",
});

// 수주 항목 스키마
export const salesOrderItemSchema = z.object({
  productId: z
    .number({ message: "제품을 선택해주세요." })
    .int()
    .positive("제품을 선택해주세요."),
  orderQty: z
    .number({ message: "수량을 입력해주세요." })
    .int("수량은 정수여야 합니다.")
    .positive("수량은 1 이상이어야 합니다."),
  notes: z.string().max(500).nullable().optional(),
});

// 수주 생성 스키마
export const salesOrderSchema = z.object({
  orderDate: z.string().min(1, "수주일을 선택해주세요."),
  division: z.string().max(50).nullable().optional(),
  manager: z.string().max(50).nullable().optional(),
  project: z.string().max(100).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(salesOrderItemSchema)
    .min(1, "최소 1개 이상의 품목을 추가해주세요."),
});

// 수주 수정 스키마
export const salesOrderUpdateSchema = z.object({
  division: z.string().max(50).nullable().optional(),
  manager: z.string().max(50).nullable().optional(),
  project: z.string().max(100).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: salesOrderStatusSchema.optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(salesOrderItemSchema).optional(),
});

// 타입 추론
export type SalesOrderStatus = z.infer<typeof salesOrderStatusSchema>;
export type SalesOrderItemFormData = z.infer<typeof salesOrderItemSchema>;
export type SalesOrderFormData = z.infer<typeof salesOrderSchema>;
export type SalesOrderUpdateData = z.infer<typeof salesOrderUpdateSchema>;
