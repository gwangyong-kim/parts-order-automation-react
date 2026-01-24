/**
 * Status Constants
 *
 * 상태 관련 상수 정의
 */

// ==================== 발주 상태 ====================

export const ORDER_STATUS = {
  DRAFT: { value: "DRAFT", label: "작성중", color: "badge-secondary" },
  SUBMITTED: { value: "SUBMITTED", label: "제출됨", color: "badge-warning" },
  APPROVED: { value: "APPROVED", label: "승인됨", color: "badge-info" },
  ORDERED: { value: "ORDERED", label: "발주완료", color: "badge-primary" },
  PARTIAL: { value: "PARTIAL", label: "부분입고", color: "badge-warning" },
  RECEIVED: { value: "RECEIVED", label: "입고완료", color: "badge-success" },
  CANCELLED: { value: "CANCELLED", label: "취소", color: "badge-danger" },
} as const;

export const orderStatusOptions = Object.values(ORDER_STATUS);

export type OrderStatusValue = keyof typeof ORDER_STATUS;

// ==================== 수주 상태 ====================

export const SALES_ORDER_STATUS = {
  RECEIVED: { value: "RECEIVED", label: "접수", color: "badge-info" },
  IN_PROGRESS: { value: "IN_PROGRESS", label: "진행중", color: "badge-warning" },
  COMPLETED: { value: "COMPLETED", label: "완료", color: "badge-success" },
  CANCELLED: { value: "CANCELLED", label: "취소", color: "badge-danger" },
} as const;

export const salesOrderStatusOptions = Object.values(SALES_ORDER_STATUS);

export type SalesOrderStatusValue = keyof typeof SALES_ORDER_STATUS;

// ==================== 거래 유형 ====================

export const TRANSACTION_TYPE = {
  INBOUND: { value: "INBOUND", label: "입고", color: "badge-success", sign: "+" },
  OUTBOUND: { value: "OUTBOUND", label: "출고", color: "badge-danger", sign: "-" },
  ADJUSTMENT: { value: "ADJUSTMENT", label: "조정", color: "badge-warning", sign: "" },
  TRANSFER: { value: "TRANSFER", label: "이동", color: "badge-info", sign: "" },
} as const;

export const transactionTypeOptions = Object.values(TRANSACTION_TYPE);

export type TransactionTypeValue = keyof typeof TRANSACTION_TYPE;

// ==================== MRP 긴급도 ====================

export const MRP_URGENCY = {
  CRITICAL: { value: "CRITICAL", label: "긴급", color: "badge-danger" },
  HIGH: { value: "HIGH", label: "높음", color: "badge-warning" },
  MEDIUM: { value: "MEDIUM", label: "보통", color: "badge-info" },
  LOW: { value: "LOW", label: "낮음", color: "badge-secondary" },
} as const;

export const mrpUrgencyOptions = Object.values(MRP_URGENCY);

export type MrpUrgencyValue = keyof typeof MRP_URGENCY;

// ==================== MRP 상태 ====================

export const MRP_STATUS = {
  PENDING: { value: "PENDING", label: "대기", color: "badge-warning" },
  ORDERED: { value: "ORDERED", label: "발주완료", color: "badge-info" },
  COMPLETED: { value: "COMPLETED", label: "완료", color: "badge-success" },
} as const;

export const mrpStatusOptions = Object.values(MRP_STATUS);

export type MrpStatusValue = keyof typeof MRP_STATUS;

// ==================== 실사 유형 ====================

export const AUDIT_TYPE = {
  MONTHLY: { value: "MONTHLY", label: "월간" },
  QUARTERLY: { value: "QUARTERLY", label: "분기" },
  YEARLY: { value: "YEARLY", label: "연간" },
  SPOT: { value: "SPOT", label: "수시" },
} as const;

export const auditTypeOptions = Object.values(AUDIT_TYPE);

export type AuditTypeValue = keyof typeof AUDIT_TYPE;

// ==================== 실사 상태 ====================

export const AUDIT_STATUS = {
  IN_PROGRESS: { value: "IN_PROGRESS", label: "진행중", color: "badge-warning" },
  COMPLETED: { value: "COMPLETED", label: "완료", color: "badge-info" },
  APPROVED: { value: "APPROVED", label: "승인됨", color: "badge-success" },
} as const;

export const auditStatusOptions = Object.values(AUDIT_STATUS);

export type AuditStatusValue = keyof typeof AUDIT_STATUS;

// ==================== 불일치 상태 ====================

export const DISCREPANCY_STATUS = {
  OPEN: { value: "OPEN", label: "미해결", color: "badge-danger" },
  INVESTIGATING: { value: "INVESTIGATING", label: "조사중", color: "badge-warning" },
  RESOLVED: { value: "RESOLVED", label: "해결됨", color: "badge-success" },
} as const;

export const discrepancyStatusOptions = Object.values(DISCREPANCY_STATUS);

export type DiscrepancyStatusValue = keyof typeof DISCREPANCY_STATUS;

// ==================== 동기화 상태 ====================

export const SYNC_STATUS = {
  PENDING: { value: "PENDING", label: "대기", color: "badge-secondary" },
  IN_PROGRESS: { value: "IN_PROGRESS", label: "진행중", color: "badge-warning" },
  COMPLETED: { value: "COMPLETED", label: "완료", color: "badge-success" },
  FAILED: { value: "FAILED", label: "실패", color: "badge-danger" },
} as const;

export const syncStatusOptions = Object.values(SYNC_STATUS);

export type SyncStatusValue = keyof typeof SYNC_STATUS;

// ==================== 헬퍼 함수 ====================

/**
 * 상태값으로 상태 정보 조회
 */
export function getStatusInfo<T extends Record<string, { value: string; label: string; color?: string }>>(
  statusMap: T,
  value: string
): { value: string; label: string; color?: string } | undefined {
  return Object.values(statusMap).find((s) => s.value === value);
}

/**
 * 상태값으로 레이블 조회
 */
export function getStatusLabel<T extends Record<string, { value: string; label: string }>>(
  statusMap: T,
  value: string
): string {
  const info = getStatusInfo(statusMap, value);
  return info?.label || value;
}

/**
 * 상태값으로 색상 조회
 */
export function getStatusColor<T extends Record<string, { value: string; color?: string }>>(
  statusMap: T,
  value: string
): string {
  const info = Object.values(statusMap).find((s) => s.value === value);
  return info?.color || "badge-secondary";
}
