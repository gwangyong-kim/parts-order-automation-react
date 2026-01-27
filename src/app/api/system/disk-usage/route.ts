import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireRole } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./prisma/backups";
const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const DISK_THRESHOLD_GB = parseInt(process.env.BACKUP_DISK_THRESHOLD_GB || "5", 10);

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);

      if (file.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        const stat = await fs.stat(filePath);
        totalSize += stat.size;
      }
    }
  } catch {
    // 디렉토리가 없거나 접근 불가
  }

  return totalSize;
}

export async function GET() {
  try {
    // 권한 검사
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    // 백업 디렉토리 확인
    try {
      await fs.access(BACKUP_DIR);
    } catch {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
    }

    // 백업 파일 목록 및 크기 수집
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter((f) => f.endsWith(".db"));

    let totalBackupSize = 0;
    let oldestBackup: { name: string; mtime: Date } | null = null;
    let newestBackup: { name: string; mtime: Date } | null = null;

    for (const file of backupFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(filePath);
      totalBackupSize += stat.size;

      if (!oldestBackup || stat.mtime < oldestBackup.mtime) {
        oldestBackup = { name: file, mtime: stat.mtime };
      }
      if (!newestBackup || stat.mtime > newestBackup.mtime) {
        newestBackup = { name: file, mtime: stat.mtime };
      }
    }

    // 관련 파일들(.meta.json, .sha256) 크기도 포함
    const metaFiles = files.filter((f) => f.endsWith(".meta.json") || f.endsWith(".sha256"));
    for (const file of metaFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      try {
        const stat = await fs.stat(filePath);
        totalBackupSize += stat.size;
      } catch {
        // 파일이 없을 수 있음
      }
    }

    // 데이터 디렉토리 크기
    const dataSize = await getDirectorySize(DATA_DIR);

    // 임계값 확인
    const thresholdBytes = DISK_THRESHOLD_GB * 1024 * 1024 * 1024;
    const isOverThreshold = totalBackupSize > thresholdBytes;

    return NextResponse.json({
      backup: {
        totalSize: totalBackupSize,
        totalSizeFormatted: formatBytes(totalBackupSize),
        fileCount: backupFiles.length,
        oldestBackup: oldestBackup
          ? { name: oldestBackup.name, date: oldestBackup.mtime.toISOString() }
          : null,
        newestBackup: newestBackup
          ? { name: newestBackup.name, date: newestBackup.mtime.toISOString() }
          : null,
      },
      data: {
        totalSize: dataSize,
        totalSizeFormatted: formatBytes(dataSize),
      },
      threshold: {
        limitGb: DISK_THRESHOLD_GB,
        limitBytes: thresholdBytes,
        limitFormatted: formatBytes(thresholdBytes),
        isOverThreshold,
        usagePercent: thresholdBytes > 0 ? Math.round((totalBackupSize / thresholdBytes) * 100) : 0,
      },
      combined: {
        totalSize: totalBackupSize + dataSize,
        totalSizeFormatted: formatBytes(totalBackupSize + dataSize),
      },
    });
  } catch (error) {
    console.error("디스크 사용량 조회 오류:", error);
    return handleApiError(error);
  }
}
