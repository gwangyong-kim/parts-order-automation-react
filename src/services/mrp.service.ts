/**
 * MRP Service
 *
 * 자재 소요량 계획(Material Requirements Planning) 비즈니스 로직
 * 수정: 파츠 + 수주(프로젝트)별로 MRP 결과 분리 생성
 */

import prisma from "@/lib/prisma";
import type { MrpUrgency } from "@/types/entities";

// ==================== 타입 정의 ====================

export interface MrpCalculationInput {
  /** 특정 파츠만 계산 (null이면 전체) */
  partIds?: number[];
  /** 특정 수주만 대상 */
  salesOrderIds?: number[];
  /** 기존 결과 삭제 여부 */
  clearExisting?: boolean;
}

export interface MrpCalculationResult {
  partId: number;
  salesOrderId?: number | null;
  totalRequirement: number;
  currentStock: number;
  reservedQty: number;
  incomingQty: number;
  safetyStock: number;
  netRequirement: number;
  recommendedOrderQty: number;
  recommendedOrderDate: Date | null;
  urgency: MrpUrgency;
  calculatedAt: Date;
}

export interface MrpSummary {
  totalResults: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalRecommendedQty: number;
  partsNeedingOrder: number;
}

// ==================== 헬퍼 함수 ====================

/**
 * 납기일까지의 일수를 기준으로 긴급도 결정
 */
export function getUrgencyLevel(daysUntil: number): MrpUrgency {
  if (daysUntil <= 0) return "CRITICAL";
  if (daysUntil <= 7) return "HIGH";
  if (daysUntil <= 14) return "MEDIUM";
  return "LOW";
}

/**
 * 두 날짜 사이의 일수 계산
 */
export function getDaysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 권장 발주일 계산
 */
export function calculateOrderDate(deliveryDate: Date, leadTimeDays: number): Date {
  const orderDate = new Date(deliveryDate);
  orderDate.setDate(orderDate.getDate() - leadTimeDays);
  return orderDate;
}

// ==================== 메인 서비스 함수 ====================

/**
 * MRP 계산 실행
 * 파츠 + 수주(프로젝트)별로 분리하여 결과 생성
 */
