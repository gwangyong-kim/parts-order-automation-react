import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface PickingLocationInfo {
  taskId: number;
  taskCode: string;
  status: "pending" | "in_progress" | "completed";
  items: {
    id: number;
    partId: number;
    partCode: string;
    partName: string;
    unit: string;
    requiredQty: number;
    pickedQty: number;
    status: string;
    notes: string | null;
  }[];
  totalRequired: number;
  totalPicked: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouseId");

    // Fetch active picking tasks (PENDING or IN_PROGRESS)
    const tasks = await prisma.pickingTask.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
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
      orderBy: [
        { status: "asc" }, // IN_PROGRESS first
        { priority: "asc" },
        { createdAt: "asc" },
      ],
    });

    // Build location summary
    const locationSummary: Record<string, PickingLocationInfo> = {};

    for (const task of tasks) {
      for (const item of task.items) {
        const locationCode = item.storageLocation;

        if (!locationSummary[locationCode]) {
          locationSummary[locationCode] = {
            taskId: task.id,
            taskCode: task.taskCode,
            status: task.status === "IN_PROGRESS" ? "in_progress" : "pending",
            items: [],
            totalRequired: 0,
            totalPicked: 0,
          };
        }

        // Determine location status based on items
        const locationStatus =
          item.status === "PICKED" || item.status === "SKIPPED" ? "completed" :
          item.status === "IN_PROGRESS" ? "in_progress" : "pending";

        // Update location status if any item is in progress or pending
        if (locationStatus === "in_progress") {
          locationSummary[locationCode].status = "in_progress";
        } else if (locationStatus === "pending" && locationSummary[locationCode].status !== "in_progress") {
          locationSummary[locationCode].status = "pending";
        }

        locationSummary[locationCode].items.push({
          id: item.id,
          partId: item.partId,
          partCode: item.part?.partCode || "",
          partName: item.part?.partName || "",
          unit: item.part?.unit || "",
          requiredQty: item.requiredQty,
          pickedQty: item.pickedQty,
          status: item.status,
          notes: item.notes,
        });

        locationSummary[locationCode].totalRequired += item.requiredQty;
        locationSummary[locationCode].totalPicked += item.pickedQty;
      }
    }

    // Check if all items at location are completed
    for (const locationCode in locationSummary) {
      const loc = locationSummary[locationCode];
      const allCompleted = loc.items.every(
        (item) => item.status === "PICKED" || item.status === "SKIPPED"
      );
      if (allCompleted && loc.items.length > 0) {
        locationSummary[locationCode].status = "completed";
      }
    }

    return NextResponse.json({
      tasks,
      locationSummary,
    });
  } catch (error) {
    console.error("Failed to fetch active picking tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch active picking tasks" },
      { status: 500 }
    );
  }
}
