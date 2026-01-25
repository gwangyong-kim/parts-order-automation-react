import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        bomItems: {
          include: {
            part: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const product = await prisma.product.create({
      data: {
        productCode: body.productCode,
        productName: body.productName,
        description: body.description,
        bomItems: body.bomItems?.length > 0
          ? {
              create: body.bomItems.map((item: {
                partId: number;
                quantityPerUnit: number;
                lossRate?: number;
                notes?: string;
              }) => ({
                partId: item.partId,
                quantityPerUnit: item.quantityPerUnit,
                lossRate: item.lossRate || 0,
                notes: item.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        bomItems: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
