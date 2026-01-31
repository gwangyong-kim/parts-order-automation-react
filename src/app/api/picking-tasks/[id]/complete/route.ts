import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// Complete picking task (출고는 개별 피킹 시 이미 처리됨)
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);

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

    // 개별 피킹 시 이미 출고가 처리되었으므로, 여기서는 상태만 업데이트
    const pickedItemsCount = task.items.filter(
      (i) => i.status === "PICKED" || i.status === "SKIPPED"
    ).length;

    // Update task status
    const completedTask = await prisma.pickingTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        pickedItems: pickedItemsCount,
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

    const actualPickedCount = task.items.filter((i) => i.status === "PICKED").length;

    return NextResponse.json({
      task: completedTask,
      pickedItems: actualPickedCount,
      skippedItems: pickedItemsCount - actualPickedCount,
      message: `피킹 작업이 완료되었습니다. (피킹: ${actualPickedCount}건, 스킵: ${pickedItemsCount - actualPickedCount}건)`,
    });
  } catch (error) {
    console.error("Failed to complete picking task:", error);
    return NextResponse.json(
      { error: "Failed to complete picking task" },
      { status: 500 }
    );
  }
}
