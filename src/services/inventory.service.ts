/**
 * Inventory Service
 *
 * 재고 관리 비즈니스 로직
 */

import prisma from "@/lib/prisma";
import type { TransactionType } from "@/types/entities";

// ==================== 타입 정의 ====================

export interface TransactionInput {
  partId: number;
  transactionType: TransactionType;
  quantity: number;
  reason?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
}

export interface AdjustmentInput {
  partId: number;
  newQuantity: number;
  reason: string;
  notes?: string;
  performedBy?: string;
}

export interface TransactionResult {
  transaction: {
    id: number;
    transactionCode: string;
    transactionType: string;
    quantity: number;
    beforeQty: number;
    afterQty: number;
  };
  inventory: {
    currentQty: number;
    reservedQty: number;
    availableQty: number;
  };
}

// ==================== 헬퍼 함수 ====================

/**
 * 거래 코드 생성
 */
export function generateTransactionCode(type: string): string {
  const prefix = type.substring(0, 2).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * 가용재고 계산
 */
export function calculateAvailableQty(currentQty: number, reservedQty: number): number {
  return Math.max(0, currentQty - reservedQty);
}

// ==================== 메인 서비스 함수 ====================

/**
 * 입출고 처리
 */
export async function processTransaction(
  input: TransactionInput
): Promise<TransactionResult> {
  const { partId, transactionType, quantity, reason, notes, referenceType, referenceId, performedBy } = input;

  // 부품 및 재고 조회
  const part = await prisma.part.findUnique({
    where: { id: partId },
    include: { inventory: true },
  });

  if (!part) {
    throw new Error(`부품을 찾을 수 없습니다. (ID: ${partId})`);
  }

  // 재고 레코드 확인/생성
  let inventory = part.inventory;
  if (!inventory) {
    inventory = await prisma.inventory.create({
      data: {
        partId,
        currentQty: 0,
        reservedQty: 0,
        incomingQty: 0,
      },
    });
  }

  const beforeQty = inventory.currentQty;
  let afterQty = beforeQty;

  // 거래 유형에 따른 재고 변경
  switch (transactionType) {
    case "INBOUND":
      afterQty = beforeQty + quantity;
      break;
    case "OUTBOUND":
      if (beforeQty < quantity) {
        throw new Error(`재고가 부족합니다. (현재: ${beforeQty}, 요청: ${quantity})`);
      }
      afterQty = beforeQty - quantity;
      break;
    case "ADJUSTMENT":
      // 조정은 별도 함수 사용 권장
      afterQty = beforeQty + quantity; // quantity가 음수일 수 있음
      break;
    case "TRANSFER":
      afterQty = beforeQty; // 이동은 별도 처리 필요
      break;
  }

  // 트랜잭션 생성 및 재고 업데이트
  const result = await prisma.$transaction(async (tx) => {
    // 거래 기록 생성
    const transaction = await tx.transaction.create({
      data: {
        transactionCode: generateTransactionCode(transactionType),
        partId,
        transactionType,
        quantity,
        beforeQty,
        afterQty,
        reason,
        notes,
        referenceType,
        referenceId,
        performedBy,
        transactionDate: new Date(),
      },
    });

    // 재고 업데이트
    const updatedInventory = await tx.inventory.update({
      where: { id: inventory!.id },
      data: {
        currentQty: afterQty,
        ...(transactionType === "INBOUND" && { lastInboundDate: new Date() }),
        ...(transactionType === "OUTBOUND" && { lastOutboundDate: new Date() }),
      },
    });

    return { transaction, inventory: updatedInventory };
  });

  return {
    transaction: {
      id: result.transaction.id,
      transactionCode: result.transaction.transactionCode,
      transactionType: result.transaction.transactionType,
      quantity: result.transaction.quantity,
      beforeQty: result.transaction.beforeQty,
      afterQty: result.transaction.afterQty,
    },
    inventory: {
      currentQty: result.inventory.currentQty,
      reservedQty: result.inventory.reservedQty,
      availableQty: calculateAvailableQty(
        result.inventory.currentQty,
        result.inventory.reservedQty
      ),
    },
  };
}

/**
 * 재고 조정
 */
export async function adjustInventory(
  input: AdjustmentInput
): Promise<TransactionResult> {
  const { partId, newQuantity, reason, notes, performedBy } = input;

  const inventory = await prisma.inventory.findUnique({
    where: { partId },
  });

  if (!inventory) {
    throw new Error(`재고 정보를 찾을 수 없습니다. (Part ID: ${partId})`);
  }

  const adjustmentQty = newQuantity - inventory.currentQty;

  return processTransaction({
    partId,
    transactionType: "ADJUSTMENT",
    quantity: adjustmentQty,
    reason,
    notes,
    performedBy,
  });
}

/**
 * 재고 예약
 */
export async function reserveInventory(
  partId: number,
  quantity: number,
  referenceType: string,
  referenceId: string
): Promise<{ success: boolean; message?: string }> {
  const inventory = await prisma.inventory.findUnique({
    where: { partId },
  });

  if (!inventory) {
    return { success: false, message: "재고 정보를 찾을 수 없습니다." };
  }

  const availableQty = calculateAvailableQty(inventory.currentQty, inventory.reservedQty);

  if (availableQty < quantity) {
    return {
      success: false,
      message: `가용재고가 부족합니다. (가용: ${availableQty}, 요청: ${quantity})`,
    };
  }

  await prisma.inventory.update({
    where: { partId },
    data: {
      reservedQty: inventory.reservedQty + quantity,
    },
  });

  return { success: true };
}

/**
 * 재고 예약 해제
 */
export async function releaseReservation(
  partId: number,
  quantity: number
): Promise<void> {
  const inventory = await prisma.inventory.findUnique({
    where: { partId },
  });

  if (!inventory) {
    throw new Error("재고 정보를 찾을 수 없습니다.");
  }

  await prisma.inventory.update({
    where: { partId },
    data: {
      reservedQty: Math.max(0, inventory.reservedQty - quantity),
    },
  });
}

/**
 * 재고 현황 조회
 */
export async function getInventoryStatus(partId?: number) {
  const where = partId ? { partId } : {};

  const inventories = await prisma.inventory.findMany({
    where,
    include: {
      part: {
        include: {
          category: true,
          supplier: true,
        },
      },
    },
  });

  return inventories.map((inv) => ({
    ...inv,
    availableQty: calculateAvailableQty(inv.currentQty, inv.reservedQty),
    isLowStock: inv.currentQty <= (inv.part.safetyStock ?? 0),
  }));
}

/**
 * 저재고 알림 대상 조회
 */
export async function getLowStockAlerts() {
  const inventories = await prisma.inventory.findMany({
    include: {
      part: {
        include: {
          supplier: true,
        },
      },
    },
  });

  return inventories
    .filter((inv) => inv.currentQty <= (inv.part.safetyStock ?? 0))
    .map((inv) => ({
      partId: inv.partId,
      partNumber: inv.part.partCode,
      partName: inv.part.partName,
      currentQty: inv.currentQty,
      safetyStock: inv.part.safetyStock,
      shortage: (inv.part.safetyStock ?? 0) - inv.currentQty,
      supplier: inv.part.supplier?.name,
    }));
}

/**
 * 거래 내역 조회
 */
export async function getTransactionHistory(options: {
  partId?: number;
  transactionType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}) {
  const { partId, transactionType, startDate, endDate, limit = 100 } = options;

  return prisma.transaction.findMany({
    where: {
      ...(partId && { partId }),
      ...(transactionType && { transactionType }),
      ...((startDate || endDate) && {
        transactionDate: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
    },
    include: {
      part: true,
    },
    orderBy: { transactionDate: "desc" },
    take: limit,
  });
}
