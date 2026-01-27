import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createOrderCreatedNotification } from "@/services/notification.service";
import { handleApiError, createdResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          supplier: true,
          items: {
            include: {
              part: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.order.count(),
    ]);

    // Transform to match frontend expectations
    const transformedOrders = orders.map((order) => ({
      ...order,
      orderNumber: order.orderCode,
      totalAmount: order.totalAmount || 0,
    }));

    return NextResponse.json({
      data: transformedOrders,
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
    const body = await request.json();

    const order = await prisma.order.create({
      data: {
        orderCode: body.orderNumber || `ORD-${Date.now()}`,
        supplierId: body.supplierId,
        orderDate: new Date(body.orderDate),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        status: body.status || "DRAFT",
        totalAmount: body.totalAmount || 0,
        notes: body.notes,
        createdBy: body.createdBy || null,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    // 발주 생성 알림 (비동기)
    createOrderCreatedNotification(
      order.orderCode,
      order.supplier?.name || "알 수 없음",
      order.totalAmount || 0
    ).catch(console.error);

    return createdResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}
