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
}

interface FromMrpRequest {
  items: MrpOrderItem[];
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
    const { items, orderDate, expectedDate, notes } = body;

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

    // 공급업체별 그룹핑
    const bySupplier = new Map<number, { supplier: typeof parts[0]["supplier"]; items: Array<{ part: typeof parts[0]; orderQty: number }> }>();

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
      if (!bySupplier.has(supplierId)) {
        bySupplier.set(supplierId, {
          supplier: part.supplier,
          items: [],
        });
      }
      bySupplier.get(supplierId)!.items.push({ part, orderQty: item.orderQty });
    }

    const parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
    const createdOrders = [];

    // 공급업체별로 발주서 생성
    for (const [supplierId, group] of bySupplier) {
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

      // 발주서 생성
      const order = await prisma.order.create({
        data: {
          orderCode,
          supplierId,
          orderDate: parsedOrderDate,
          expectedDate: calcExpectedDate,
          status: "DRAFT",
          totalAmount,
          notes: notes || `MRP 기반 자동 발주 (${group.items.length}개 품목)`,
          items: {
            create: group.items.map((item) => ({
              partId: item.part.id,
              orderQty: item.orderQty,
              unitPrice: item.part.unitPrice || 0,
              totalPrice: item.orderQty * (item.part.unitPrice || 0),
              status: "PENDING",
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
