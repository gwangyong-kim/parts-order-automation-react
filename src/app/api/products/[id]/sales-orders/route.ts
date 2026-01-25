import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    // Get sales order items for this product with related sales order
    const salesOrderItems = await prisma.salesOrderItem.findMany({
      where: { productId },
      include: {
        salesOrder: true,
      },
      orderBy: {
        salesOrder: {
          orderDate: "desc",
        },
      },
      take: 20,
    });

    return NextResponse.json(salesOrderItems);
  } catch (error) {
    console.error("Failed to fetch product sales orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch product sales orders" },
      { status: 500 }
    );
  }
}
