import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const results = await prisma.mrpResult.findMany({
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
            unit: true,
            unitPrice: true,
            leadTimeDays: true,
            safetyStock: true,
            supplierId: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderCode: true,
            project: true,
            dueDate: true,
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    // Transform to match frontend expectations
    const transformedResults = results.map((result) => ({
      id: result.id,
      partId: result.partId,
      part: result.part ? {
        id: result.part.id,
        partCode: result.part.partCode,
        partNumber: result.part.partCode,
        partName: result.part.partName,
        unit: result.part.unit,
        unitPrice: result.part.unitPrice,
        leadTime: result.part.leadTimeDays,
        supplierId: result.part.supplierId,
        supplier: result.part.supplier,
      } : null,
      salesOrderId: result.salesOrderId,
      salesOrder: result.salesOrder ? {
        id: result.salesOrder.id,
        orderCode: result.salesOrder.orderCode,
        project: result.salesOrder.project,
      } : null,
      totalRequirement: result.grossRequirement,
      currentStock: result.currentStock,
      incomingQty: result.incomingQty,
      safetyStock: result.part?.safetyStock ?? 0,
      netRequirement: result.netRequirement,
      recommendedOrderQty: result.suggestedOrderQty,
      recommendedOrderDate: result.suggestedOrderDate,
      urgency: result.suggestedOrderDate
        ? getUrgencyLevel(result.suggestedOrderDate)
        : "LOW",
      status: result.status,  // 발주 상태 (PENDING, ORDERED 등)
      calculatedAt: result.createdAt,
    }));

    return NextResponse.json(transformedResults);
  } catch (error) {
    console.error("Failed to fetch MRP results:", error);
    return NextResponse.json(
      { error: "Failed to fetch MRP results" },
      { status: 500 }
    );
  }
}

function getUrgencyLevel(suggestedDate: Date): string {
  const now = new Date();
  const diffDays = Math.ceil((suggestedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "CRITICAL";
  if (diffDays <= 7) return "HIGH";
  if (diffDays <= 14) return "MEDIUM";
  return "LOW";
}
