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

    // Get current item info for inventory operations
    const currentItem = await prisma.pickingItem.findUnique({
      where: { id: itemId },
      include: { pickingTask: true },
    });

    if (!currentItem) {
      return NextResponse.json({ error: "Picking item not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    let outboundTransaction = null;
    let inboundTransaction = null;

    // Handle pick action - 즉시 출고 처리
    if (body.action === "pick") {
      const pickedQty = body.pickedQty ?? currentItem.requiredQty;
      updateData.status = "PICKED";
      updateData.pickedQty = pickedQty;
      updateData.verifiedAt = new Date();

      // 재고 차감 (출고)
      const inventory = await prisma.inventory.findUnique({
        where: { partId: currentItem.partId },
      });

      if (inventory && pickedQty > 0) {
        const beforeQty = inventory.currentQty;
        const afterQty = beforeQty - pickedQty;

        // Generate transaction code
        const txCount = await prisma.transaction.count();
        const transactionCode = `TRX-${Date.now()}-${txCount + 1}`;

        // Create outbound transaction
        outboundTransaction = await prisma.transaction.create({
          data: {
            transactionCode,
            transactionType: "OUTBOUND",
            partId: currentItem.partId,
            quantity: pickedQty,
            beforeQty,
            afterQty,
            referenceType: "PICK",
            referenceId: currentItem.pickingTask.taskCode,
            notes: `피킹 출고 - ${currentItem.pickingTask.taskCode}`,
            performedBy: body.performedBy || currentItem.pickingTask.assignedTo,
          },
        });

        // Update inventory
        await prisma.inventory.update({
          where: { partId: currentItem.partId },
          data: {
            currentQty: afterQty,
            lastOutboundDate: new Date(),
          },
        });
      }
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

    // Handle revert-skip action (SKIPPED -> PENDING)
    if (body.action === "revert-skip") {
      updateData.status = "PENDING";
      updateData.notes = body.notes ?? null;
    }

    // Handle revert-pick action (PICKED -> PENDING) - 출고 취소 처리
    if (body.action === "revert-pick") {
      // 이미 피킹된 수량이 있으면 재고 복원
      if (currentItem.status === "PICKED" && currentItem.pickedQty > 0) {
        const inventory = await prisma.inventory.findUnique({
          where: { partId: currentItem.partId },
        });

        if (inventory) {
          const beforeQty = inventory.currentQty;
          const afterQty = beforeQty + currentItem.pickedQty;

          // Generate transaction code
          const txCount = await prisma.transaction.count();
          const transactionCode = `TRX-${Date.now()}-${txCount + 1}`;

          // Create inbound (reversal) transaction
          inboundTransaction = await prisma.transaction.create({
            data: {
              transactionCode,
              transactionType: "INBOUND",
              partId: currentItem.partId,
              quantity: currentItem.pickedQty,
              beforeQty,
              afterQty,
              referenceType: "PICK_REVERT",
              referenceId: currentItem.pickingTask.taskCode,
              notes: `피킹 취소 - ${currentItem.pickingTask.taskCode}`,
              performedBy: body.performedBy || currentItem.pickingTask.assignedTo,
            },
          });

          // Restore inventory
          await prisma.inventory.update({
            where: { partId: currentItem.partId },
            data: {
              currentQty: afterQty,
            },
          });
        }
      }

      updateData.status = "PENDING";
      updateData.pickedQty = 0;
      updateData.scannedAt = null;
      updateData.verifiedAt = null;
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

    return NextResponse.json({
      ...item,
      outboundTransaction,
      inboundTransaction,
    });
  } catch (error) {
    console.error("Failed to update picking item:", error);
    return NextResponse.json(
      { error: "Failed to update picking item" },
      { status: 500 }
    );
  }
}
