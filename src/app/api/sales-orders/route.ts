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

    return NextResponse.json(salesOrder, { status: 201 });
  } catch (error) {
    console.error("Failed to create sales order:", error);
    return NextResponse.json(
      { error: "Failed to create sales order" },
      { status: 500 }
    );
  }
}
