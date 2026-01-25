import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// Parse storage location and return zone/row/shelf for sorting
function parseLocation(location: string | null): { zone: string; row: number; shelf: number } {
  if (!location) return { zone: "ZZZ", row: 999, shelf: 999 };
  const parts = location.split("-");
  return {
    zone: parts[0] || "ZZZ",
    row: parseInt(parts[1]) || 999,
    shelf: parseInt(parts[2]) || 999,
  };
}

// Create picking task from sales order
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const salesOrderId = parseInt(id);

    // Get sales order with items and BOM
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                bomItems: {
                  where: { isActive: true },
                  include: {
                    part: {
                      include: { inventory: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!salesOrder) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    // Check if picking task already exists
    const existingTask = await prisma.pickingTask.findFirst({
      where: { salesOrderId },
    });

    if (existingTask) {
      return NextResponse.json(
        { error: "Picking task already exists for this sales order", taskId: existingTask.id },
        { status: 400 }
      );
    }

    // Aggregate parts needed from BOM
    const partsNeeded = new Map<
      number,
      {
        partId: number;
        partCode: string;
        partName: string;
        unit: string;
        storageLocation: string | null;
        requiredQty: number;
      }
    >();

    for (const item of salesOrder.items) {
      for (const bomItem of item.product.bomItems) {
        const neededQty = Math.ceil(
          item.orderQty * bomItem.quantityPerUnit * (1 + (bomItem.lossRate - 1))
        );
        const existing = partsNeeded.get(bomItem.partId);

        if (existing) {
          existing.requiredQty += neededQty;
        } else {
          partsNeeded.set(bomItem.partId, {
            partId: bomItem.partId,
            partCode: bomItem.part.partCode,
            partName: bomItem.part.partName,
            unit: bomItem.part.unit,
            storageLocation: bomItem.part.storageLocation,
            requiredQty: neededQty,
          });
        }
      }
    }

    if (partsNeeded.size === 0) {
      return NextResponse.json(
        { error: "No parts found in BOM for this sales order" },
        { status: 400 }
      );
    }

    // Sort parts by location for optimal picking route (Zone -> Row -> Shelf)
    const sortedParts = Array.from(partsNeeded.values()).sort((a, b) => {
      const locA = parseLocation(a.storageLocation);
      const locB = parseLocation(b.storageLocation);

      if (locA.zone !== locB.zone) return locA.zone.localeCompare(locB.zone);
      if (locA.row !== locB.row) return locA.row - locB.row;
      return locA.shelf - locB.shelf;
    });

    // Generate task code
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.pickingTask.count({
      where: {
        taskCode: { startsWith: `PICK-${dateStr}` },
      },
    });
    const taskCode = `PICK-${dateStr}-${String(count + 1).padStart(3, "0")}`;

    // Create picking task with items
    const task = await prisma.pickingTask.create({
      data: {
        taskCode,
        salesOrderId,
        priority: salesOrder.dueDate
          ? new Date(salesOrder.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            ? "HIGH"
            : "NORMAL"
          : "NORMAL",
        status: "PENDING",
        totalItems: sortedParts.length,
        notes: `수주 ${salesOrder.orderCode}${salesOrder.project ? ` - ${salesOrder.project}` : ""}`,
        items: {
          create: sortedParts.map((part, index) => ({
            partId: part.partId,
            storageLocation: part.storageLocation || "UNKNOWN",
            requiredQty: part.requiredQty,
            sequence: index + 1,
          })),
        },
      },
      include: {
        salesOrder: {
          select: {
            id: true,
            orderCode: true,
            project: true,
          },
        },
        items: {
          include: {
            part: {
              select: {
                id: true,
                partCode: true,
                partName: true,
                unit: true,
              },
            },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create picking task from sales order:", error);
    return NextResponse.json(
      { error: "Failed to create picking task from sales order" },
      { status: 500 }
    );
  }
}
