import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getUrgency(daysUntil: number): string {
  if (daysUntil <= 0) return "CRITICAL";
  if (daysUntil <= 7) return "HIGH";
  if (daysUntil <= 14) return "MEDIUM";
  return "LOW";
}

export async function POST() {
  try {
    // Clear existing MRP results
    await prisma.mrpResult.deleteMany({});

    // Get all active parts with inventory
    const parts = await prisma.part.findMany({
      where: { isActive: true },
      include: {
        inventory: true,
        bomItems: {
          include: {
            product: {
              include: {
                salesOrderItems: {
                  include: {
                    salesOrder: true,
                  },
                  where: {
                    salesOrder: {
                      status: {
                        in: ["PENDING", "CONFIRMED", "IN_PRODUCTION"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderItems: {
          where: {
            order: {
              status: {
                in: ["APPROVED", "ORDERED"],
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const results = [];

    for (const part of parts) {
      // Calculate total requirement from sales orders
      let totalRequirement = 0;
      let earliestDeliveryDate: Date | null = null;

      for (const bomItem of part.bomItems) {
        for (const salesOrderItem of bomItem.product.salesOrderItems) {
          const quantity = salesOrderItem.orderQty * bomItem.quantity * (1 + bomItem.lossRate);
          totalRequirement += quantity;

          const deliveryDate = new Date(salesOrderItem.salesOrder.deliveryDate);
          if (!earliestDeliveryDate || deliveryDate < earliestDeliveryDate) {
            earliestDeliveryDate = deliveryDate;
          }
        }
      }

      // Get current stock
      const currentStock = part.inventory?.currentQty || 0;

      // Get incoming orders
      const incomingQty = part.orderItems.reduce((sum, item) => sum + item.quantity, 0);

      // Calculate net requirement
      const availableStock = currentStock + incomingQty - part.safetyStock;
      const netRequirement = Math.max(0, totalRequirement - availableStock);

      // Calculate recommended order quantity
      const recommendedOrderQty = netRequirement > 0
        ? Math.max(netRequirement, part.minOrderQty)
        : 0;

      // Calculate recommended order date
      let recommendedOrderDate: Date | null = null;
      if (earliestDeliveryDate && recommendedOrderQty > 0) {
        recommendedOrderDate = new Date(earliestDeliveryDate);
        recommendedOrderDate.setDate(recommendedOrderDate.getDate() - part.leadTime);
      }

      // Determine urgency
      const daysUntil = earliestDeliveryDate
        ? Math.floor((earliestDeliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const urgency = getUrgency(daysUntil);

      // Create MRP result
      const result = await prisma.mrpResult.create({
        data: {
          partId: part.id,
          totalRequirement: Math.round(totalRequirement),
          currentStock,
          incomingQty,
          safetyStock: part.safetyStock,
          netRequirement: Math.round(netRequirement),
          recommendedOrderQty: Math.round(recommendedOrderQty),
          recommendedOrderDate,
          urgency,
          calculatedAt: now,
        },
        include: {
          part: true,
        },
      });

      results.push(result);
    }

    return NextResponse.json({
      message: "MRP calculation completed",
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Failed to run MRP calculation:", error);
    return NextResponse.json(
      { error: "Failed to run MRP calculation" },
      { status: 500 }
    );
  }
}
