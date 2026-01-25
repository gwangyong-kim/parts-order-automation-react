import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST: 모든 알림 읽음 표시
export async function POST() {
  try {
    const result = await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({
      message: "모든 알림을 읽음 처리했습니다.",
      count: result.count,
    });
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return NextResponse.json(
      { error: "알림 읽음 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
