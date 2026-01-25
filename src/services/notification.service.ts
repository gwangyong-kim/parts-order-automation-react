/**
 * Notification Service
 *
 * 알림 생성 및 관리 서비스
 */

import prisma from "@/lib/prisma";

type NotificationType = "INFO" | "WARNING" | "ERROR" | "SUCCESS";
type NotificationCategory = "SYSTEM" | "INVENTORY" | "ORDER" | "SUPPLIER";

interface CreateNotificationInput {
  userId?: number;
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  link?: string;
}

/**
 * 알림 생성
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId || null,
      title: input.title,
      message: input.message,
      type: input.type || "INFO",
      category: input.category || "SYSTEM",
      link: input.link || null,
    },
  });
}

/**
 * 저재고 알림 생성
 */
export async function createLowStockNotification(
  partCode: string,
  partName: string,
  currentQty: number,
  safetyStock: number
) {
  return createNotification({
    title: "저재고 경고",
    message: `${partCode} (${partName}) 재고가 안전재고 이하입니다. 현재: ${currentQty}개, 안전재고: ${safetyStock}개`,
    type: "WARNING",
    category: "INVENTORY",
    link: `/parts?search=${encodeURIComponent(partCode)}`,
  });
}

/**
 * 발주 생성 알림
 */
export async function createOrderCreatedNotification(
  orderCode: string,
  supplierName: string,
  totalAmount: number
) {
  return createNotification({
    title: "발주 생성",
    message: `${orderCode} 발주가 생성되었습니다. (${supplierName}, ₩${totalAmount.toLocaleString()})`,
    type: "INFO",
    category: "ORDER",
    link: `/orders?search=${encodeURIComponent(orderCode)}`,
  });
}

/**
 * 발주 상태 변경 알림
 */
export async function createOrderStatusChangedNotification(
  orderCode: string,
  status: string
) {
  const statusLabels: Record<string, string> = {
    DRAFT: "초안",
    PENDING: "대기",
    APPROVED: "승인",
    ORDERED: "발주완료",
    PARTIAL: "부분입고",
    RECEIVED: "입고완료",
    CANCELLED: "취소",
  };

  const label = statusLabels[status] || status;

  return createNotification({
    title: "발주 상태 변경",
    message: `${orderCode} 발주가 "${label}" 상태로 변경되었습니다.`,
    type: status === "CANCELLED" ? "WARNING" : "INFO",
    category: "ORDER",
    link: `/orders?search=${encodeURIComponent(orderCode)}`,
  });
}

/**
 * 입고 완료 알림
 */
export async function createInboundCompletedNotification(
  partCode: string,
  partName: string,
  quantity: number
) {
  return createNotification({
    title: "입고 완료",
    message: `${partCode} (${partName}) ${quantity}개가 입고되었습니다.`,
    type: "SUCCESS",
    category: "INVENTORY",
    link: `/inventory?search=${encodeURIComponent(partCode)}`,
  });
}
