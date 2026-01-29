import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, createdResponse } from "@/lib/api-error";
import { requireAuth, requireOperator } from "@/lib/authorization";
import { calculateMrp } from "@/services/mrp.service";

export async function GET(request: Request) {
  try {
    // 모든 인증된 사용자 조회 가능
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [salesOrders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.salesOrder.count(),
    ]);

    return NextResponse.json({
      data: salesOrders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    // OPERATOR 이상만 생성 가능
    const authResult = await requireOperator();
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();

    // Generate order code if not provided
    let orderCode = body.orderNumber || body.orderCode;
    if (!orderCode) {
      const today = new Date();
      const yearMonth = `${today.getFullYear().toString().slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}`;
      const prefix = `SO${yearMonth}-`;

      // Find the latest order with this prefix
      const latestOrder = await prisma.salesOrder.findFirst({
        where: {
          orderCode: { startsWith: prefix },
        },
        orderBy: { orderCode: "desc" },
      });

      let nextNumber = 1;
      if (latestOrder) {
        const lastNumber = parseInt(latestOrder.orderCode.split("-")[1] || "0", 10);
        nextNumber = lastNumber + 1;
      }
      orderCode = `${prefix}${String(nextNumber).padStart(4, "0")}`;
    }

    // Calculate total quantity from items
    const items = body.items || [];
    const totalQty = items.reduce((sum: number, item: { orderQty?: number }) => sum + (item.orderQty || 0), 0);

    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderCode,
        division: body.customerName || body.division,
        manager: body.manager,
        project: body.project,
        orderDate: new Date(body.orderDate),
        dueDate: body.deliveryDate || body.dueDate ? new Date(body.deliveryDate || body.dueDate) : undefined,
        status: body.status || "PENDING",
        totalQty: totalQty || body.totalAmount || body.totalQty || 0,
        notes: body.notes,
        // Create items if provided
        items: items.length > 0
          ? {
              create: items.map((item: { productId: number; orderQty: number; notes?: string }) => ({
                productId: item.productId,
                orderQty: item.orderQty,
                notes: item.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // MRP 자동 재계산 (비동기)
    calculateMrp({ clearExisting: true }).catch((err) => {
      console.error("MRP 자동 계산 실패:", err);
    });

    return createdResponse(salesOrder);
  } catch (error) {
    return handleApiError(error);
  }
}
