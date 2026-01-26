import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const itemId = parseInt(id);

    const updateData: Record<string, unknown> = {};

    // Handle pick action
    if (body.action === "pick") {
      updateData.status = "PICKED";
      updateData.pickedQty = body.pickedQty ?? body.requiredQty;
      updateData.verifiedAt = new Date();
    }

    // Handle scan action
    if (body.action === "scan") {
      updateData.scannedAt = new Date();
      updateData.status = "IN_PROGRESS";
    }

    // Handle skip action
    if (body.action === "skip") {
      updateData.status = "SKIPPED";
      updateData.notes = body.notes || "Skipped";
    }

    // Handle flag action (report issue)
    if (body.action === "flag") {
      updateData.status = "SKIPPED";
      const flagType = body.flagType || "other";
      const flagNotes = body.notes || "";
      updateData.notes = `[FLAGGED: ${flagType}] ${flagNotes}`.trim();
    }

    // Direct status update
    if (body.status !== undefined) updateData.status = body.status;
    if (body.pickedQty !== undefined) updateData.pickedQty = body.pickedQty;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const item = await prisma.pickingItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        part: {
          select: {
            id: true,
            partCode: true,
            partName: true,
            unit: true,
          },
        },
        pickingTask: true,
      },
    });

    // Update task progress
    const taskItems = await prisma.pickingItem.findMany({
      where: { pickingTaskId: item.pickingTaskId },
    });

    const pickedCount = taskItems.filter(
      (i) => i.status === "PICKED" || i.status === "SKIPPED"
    ).length;

    await prisma.pickingTask.update({
      where: { id: item.pickingTaskId },
      data: { pickedItems: pickedCount },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update picking item:", error);
    return NextResponse.json(
      { error: "Failed to update picking item" },
      { status: 500 }
    );
  }
}
