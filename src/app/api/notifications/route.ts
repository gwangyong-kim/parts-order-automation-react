import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: "알림을 불러오는데 실패했습니다." },
      { status: 500 }
    );
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

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return NextResponse.json(
      { error: "알림 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
