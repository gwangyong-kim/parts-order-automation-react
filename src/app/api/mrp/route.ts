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
            leadTimeDays: true,
            safetyStock: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderCode: true,
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
      ...result,
      part: result.part ? {
        ...result.part,
        partNumber: result.part.partCode,
        leadTime: result.part.leadTimeDays,
      } : null,
      // Calculate urgency based on suggested order date
      urgency: result.suggestedOrderDate
        ? getUrgencyLevel(result.suggestedOrderDate)
        : "LOW",
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
