import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, deletedResponse } from "@/lib/api-error";

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
    return handleApiError(error);
  }
}

// DELETE: 알림 삭제
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.notification.delete({
      where: { id: parseInt(id) },
    });

    return deletedResponse("알림이 삭제되었습니다.");
  } catch (error) {
    return handleApiError(error);
  }
}
