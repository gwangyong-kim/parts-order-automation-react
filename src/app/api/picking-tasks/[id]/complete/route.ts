import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// Complete picking task and create outbound transactions
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);
    const body = await request.json();

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

    if (task.status === "COMPLETED") {
      return NextResponse.json({ error: "Task already completed" }, { status: 400 });
    }

    // Create outbound transactions for each picked item
    const transactions = [];
    for (const item of task.items) {
      if (item.status === "PICKED" && item.pickedQty > 0) {
        // Get current inventory
        const inventory = await prisma.inventory.findUnique({
          where: { partId: item.partId },
        });

        if (!inventory) continue;

        const beforeQty = inventory.currentQty;
        const afterQty = beforeQty - item.pickedQty;

        // Generate transaction code
        const txCount = await prisma.transaction.count();
        const transactionCode = `TRX-${Date.now()}-${txCount + 1}`;

        // Create transaction
        const transaction = await prisma.transaction.create({
          data: {
            transactionCode,
            transactionType: "OUTBOUND",
            partId: item.partId,
            quantity: item.pickedQty,
            beforeQty,
            afterQty,
            referenceType: "PICK",
            referenceId: task.taskCode,
            notes: `피킹 완료 - ${task.taskCode}`,
            performedBy: body.performedBy || task.assignedTo,
          },
        });

        transactions.push(transaction);

        // Update inventory
        await prisma.inventory.update({
          where: { partId: item.partId },
          data: {
            currentQty: afterQty,
            lastOutboundDate: new Date(),
          },
        });
      }
    }

    // Update task status
    const completedTask = await prisma.pickingTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        pickedItems: task.items.filter(
          (i) => i.status === "PICKED" || i.status === "SKIPPED"
        ).length,
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
      task: completedTask,
      transactions: transactions.length,
      message: `피킹 작업이 완료되었습니다. ${transactions.length}건의 출고가 처리되었습니다.`,
    });
  } catch (error) {
    console.error("Failed to complete picking task:", error);
    return NextResponse.json(
      { error: "Failed to complete picking task" },
      { status: 500 }
    );
  }
}
