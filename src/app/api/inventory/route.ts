import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        include: {
          part: {
            select: {
              id: true,
              partCode: true,
              partName: true,
              unit: true,
              safetyStock: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.inventory.count(),
    ]);

    // Transform to match frontend expectations
    const transformedInventory = inventory.map((item) => ({
      ...item,
      availableQty: item.currentQty - item.reservedQty,
      part: item.part ? {
        ...item.part,
        partNumber: item.part.partCode,
      } : null,
    }));

    return NextResponse.json({
      data: transformedInventory,
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
