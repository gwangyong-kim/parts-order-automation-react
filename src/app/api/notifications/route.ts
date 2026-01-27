import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError, createdResponse } from "@/lib/api-error";

// GET: 알림 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const notifications = await prisma.notification.findMany({
      where: unreadOnly ? { isRead: false } : undefined,
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { isRead: false },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: 알림 생성
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const notification = await prisma.notification.create({
      data: {
        userId: body.userId || null,
        title: body.title,
        message: body.message,
        type: body.type || "INFO",
        category: body.category || "SYSTEM",
        link: body.link || null,
      },
    });

    return createdResponse(notification);
  } catch (error) {
    return handleApiError(error);
  }
}
