import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createOrderStatusChangedNotification } from "@/services/notification.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        supplier: true,
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 기존 주문 조회 (상태 변경 감지용)
    const existingOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
    });

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        orderCode: body.orderNumber,
        supplierId: body.supplierId,
        orderDate: new Date(body.orderDate),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        status: body.status,
        totalAmount: body.totalAmount,
        notes: body.notes,
        approvedBy: body.approvedBy,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : null,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    // 상태가 변경된 경우 알림 생성
    if (existingOrder && existingOrder.status !== body.status) {
      createOrderStatusChangedNotification(
        order.orderCode,
        body.status
      ).catch(console.error);
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Delete associated items first, then the order
    await prisma.orderItem.deleteMany({
      where: { orderId: parseInt(id) },
    });

    await prisma.order.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
