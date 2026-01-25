import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!salesOrder) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    return NextResponse.json(salesOrder);
  } catch (error) {
    console.error("Failed to fetch sales order:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales order" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const salesOrder = await prisma.salesOrder.update({
      where: { id: parseInt(id) },
      data: {
        orderCode: body.orderNumber || body.orderCode,
        division: body.customerName || body.division,
        manager: body.manager,
        project: body.project,
        orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
        dueDate: body.deliveryDate || body.dueDate ? new Date(body.deliveryDate || body.dueDate) : undefined,
        status: body.status,
        totalQty: body.totalAmount || body.totalQty,
        notes: body.notes,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json(salesOrder);
  } catch (error) {
    console.error("Failed to update sales order:", error);
    return NextResponse.json(
      { error: "Failed to update sales order" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Delete associated items first, then the order
    await prisma.salesOrderItem.deleteMany({
      where: { salesOrderId: parseInt(id) },
    });

    await prisma.salesOrder.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Sales order deleted successfully" });
  } catch (error) {
    console.error("Failed to delete sales order:", error);
    return NextResponse.json(
      { error: "Failed to delete sales order" },
      { status: 500 }
    );
  }
}
