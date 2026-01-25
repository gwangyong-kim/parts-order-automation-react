import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const salesOrders = await prisma.salesOrder.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(salesOrders);
  } catch (error) {
    console.error("Failed to fetch sales orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderCode: body.orderNumber || body.orderCode,
        division: body.customerName || body.division,
        manager: body.manager,
        project: body.project,
        orderDate: new Date(body.orderDate),
        dueDate: body.deliveryDate || body.dueDate ? new Date(body.deliveryDate || body.dueDate) : undefined,
        status: body.status || "RECEIVED",
        totalQty: body.totalAmount || body.totalQty || 0,
        notes: body.notes,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(salesOrder, { status: 201 });
  } catch (error) {
    console.error("Failed to create sales order:", error);
    return NextResponse.json(
      { error: "Failed to create sales order" },
      { status: 500 }
    );
  }
}
