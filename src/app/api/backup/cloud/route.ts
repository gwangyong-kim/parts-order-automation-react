import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import {
  isGCSConfigured,
  testGCSConnection,
  listGCSBackups,
  getGCSUsage,
} from "@/lib/gcs-storage";

// GCS 백업 목록 및 상태 조회 (ADMIN, MANAGER)
export async function GET() {
  try {
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    // GCS 설정 여부 확인
    if (!isGCSConfigured()) {
      return NextResponse.json({
        configured: false,
        message: "GCS가 설정되지 않았습니다. 환경 변수를 확인하세요.",
        requiredEnvVars: [
          "GCS_BUCKET_NAME",
          "GCS_PROJECT_ID 또는 GCS_KEY_FILE 또는 GCS_CREDENTIALS",
        ],
      });
    }

    // 연결 테스트
    const connectionTest = await testGCSConnection();
    if (!connectionTest.success) {
      return NextResponse.json({
        configured: true,
        connected: false,
        message: connectionTest.message,
      });
    }

    // 백업 목록 및 사용량 조회
    const [backups, usage] = await Promise.all([
      listGCSBackups(),
      getGCSUsage(),
    ]);

    return NextResponse.json({
      configured: true,
      connected: true,
      bucketName: connectionTest.bucketName,
      backups,
      usage,
    });
  } catch (error) {
    console.error("GCS 백업 조회 오류:", error);
    return handleApiError(error);
  }
}
