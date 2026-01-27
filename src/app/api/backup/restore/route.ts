import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.NODE_ENV === "production" ? "/app/data" : "./prisma";
const BACKUP_DIR = process.env.NODE_ENV === "production" ? "/app/data/backups" : "./prisma/backups";
const DB_FILE = process.env.NODE_ENV === "production" ? "partsync.db" : "dev.db";

// 백업에서 복구
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: "복구할 백업 파일명이 필요합니다." },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, fileName);
    const dbPath = path.join(DATA_DIR, DB_FILE);

    // 백업 파일 존재 확인
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: "백업 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 현재 DB를 임시 백업 (복구 실패 시 롤백용)
    const tempBackupPath = path.join(DATA_DIR, `${DB_FILE}.temp`);
    try {
      await fs.copyFile(dbPath, tempBackupPath);
    } catch {
      // 현재 DB가 없을 수 있음 (첫 실행 등)
    }

    try {
      // 백업 파일을 현재 DB로 복사
      await fs.copyFile(backupPath, dbPath);

      // 임시 백업 삭제
      try {
        await fs.unlink(tempBackupPath);
      } catch {
        // 무시
      }

      return NextResponse.json({
        success: true,
        message: "데이터가 복구되었습니다. 페이지를 새로고침 해주세요.",
        restoredFrom: fileName,
      });
    } catch (restoreError) {
      // 복구 실패 시 롤백
      try {
        await fs.copyFile(tempBackupPath, dbPath);
        await fs.unlink(tempBackupPath);
      } catch {
        // 롤백 실패
      }

      throw restoreError;
    }
  } catch (error) {
    console.error("복구 오류:", error);
    return NextResponse.json(
      { error: "데이터 복구에 실패했습니다." },
      { status: 500 }
    );
  }
}