export async function calculateMrp(
  input: MrpCalculationInput = {}
): Promise<{ results: MrpCalculationResult[]; summary: MrpSummary }> {
  const { partIds, salesOrderIds, clearExisting = true } = input;
  const now = new Date();

  // 기존 결과 삭제
  if (clearExisting) {
    await prisma.mrpResult.deleteMany({
      where: partIds ? { partId: { in: partIds } } : undefined,
    });
  }

  // 활성 수주 상태 (PENDING, CONFIRMED, IN_PRODUCTION)
  const activeSalesOrderStatuses = ["PENDING", "CONFIRMED", "IN_PRODUCTION"];

  // 활성 파츠 조회 (재고, BOM, 발주 정보 포함)
  const parts = await prisma.part.findMany({
    where: {
      isActive: true,
      ...(partIds && { id: { in: partIds } }),
    },
    include: {
      inventory: true,
      bomItems: {
        where: { isActive: true },
        include: {
          product: {
            include: {
              salesOrderItems: {
                include: {
                  salesOrder: true,
                },
                where: {
                  salesOrder: {
                    status: { in: activeSalesOrderStatuses },
                    ...(salesOrderIds && { id: { in: salesOrderIds } }),
                  },
                },
              },
            },
          },
        },
      },
      orderItems: {
        where: {
          order: {
            status: { in: ["DRAFT", "APPROVED", "ORDERED"] },
          },
        },
      },
    },
  });

  const results: MrpCalculationResult[] = [];

  // 파츠 + 수주별 소요량 맵: Map<"partId-salesOrderId", { requirement, dueDate, salesOrderId }>
  const requirementMap = new Map<string, {
    partId: number;
    salesOrderId: number;
    requirement: number;
    dueDate: Date | null;
  }>();

  // 1단계: 파츠 + 수주별 소요량 집계
  for (const part of parts) {
    for (const bomItem of part.bomItems) {
      for (const salesOrderItem of bomItem.product.salesOrderItems) {
        const key = `${part.id}-${salesOrderItem.salesOrderId}`;

        // 소요량 = 주문수량 × 단위당 소요량 × (1 + 손실률)
        const requirement =
          salesOrderItem.orderQty * bomItem.quantityPerUnit * (1 + bomItem.lossRate);

        const dueDate = salesOrderItem.salesOrder.dueDate
          ? new Date(salesOrderItem.salesOrder.dueDate)
          : null;

        if (requirementMap.has(key)) {
          const existing = requirementMap.get(key)!;
          existing.requirement += requirement;
          // 더 빠른 납기일로 업데이트
          if (dueDate && (!existing.dueDate || dueDate < existing.dueDate)) {
            existing.dueDate = dueDate;
          }
        } else {
          requirementMap.set(key, {
            partId: part.id,
            salesOrderId: salesOrderItem.salesOrderId,
            requirement,
            dueDate,
          });
        }
      }
    }
  }

  // 2단계: 파츠별 재고 정보 맵 생성
  const partInfoMap = new Map(parts.map((part) => [
    part.id,
    {
      part,
      currentStock: part.inventory?.currentQty ?? 0,
      reservedQty: part.inventory?.reservedQty ?? 0,
      incomingQty: part.orderItems.reduce((sum, item) => sum + item.orderQty - item.receivedQty, 0),
      safetyStock: part.safetyStock,
      minOrderQty: part.minOrderQty,
      leadTimeDays: part.leadTimeDays,
    },
  ]));

  // 3단계: 파츠 + 수주별 MRP 결과 생성
  for (const [, reqData] of requirementMap) {
    const partInfo = partInfoMap.get(reqData.partId);
    if (!partInfo) continue;

    const { currentStock, reservedQty, incomingQty, safetyStock, minOrderQty, leadTimeDays } = partInfo;
    const totalRequirement = reqData.requirement;

    // 순소요량 계산
    // 가용재고 = 현재고 + 입고예정 - 예약수량 - 안전재고
    const availableStock = currentStock + incomingQty - reservedQty - safetyStock;
    const netRequirement = Math.max(0, totalRequirement - Math.max(0, availableStock));

    // 권장 발주량 계산 (최소발주량 고려)
    const recommendedOrderQty = netRequirement > 0
      ? Math.max(Math.ceil(netRequirement), minOrderQty)
      : 0;

    // 권장 발주일 계산
    let recommendedOrderDate: Date | null = null;
    if (reqData.dueDate && recommendedOrderQty > 0) {
      recommendedOrderDate = calculateOrderDate(reqData.dueDate, leadTimeDays);
    }

    // 긴급도 결정
    const daysUntil = reqData.dueDate
      ? getDaysBetween(now, reqData.dueDate)
      : 999;
    const urgency = getUrgencyLevel(daysUntil);

    // 결과 저장
    const result: MrpCalculationResult = {
      partId: reqData.partId,
      salesOrderId: reqData.salesOrderId,
      totalRequirement: Math.round(totalRequirement),
      currentStock,
      reservedQty,
      incomingQty,
      safetyStock,
      netRequirement: Math.round(netRequirement),
      recommendedOrderQty: Math.round(recommendedOrderQty),
      recommendedOrderDate,
      urgency,
      calculatedAt: now,
    };

    // DB에 저장
    await prisma.mrpResult.create({
      data: {
        partId: result.partId,
        salesOrderId: result.salesOrderId,
        calculationDate: result.calculatedAt,
        grossRequirement: result.totalRequirement,
        currentStock: result.currentStock,
        reservedQty: result.reservedQty,
        incomingQty: result.incomingQty,
        netRequirement: result.netRequirement,
        suggestedOrderQty: result.recommendedOrderQty,
        suggestedOrderDate: result.recommendedOrderDate,
        status: "PENDING",
      },
    });

    results.push(result);
  }

  // 요약 정보 생성
  const summary: MrpSummary = {
    totalResults: results.length,
    criticalCount: results.filter((r) => r.urgency === "CRITICAL").length,
    highCount: results.filter((r) => r.urgency === "HIGH").length,
    mediumCount: results.filter((r) => r.urgency === "MEDIUM").length,
    lowCount: results.filter((r) => r.urgency === "LOW").length,
    totalRecommendedQty: results.reduce((sum, r) => sum + r.recommendedOrderQty, 0),
    partsNeedingOrder: results.filter((r) => r.recommendedOrderQty > 0).length,
  };

  return { results, summary };
}

/**
 * MRP 결과 조회
 */
export async function getMrpResults(options: {
  status?: string;
  urgency?: MrpUrgency;
  partId?: number;
  onlyNeedsOrder?: boolean;
} = {}) {
  const { status, urgency, partId, onlyNeedsOrder } = options;

  const results = await prisma.mrpResult.findMany({
    where: {
      ...(status && { status }),
      ...(partId && { partId }),
      ...(onlyNeedsOrder && { suggestedOrderQty: { gt: 0 } }),
    },
    include: {
      part: {
        include: {
          supplier: true,
          category: true,
        },
      },
      salesOrder: true,
    },
    orderBy: [
      { suggestedOrderDate: "asc" },
      { suggestedOrderQty: "desc" },
    ],
  });

  // urgency 필터링 (DB에 없으므로 계산 후 필터링)
  if (urgency) {
    const now = new Date();
    return results.filter((result) => {
      const daysUntil = result.suggestedOrderDate
        ? getDaysBetween(now, new Date(result.suggestedOrderDate))
        : 999;
      return getUrgencyLevel(daysUntil) === urgency;
    });
  }

  return results;
}

/**
 * MRP 결과 상태 업데이트
 */
export async function updateMrpResultStatus(
  resultId: number,
  status: string
) {
  return prisma.mrpResult.update({
    where: { id: resultId },
    data: { status },
  });
}

/**
 * 저재고 파츠 조회
 */
export async function getLowStockParts() {
  // Get all active parts with inventory and filter by safety stock
  const parts = await prisma.part.findMany({
    where: {
      isActive: true,
    },
    include: {
      inventory: true,
      supplier: true,
      category: true,
    },
  });

  // Filter parts where inventory currentQty <= safetyStock
  return parts.filter((part) => {
    const currentQty = part.inventory?.currentQty ?? 0;
    return currentQty <= part.safetyStock;
  });
}
