import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { requireRole } from "@/lib/authorization";
import { handleApiError, forbidden } from "@/lib/api-error";
import prisma from "@/lib/prisma";

const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./prisma/backups";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX_COUNT || "7", 10);
const APP_VERSION = "2.0.0";

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
 * SHA-256 체크섬 생성
 */
async function generateChecksum(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * 체크섬 파일 저장
 */
async function saveChecksum(backupPath: string, checksum: string): Promise<void> {
  const checksumPath = `${backupPath}.sha256`;
  await fs.writeFile(checksumPath, checksum);
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
    return { valid: false };
  }
}

/**
 * 메타데이터 수집
 */
async function collectMetadata(userId?: string, description?: string): Promise<Record<string, unknown>> {
  // 각 테이블의 레코드 수 조회
  const [
    users,
    parts,
    products,
    orders,
    salesOrders,
    transactions,
    inventory,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.part.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.salesOrder.count(),
    prisma.transaction.count(),
    prisma.inventory.count(),
  ]);

  return {
    appVersion: APP_VERSION,
    schemaVersion: "1.0",
    createdAt: new Date().toISOString(),
    createdBy: userId || "system",
    description: description || "",
    type: userId ? "manual" : "auto",
    recordCounts: {
      users,
      parts,
      products,
      orders,
      salesOrders,
      transactions,
      inventory,
      total: users + parts + products + orders + salesOrders + transactions + inventory,
    },
  };
}

// 백업 목록 조회 (ADMIN, MANAGER만 가능)
export async function GET() {
  try {
    // 권한 검사
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    // 백업 디렉토리 확인/생성
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    }

    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter((f) => f.endsWith(".db"))
        .map(async (fileName) => {
          const filePath = path.join(BACKUP_DIR, fileName);

          // 경로 안전성 검증
          if (!isPathSafe(filePath)) {
            return null;
          }

          const stat = await fs.stat(filePath);

          // 체크섬 검증 상태
          const checksumResult = await verifyChecksum(filePath);

          // 메타데이터 읽기
          let metadata = null;
          try {
            const metaPath = `${filePath}.meta.json`;
            const metaContent = await fs.readFile(metaPath, "utf-8");
            metadata = JSON.parse(metaContent);
          } catch {
            // 메타데이터 파일이 없을 수 있음
          }

          return {
            fileName,
            createdAt: stat.mtime.toISOString(),
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            checksumValid: checksumResult.valid,
            metadata,
          };
        })
    );

    // null 항목 필터링 후 최신순 정렬
    const validBackups = backups
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 현재 DB 정보
    const dbPath = path.join(DATA_DIR, DB_FILE);
    let currentDbInfo = null;
    try {
      const dbStat = await fs.stat(dbPath);
      currentDbInfo = {
        size: dbStat.size,
        sizeFormatted: formatBytes(dbStat.size),
        lastModified: dbStat.mtime.toISOString(),
      };
    } catch {
      // DB 파일이 없는 경우
    }

    return NextResponse.json({
      backups: validBackups,
      currentDb: currentDbInfo,
      config: {
        maxBackups: MAX_BACKUPS,
        backupDir: BACKUP_DIR,
      },
    });
  } catch (error) {
    console.error("백업 목록 조회 오류:", error);
    return handleApiError(error);
  }
}

// 수동 백업 생성 (ADMIN, MANAGER만 가능)
export async function POST(request: NextRequest) {
  try {
    // 권한 검사
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json().catch(() => ({}));
    const description = body.description || "";

    // 백업 디렉토리 확인/생성
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    }

    const dbPath = path.join(DATA_DIR, DB_FILE);

    // DB 파일 존재 확인
    try {
      await fs.access(dbPath);
    } catch {
      return NextResponse.json(
        { error: "데이터베이스 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 백업 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 경로 안전성 검증
    if (!isPathSafe(backupPath)) {
      return handleApiError(forbidden("잘못된 백업 경로입니다."));
    }

    // 백업 복사
    await fs.copyFile(dbPath, backupPath);

    // SHA-256 체크섬 생성 및 저장
    const checksum = await generateChecksum(backupPath);
    await saveChecksum(backupPath, checksum);

    // 메타데이터 수집 및 저장
    const metadata = await collectMetadata(authResult.session.user.id, description);
    const metaPath = `${backupPath}.meta.json`;
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    // 오래된 백업 정리
    await cleanupOldBackups();

    const stat = await fs.stat(backupPath);

    return NextResponse.json({
      success: true,
      message: "백업이 완료되었습니다.",
      backup: {
        fileName: backupFileName,
        createdAt: new Date().toISOString(),
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        checksum,
        metadata,
      },
    });
  } catch (error) {
    console.error("백업 생성 오류:", error);
    return handleApiError(error);
  }
}

// 오래된 백업 정리
async function cleanupOldBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter((f) => f.endsWith(".db"));

    if (backupFiles.length <= MAX_BACKUPS) return;

    // 파일 정보와 함께 정렬
    const filesWithStats = await Promise.all(
      backupFiles.map(async (fileName) => {
        const filePath = path.join(BACKUP_DIR, fileName);

        // 경로 안전성 검증
        if (!isPathSafe(filePath)) {
          return null;
        }

        const stat = await fs.stat(filePath);
        return { fileName, mtime: stat.mtime.getTime() };
      })
    );

    // null 항목 필터링 후 오래된 순으로 정렬
    const validFiles = filesWithStats
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => a.mtime - b.mtime);

    // 오래된 백업 삭제
    const toDelete = validFiles.slice(0, validFiles.length - MAX_BACKUPS);
    for (const file of toDelete) {
      const filePath = path.join(BACKUP_DIR, file.fileName);

      // 경로 안전성 재검증
      if (!isPathSafe(filePath)) continue;

      await fs.unlink(filePath);
      // 메타 파일도 삭제
      try {
        await fs.unlink(`${filePath}.meta.json`);
      } catch {
        // 메타 파일이 없을 수 있음
      }
      // 체크섬 파일도 삭제
      try {
        await fs.unlink(`${filePath}.sha256`);
      } catch {
        // 체크섬 파일이 없을 수 있음
      }
    }
  } catch (error) {
    console.error("백업 정리 오류:", error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
