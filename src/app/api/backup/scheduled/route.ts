import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError, badRequest } from "@/lib/api-error";
import prisma from "@/lib/prisma";
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getActiveSchedules,
} from "@/lib/backup-scheduler";

// 스케줄 목록 조회 (ADMIN, MANAGER)
export async function GET() {
  try {
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const schedules = await getActiveSchedules();

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("스케줄 조회 오류:", error);
    return handleApiError(error);
  }
}

// 스케줄 생성 (ADMIN만)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();
    const { name, cronExpression, retentionCount } = body;

    if (!name || !cronExpression) {
      return handleApiError(badRequest("스케줄 이름과 cron 표현식이 필요합니다."));
    }

    // 간단한 cron 표현식 검증
    const parts = cronExpression.split(" ");
    if (parts.length !== 5) {
      return handleApiError(badRequest("잘못된 cron 표현식입니다. (예: 0 0 * * *)"));
    }

    const schedule = await createSchedule(name, cronExpression, {
      retentionCount: retentionCount || 30,
      createdBy: authResult.session.user.id,
    });

    return NextResponse.json({
      success: true,
      schedule,
    });
  } catch (error) {
    console.error("스케줄 생성 오류:", error);
    return handleApiError(error);
  }
}

// 스케줄 업데이트 (ADMIN만)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();
    const { id, name, cronExpression, retentionCount, isActive } = body;

    if (!id) {
      return handleApiError(badRequest("스케줄 ID가 필요합니다."));
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (cronExpression !== undefined) {
      const parts = cronExpression.split(" ");
      if (parts.length !== 5) {
        return handleApiError(badRequest("잘못된 cron 표현식입니다."));
      }
      updateData.cronExpression = cronExpression;
    }
    if (retentionCount !== undefined) updateData.retentionCount = retentionCount;
    if (isActive !== undefined) updateData.isActive = isActive;

    const schedule = await updateSchedule(id, updateData);

    return NextResponse.json({
      success: true,
      schedule,
    });
  } catch (error) {
    console.error("스케줄 업데이트 오류:", error);
    return handleApiError(error);
  }
}

// 스케줄 삭제 (ADMIN만)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return handleApiError(badRequest("스케줄 ID가 필요합니다."));
    }

    await deleteSchedule(parseInt(id, 10));

    return NextResponse.json({
      success: true,
      message: "스케줄이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("스케줄 삭제 오류:", error);
    return handleApiError(error);
  }
}
