import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// Revert completed picking task - 완료된 피킹 작업 취소 (재고 복원 포함)
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);
    const body = await request.json().catch(() => ({}));
    const restoreInventory = body.restoreInventory !== false; // 기본값: true

    const task = await prisma.pickingTask.findUnique({
      where: { id: taskId },
      include: {
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Picking task not found" }, { status: 404 });
    }

    if (task.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Only completed tasks can be reverted" },
        { status: 400 }
      );
    }

    const revertedItems = [];

    // 재고 복원이 필요한 경우
    if (restoreInventory) {
      for (const item of task.items) {
        if (item.status === "PICKED" && item.pickedQty > 0) {
          // Get current inventory
          const inventory = await prisma.inventory.findUnique({
            where: { partId: item.partId },
          });

          if (inventory) {
            const beforeQty = inventory.currentQty;
            const afterQty = beforeQty + item.pickedQty;

            // Generate transaction code
            const txCount = await prisma.transaction.count();
            const transactionCode = `TRX-${Date.now()}-${txCount + 1}`;

            // Create inbound (reversal) transaction
            await prisma.transaction.create({
              data: {
                transactionCode,
                transactionType: "INBOUND",
                partId: item.partId,
                quantity: item.pickedQty,
                beforeQty,
                afterQty,
                referenceType: "PICK_REVERT",
                referenceId: task.taskCode,
                notes: `피킹 완료 취소 - ${task.taskCode}`,
                performedBy: body.performedBy || task.assignedTo,
              },
            });

            // Restore inventory
            await prisma.inventory.update({
              where: { partId: item.partId },
              data: {
                currentQty: afterQty,
              },
            });

            // Reset picking item status
            await prisma.pickingItem.update({
              where: { id: item.id },
              data: {
                status: "PENDING",
                pickedQty: 0,
                scannedAt: null,
                verifiedAt: null,
              },
            });

            revertedItems.push({
              partCode: item.part.partCode,
              partName: item.part.partName,
              restoredQty: item.pickedQty,
            });
          }
        } else if (item.status === "SKIPPED") {
          // 스킵된 아이템도 PENDING으로 되돌림
          await prisma.pickingItem.update({
            where: { id: item.id },
            data: {
              status: "PENDING",
              notes: null,
            },
          });
        }
      }
    }

    // Update task status back to IN_PROGRESS
    const revertedTask = await prisma.pickingTask.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
        completedAt: null,
        pickedItems: restoreInventory ? 0 : task.pickedItems,
      },
      include: {
        salesOrder: true,
        items: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json({
      task: revertedTask,
      revertedItems: revertedItems.length,
      inventoryRestored: restoreInventory,
      message: restoreInventory
        ? `피킹 작업이 취소되었습니다. ${revertedItems.length}건의 재고가 복원되었습니다.`
        : "피킹 작업 상태가 진행중으로 변경되었습니다.",
    });
  } catch (error) {
    console.error("Failed to revert picking task:", error);
    return NextResponse.json(
      { error: "Failed to revert picking task" },
      { status: 500 }
    );
  }
}
