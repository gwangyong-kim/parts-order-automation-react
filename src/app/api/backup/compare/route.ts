import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireRole } from "@/lib/authorization";
import { handleApiError, forbidden, badRequest } from "@/lib/api-error";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const Database: any = require("better-sqlite3");

const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./backups";
const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";

function isPathSafe(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);
  const resolvedBackupDir = path.resolve(BACKUP_DIR);
  const resolvedFilePath = path.resolve(normalizedPath);
  return resolvedFilePath.startsWith(resolvedBackupDir);
}

function isFileNameSafe(fileName: string): boolean {
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return false;
  }
  if (!fileName.endsWith(".db")) {
    return false;
  }
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(fileName)) {
    return false;
  }
  return true;
}

// 현재 DB와 백업 비교
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "MANAGER"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    const tableName = searchParams.get("table");

    if (!fileName) {
      return handleApiError(badRequest("백업 파일명이 필요합니다."));
    }

    if (!isFileNameSafe(fileName)) {
      return handleApiError(forbidden("잘못된 파일명입니다."));
    }

    const backupPath = path.join(BACKUP_DIR, fileName);
    const dbPath = path.join(DATA_DIR, DB_FILE);

    if (!isPathSafe(backupPath)) {
      return handleApiError(forbidden("잘못된 백업 경로입니다."));
    }

    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const backupDb = new Database(backupPath, { readonly: true });
    const currentDb = new Database(dbPath, { readonly: true });

    try {
      // 테이블 목록 조회
      const backupTables = backupDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'")
        .all() as { name: string }[];

      const currentTables = currentDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'")
        .all() as { name: string }[];

      const backupTableNames = new Set(backupTables.map((t) => t.name));
      const currentTableNames = new Set(currentTables.map((t) => t.name));

      // 테이블 비교
      const tableComparison: Record<string, {
        backupCount: number;
        currentCount: number;
        difference: number;
        status: string;
      }> = {};

      // 모든 테이블 병합
      const allTables = new Set([...backupTableNames, ...currentTableNames]);

      for (const table of allTables) {
        const inBackup = backupTableNames.has(table);
        const inCurrent = currentTableNames.has(table);

        let backupCount = 0;
        let currentCount = 0;

        if (inBackup) {
          backupCount = (backupDb.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number }).count;
        }

        if (inCurrent) {
          currentCount = (currentDb.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number }).count;
        }

        let status = "unchanged";
        if (!inBackup && inCurrent) {
          status = "added"; // 현재 DB에만 있음
        } else if (inBackup && !inCurrent) {
          status = "removed"; // 백업에만 있음
        } else if (backupCount !== currentCount) {
          status = "modified";
        }

        tableComparison[table] = {
          backupCount,
          currentCount,
          difference: currentCount - backupCount,
          status,
        };
      }

      // 특정 테이블의 상세 비교 (요청 시)
      let detailedComparison = null;
      if (tableName && backupTableNames.has(tableName) && currentTableNames.has(tableName)) {
        detailedComparison = await compareTableDetails(backupDb, currentDb, tableName);
      }

      return NextResponse.json({
        tables: tableComparison,
        summary: {
          totalTables: allTables.size,
          addedTables: Object.values(tableComparison).filter((t) => t.status === "added").length,
          removedTables: Object.values(tableComparison).filter((t) => t.status === "removed").length,
          modifiedTables: Object.values(tableComparison).filter((t) => t.status === "modified").length,
          unchangedTables: Object.values(tableComparison).filter((t) => t.status === "unchanged").length,
        },
        detailed: detailedComparison,
      });
    } finally {
      backupDb.close();
      currentDb.close();
    }
  } catch (error) {
    console.error("비교 오류:", error);
    return handleApiError(error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function compareTableDetails(
  backupDb: any,
  currentDb: any,
  tableName: string
): Promise<{
  added: number;
  removed: number;
  modified: number;
  samples: {
    added: unknown[];
    removed: unknown[];
    modified: { backup: unknown; current: unknown }[];
  };
}> {
  // Primary key 컬럼 찾기 (기본적으로 'id' 사용)
  const pkColumn = "id";

  // 백업 데이터
  const backupData = backupDb.prepare(`SELECT * FROM "${tableName}" ORDER BY ${pkColumn}`).all() as Record<string, unknown>[];
  const backupMap = new Map(backupData.map((row) => [row[pkColumn], row]));

  // 현재 데이터
  const currentData = currentDb.prepare(`SELECT * FROM "${tableName}" ORDER BY ${pkColumn}`).all() as Record<string, unknown>[];
  const currentMap = new Map(currentData.map((row) => [row[pkColumn], row]));

  const added: unknown[] = [];
  const removed: unknown[] = [];
  const modified: { backup: unknown; current: unknown }[] = [];

  // 추가된 레코드 (현재에만 있음)
  for (const [id, current] of currentMap) {
    if (!backupMap.has(id)) {
      added.push(current);
    }
  }

  // 삭제된 레코드 (백업에만 있음)
  for (const [id, backup] of backupMap) {
    if (!currentMap.has(id)) {
      removed.push(backup);
    }
  }

  // 수정된 레코드
  for (const [id, current] of currentMap) {
    const backup = backupMap.get(id);
    if (backup) {
      // 간단한 비교 (JSON 직렬화)
      if (JSON.stringify(backup) !== JSON.stringify(current)) {
        modified.push({ backup, current });
      }
    }
  }

  return {
    added: added.length,
    removed: removed.length,
    modified: modified.length,
    samples: {
      added: added.slice(0, 5), // 샘플 5개
      removed: removed.slice(0, 5),
      modified: modified.slice(0, 5),
    },
  };
}
