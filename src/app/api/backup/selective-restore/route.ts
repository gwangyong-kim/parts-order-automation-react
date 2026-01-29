import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireRole } from "@/lib/authorization";
import { handleApiError, forbidden, badRequest } from "@/lib/api-error";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3");

const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./backups";
const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";

// 복원 가능한 테이블 목록
const RESTORABLE_TABLES = [
  "users",
  "parts",
  "products",
  "suppliers",
  "categories",
  "orders",
  "order_items",
  "sales_orders",
  "sales_order_items",
  "inventory",
  "transactions",
  "audit_records",
  "audit_items",
  "bom_items",
];

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

// 백업 파일의 테이블 목록 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");

    if (!fileName) {
      return handleApiError(badRequest("백업 파일명이 필요합니다."));
    }

    if (!isFileNameSafe(fileName)) {
      return handleApiError(forbidden("잘못된 파일명입니다."));
    }

    const backupPath = path.join(BACKUP_DIR, fileName);

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

    // 백업 DB 열기
    const backupDb = new Database(backupPath, { readonly: true });

    try {
      // 테이블 목록 조회
      const tables = backupDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'")
        .all() as { name: string }[];

      // 각 테이블의 레코드 수 조회
      const tableInfo = tables.map((table) => {
        const countResult = backupDb.prepare(`SELECT COUNT(*) as count FROM "${table.name}"`).get() as { count: number };
        return {
          name: table.name,
          count: countResult.count,
          restorable: RESTORABLE_TABLES.includes(table.name),
        };
      });

      return NextResponse.json({
        tables: tableInfo,
        restorableTables: RESTORABLE_TABLES,
      });
    } finally {
      backupDb.close();
    }
  } catch (error) {
    console.error("테이블 목록 조회 오류:", error);
    return handleApiError(error);
  }
}

// 선택적 테이블 복원
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN"]);
    if ("error" in authResult) {
      return handleApiError(authResult.error);
    }

    const body = await request.json();
    const { fileName, tables, mode = "merge" } = body; // mode: "merge" or "replace"

    if (!fileName || !tables || !Array.isArray(tables) || tables.length === 0) {
      return handleApiError(badRequest("백업 파일명과 복원할 테이블 목록이 필요합니다."));
    }

    if (!isFileNameSafe(fileName)) {
      return handleApiError(forbidden("잘못된 파일명입니다."));
    }

    // 허용된 테이블만 복원
    const invalidTables = tables.filter((t: string) => !RESTORABLE_TABLES.includes(t));
    if (invalidTables.length > 0) {
      return handleApiError(badRequest(`복원할 수 없는 테이블: ${invalidTables.join(", ")}`));
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

    // 백업 DB와 현재 DB 열기
    const backupDb = new Database(backupPath, { readonly: true });
    const currentDb = new Database(dbPath);

    const results: Record<string, { before: number; after: number; action: string }> = {};

    try {
      currentDb.exec("BEGIN TRANSACTION");

      for (const tableName of tables) {
        // 현재 레코드 수
        const beforeCount = (currentDb.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number }).count;

        if (mode === "replace") {
          // 기존 데이터 삭제
          currentDb.prepare(`DELETE FROM "${tableName}"`).run();
        }

        // 백업에서 데이터 가져오기
        const backupData = backupDb.prepare(`SELECT * FROM "${tableName}"`).all();

        if (backupData.length > 0) {
          // 컬럼 목록 가져오기
          const columns = Object.keys(backupData[0] as Record<string, unknown>);
          const placeholders = columns.map(() => "?").join(", ");

          const insertStmt = currentDb.prepare(
            mode === "merge"
              ? `INSERT OR REPLACE INTO "${tableName}" (${columns.join(", ")}) VALUES (${placeholders})`
              : `INSERT INTO "${tableName}" (${columns.join(", ")}) VALUES (${placeholders})`
          );

          for (const row of backupData) {
            const values = columns.map((col) => (row as Record<string, unknown>)[col]);
            insertStmt.run(...values);
          }
        }

        // 복원 후 레코드 수
        const afterCount = (currentDb.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number }).count;

        results[tableName] = {
          before: beforeCount,
          after: afterCount,
          action: mode === "replace" ? "replaced" : "merged",
        };
      }

      currentDb.exec("COMMIT");

      return NextResponse.json({
        success: true,
        message: "선택한 테이블이 복원되었습니다.",
        results,
      });
    } catch (error) {
      currentDb.exec("ROLLBACK");
      throw error;
    } finally {
      backupDb.close();
      currentDb.close();
    }
  } catch (error) {
    console.error("선택적 복원 오류:", error);
    return handleApiError(error);
  }
}
