import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assignedTo");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;

    const tasks = await prisma.pickingTask.findMany({
      where,
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
        { status: "asc" },
        { priority: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Failed to fetch picking tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch picking tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Generate task code
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await prisma.pickingTask.count({
      where: {
        taskCode: { startsWith: `PICK-${dateStr}` },
      },
    });
    const taskCode = `PICK-${dateStr}-${String(count + 1).padStart(3, "0")}`;

    const task = await prisma.pickingTask.create({
      data: {
        taskCode,
        salesOrderId: body.salesOrderId || null,
        transactionId: body.transactionId || null,
        priority: body.priority || "NORMAL",
        status: "PENDING",
        assignedTo: body.assignedTo || null,
        notes: body.notes || null,
        createdBy: body.createdBy || null,
        totalItems: body.items?.length || 0,
        items: body.items
          ? {
              create: body.items.map(
                (
                  item: {
                    partId: number;
                    storageLocation: string;
                    requiredQty: number;
                  },
                  index: number
                ) => ({
                  partId: item.partId,
                  storageLocation: item.storageLocation,
                  requiredQty: item.requiredQty,
                  sequence: index + 1,
                })
              ),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create picking task:", error);
    return NextResponse.json(
      { error: "Failed to create picking task" },
      { status: 500 }
    );
  }
}
