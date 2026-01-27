/**
 * Backup Scheduler
 *
 * 자동 백업 스케줄링 및 관리 라이브러리
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import prisma from "./prisma";

const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./prisma/backups";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";
const APP_VERSION = "2.0.0";

export interface BackupResult {
  success: boolean;
  fileName?: string;
  fileSize?: number;
  checksum?: string;
  duration?: number;
  error?: string;
}

export interface BackupOptions {
  type?: "MANUAL" | "SCHEDULED" | "PRE_RESTORE" | "STARTUP";
  description?: string;
  createdBy?: string;
}

/**
 * SHA-256 체크섬 생성
 */
async function generateChecksum(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * 레코드 수 수집
 */
async function collectRecordCounts(): Promise<Record<string, number>> {
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
    users,
    parts,
    products,
    orders,
    salesOrders,
    transactions,
    inventory,
  };
}

/**
 * 백업 생성
 */
export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = options.type === "STARTUP" ? "startup" :
                 options.type === "SCHEDULED" ? "scheduled" :
                 options.type === "PRE_RESTORE" ? "pre_restore" : "backup";
  const backupFileName = `${prefix}_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  try {
    // 백업 디렉토리 확인/생성
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const dbPath = path.join(DATA_DIR, DB_FILE);

    // DB 파일 존재 확인
    try {
      await fs.access(dbPath);
    } catch {
      throw new Error("데이터베이스 파일을 찾을 수 없습니다.");
    }

    // 백업 복사
    await fs.copyFile(dbPath, backupPath);

    // 체크섬 생성 및 저장
    const checksum = await generateChecksum(backupPath);
    await fs.writeFile(`${backupPath}.sha256`, checksum);

    // 레코드 수 수집
    const recordCounts = await collectRecordCounts();

    // 메타데이터 저장
    const metadata = {
      appVersion: APP_VERSION,
      schemaVersion: "1.0",
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy || "system",
      description: options.description || "",
      type: options.type || "MANUAL",
      recordCounts,
    };
    await fs.writeFile(`${backupPath}.meta.json`, JSON.stringify(metadata, null, 2));

    const stat = await fs.stat(backupPath);
    const duration = Date.now() - startTime;

    // 백업 히스토리 저장
    await prisma.backupHistory.create({
      data: {
        fileName: backupFileName,
        fileSize: stat.size,
        checksum,
        backupType: options.type || "MANUAL",
        status: "COMPLETED",
        duration,
        recordCounts: JSON.stringify(recordCounts),
        appVersion: APP_VERSION,
        description: options.description,
        createdBy: options.createdBy,
      },
    });

    return {
      success: true,
      fileName: backupFileName,
      fileSize: stat.size,
      checksum,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";

    // 실패 히스토리 저장
    try {
      await prisma.backupHistory.create({
        data: {
          fileName: backupFileName,
          fileSize: 0,
          backupType: options.type || "MANUAL",
          status: "FAILED",
          duration: Date.now() - startTime,
          errorMessage,
          createdBy: options.createdBy,
        },
      });
    } catch {
      // 히스토리 저장 실패 무시
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 오래된 백업 정리
 */
export async function cleanupOldBackups(maxCount: number = 30): Promise<number> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter((f) => f.endsWith(".db"));

    if (backupFiles.length <= maxCount) return 0;

    // 파일 정보와 함께 정렬
    const filesWithStats = await Promise.all(
      backupFiles.map(async (fileName) => {
        const filePath = path.join(BACKUP_DIR, fileName);
        const stat = await fs.stat(filePath);
        return { fileName, mtime: stat.mtime.getTime() };
      })
    );

    // 오래된 순으로 정렬
    filesWithStats.sort((a, b) => a.mtime - b.mtime);

    // 오래된 백업 삭제
    const toDelete = filesWithStats.slice(0, filesWithStats.length - maxCount);
    let deletedCount = 0;

    for (const file of toDelete) {
      const filePath = path.join(BACKUP_DIR, file.fileName);

      try {
        await fs.unlink(filePath);
        deletedCount++;
      } catch {
        continue;
      }

      // 관련 파일들도 삭제
      try { await fs.unlink(`${filePath}.meta.json`); } catch {}
      try { await fs.unlink(`${filePath}.sha256`); } catch {}

      // 히스토리에서도 삭제
      try {
        await prisma.backupHistory.delete({
          where: { fileName: file.fileName },
        });
      } catch {}
    }

    return deletedCount;
  } catch (error) {
    console.error("백업 정리 오류:", error);
    return 0;
  }
}

/**
 * 백업 설정 조회
 */
export async function getBackupSettings() {
  let settings = await prisma.backupSettings.findFirst();

  if (!settings) {
    // 기본 설정 생성
    settings = await prisma.backupSettings.create({
      data: {
        autoBackupEnabled: false,
        backupFrequency: "DAILY",
        backupTime: "00:00",
        retentionDays: 30,
        maxBackupCount: 30,
      },
    });
  }

  return settings;
}

/**
 * 백업 설정 업데이트
 */
export async function updateBackupSettings(
  data: Partial<{
    autoBackupEnabled: boolean;
    backupFrequency: string;
    backupTime: string;
    retentionDays: number;
    maxBackupCount: number;
    cloudBackupEnabled: boolean;
    cloudProvider: string;
    cloudBucket: string;
    encryptionEnabled: boolean;
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
    slackWebhookUrl: string;
    emailNotification: string;
    diskThresholdGb: number;
  }>,
  updatedBy?: string
) {
  const settings = await getBackupSettings();

  return prisma.backupSettings.update({
    where: { id: settings.id },
    data: {
      ...data,
      updatedBy,
    },
  });
}

/**
 * 스케줄 생성
 */
export async function createSchedule(
  name: string,
  cronExpression: string,
  options: {
    retentionCount?: number;
    createdBy?: string;
  } = {}
) {
  // 다음 실행 시간 계산 (간단한 구현)
  const nextRunAt = calculateNextRun(cronExpression);

  return prisma.backupSchedule.create({
    data: {
      name,
      cronExpression,
      retentionCount: options.retentionCount || 30,
      nextRunAt,
      createdBy: options.createdBy,
    },
  });
}

/**
 * 스케줄 업데이트
 */
export async function updateSchedule(
  id: number,
  data: Partial<{
    name: string;
    cronExpression: string;
    retentionCount: number;
    isActive: boolean;
  }>
) {
  const updateData: Record<string, unknown> = { ...data };

  if (data.cronExpression) {
    updateData.nextRunAt = calculateNextRun(data.cronExpression);
  }

  return prisma.backupSchedule.update({
    where: { id },
    data: updateData,
  });
}

/**
 * 스케줄 삭제
 */
export async function deleteSchedule(id: number) {
  return prisma.backupSchedule.delete({
    where: { id },
  });
}

/**
 * 활성 스케줄 조회
 */
export async function getActiveSchedules() {
  return prisma.backupSchedule.findMany({
    where: { isActive: true },
    orderBy: { nextRunAt: "asc" },
  });
}

/**
 * 실행 대기 중인 스케줄 조회
 */
export async function getPendingSchedules() {
  return prisma.backupSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: {
        lte: new Date(),
      },
    },
  });
}

/**
 * 스케줄 실행 후 업데이트
 */
export async function markScheduleRun(
  id: number,
  success: boolean,
  error?: string
) {
  const schedule = await prisma.backupSchedule.findUnique({ where: { id } });
  if (!schedule) return;

  const nextRunAt = calculateNextRun(schedule.cronExpression);

  return prisma.backupSchedule.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt,
      lastStatus: success ? "SUCCESS" : "FAILED",
      lastError: error || null,
    },
  });
}

/**
 * 다음 실행 시간 계산 (간단한 cron 파싱)
 */
function calculateNextRun(cronExpression: string): Date {
  const now = new Date();
  const parts = cronExpression.split(" ");

  if (parts.length !== 5) {
    // 잘못된 cron 표현식이면 1시간 후로 설정
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  const [minute, hour] = parts;

  // 단순 구현: 매일 지정된 시간에 실행
  const targetHour = hour === "*" ? now.getHours() : parseInt(hour, 10);
  const targetMinute = minute === "*" ? 0 : parseInt(minute, 10);

  const nextRun = new Date(now);
  nextRun.setHours(targetHour, targetMinute, 0, 0);

  // 이미 지났으면 다음 날로
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}

/**
 * 백업 히스토리 조회
 */
export async function getBackupHistory(limit: number = 20) {
  return prisma.backupHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * 디스크 사용량 확인
 */
export async function checkDiskUsage(): Promise<{
  backup: {
    totalSize: number;
    totalSizeFormatted: string;
    fileCount: number;
    oldestBackup: { name: string; date: string } | null;
    newestBackup: { name: string; date: string } | null;
  };
  data: {
    totalSize: number;
    totalSizeFormatted: string;
  };
  threshold: {
    limitGb: number;
    isOverThreshold: boolean;
    usagePercent: number;
  };
}> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter((f) => f.endsWith(".db"));

    let totalBackupSize = 0;
    let oldestBackup: { name: string; date: Date } | null = null;
    let newestBackup: { name: string; date: Date } | null = null;

    for (const file of backupFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(filePath);
      totalBackupSize += stat.size;

      if (!oldestBackup || stat.mtime < oldestBackup.date) {
        oldestBackup = { name: file, date: stat.mtime };
      }
      if (!newestBackup || stat.mtime > newestBackup.date) {
        newestBackup = { name: file, date: stat.mtime };
      }
    }

    // DB 파일 크기
    let dbSize = 0;
    try {
      const dbPath = path.join(DATA_DIR, DB_FILE);
      const dbStat = await fs.stat(dbPath);
      dbSize = dbStat.size;
    } catch {
      // DB 파일 없음
    }

    // 설정에서 임계값 가져오기
    let thresholdGb = 5; // 기본값
    try {
      const settings = await prisma.backupSettings.findFirst();
      if (settings?.diskThresholdGb) {
        thresholdGb = settings.diskThresholdGb;
      }
    } catch {
      // 설정 조회 실패 시 기본값 사용
    }

    const thresholdBytes = thresholdGb * 1024 * 1024 * 1024;
    const usagePercent = thresholdBytes > 0 ? Math.round((totalBackupSize / thresholdBytes) * 100) : 0;

    return {
      backup: {
        totalSize: totalBackupSize,
        totalSizeFormatted: formatBytes(totalBackupSize),
        fileCount: backupFiles.length,
        oldestBackup: oldestBackup ? { name: oldestBackup.name, date: oldestBackup.date.toISOString() } : null,
        newestBackup: newestBackup ? { name: newestBackup.name, date: newestBackup.date.toISOString() } : null,
      },
      data: {
        totalSize: dbSize,
        totalSizeFormatted: formatBytes(dbSize),
      },
      threshold: {
        limitGb: thresholdGb,
        isOverThreshold: totalBackupSize > thresholdBytes,
        usagePercent,
      },
    };
  } catch {
    return {
      backup: {
        totalSize: 0,
        totalSizeFormatted: "0 Bytes",
        fileCount: 0,
        oldestBackup: null,
        newestBackup: null,
      },
      data: {
        totalSize: 0,
        totalSizeFormatted: "0 Bytes",
      },
      threshold: {
        limitGb: 5,
        isOverThreshold: false,
        usagePercent: 0,
      },
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
