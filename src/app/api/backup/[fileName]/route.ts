import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireRole } from "@/lib/authorization";
import { handleApiError, forbidden } from "@/lib/api-error";

const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./backups";

/**
 * 경로 검증: 백업 디렉토리 내의 경로인지 확인
 */
function isPathSafe(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);
  const resolvedBackupDir = path.resolve(BACKUP_DIR);
  const resolvedFilePath = path.resolve(normalizedPath);
  return resolvedFilePath.startsWith(resolvedBackupDir);
}

/**
 * 파일명 검증: 안전한 파일명인지 확인
 */
function isFileNameSafe(fileName: string): boolean {
  // 경로 구분자나 상위 디렉토리 참조 차단
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return false;
  }
  // .db 확장자만 허용
  if (!fileName.endsWith(".db")) {
    return false;
  }
  // 허용된 문자만 사용 (영숫자, 하이픈, 언더스코어, 점)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(fileName)) {
    return false;
  }
  return true;
}

// 백업 파일 다운로드 (ADMIN, MANAGER만 가능)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    // 권한 검사
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { fileName } = await params;

    // 파일명 안전성 검증
    if (!isFileNameSafe(fileName)) {
      return handleApiError(forbidden("잘못된 파일명입니다."));
    }

    const backupPath = path.join(BACKUP_DIR, fileName);

    // 경로 안전성 검증
    if (!isPathSafe(backupPath)) {
      return handleApiError(forbidden("잘못된 백업 경로입니다."));
    }

    // 파일 존재 확인
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(backupPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error("백업 다운로드 오류:", error);
    return handleApiError(error);
  }
}

// 백업 삭제 (ADMIN만 가능)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    // 권한 검사 - 삭제는 ADMIN만 가능
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { fileName } = await params;

    // 파일명 안전성 검증
    if (!isFileNameSafe(fileName)) {
      return handleApiError(forbidden("잘못된 파일명입니다."));
    }

    const backupPath = path.join(BACKUP_DIR, fileName);

    // 경로 안전성 검증
    if (!isPathSafe(backupPath)) {
      return handleApiError(forbidden("잘못된 백업 경로입니다."));
    }

    // 파일 존재 확인
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 백업 파일 삭제
    await fs.unlink(backupPath);

    // 메타 파일도 삭제
    try {
      await fs.unlink(`${backupPath}.meta.json`);
    } catch {
      // 메타 파일이 없을 수 있음
    }

    // 체크섬 파일도 삭제
    try {
      await fs.unlink(`${backupPath}.sha256`);
    } catch {
      // 체크섬 파일이 없을 수 있음
    }

    return NextResponse.json({
      success: true,
      message: "백업이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("백업 삭제 오류:", error);
    return handleApiError(error);
  }
}
