import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireRole } from "@/lib/authorization";
import { handleApiError, notFound } from "@/lib/api-error";
import {
  isGCSConfigured,
  downloadFromGCS,
  deleteFromGCS,
} from "@/lib/gcs-storage";
import { createBackup } from "@/lib/backup-scheduler";

const DATA_DIR =
  process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const DB_FILE =
  process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";

// GCS 백업 다운로드 (로컬로 복원)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { fileName } = await params;

    if (!isGCSConfigured()) {
      return NextResponse.json(
        { error: "GCS가 설정되지 않았습니다." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === "restore") {
      // 복원 전 현재 DB 백업
      const preRestoreBackup = await createBackup({
        type: "PRE_RESTORE",
        description: `GCS 복원 전 자동 백업 (복원 파일: ${fileName})`,
        createdBy: authResult.session.user.id,
      });

      if (!preRestoreBackup.success) {
        return NextResponse.json(
          { error: "복원 전 백업 생성 실패" },
          { status: 500 }
        );
      }

      // GCS에서 다운로드
      const tempPath = path.join(DATA_DIR, `temp_restore_${Date.now()}.db`);
      const downloadResult = await downloadFromGCS(fileName, tempPath);

      if (!downloadResult.success) {
        return NextResponse.json(
          { error: `GCS 다운로드 실패: ${downloadResult.error}` },
          { status: 500 }
        );
      }

      // 현재 DB를 새 파일로 교체
      const dbPath = path.join(DATA_DIR, DB_FILE);

      try {
        // 기존 DB 파일 삭제
        await fs.unlink(dbPath);
        // 다운로드한 파일로 교체
        await fs.rename(tempPath, dbPath);
      } catch (replaceError) {
        // 실패 시 임시 파일 정리
        await fs.unlink(tempPath).catch(() => {});
        throw replaceError;
      }

      return NextResponse.json({
        success: true,
        message: "GCS에서 백업이 복원되었습니다.",
        preRestoreBackup: preRestoreBackup.fileName,
        restoredFrom: fileName,
      });
    } else if (action === "download") {
      // 로컬에 다운로드만 (복원하지 않음)
      const downloadDir =
        process.env.NODE_ENV === "production"
          ? "/app/data/downloads"
          : "./prisma/downloads";
      await fs.mkdir(downloadDir, { recursive: true });

      const localPath = path.join(downloadDir, fileName);
      const downloadResult = await downloadFromGCS(fileName, localPath);

      if (!downloadResult.success) {
        return NextResponse.json(
          { error: `다운로드 실패: ${downloadResult.error}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "백업 파일이 로컬에 다운로드되었습니다.",
        localPath: downloadResult.localPath,
      });
    }

    return NextResponse.json(
      { error: "action 파라미터가 필요합니다. (restore 또는 download)" },
      { status: 400 }
    );
  } catch (error) {
    console.error("GCS 백업 처리 오류:", error);
    return handleApiError(error);
  }
}

// GCS 백업 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { fileName } = await params;

    if (!isGCSConfigured()) {
      return NextResponse.json(
        { error: "GCS가 설정되지 않았습니다." },
        { status: 400 }
      );
    }

    const result = await deleteFromGCS(fileName);

    if (!result.success) {
      return handleApiError(notFound(`파일을 찾을 수 없습니다: ${fileName}`));
    }

    return NextResponse.json({
      success: true,
      message: "GCS 백업이 삭제되었습니다.",
      fileName,
    });
  } catch (error) {
    console.error("GCS 백업 삭제 오류:", error);
    return handleApiError(error);
  }
}
