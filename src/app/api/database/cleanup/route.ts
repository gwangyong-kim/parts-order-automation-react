import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 오래된 데이터 정리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cleanNotifications = true,
      cleanBulkUploadLogs = true,
      cleanActivityLogs = false,
      daysToKeep = 30
    } = body;

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const results: Record<string, number> = {};

    // 읽은 알림 정리
    if (cleanNotifications) {
      const deletedNotifications = await prisma.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      results.notifications = deletedNotifications.count;
    }

    // 대량 업로드 로그 정리
    if (cleanBulkUploadLogs) {
      const deletedLogs = await prisma.bulkUploadLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      results.bulkUploadLogs = deletedLogs.count;
    }

    // 사용자 활동 로그 정리 (선택적)
    if (cleanActivityLogs) {
      const deletedActivityLogs = await prisma.userActivityLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      results.activityLogs = deletedActivityLogs.count;
    }

    // SQLite VACUUM으로 디스크 공간 회수
    try {
      await prisma.$executeRawUnsafe("VACUUM");
      results.vacuumed = 1;
    } catch {
      results.vacuumed = 0;
    }

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0) - (results.vacuumed || 0);

    return NextResponse.json({
      success: true,
      message: `${totalDeleted}개의 오래된 레코드가 정리되었습니다.`,
      details: results,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error("데이터 정리 오류:", error);
    return NextResponse.json(
      { error: "데이터 정리에 실패했습니다." },
      { status: 500 }
    );
  }
}

// 정리 대상 미리보기
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysToKeep = parseInt(searchParams.get("daysToKeep") || "30");
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const [notificationsCount, bulkUploadLogsCount, activityLogsCount] = await Promise.all([
      prisma.notification.count({
        where: {
          isRead: true,
          createdAt: { lt: cutoffDate },
        },
      }),
      prisma.bulkUploadLog.count({
        where: {
          createdAt: { lt: cutoffDate },
        },
      }),
      prisma.userActivityLog.count({
        where: {
          createdAt: { lt: cutoffDate },
        },
      }),
    ]);

    return NextResponse.json({
      preview: {
        notifications: notificationsCount,
        bulkUploadLogs: bulkUploadLogsCount,
        activityLogs: activityLogsCount,
        total: notificationsCount + bulkUploadLogsCount + activityLogsCount,
      },
      cutoffDate: cutoffDate.toISOString(),
      daysToKeep,
    });
  } catch (error) {
    console.error("정리 미리보기 오류:", error);
    return NextResponse.json(
      { error: "미리보기를 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
