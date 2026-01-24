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
        orderNumber: body.orderNumber,
        customerName: body.customerName,
        orderDate: new Date(body.orderDate),
        deliveryDate: new Date(body.deliveryDate),
        status: body.status || "PENDING",
        totalAmount: body.totalAmount || 0,
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
