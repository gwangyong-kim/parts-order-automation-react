import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import {
  getBackupSettings,
  updateBackupSettings,
  getBackupHistory,
  checkDiskUsage,
} from "@/lib/backup-scheduler";

// 백업 설정 조회 (ADMIN, MANAGER)
export async function GET() {
  try {
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const [settings, history, diskUsage] = await Promise.all([
      getBackupSettings(),
      getBackupHistory(10),
      checkDiskUsage(),
    ]);

    return NextResponse.json({
      settings,
      history,
      diskUsage,
    });
  } catch (error) {
    console.error("백업 설정 조회 오류:", error);
    return handleApiError(error);
  }
}

// 백업 설정 업데이트 (ADMIN만)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();

    // 허용된 필드만 추출
    const allowedFields = [
      "autoBackupEnabled",
      "backupFrequency",
      "backupTime",
      "retentionDays",
      "maxBackupCount",
      "cloudBackupEnabled",
      "cloudProvider",
      "cloudBucket",
      "encryptionEnabled",
      "notifyOnSuccess",
      "notifyOnFailure",
      "slackWebhookUrl",
      "emailNotification",
      "diskThresholdGb",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const settings = await updateBackupSettings(
      updateData as Parameters<typeof updateBackupSettings>[0],
      authResult.session.user.id
    );

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("백업 설정 업데이트 오류:", error);
    return handleApiError(error);
  }
}
