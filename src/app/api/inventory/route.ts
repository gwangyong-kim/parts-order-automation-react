import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const inventory = await prisma.inventory.findMany({
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
    });

    // Transform to match frontend expectations
    const transformedInventory = inventory.map((item) => ({
      ...item,
      availableQty: item.currentQty - item.reservedQty,
      part: item.part ? {
        ...item.part,
        partNumber: item.part.partCode,
      } : null,
    }));

    return NextResponse.json(transformedInventory);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}
