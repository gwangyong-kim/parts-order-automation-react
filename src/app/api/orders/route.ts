import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            part: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to match frontend expectations
    const transformedOrders = orders.map((order) => ({
      ...order,
      orderNumber: order.orderCode,
      totalAmount: order.totalAmount || 0,
    }));

    return NextResponse.json(transformedOrders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
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

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
