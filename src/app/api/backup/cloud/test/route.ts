import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import { isR2Configured, testR2Connection } from "@/lib/r2-storage";

// R2 연결 테스트 (ADMIN)
export async function GET() {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    // 설정 확인
    const configured = isR2Configured();
    const envStatus = {
      R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
      R2_BACKUP_PREFIX: process.env.R2_BACKUP_PREFIX || "backups/",
    };

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: "R2 환경 변수가 설정되지 않았습니다.",
        envStatus,
        requiredEnvVars: {
          required: [
            "R2_ACCOUNT_ID (Cloudflare 계정 ID)",
            "R2_ACCESS_KEY_ID (R2 API 토큰 Access Key)",
            "R2_SECRET_ACCESS_KEY (R2 API 토큰 Secret Key)",
            "R2_BUCKET_NAME (R2 버킷 이름)",
          ],
          optional: ["R2_BACKUP_PREFIX (기본값: backups/)"],
        },
      });
    }

    // 연결 테스트
    const connectionResult = await testR2Connection();

    return NextResponse.json({
      configured: true,
      connected: connectionResult.success,
      message: connectionResult.message,
      bucketName: connectionResult.bucketName,
      envStatus,
    });
  } catch (error) {
    console.error("R2 연결 테스트 오류:", error);
    return handleApiError(error);
  }
}
