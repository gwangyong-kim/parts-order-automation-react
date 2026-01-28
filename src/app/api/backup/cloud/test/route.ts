import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { isGCSConfigured, testGCSConnection } from "@/lib/gcs-storage";

// GCS 연결 테스트 (ADMIN)
export async function GET() {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    // 설정 확인
    const configured = isGCSConfigured();
    const envStatus = {
      GCS_PROJECT_ID: !!process.env.GCS_PROJECT_ID,
      GCS_BUCKET_NAME: !!process.env.GCS_BUCKET_NAME,
      GCS_KEY_FILE: !!process.env.GCS_KEY_FILE,
      GCS_CREDENTIALS: !!process.env.GCS_CREDENTIALS,
      GCS_BACKUP_PREFIX: process.env.GCS_BACKUP_PREFIX || "backups/",
    };

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: "GCS 환경 변수가 설정되지 않았습니다.",
        envStatus,
        requiredEnvVars: {
          required: ["GCS_BUCKET_NAME"],
          authOptions: [
            "GCS_KEY_FILE (서비스 계정 키 파일 경로)",
            "GCS_CREDENTIALS (서비스 계정 JSON 문자열)",
            "GCS_PROJECT_ID (GCE/Cloud Run에서 자동 인증 사용 시)",
          ],
          optional: ["GCS_BACKUP_PREFIX (기본값: backups/)"],
        },
      });
    }

    // 연결 테스트
    const connectionResult = await testGCSConnection();

    return NextResponse.json({
      configured: true,
      connected: connectionResult.success,
      message: connectionResult.message,
      bucketName: connectionResult.bucketName,
      envStatus,
    });
  } catch (error) {
    console.error("GCS 연결 테스트 오류:", error);
    return handleApiError(error);
  }
}
