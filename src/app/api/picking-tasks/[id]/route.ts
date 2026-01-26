import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const task = await prisma.pickingTask.findUnique({
      where: { id: parseInt(id) },
      include: {
        salesOrder: {
          select: {
            id: true,
            orderCode: true,
            project: true,
            dueDate: true,
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

    if (!task) {
      return NextResponse.json({ error: "Picking task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Failed to fetch picking task:", error);
    return NextResponse.json(
      { error: "Failed to fetch picking task" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Handle status transitions
    if (body.status === "IN_PROGRESS" && !body.startedAt) {
      updateData.startedAt = new Date();
    }
    if (body.status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    // Handle task revert action (COMPLETED -> IN_PROGRESS)
    if (body.action === "revert") {
      updateData.status = "IN_PROGRESS";
      updateData.completedAt = null;
    }

    const task = await prisma.pickingTask.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Failed to update picking task:", error);
    return NextResponse.json(
      { error: "Failed to update picking task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.pickingTask.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Picking task deleted successfully" });
  } catch (error) {
    console.error("Failed to delete picking task:", error);
    return NextResponse.json(
      { error: "Failed to delete picking task" },
      { status: 500 }
    );
  }
}
