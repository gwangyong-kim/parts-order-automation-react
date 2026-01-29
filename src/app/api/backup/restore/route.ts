import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { requireRole } from "@/lib/authorization";
import { handleApiError, forbidden, badRequest } from "@/lib/api-error";

const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./backups";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";

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

/**
 * SHA-256 체크섬 생성
 */
async function generateChecksum(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * 체크섬 검증
 */
async function verifyChecksum(backupPath: string): Promise<{ valid: boolean; expected?: string; actual?: string }> {
  const checksumPath = `${backupPath}.sha256`;
  try {
    const expectedChecksum = (await fs.readFile(checksumPath, "utf-8")).trim();
    const actualChecksum = await generateChecksum(backupPath);
    return {
      valid: expectedChecksum === actualChecksum,
      expected: expectedChecksum,
      actual: actualChecksum,
    };
  } catch {
    // 체크섬 파일이 없으면 검증 건너뛰기 (레거시 백업 호환)
    return { valid: true };
  }
}

// 백업에서 복구 (ADMIN만 가능 - 데이터 전체 변경이므로 더 엄격한 권한)
export async function POST(request: NextRequest) {
  try {
    // 권한 검사 - 복원은 ADMIN만 가능
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();
    const { fileName, skipChecksumVerification } = body;

    if (!fileName) {
      return handleApiError(badRequest("복구할 백업 파일명이 필요합니다."));
    }

    // 파일명 안전성 검증
    if (!isFileNameSafe(fileName)) {
      return handleApiError(forbidden("잘못된 파일명입니다."));
    }

    const backupPath = path.join(BACKUP_DIR, fileName);
    const dbPath = path.join(DATA_DIR, DB_FILE);

    // 경로 안전성 검증
    if (!isPathSafe(backupPath)) {
      return handleApiError(forbidden("잘못된 백업 경로입니다."));
    }

    // 백업 파일 존재 확인
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 체크섬 검증 (skipChecksumVerification이 true가 아닌 경우)
    if (!skipChecksumVerification) {
      const checksumResult = await verifyChecksum(backupPath);
      if (!checksumResult.valid) {
        return NextResponse.json(
          {
            error: "백업 파일 무결성 검증에 실패했습니다. 파일이 손상되었을 수 있습니다.",
            details: {
              expected: checksumResult.expected,
              actual: checksumResult.actual,
            },
          },
          { status: 400 }
        );
      }
    }

    // 현재 DB를 복구 전 백업 (복구 실패 시 롤백용)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const preRestoreBackupName = `pre_restore_${timestamp}.db`;
    const preRestoreBackupPath = path.join(BACKUP_DIR, preRestoreBackupName);

    try {
      await fs.copyFile(dbPath, preRestoreBackupPath);

      // 체크섬 생성
      const checksum = await generateChecksum(preRestoreBackupPath);
      await fs.writeFile(`${preRestoreBackupPath}.sha256`, checksum);

      // 메타데이터 생성
      await fs.writeFile(
        `${preRestoreBackupPath}.meta.json`,
        JSON.stringify({
          type: "pre_restore",
          createdAt: new Date().toISOString(),
          createdBy: authResult.session.user.id,
          restoredFrom: fileName,
          description: `복원 전 자동 백업 (복원 대상: ${fileName})`,
        }, null, 2)
      );
    } catch {
      // 현재 DB가 없을 수 있음 (첫 실행 등)
    }

    try {
      // 백업 파일을 현재 DB로 복사
      await fs.copyFile(backupPath, dbPath);

      return NextResponse.json({
        success: true,
        message: "데이터가 복구되었습니다. 페이지를 새로고침 해주세요.",
        restoredFrom: fileName,
        preRestoreBackup: preRestoreBackupName,
      });
    } catch (restoreError) {
      // 복구 실패 시 롤백 시도
      try {
        await fs.copyFile(preRestoreBackupPath, dbPath);
      } catch {
        // 롤백 실패
      }

      throw restoreError;
    }
  } catch (error) {
    console.error("복구 오류:", error);
    return handleApiError(error);
  }
}
