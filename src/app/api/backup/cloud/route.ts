import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";
import {
  isR2Configured,
  testR2Connection,
  listR2Backups,
  getR2Usage,
} from "@/lib/r2-storage";

// R2 백업 목록 및 상태 조회 (ADMIN, MANAGER)
export async function GET() {
  try {
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    // R2 설정 여부 확인
    if (!isR2Configured()) {
      return NextResponse.json({
        configured: false,
        message: "R2가 설정되지 않았습니다. 환경 변수를 확인하세요.",
        requiredEnvVars: [
          "R2_ACCOUNT_ID",
          "R2_ACCESS_KEY_ID",
          "R2_SECRET_ACCESS_KEY",
          "R2_BUCKET_NAME",
        ],
      });
    }

    // 연결 테스트
    const connectionTest = await testR2Connection();
    if (!connectionTest.success) {
      return NextResponse.json({
        configured: true,
        connected: false,
        message: connectionTest.message,
      });
    }

    // 백업 목록 및 사용량 조회
    const [backups, usage] = await Promise.all([
      listR2Backups(),
      getR2Usage(),
    ]);

    return NextResponse.json({
      configured: true,
      connected: true,
      bucketName: connectionTest.bucketName,
      backups,
      usage,
    });
  } catch (error) {
    console.error("R2 백업 조회 오류:", error);
    return handleApiError(error);
  }
}
