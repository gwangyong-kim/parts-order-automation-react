import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// 발주 코드 자동 생성 (PO2501-0001 형식)
async function generateOrderCode(): Promise<string> {
  const today = new Date();
  const prefix = `PO${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;

  const lastOrder = await prisma.order.findFirst({
    where: { orderCode: { startsWith: prefix } },
    orderBy: { orderCode: "desc" },
  });

  if (lastOrder) {
    const lastNumber = parseInt(lastOrder.orderCode.split("-")[1]) || 0;
    return `${prefix}-${String(lastNumber + 1).padStart(4, "0")}`;
  }

  return `${prefix}-0001`;
}

interface MrpOrderItem {
  partId: number;
  orderQty: number;
  salesOrderId?: number | null;  // MRP 결과의 수주 ID
}

interface FromMrpRequest {
  items: MrpOrderItem[];
  salesOrderId?: number;  // SO 연결 (추적용) - 단일 수주인 경우
  skipDraft?: boolean;    // true면 ORDERED 상태로 바로 생성
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
}

/**
 * POST /api/orders/from-mrp
 * MRP 결과에서 선택된 품목으로 발주서 생성
 * 공급업체별로 자동 그룹핑하여 별도 발주서 생성
 */
export async function POST(request: Request) {
  try {
    const body: FromMrpRequest = await request.json();
    const { items, salesOrderId, skipDraft, orderDate, expectedDate, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "발주할 품목이 필요합니다" },
        { status: 400 }
      );
    }

    // 품목 정보 조회 (공급업체 포함)
    const partIds = items.map((item) => item.partId);
    const parts = await prisma.part.findMany({
      where: { id: { in: partIds } },
      include: { supplier: true },
    });

    // 품목 맵 생성
    const partMap = new Map(parts.map((p) => [p.id, p]));

    // 수주 ID 목록 수집 (MRP 상태 업데이트용)
    const itemSalesOrderIds = items
      .map((item) => item.salesOrderId)
      .filter((id): id is number => id != null);
    const allSalesOrderIds = salesOrderId
      ? [...new Set([salesOrderId, ...itemSalesOrderIds])]
      : [...new Set(itemSalesOrderIds)];

    // 수주 ID 목록 수집 (중복 제거)
    const salesOrderIds = [...new Set(items.map((item) => item.salesOrderId).filter((id): id is number => id != null))];

    // 수주 정보 일괄 조회
    const salesOrders = salesOrderIds.length > 0
      ? await prisma.salesOrder.findMany({
          where: { id: { in: salesOrderIds } },
          select: { id: true, orderCode: true, project: true },
        })
      : [];
    const salesOrderMap = new Map(salesOrders.map((so) => [so.id, so]));

    // 공급업체 + 프로젝트별 그룹핑
    // 키: "supplierId-salesOrderId" 또는 "supplierId-none"
    interface GroupItem {
      part: typeof parts[0];
      orderQty: number;
      salesOrderId: number | null;
    }
    interface OrderGroup {
      supplierId: number;
      supplier: typeof parts[0]["supplier"];
      salesOrderId: number | null;
      salesOrderCode: string | null;
      project: string | null;
      items: GroupItem[];
    }
    const groupMap = new Map<string, OrderGroup>();

    for (const item of items) {
      const part = partMap.get(item.partId);
      if (!part) {
        return NextResponse.json(
          { error: `품목을 찾을 수 없습니다: ID ${item.partId}` },
          { status: 400 }
        );
      }

      if (!part.supplierId || !part.supplier) {
        return NextResponse.json(
          { error: `품목 ${part.partCode}에 공급업체가 지정되지 않았습니다` },
          { status: 400 }
        );
      }

      const supplierId = part.supplierId;
      // salesOrderId 결정: item에 있으면 사용, 없으면 request body의 salesOrderId 사용
      const soId = item.salesOrderId ?? salesOrderId ?? null;
      const salesOrder = soId ? salesOrderMap.get(soId) : null;

      // 그룹 키: 공급업체ID + 프로젝트명 (프로젝트가 같으면 같은 발주로 묶음)
      const projectKey = salesOrder?.project || "none";
      const groupKey = `${supplierId}-${projectKey}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          supplierId,
          supplier: part.supplier,
          salesOrderId: soId,
          salesOrderCode: salesOrder?.orderCode || null,
          project: salesOrder?.project || null,
          items: [],
        });
      }
      groupMap.get(groupKey)!.items.push({ part, orderQty: item.orderQty, salesOrderId: soId });
    }

    const parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
    const createdOrders = [];

    // 공급업체 + 프로젝트별로 발주서 생성
    for (const [, group] of groupMap) {
      const orderCode = await generateOrderCode();

      // 발주 금액 계산
      const totalAmount = group.items.reduce(
        (sum, item) => sum + item.orderQty * (item.part.unitPrice || 0),
        0
      );

      // 예상 납기일 계산 (공급업체 리드타임 또는 입력값)
      const calcExpectedDate = expectedDate
        ? new Date(expectedDate)
        : (() => {
            const leadTime = group.supplier?.leadTimeDays || 7;
            const date = new Date(parsedOrderDate);
            date.setDate(date.getDate() + leadTime);
            return date;
          })();

      // 발주 상태 결정 (skipDraft가 true면 ORDERED로 바로 생성)
      const orderStatus = skipDraft ? "ORDERED" : "DRAFT";
      const itemStatus = skipDraft ? "ORDERED" : "PENDING";

      // 비고 생성 (프로젝트 정보 포함)
      const autoNotes = group.project
        ? `MRP 기반 자동 발주 (${group.items.length}개 품목) - [${group.project}]`
        : `MRP 기반 자동 발주 (${group.items.length}개 품목)`;

      // 발주서 생성
      const order = await prisma.order.create({
        data: {
          orderCode,
          supplierId: group.supplierId,
          project: group.project,
          orderDate: parsedOrderDate,
          expectedDate: calcExpectedDate,
          status: orderStatus,
          totalAmount,
          notes: notes || autoNotes,
          items: {
            create: group.items.map((item) => ({
              partId: item.part.id,
              orderQty: item.orderQty,
              unitPrice: item.part.unitPrice || 0,
              totalPrice: item.orderQty * (item.part.unitPrice || 0),
              status: itemStatus,
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              part: true,
            },
          },
        },
      });

      createdOrders.push({
        id: order.id,
        orderCode: order.orderCode,
        supplierName: order.supplier?.name || "Unknown",
        project: group.project,
        itemCount: order.items.length,
        totalAmount: order.totalAmount,
        status: order.status,
        items: order.items.map((item) => ({
          partCode: item.part.partCode,
          partName: item.part.partName,
          orderQty: item.orderQty,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      });
    }

    // MrpResult 상태 업데이트: 발주된 항목은 ORDERED로 변경
    if (allSalesOrderIds.length > 0) {
      await prisma.mrpResult.updateMany({
        where: {
          salesOrderId: { in: allSalesOrderIds },
          partId: { in: partIds },
          status: { not: "ORDERED" },
        },
        data: { status: "ORDERED" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        purchaseOrders: createdOrders,
        totalOrders: createdOrders.length,
        totalItems: items.length,
        totalAmount: createdOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      },
    });
  } catch (error) {
    console.error("Error creating orders from MRP:", error);
    return handleApiError(error);
  }
}
