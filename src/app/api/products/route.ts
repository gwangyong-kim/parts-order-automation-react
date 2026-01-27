import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, createdResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        include: {
          bomItems: {
            include: {
              part: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      data: products,
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

    return createdResponse(product);
  } catch (error) {
    return handleApiError(error);
  }
}
