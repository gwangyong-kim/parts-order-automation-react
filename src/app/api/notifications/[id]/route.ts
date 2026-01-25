import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// PUT: 알림 읽음 표시
export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const notification = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Failed to update notification:", error);
    return NextResponse.json(
      { error: "알림 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 알림 삭제
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.notification.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "알림이 삭제되었습니다." });
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return NextResponse.json(
      { error: "알림 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
